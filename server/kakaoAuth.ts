import passport from "passport";
import { Strategy as KakaoStrategy } from "passport-kakao";
import type { Express } from "express";
import { storage } from "./storage";

export async function setupKakaoAuth(app: Express) {
  const kakaoClientId = process.env.KAKAO_CLIENT_ID?.trim();
  const kakaoClientSecret = process.env.KAKAO_CLIENT_SECRET?.trim();
  
  if (!kakaoClientId || !kakaoClientSecret) {
    console.warn('⚠️  카카오 OAuth 환경변수가 설정되지 않았습니다. 카카오 로그인을 사용하려면 KAKAO_CLIENT_ID와 KAKAO_CLIENT_SECRET을 설정하세요.');
    
    app.get("/api/auth/kakao", (req, res) => {
      res.status(503).json({ 
        error: "카카오 로그인이 아직 설정되지 않았습니다. 관리자에게 문의하세요." 
      });
    });
    
    app.get("/api/auth/kakao/callback", (req, res) => {
      res.status(503).json({ 
        error: "카카오 로그인이 아직 설정되지 않았습니다." 
      });
    });
    
    return;
  }

  const domains = process.env.REPLIT_DOMAINS?.split(",") || ['localhost:5000'];
  const domain = domains[0];
  const protocol = domain.includes('replit.dev') || domain.includes('replit.app') ? 'https' : 'http';
  const callbackURL = `${protocol}://${domain}/api/auth/kakao/callback`;
  
  console.log('🟡 Kakao OAuth 설정:');
  console.log('  - Client ID 길이:', kakaoClientId.length, '글자');
  console.log('  - Client ID 앞 10자:', kakaoClientId.substring(0, 10));
  console.log('  - Client Secret 길이:', kakaoClientSecret.length, '글자');
  console.log('  - Client Secret 앞 10자:', kakaoClientSecret.substring(0, 10));
  console.log('  - Callback URL:', callbackURL);

  passport.use(
    new KakaoStrategy(
      {
        clientID: kakaoClientId,
        clientSecret: kakaoClientSecret,
        callbackURL: callbackURL,
      },
      async (accessToken: string, refreshToken: string, profile: any, done: any) => {
        try {
          const email = profile._json?.kakao_account?.email;
          const nickname = profile.displayName || profile.username || '';
          const profileImageUrl = profile._json?.kakao_account?.profile?.profile_image_url || '';
          
          const userId = `kakao_${profile.id}`;

          await storage.upsertUser({
            id: userId,
            email: email,
            firstName: nickname,
            lastName: '',
            profileImageUrl: profileImageUrl,
            provider: 'kakao',
          });

          const user = {
            id: userId,
            email: email,
            firstName: nickname,
            lastName: '',
            profileImageUrl: profileImageUrl,
            provider: 'kakao',
          };

          done(null, user);
        } catch (error) {
          console.error('카카오 인증 오류:', error);
          done(error as Error, undefined);
        }
      }
    )
  );

  app.get(
    "/api/auth/kakao",
    passport.authenticate("kakao")
  );

  app.get(
    "/api/auth/kakao/callback",
    (req, res, next) => {
      passport.authenticate("kakao", (err: any, user: any) => {
        if (err) {
          console.error('카카오 인증 콜백 오류:', err);
          return res.redirect("/archive?auth=failed");
        }
        
        if (!user) {
          console.error('카카오 인증 실패: 사용자 없음');
          return res.redirect("/archive?auth=failed");
        }
        
        // 로그인 처리
        req.logIn(user, (loginErr) => {
          if (loginErr) {
            console.error('카카오 로그인 오류:', loginErr);
            return res.redirect("/archive?auth=failed");
          }
          
          // ⚠️ 2025.11.06: 팝업이면 부모 창에 메시지 전달 후 닫기, 아니면 리다이렉트
          res.send(`
            <!DOCTYPE html>
            <html>
            <head>
              <title>로그인 완료</title>
            </head>
            <body>
              <script>
                if (window.opener) {
                  // 팝업에서 열렸으면 부모 창에 메시지 전달
                  window.opener.postMessage({ type: 'oauth_success' }, window.location.origin);
                  window.close();
                  // 일부 브라우저에서 즉시 닫히지 않을 수 있으므로 메시지 표시
                  document.body.innerHTML = '<div style="text-align:center; padding:50px; font-family:sans-serif;"><h2>✅ 로그인 완료!</h2><p>이 창은 자동으로 닫힙니다...</p></div>';
                  setTimeout(() => window.close(), 500);
                } else {
                  // 현재 탭에서 열렸으면 로그인 성공 플래그 저장 후 리다이렉트
                  localStorage.setItem('auth_success', 'true');
                  window.location.href = '/#archive';
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
