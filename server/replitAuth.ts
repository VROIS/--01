import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // OAuth 리다이렉트 시 쿠키 유지
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  // ✅ 세션 직렬화: OAuth는 ID만, Replit Auth는 전체 객체 저장
  passport.serializeUser((user: any, cb) => {
    try {
      // Google/Kakao OAuth: ID와 provider만 저장 (토큰 불필요)
      if (user.provider === 'google' || user.provider === 'kakao') {
        console.log('✅ [Serialize] OAuth 사용자:', user.id);
        return cb(null, { id: user.id, provider: user.provider });
      }
      // Replit Auth: 전체 객체 저장 (claims, tokens 포함 - DB에 없음)
      if (user.claims?.sub) {
        console.log('✅ [Serialize] Replit 사용자 (전체 객체 저장)');
        return cb(null, { type: 'replit', data: user });
      }
      console.error('❌ [Serialize] 알 수 없는 사용자 형식:', user);
      cb(new Error('Unknown user type'));
    } catch (error) {
      console.error('❌ [Serialize] 오류:', error);
      cb(error);
    }
  });

  // ✅ 세션 역직렬화: OAuth는 DB 조회, Replit Auth는 객체 복원
  passport.deserializeUser(async (serialized: any, cb) => {
    try {
      // Replit Auth: 전체 객체 복원 (claims, tokens DB에 없음)
      if (serialized.type === 'replit') {
        console.log('✅ [Deserialize] Replit 사용자 복원');
        return cb(null, serialized.data);
      }
      
      // Google/Kakao OAuth: DB에서 조회
      if (serialized.provider === 'google' || serialized.provider === 'kakao') {
        console.log('🔍 [Deserialize] OAuth 사용자 조회:', serialized.id);
        const user = await storage.getUser(serialized.id);
        
        if (!user) {
          console.error('❌ [Deserialize] 사용자 없음:', serialized.id);
          return cb(new Error('User not found'));
        }
        
        console.log('✅ [Deserialize] OAuth 사용자 복원:', user.id);
        return cb(null, {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          profileImageUrl: user.profileImageUrl,
          provider: user.provider
        });
      }
      
      console.error('❌ [Deserialize] 알 수 없는 직렬화 형식:', serialized);
      cb(new Error('Unknown serialized user type'));
    } catch (error) {
      console.error('❌ [Deserialize] 오류:', error);
      cb(error);
    }
  });

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  const user = req.user as any;

  // 📊 [디버깅] 테스트 환경 로그
  if (process.env.NODE_ENV === 'development') {
    console.log('🔐 [인증체크]', {
      isAuthenticated: req.isAuthenticated(),
      userExists: !!user,
      hasExpiresAt: !!user?.expires_at,
      hasRefreshToken: !!user?.refresh_token,
      userSub: user?.claims?.sub,
      userId: user?.id,
      provider: user?.provider
    });
  }

  if (!req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  // ✅ Google/Kakao OAuth 사용자는 expires_at이 없음 - 바로 허용
  if (user.provider === 'google' || user.provider === 'kakao') {
    console.log(`✅ [OAuth ${user.provider}] 인증 완료, 세션 유효`);
    return next();
  }

  // 🔐 Replit Auth 사용자는 토큰 만료 체크
  if (!user.expires_at) {
    console.log('⚠️ [Replit Auth] expires_at이 없지만 인증된 사용자로 진행');
    return next();
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};
