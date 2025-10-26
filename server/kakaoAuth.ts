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
    passport.authenticate("kakao", {
      failureRedirect: "/?auth=failed",
    }),
    (req, res) => {
      // 항상 popup 방식으로 처리 (간단하고 안정적)
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>인증 완료</title>
        </head>
        <body>
          <script>
            // 부모 창에 메시지 전송
            if (window.opener) {
              window.opener.postMessage('auth-success', '*');
              window.close();
            } else {
              // Popup이 아닌 경우 메인 페이지로 리다이렉트
              window.location.href = '/';
            }
          </script>
          <p style="text-align: center; font-family: sans-serif; margin-top: 50px;">
            ✅ 인증이 완료되었습니다!<br>
            잠시 후 자동으로 닫힙니다...
          </p>
        </body>
        </html>
      `);
    }
  );
}
