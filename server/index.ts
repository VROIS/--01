import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { storage } from "./storage";
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
  // 🔧 Ensure temp-user-id exists for share functionality
  try {
    const tempUser = await storage.getUser('temp-user-id');
    if (!tempUser) {
      await storage.upsertUser({
        id: 'temp-user-id',
        email: 'temp@example.com',
        firstName: '임시',
        lastName: '사용자',
      });
      log('Created temp-user-id for share functionality');
    }
  } catch (error) {
    log('Warning: Could not create temp-user-id: ' + error);
  }
  
  // 🔧 [공유링크 수정] 정적 파일 서빙을 라우트 등록보다 먼저 설정
  const publicDir = process.env.NODE_ENV === 'production' ? 'dist/public' : 'public';
  
  // ⚠️ 2025.11.02: 스마트 캐시 전략 (업데이트 vs 성능 균형)
  app.use(express.static(publicDir, {
    setHeaders: (res, path) => {
      // HTML/JS만 캐시 비활성화 (업데이트 즉시 반영)
      // 이미지/CSS는 캐시 허용 (성능 향상)
      if (path.endsWith('.html') || path.endsWith('.js')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      } else {
        // 이미지, CSS 등: 1시간 캐시
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    }
  }));
  
  // Route for root page
  app.get('/', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile('index.html', { root: publicDir });
  });
  
  // Route for share page - 명시적 라우트 추가
  app.get('/share.html', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile('share.html', { root: publicDir });
  });
  
  // 🔧 [공유링크 임시 비활성화] SEO 친화적 URL은 추후 구현 예정

  const server = await registerRoutes(app);

  // ⚠️ 2025.11.02: SPA Fallback - 모든 클라이언트 라우트를 index.html로
  // API 라우트가 먼저 처리되고, 나머지는 모두 index.html로 (SPA 라우팅)
  app.get('*', (req, res) => {
    // API 경로는 이미 위에서 처리되었으므로 여기 도달하지 않음
    // 클라이언트 라우트(/archive, /settings 등)를 index.html로 보냄
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile('index.html', { root: publicDir });
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
