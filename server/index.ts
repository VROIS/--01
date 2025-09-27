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

// 🔧 [수정] 공유페이지 전용 헤더 컨트롤 미들웨어
app.use('/share.html', (req, res, next) => {
  // 모든 Replit 기본 헤더 완전 제거
  const originalSetHeader = res.setHeader;
  const originalRemoveHeader = res.removeHeader;
  
  // 헤더 설정 오버라이드
  res.setHeader = function(name: string, value: any) {
    const lowerName = name.toLowerCase();
    if (lowerName.includes('x-robots-tag') || lowerName.includes('robots')) {
      return this; // X-Robots-Tag 관련 헤더 무시
    }
    return originalSetHeader.call(this, name, value);
  };
  
  // 수동으로 안전한 헤더 설정
  res.removeHeader('X-Robots-Tag');
  res.removeHeader('Replit-X-Robots-Tag');
  res.removeHeader('x-robots-tag');
  
  originalSetHeader.call(res, 'X-Robots-Tag', 'index, follow, noarchive');
  originalSetHeader.call(res, 'X-Frame-Options', 'SAMEORIGIN');
  originalSetHeader.call(res, 'Cache-Control', 'public, max-age=3600');
  originalSetHeader.call(res, 'Content-Security-Policy', "default-src 'self' 'unsafe-inline' 'unsafe-eval' data: https:; img-src 'self' data: https:; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.tailwindcss.com https://hangeul.pstatic.net;");
  originalSetHeader.call(res, 'X-Content-Type-Options', 'nosniff');
  
  next();
});

(async () => {
  // 🔧 [수정] Microsoft Defender 차단 해결: 특정 라우트를 정적 파일보다 먼저 설정
  
  // Route for share page - 미들웨어에서 헤더 처리 완료
  app.get('/share.html', (req, res) => {
    res.sendFile('share.html', { root: 'public' });
  });
  
  // Route for root page
  app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
  });
  
  // 🔧 [공유링크 수정] 정적 파일 서빙을 특정 라우트 등록 후에 설정
  app.use(express.static('public'));
  
  const server = await registerRoutes(app);
  
  // SPA fallback: serve index.html for all client-side routes
  app.get('*', (req, res) => {
    // Only fallback for non-API routes
    if (!req.path.startsWith('/api')) {
      res.sendFile('index.html', { root: 'public' });
    } else {
      res.status(404).json({ message: 'API endpoint not found' });
    }
  });

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
