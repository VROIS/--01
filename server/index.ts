/**
 * 📝 수정 메모 (2025-09-24)  
 * 목적: Microsoft Defender 브라우저 차단 문제 해결
 * 
 * 🚨 실제 문제: URL 길이가 아닌 HTTP 헤더 이슈
 * - 카카오톡: 정상 작동 (헤더 무시)
 * - 브라우저: Microsoft Defender 차단 (악성 헤더 패턴 감지)
 * 
 * 🔧 해결 방법:
 * 1. /share.html 라우트에서 Replit 기본 헤더 제거
 * 2. 올바른 X-Robots-Tag 설정: 'index, follow, noarchive'
 * 3. 보안 헤더 추가 (CSP, X-Frame-Options 등)
 * 4. 라우트 순서 조정: express.static보다 먼저 처리
 * 
 * ❌ 이전 허위보고 정정:
 * - URL 길이 문제 아니었음 (이미 6자 ID 사용)
 * - 실제 원인: X-Robots-Tag 중복 및 noindex 패턴
 */

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

// Simple logging function
const log = (message: string) => {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`${timestamp} [express] ${message}`);
};

// Basic request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms`);
    }
  });
  next();
});

(async () => {
  // 🔧 [수정] Microsoft Defender 차단 해결: 특정 라우트를 정적 파일보다 먼저 설정
  
  // Route for share page - Microsoft Defender 차단 문제 해결
  app.get('/share.html', (req, res) => {
    // 🔧 [수정] Microsoft Defender 차단 해결: Replit 기본 헤더 제거 후 올바른 헤더 설정
    res.removeHeader('X-Robots-Tag'); // Replit 기본 헤더 제거
    res.setHeader('X-Robots-Tag', 'index, follow, noarchive');
    res.setHeader('Cache-Control', 'public, max-age=3600'); // 1시간 캐시
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https:; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://hangeul.pstatic.net;");
    res.setHeader('X-Content-Type-Options', 'nosniff'); // 보안 강화
    res.setHeader('X-Frame-Options', 'DENY'); // 클릭재킹 방지
    res.sendFile('share.html', { root: 'public' });
  });
  
  // Route for root page
  app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
  });
  
  // 🔧 [공유링크 수정] 정적 파일 서빙을 특정 라우트 등록 후에 설정
  app.use(express.static('public'));
  
  // 🔧 [공유링크 임시 비활성화] SEO 친화적 URL은 추후 구현 예정

  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Express error:", err);
    res.status(status).json({ message });
    // Don't throw err after sending response to prevent server crashes
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
