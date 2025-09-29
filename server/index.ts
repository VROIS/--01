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
  // 🔧 [공유링크 수정] 정적 파일 서빙을 라우트 등록보다 먼저 설정
  app.use(express.static('public'));

  // Route for root page
  app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'public' });
  });

  // Route for share page - 명시적 라우트 추가
  app.get('/share.html', (req, res) => {
    res.sendFile('share.html', { root: 'public' });
  });

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
