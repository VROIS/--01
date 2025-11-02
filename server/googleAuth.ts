import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Express } from "express";
import { storage } from "./storage";

export async function setupGoogleAuth(app: Express) {
  const googleClientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  
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
    passport.authenticate("google", {
      scope: ["profile", "email"],
    })
  );

  app.get(
    "/api/auth/google/callback",
    (req, res, next) => {
      passport.authenticate("google", (err: any, user: any) => {
        if (err) {
          console.error('구글 인증 콜백 오류:', err);
          return res.redirect("/archive?auth=failed");
        }
        
        if (!user) {
          console.error('구글 인증 실패: 사용자 없음');
          return res.redirect("/archive?auth=failed");
        }
        
        // 로그인 처리
        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error('구글 로그인 오류:', loginErr);
            return res.redirect("/archive?auth=failed");
          }
          
          // ⚠️ 2025.11.02 근본 해결: 팝업이면 닫고, 원래 창에서 인증 체크
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>인증 완료</title>
              <meta charset="UTF-8">
            </head>
            <body>
              <script>
                // 팝업 즉시 닫기 (opener가 자동으로 인증 상태 확인함)
                window.close();
              </script>
            </body>
            </html>
          `);
        });
      })(req, res, next);
    }
  );
}
