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
          
          // ⚠️ 2025.11.02 FIX: OAuth 팝업 플로우 - 팝업 자동 닫기
          // 팝업 창이면 자동으로 닫힘, 일반 창이면 /archive로 이동
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>인증 완료</title>
              <style>
                body { 
                  font-family: Arial, sans-serif; 
                  display: flex; 
                  align-items: center; 
                  justify-content: center; 
                  height: 100vh; 
                  margin: 0;
                  background: #f5f5f5;
                }
                .message {
                  text-align: center;
                  padding: 2rem;
                  background: white;
                  border-radius: 8px;
                  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                }
              </style>
            </head>
            <body>
              <div class="message">
                <h2>✅ 로그인 성공!</h2>
                <p>잠시만 기다려주세요...</p>
              </div>
              <script>
                // ⚠️ 2025.11.02 FIX: postMessage로 원래 창에 인증 완료 알림
                if (window.opener) {
                  console.log('📨 Sending auth success message to opener');
                  window.opener.postMessage({ type: 'AUTH_SUCCESS' }, '*');
                  
                  // 메시지 전송 후 팝업 닫기
                  setTimeout(() => {
                    window.close();
                  }, 100);
                } else {
                  // 일반 창이면 보관함으로 이동
                  window.location.href = '/archive';
                }
              </script>
            </body>
            </html>
          `);
        });
      })(req, res, next);
    }
  );
}
