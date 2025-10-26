import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Express } from "express";
import { storage } from "./storage";

export async function setupGoogleAuth(app: Express) {
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  if (!googleClientId || !googleClientSecret) {
    console.warn('⚠️  구글 OAuth 환경변수가 설정되지 않았습니다. 구글 로그인을 사용하려면 GOOGLE_CLIENT_ID와 GOOGLE_CLIENT_SECRET을 설정하세요.');
    
    app.get("/api/auth/google", (req, res) => {
      res.status(503).json({ 
        error: "구글 로그인이 아직 설정되지 않았습니다. 관리자에게 문의하세요." 
      });
    });
    
    app.get("/api/auth/google/callback", (req, res) => {
      res.status(503).json({ 
        error: "구글 로그인이 아직 설정되지 않았습니다." 
      });
    });
    
    return;
  }

  const domains = process.env.REPLIT_DOMAINS?.split(",") || ['localhost:5000'];
  const domain = domains[0];
  const protocol = domain.includes('replit.dev') || domain.includes('replit.app') ? 'https' : 'http';
  const callbackURL = `${protocol}://${domain}/api/auth/google/callback`;
  
  console.log('🔐 Google OAuth Callback URL:', callbackURL);

  passport.use(
    new GoogleStrategy(
      {
        clientID: googleClientId,
        clientSecret: googleClientSecret,
        callbackURL: callbackURL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          const firstName = profile.name?.givenName || '';
          const lastName = profile.name?.familyName || '';
          const profileImageUrl = profile.photos?.[0]?.value || '';
          
          const userId = `google_${profile.id}`;

          await storage.upsertUser({
            id: userId,
            email: email,
            firstName: firstName,
            lastName: lastName,
            profileImageUrl: profileImageUrl,
            provider: 'google',
          });

          const user = {
            id: userId,
            email: email,
            firstName: firstName,
            lastName: lastName,
            profileImageUrl: profileImageUrl,
            provider: 'google',
          };

          done(null, user);
        } catch (error) {
          console.error('구글 인증 오류:', error);
          done(error as Error, undefined);
        }
      }
    )
  );

  app.get(
    "/api/auth/google",
    (req, res, next) => {
      (req.session as any).returnTo = req.query.returnTo as string || '/';
      next();
    },
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })
  );

  app.get(
    "/api/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: "/?auth=failed",
    }),
    (req, res) => {
      const returnTo = (req.session as any).returnTo || '/';
      delete (req.session as any).returnTo;
      res.redirect(returnTo);
    }
  );
}
