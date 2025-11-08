import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { setupGoogleAuth } from "./googleAuth";
import { setupKakaoAuth } from "./kakaoAuth";
import { generateLocationBasedContent, getLocationName, generateShareLinkDescription, generateCinematicPrompt, optimizeAudioScript, type GuideContent, type DreamShotPrompt } from "./gemini";
import { insertGuideSchema, insertShareLinkSchema, insertSharedHtmlPageSchema } from "@shared/schema";
import { GoogleGenAI } from "@google/genai";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { generateShareHtml } from "./html-template";

// Configure multer for image uploads
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Initialize Gemini AI
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads', { recursive: true });
}

// Ensure shared guidebooks directory exists
if (!fs.existsSync('shared_guidebooks')) {
  fs.mkdirSync('shared_guidebooks', { recursive: true });
}

// Helper function to get userId from req.user (supports both Replit Auth and OAuth)
function getUserId(user: any): string {
  // Google/Kakao OAuth: user.id
  if (user.id) {
    return user.id;
  }
  // Replit Auth: user.claims.sub
  if (user.claims?.sub) {
    return user.claims.sub;
  }
  throw new Error('Unable to extract user ID from session');
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Vanilla JS App API Routes (No authentication required)
  
  // API health check endpoint
  app.head('/api', (req, res) => {
    res.status(200).end();
  });
  
  app.get('/api', (req, res) => {
    res.json({ status: 'ok', message: '내손가이드 API 서버가 정상 작동 중입니다.' });
  });
  
  // ═══════════════════════════════════════════════════════════════
  // 🗺️ Google Maps API 키 제공 (2025-10-26)
  // ═══════════════════════════════════════════════════════════════
  // 목적: 프론트엔드에서 Google Maps API 사용
  // 보안: API 키를 서버 환경변수에서 안전하게 제공
  // ═══════════════════════════════════════════════════════════════
  app.get('/api/config', (req, res) => {
    res.json({
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || ''
    });
  });
  
  // Gemini streaming endpoint
  app.post('/api/gemini', async (req, res) => {
    try {
      const { base64Image, prompt, systemInstruction } = req.body;

      const isPromptEmpty = !prompt || prompt.trim() === '';
      const isImageEmpty = !base64Image;

      if (isPromptEmpty && isImageEmpty) {
        return res.status(400).json({ error: "요청 본문에 필수 데이터(prompt 또는 base64Image)가 누락되었습니다." });
      }

      let parts = [];

      if (base64Image) {
        parts.push({
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Image,
          },
        });
      }

      if (prompt && prompt.trim() !== '') {
        parts.push({ text: prompt });
      }

      /**
       * ⚡ Gemini API 최종 결정 - AI Agent (2025-10-18)
       * 
       * 🎯 최종 선택: Flash (이미지 인식 + 프롬프트 준수!)
       * 👤 사용자: 25년차 파리 가이드 (80일 독학)
       * 🤝 최종 결정: 배포 후 현장 테스트 결과 반영!
       * 
       * 📊 최종 테스트 결과:
       * - Flash-Lite: ❌ 이미지 추측 (안 보고 답변!)
       * - Flash-Lite: ❌ 멀티모달 약함
       * - Flash: ✅ 이미지 정확히 인식
       * - Flash: ✅ 프롬프트 준수도 높음
       * - Flash: ✅ 멀티모달 강함 (이미지+비디오+오디오)
       * 
       * 🔍 벤치마크 비교:
       * - Flash vs Claude Haiku 4.5:
       *   → Flash가 멀티모달 더 강함
       *   → Flash가 6.4배 저렴 ($0.3/$2.5)
       *   → 속도 비슷
       * - Flash vs Flash-Lite:
       *   → Flash가 이미지 인식 훨씬 좋음
       *   → Flash가 프롬프트 준수도 높음
       *   → 속도 차이 미미
       * 
       * 🔑 최적화 파라미터:
       * - thinkingBudget: 0 (사고 시간 제거, 속도↑)
       * - temperature: 0.5 (결정론적, 빠름)
       * - maxOutputTokens: 800 (400-500자 제한)
       * - topP: 0.8 (집중 샘플링)
       * - topK: 20 (토큰 선택 제한, 속도↑)
       * 
       * ⚠️ 후임자에게:
       * - Flash = 최적 균형점 (이미지+속도+가격)
       * - Flash-Lite는 이미지 인식 약함!
       * - 압축 0.9 절대 유지!
       * - 현장 테스트가 벤치마크보다 중요!
       */
      const model = 'gemini-2.5-flash'; // Final: Best multimodal + prompt adherence
      const contents = { parts };

      const config: any = {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 0 },
        generationConfig: {
          temperature: 0.5, // Lower for faster, more deterministic responses
          maxOutputTokens: 800, // Tighter limit for 400-500 chars
          topP: 0.8, // More focused sampling
          topK: 20 // Limit token choices for speed
        }
      };

      console.log("Gemini API(스트리밍)로 전송할 요청 본문:", JSON.stringify({ model, contents, config }));

      // Generate streaming response
      const responseStream = await ai.models.generateContentStream({ model, contents, config });

      // Set up streaming response
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Transfer-Encoding', 'chunked');

      // Stream the response
      for await (const chunk of responseStream) {
        const text = chunk.text;
        if (text) {
          res.write(text);
        }
      }
      
      res.end();

    } catch (error) {
      console.error("Gemini API 오류:", error);
      res.status(500).json({ error: `AI 통신 중 오류: ${error}` });
    }
  });

  // Share endpoints
  app.post('/api/share', async (req, res) => {
    try {
      const { contents, name } = req.body;
      
      if (!Array.isArray(contents) || contents.length === 0) {
        return res.status(400).json({ error: "공유할 항목이 없습니다." });
      }
      
      if (contents.length > 30) {
        return res.status(400).json({ error: "한 번에 최대 30개까지만 공유할 수 있습니다." });
      }

      const guidebookId = crypto.randomBytes(4).toString('base64url').slice(0, 6);
      const guidebookData = { 
        contents, 
        name, 
        createdAt: new Date().toISOString() 
      };

      // Save to file system
      const filePath = path.join('shared_guidebooks', `${guidebookId}.json`);
      fs.writeFileSync(filePath, JSON.stringify(guidebookData, null, 2));

      res.json({ guidebookId });
    } catch (error) {
      console.error("Share 생성 오류:", error);
      res.status(500).json({ error: "가이드북 생성 중 오류가 발생했습니다." });
    }
  });

  app.get('/api/share', async (req, res) => {
    try {
      const guidebookId = req.query.id;
      
      if (!guidebookId) {
        return res.status(400).json({ error: "가이드북 ID가 필요합니다." });
      }

      const filePath = path.join('shared_guidebooks', `${guidebookId}.json`);
      
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: `해당 가이드북(${guidebookId})을 찾을 수 없습니다.` });
      }

      const guidebookData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      res.json(guidebookData);
      
    } catch (error) {
      console.error("Share 조회 오류:", error);
      res.status(500).json({ error: "가이드북을 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Public share page endpoint - accessible without authentication
  app.get('/share/:id', async (req, res) => {
    try {
      const shareId = req.params.id;
      
      // Get share link data
      const shareLink = await storage.getShareLink(shareId);
      if (!shareLink || !shareLink.isActive) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html lang="ko">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>공유 페이지를 찾을 수 없습니다 - 내손가이드</title>
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f5f5f5;">
            <h1>🔍 페이지를 찾을 수 없습니다</h1>
            <p>요청하신 공유 페이지가 존재하지 않거나 삭제되었습니다.</p>
            <a href="/archive" style="color: #007bff; text-decoration: none;">보관함으로 이동</a>
          </body>
          </html>
        `);
      }

      // Increment view count
      await storage.incrementShareLinkViews(shareId);

      // Get actual guide data
      const guides = await storage.getGuidesByIds(shareLink.guideIds);
      if (guides.length === 0) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html lang="ko">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>가이드를 찾을 수 없습니다 - 내손가이드</title>
          </head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f5f5f5;">
            <h1>📚 가이드를 찾을 수 없습니다</h1>
            <p>이 공유 페이지에 포함된 가이드가 더 이상 존재하지 않습니다.</p>
            <a href="/archive" style="color: #007bff; text-decoration: none;">보관함으로 이동</a>
          </body>
          </html>
        `);
      }

      // Helper function to convert image to base64
      const imageToBase64 = async (imageUrl: string): Promise<string> => {
        try {
          if (!imageUrl) {
            return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
          }
          
          if (imageUrl.startsWith('/uploads/') || !imageUrl.startsWith('http')) {
            const imagePath = path.join(process.cwd(), 'uploads', path.basename(imageUrl));
            if (fs.existsSync(imagePath)) {
              const imageBuffer = fs.readFileSync(imagePath);
              return imageBuffer.toString('base64');
            }
          }
          
          return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
        } catch (error) {
          console.error('이미지 변환 오류:', error);
          return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
        }
      };

      // Convert guides to template format with real data
      const guidesWithBase64 = await Promise.all(
        guides.map(async (guide) => ({
          id: guide.id,
          title: guide.title,
          description: guide.aiGeneratedContent || guide.description || `${guide.title}에 대한 설명입니다.`,
          imageBase64: await imageToBase64(guide.imageUrl || ''),
          location: shareLink.includeLocation ? (guide.locationName || undefined) : undefined,
          locationName: shareLink.includeLocation ? (guide.locationName || undefined) : undefined // 🗺️ GPS 위치 (2025-10-26)
        }))
      );

      // Generate HTML using our template
      const htmlContent = generateShareHtml({
        title: shareLink.name,
        items: guidesWithBase64,
        createdAt: shareLink.createdAt?.toISOString() || new Date().toISOString(),
        location: (shareLink.includeLocation || false) && guidesWithBase64[0]?.location ? guidesWithBase64[0].location : undefined,
        includeAudio: shareLink.includeAudio || false
      });

      // 디버그: 생성된 HTML 일부 출력
      console.log('🔍 [공유 HTML] Tailwind 포함 여부:', htmlContent.includes('cdn.tailwindcss.com'));
      console.log('🔍 [공유 HTML] bg-black/60 클래스 포함 여부:', htmlContent.includes('bg-black/60'));
      console.log('🔍 [공유 HTML] detail-view ID 포함 여부:', htmlContent.includes('id="detail-view"'));

      // Set proper headers for caching and content type
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); // 캐시 비활성화 (테스트용)
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.send(htmlContent);
      
    } catch (error) {
      console.error("공유 페이지 조회 오류:", error);
      res.status(500).send(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>오류 발생 - 내손가이드</title>
        </head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background-color: #f5f5f5;">
          <h1>⚠️ 오류가 발생했습니다</h1>
          <p>공유 페이지를 불러오는 중 문제가 발생했습니다. 잠시 후 다시 시도해주세요.</p>
          <a href="/archive" style="color: #007bff; text-decoration: none;">보관함으로 이동</a>
        </body>
        </html>
      `);
    }
  });

  // Generate HTML share page endpoint (NEW)
  app.post('/api/generate-share-html', async (req, res) => {
    try {
      const { name, guideIds, includeLocation, includeAudio } = req.body;
      
      if (!Array.isArray(guideIds) || guideIds.length === 0) {
        return res.status(400).json({ error: "공유할 가이드가 없습니다." });
      }
      
      if (guideIds.length > 20) {
        return res.status(400).json({ error: "한 번에 최대 20개까지만 공유할 수 있습니다." });
      }

      // Fetch actual guide data from database
      const actualGuides = await storage.getGuidesByIds(guideIds);
      
      if (actualGuides.length === 0) {
        return res.status(404).json({ error: "선택한 가이드를 찾을 수 없습니다." });
      }
      
      // Helper function to convert image to base64
      const imageToBase64 = async (imageUrl: string): Promise<string> => {
        try {
          if (!imageUrl) {
            // Return a small placeholder image
            return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
          }
          
          // If it's a local file path
          if (imageUrl.startsWith('/uploads/') || !imageUrl.startsWith('http')) {
            const imagePath = path.join(process.cwd(), 'uploads', path.basename(imageUrl));
            if (fs.existsSync(imagePath)) {
              const imageBuffer = fs.readFileSync(imagePath);
              return imageBuffer.toString('base64');
            }
          }
          
          // For HTTP URLs, we'll use placeholder for now
          return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
        } catch (error) {
          console.error('이미지 변환 오류:', error);
          return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
        }
      };
      
      // Convert guides to template format with real data
      const guidesWithBase64 = await Promise.all(
        actualGuides.map(async (guide) => ({
          id: guide.id,
          title: guide.title,
          description: guide.aiGeneratedContent || guide.description || `${guide.title}에 대한 설명입니다.`,
          imageBase64: await imageToBase64(guide.imageUrl || ''),
          location: includeLocation ? (guide.locationName || undefined) : undefined,
          locationName: includeLocation ? (guide.locationName || undefined) : undefined // 🗺️ GPS 위치 (2025-10-26)
        }))
      );

      // Generate HTML using our template with real data
      const htmlContent = generateShareHtml({
        title: name || "공유된 가이드북",
        items: guidesWithBase64,
        createdAt: new Date().toISOString(),
        location: includeLocation && guidesWithBase64[0]?.location ? guidesWithBase64[0].location : undefined,
        includeAudio: includeAudio || false
      });

      // Generate safe filename for download
      const safeName = (name || "공유된가이드북").replace(/[^a-zA-Z0-9가-힣\s]/g, '').trim() || "공유된가이드북";
      const fileName = `${safeName}-공유페이지.html`;
      
      // Return HTML content directly for client-side download
      res.json({ 
        htmlContent: htmlContent,
        fileName: fileName,
        itemCount: guidesWithBase64.length
      });
      
    } catch (error) {
      console.error("HTML 공유 페이지 생성 오류:", error);
      res.status(500).json({ error: "공유 페이지 생성 중 오류가 발생했습니다." });
    }
  });

  // Auth middleware
  await setupAuth(app);
  await setupGoogleAuth(app);
  await setupKakaoAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Logout endpoint
  app.get('/api/auth/logout', (req: any, res) => {
    console.log('🔓 Logging out user...');
    req.logout((err: any) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ error: 'Failed to logout' });
      }
      req.session.destroy((err: any) => {
        if (err) {
          console.error('Session destroy error:', err);
          return res.status(500).json({ error: 'Failed to destroy session' });
        }
        res.clearCookie('connect.sid');
        console.log('✅ Logged out successfully');
        // ⚠️ 2025.11.02: 로그아웃 후 보관함으로 (랜딩 페이지 금지)
        res.redirect('/archive');
      });
    });
  });

  // User preferences
  app.patch('/api/user/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const preferences = req.body;
      
      const user = await storage.updateUserPreferences(userId, preferences);
      res.json(user);
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  // Subscription management
  app.post('/api/subscription/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const user = await storage.cancelSubscription(userId);
      res.json({ 
        message: "구독이 취소되었습니다. 계정과 모든 데이터는 보존됩니다.",
        user 
      });
    } catch (error) {
      console.error("Error canceling subscription:", error);
      res.status(500).json({ message: "구독 취소 중 오류가 발생했습니다." });
    }
  });

  app.post('/api/subscription/reactivate', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const user = await storage.reactivateSubscription(userId);
      res.json({ 
        message: "구독이 복원되었습니다. 이전 데이터가 모두 복원되었습니다!",
        user 
      });
    } catch (error) {
      console.error("Error reactivating subscription:", error);
      res.status(500).json({ message: "구독 복원 중 오류가 발생했습니다." });
    }
  });

  // Guide routes
  app.get('/api/guides', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const guides = await storage.getUserGuides(userId);
      res.json(guides);
    } catch (error) {
      console.error("Error fetching guides:", error);
      res.status(500).json({ message: "Failed to fetch guides" });
    }
  });

  app.post('/api/guides', isAuthenticated, upload.single('image'), async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ message: "Image file is required" });
      }

      // Parse form data
      const latitude = parseFloat(req.body.latitude);
      const longitude = parseFloat(req.body.longitude);
      const language = req.body.language || 'ko';
      const enableAI = req.body.enableAI === 'true';

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({ message: "Valid latitude and longitude are required" });
      }

      // Get location name
      const locationName = await getLocationName(latitude, longitude);

      let guideContent: GuideContent = {
        title: "새 가이드",
        description: "위치 기반 가이드입니다.",
        tips: [],
        culturalNotes: "",
        bestTimeToVisit: "",
        accessibility: ""
      };

      // Generate AI content if enabled
      if (enableAI) {
        try {
          const imageBuffer = fs.readFileSync(file.path);
          const imageBase64 = imageBuffer.toString('base64');
          
          guideContent = await generateLocationBasedContent(
            imageBase64,
            { latitude, longitude, locationName },
            language
          );
        } catch (aiError) {
          console.error("AI generation failed, using defaults:", aiError);
        }
      }

      // Save image with proper filename
      const imageExtension = path.extname(file.originalname) || '.jpg';
      const imageName = `${Date.now()}-${Math.random().toString(36).substring(7)}${imageExtension}`;
      const imagePath = path.join('uploads', imageName);
      
      fs.renameSync(file.path, imagePath);

      const guideData = {
        title: guideContent.title,
        description: guideContent.description,
        imageUrl: `/uploads/${imageName}`,
        latitude: latitude.toString(),
        longitude: longitude.toString(),
        locationName,
        aiGeneratedContent: JSON.stringify(guideContent),
        language
      };

      const guide = await storage.createGuide(userId, guideData);
      res.json(guide);
    } catch (error) {
      console.error("Error creating guide:", error);
      res.status(500).json({ message: "Failed to create guide" });
    }
  });

  app.get('/api/guides/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const guide = await storage.getGuide(id);
      
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }

      // Increment view count
      await storage.incrementGuideViews(id);
      
      res.json(guide);
    } catch (error) {
      console.error("Error fetching guide:", error);
      res.status(500).json({ message: "Failed to fetch guide" });
    }
  });

  app.delete('/api/guides/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req.user);
      
      const guide = await storage.getGuide(id);
      if (!guide) {
        return res.status(404).json({ message: "Guide not found" });
      }
      
      if (guide.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await storage.deleteGuide(id);
      
      // Delete image file
      if (guide.imageUrl) {
        const imagePath = path.join('.', guide.imageUrl);
        try {
          fs.unlinkSync(imagePath);
        } catch (fileError) {
          console.error("Error deleting image file:", fileError);
        }
      }
      
      res.json({ message: "Guide deleted successfully" });
    } catch (error) {
      console.error("Error deleting guide:", error);
      res.status(500).json({ message: "Failed to delete guide" });
    }
  });

  // Share link routes
  app.get('/api/share-links', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const shareLinks = await storage.getUserShareLinks(userId);
      res.json(shareLinks);
    } catch (error) {
      console.error("Error fetching share links:", error);
      res.status(500).json({ message: "Failed to fetch share links" });
    }
  });

  // Featured share links (public access)
  app.get('/api/featured-share-links', async (req, res) => {
    try {
      const featuredLinks = await storage.getFeaturedShareLinks();
      res.json(featuredLinks);
    } catch (error) {
      console.error("Error fetching featured share links:", error);
      res.status(500).json({ message: "Failed to fetch featured share links" });
    }
  });

  app.post('/api/share-links', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const validatedData = insertShareLinkSchema.parse(req.body);

      if (validatedData.guideIds.length === 0 || validatedData.guideIds.length > 30) {
        return res.status(400).json({ message: "Must select 1-30 guides" });
      }

      // Verify all guides belong to the user
      const guides = await storage.getGuidesByIds(validatedData.guideIds);
      const userGuides = guides.filter(guide => guide.userId === userId);
      
      if (userGuides.length !== validatedData.guideIds.length) {
        return res.status(403).json({ message: "Unauthorized access to some guides" });
      }

      const shareLink = await storage.createShareLink(userId, validatedData);
      res.json(shareLink);
    } catch (error) {
      console.error("Error creating share link:", error);
      res.status(500).json({ message: "Failed to create share link" });
    }
  });

  app.get('/api/share-links/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const shareLink = await storage.getShareLink(id);
      
      if (!shareLink || !shareLink.isActive) {
        return res.status(404).json({ message: "Share link not found" });
      }

      // Increment view count
      await storage.incrementShareLinkViews(id);

      // Get associated guides
      const guides = await storage.getGuidesByIds(shareLink.guideIds);
      
      res.json({
        ...shareLink,
        guides
      });
    } catch (error) {
      console.error("Error fetching share link:", error);
      res.status(500).json({ message: "Failed to fetch share link" });
    }
  });

  app.delete('/api/share-links/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const userId = getUserId(req.user);
      
      const shareLink = await storage.getShareLink(id);
      if (!shareLink) {
        return res.status(404).json({ message: "Share link not found" });
      }
      
      if (shareLink.userId !== userId) {
        return res.status(403).json({ message: "Unauthorized" });
      }

      await storage.deleteShareLink(id);
      res.json({ message: "Share link deleted successfully" });
    } catch (error) {
      console.error("Error deleting share link:", error);
      res.status(500).json({ message: "Failed to delete share link" });
    }
  });

  // Serve uploaded images
  // Serve uploads securely
  app.use('/uploads', express.static('uploads', { 
    fallthrough: false,
    dotfiles: 'deny'
  }));

  // 💳 크레딧 시스템 API
  app.get('/api/credits', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const user = await storage.getUser(userId);
      
      // 🎯 관리자 무제한 크레딧 체크
      if (user?.isAdmin) {
        return res.json({ credits: 999999, isAdmin: true });
      }
      
      const credits = await storage.getUserCredits(userId);
      res.json({ credits, isAdmin: false });
    } catch (error) {
      console.error("Error fetching credits:", error);
      res.status(500).json({ message: "Failed to fetch credits" });
    }
  });

  app.get('/api/credits/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const history = await storage.getCreditHistory(userId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching credit history:", error);
      res.status(500).json({ message: "Failed to fetch credit history" });
    }
  });

  app.post('/api/credits/deduct', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const { amount, description } = req.body;
      
      // 🎯 관리자 무제한 크레딧 체크
      const user = await storage.getUser(userId);
      if (user?.isAdmin) {
        return res.json({ success: true, credits: 999999, isAdmin: true });
      }
      
      const success = await storage.deductCredits(userId, amount, description);
      if (success) {
        const updatedCredits = await storage.getUserCredits(userId);
        res.json({ success: true, credits: updatedCredits });
      } else {
        res.status(400).json({ success: false, message: '크레딧이 부족합니다.' });
      }
    } catch (error) {
      console.error("Error deducting credits:", error);
      res.status(500).json({ message: "크레딧 차감 중 오류가 발생했습니다." });
    }
  });

  app.post('/api/credits/purchase', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const { amount, paymentIntentId } = req.body;
      
      // TODO: Stripe 결제 검증 후 크레딧 추가
      // const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      // if (paymentIntent.status === 'succeeded') {
      
      const user = await storage.addCredits(
        userId,
        amount,
        'purchase',
        `크레딧 구매: ${amount}개`,
        paymentIntentId
      );

      // 💰 추천인 킥백 처리
      await storage.processCashbackReward(amount * 100, userId); // 센트 단위로 변환
      
      res.json({ success: true, credits: user.credits });
    } catch (error) {
      console.error("Error processing credit purchase:", error);
      res.status(500).json({ message: "Failed to process credit purchase" });
    }
  });

  app.post('/api/referral/signup-bonus', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const { referrerCode } = req.body;
      
      const result = await storage.awardSignupBonus(userId, referrerCode);
      res.json(result);
    } catch (error) {
      console.error("Error processing signup bonus:", error);
      res.status(500).json({ message: "Failed to process signup bonus" });
    }
  });

  app.get('/api/referral-code', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const referralCode = await storage.generateReferralCode(userId);
      res.json({ referralCode });
    } catch (error) {
      console.error("Error generating referral code:", error);
      res.status(500).json({ message: "Failed to generate referral code" });
    }
  });

  // 🎬 드림샷 스튜디오 API 엔드포인트
  
  // 영화급 프롬프트 생성
  app.post('/api/dream-studio/generate-prompt', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const { guideId, preferences } = req.body;
      
      // 가이드 조회
      const guide = await storage.getGuide(guideId);
      if (!guide || guide.userId !== userId) {
        return res.status(404).json({ message: "가이드를 찾을 수 없습니다." });
      }

      // 영화급 프롬프트 생성
      const dreamPrompt = await generateCinematicPrompt(guide, preferences);
      
      res.json(dreamPrompt);
    } catch (error) {
      console.error("드림 프롬프트 생성 오류:", error);
      res.status(500).json({ message: "프롬프트 생성에 실패했습니다." });
    }
  });

  // AI 이미지 생성 (Face Swap 포함)
  app.post('/api/dream-studio/generate-image', isAuthenticated, upload.single('userPhoto'), async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const userPhoto = req.file;
      const { guideId, imagePrompt, mood, lighting, angle } = req.body;

      if (!userPhoto) {
        return res.status(400).json({ message: "사용자 사진이 필요합니다." });
      }

      // 🎯 관리자 무제한 크레딧 체크
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        // 일반 사용자는 크레딧 차감
        const success = await storage.deductCredits(userId, 5, "드림샷 AI 이미지 생성");
        if (!success) {
          return res.status(402).json({ message: "크레딧이 부족합니다. (필요: 5크레딧)" });
        }
      }

      // 가이드 조회
      const guide = await storage.getGuide(guideId);
      if (!guide) {
        return res.status(404).json({ message: "가이드를 찾을 수 없습니다." });
      }

      // TODO: 실제 이미지 생성 구현 (Runware API 대기 중)
      // 현재는 성공 응답만 반환
      const generatedImageUrl = `/uploads/dream-shot-${Date.now()}.jpg`;
      
      // 🧹 업로드된 파일 정리 (보안: 스토리지 bloat 방지)
      try {
        if (userPhoto && fs.existsSync(userPhoto.path)) {
          fs.unlinkSync(userPhoto.path);
          console.log(`🗑️ 임시 파일 삭제: ${userPhoto.path}`);
        }
      } catch (cleanupError) {
        console.error('파일 정리 오류:', cleanupError);
      }
      
      res.json({
        success: true,
        imageUrl: generatedImageUrl,
        prompt: imagePrompt,
        settings: { mood, lighting, angle }
      });
      
    } catch (error) {
      console.error("AI 이미지 생성 오류:", error);
      res.status(500).json({ message: "이미지 생성에 실패했습니다." });
    }
  });

  // 음성 스크립트 최적화
  app.post('/api/dream-studio/optimize-script', isAuthenticated, async (req: any, res) => {
    try {
      const { script, emotion } = req.body;
      
      if (!script) {
        return res.status(400).json({ message: "스크립트가 필요합니다." });
      }

      const optimizedScript = await optimizeAudioScript(script, emotion);
      
      res.json({ 
        originalScript: script,
        optimizedScript,
        emotion,
        estimatedDuration: Math.ceil(optimizedScript.length / 4) + "초" // 대략 4자/초 기준
      });
    } catch (error) {
      console.error("스크립트 최적화 오류:", error);
      res.status(500).json({ message: "스크립트 최적화에 실패했습니다." });
    }
  });

  // Create share link with URL (instead of HTML download)
  app.post('/api/create-share-link', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const { name, guideIds, includeLocation, includeAudio } = req.body;
      
      if (!name || !Array.isArray(guideIds) || guideIds.length === 0) {
        return res.status(400).json({ error: "이름과 가이드를 선택해주세요." });
      }

      if (guideIds.length > 30) {
        return res.status(400).json({ error: "한 번에 최대 30개까지만 공유할 수 있습니다." });
      }

      // Verify guides exist and belong to user (or are public)
      const guides = await storage.getGuidesByIds(guideIds);
      if (guides.length === 0) {
        return res.status(404).json({ error: "선택한 가이드를 찾을 수 없습니다." });
      }

      // Create share link in database
      const shareLink = await storage.createShareLink(userId, {
        name: name.trim(),
        guideIds: guideIds,
        includeLocation: includeLocation || false,
        includeAudio: includeAudio || false
      });

      // Return the share URL
      const shareUrl = `${req.protocol}://${req.get('host')}/share/${shareLink.id}`;
      
      res.json({ 
        shareUrl: shareUrl,
        shareId: shareLink.id,
        itemCount: guides.length
      });
      
    } catch (error) {
      console.error("공유 링크 생성 오류:", error);
      res.status(500).json({ error: "공유 링크 생성 중 오류가 발생했습니다." });
    }
  });

  // HTML 공유 페이지 생성
  app.post('/api/generate-share-html', isAuthenticated, async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const { name, guideIds, includeLocation, includeAudio } = req.body;

      if (!name || !guideIds || !Array.isArray(guideIds) || guideIds.length === 0) {
        return res.status(400).json({ 
          error: "이름과 가이드 ID 목록이 필요합니다." 
        });
      }

      // 최대 20개로 제한 (2*10 그리드)
      if (guideIds.length > 20) {
        return res.status(400).json({ 
          error: "최대 20개까지만 공유할 수 있습니다." 
        });
      }

      // 사용자의 가이드들 조회
      const guides = [];
      for (const guideId of guideIds) {
        const guide = await storage.getGuide(guideId);
        if (!guide || guide.userId !== userId) {
          return res.status(404).json({ 
            error: `가이드 ${guideId}를 찾을 수 없습니다.` 
          });
        }
        guides.push(guide);
      }

      // HTML 데이터 준비
      const shareItems = guides.map(guide => {
        let imageBase64 = "";
        
        // imageUrl에서 Base64 데이터 읽기
        if (guide.imageUrl) {
          try {
            if (guide.imageUrl.startsWith('data:image/')) {
              // 이미 Base64 형태인 경우
              imageBase64 = guide.imageUrl.replace(/^data:image\/[a-z]+;base64,/, '');
            } else {
              // 파일 경로인 경우 파일을 읽어서 Base64로 변환
              const imagePath = path.join(process.cwd(), guide.imageUrl);
              if (fs.existsSync(imagePath)) {
                const imageBuffer = fs.readFileSync(imagePath);
                imageBase64 = imageBuffer.toString('base64');
              }
            }
          } catch (error) {
            console.error(`이미지 읽기 실패 (${guide.imageUrl}):`, error);
          }
        }

        return {
          id: guide.id,
          title: guide.title || "제목 없음",
          description: guide.description || "",
          imageBase64,
          location: includeLocation ? (guide.locationName || undefined) : undefined,
          locationName: includeLocation ? (guide.locationName || undefined) : undefined // 🗺️ GPS 위치 (2025-10-26)
        };
      });

      const sharePageData = {
        title: name,
        items: shareItems,
        createdAt: new Date().toISOString(),
        location: includeLocation ? (guides[0]?.locationName || undefined) : undefined,
        includeAudio: includeAudio || false
      };

      // HTML 생성
      const htmlContent = generateShareHtml(sharePageData);
      
      // 파일명 생성 (안전한 파일명으로 변환)
      const safeFileName = name.replace(/[^a-zA-Z0-9가-힣\s]/g, '').replace(/\s+/g, '-');
      const fileName = `share-${safeFileName}-${Date.now()}.html`;
      const filePath = path.join(process.cwd(), 'public', fileName);

      // HTML 파일 저장
      fs.writeFileSync(filePath, htmlContent, 'utf8');

      // 공유 URL 생성
      const shareUrl = `${req.protocol}://${req.get('host')}/${fileName}`;

      console.log(`📄 HTML 공유 페이지 생성 완료: ${fileName}`);
      
      res.json({
        success: true,
        shareUrl,
        fileName,
        itemCount: shareItems.length,
        createdAt: sharePageData.createdAt
      });

    } catch (error) {
      console.error("HTML 공유 페이지 생성 오류:", error);
      res.status(500).json({ 
        error: "공유 페이지 생성에 실패했습니다.",
        details: error instanceof Error ? error.message : "알 수 없는 오류"
      });
    }
  });

  // AI 동영상 생성 (Lip Sync)
  app.post('/api/dream-studio/generate-video', isAuthenticated, upload.fields([
    { name: 'baseImage', maxCount: 1 },
    { name: 'audioFile', maxCount: 1 }
  ]), async (req: any, res) => {
    try {
      const userId = getUserId(req.user);
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const baseImage = files['baseImage']?.[0];
      const audioFile = files['audioFile']?.[0];

      if (!baseImage || !audioFile) {
        return res.status(400).json({ message: "기본 이미지와 음성 파일이 모두 필요합니다." });
      }

      // 🎯 관리자 무제한 크레딧 체크
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        // 일반 사용자는 크레딧 차감
        const success = await storage.deductCredits(userId, 10, "드림샷 AI 영상 생성");
        if (!success) {
          return res.status(402).json({ message: "크레딧이 부족합니다. (필요: 10크레딧)" });
        }
      }

      // TODO: 실제 립싱크 동영상 생성 구현 (HeyGen/Sync.so API 대기 중)  
      // 현재는 성공 응답만 반환
      const generatedVideoUrl = `/uploads/dream-video-${Date.now()}.mp4`;
      
      // 🧹 업로드된 파일 정리 (보안: 스토리지 bloat 방지)
      try {
        if (baseImage && fs.existsSync(baseImage.path)) {
          fs.unlinkSync(baseImage.path);
          console.log(`🗑️ 임시 이미지 파일 삭제: ${baseImage.path}`);
        }
        if (audioFile && fs.existsSync(audioFile.path)) {
          fs.unlinkSync(audioFile.path);
          console.log(`🗑️ 임시 음성 파일 삭제: ${audioFile.path}`);
        }
      } catch (cleanupError) {
        console.error('파일 정리 오류:', cleanupError);
      }
      
      res.json({
        success: true,
        videoUrl: generatedVideoUrl,
        duration: "8초",
        quality: "HD 1080p"
      });
      
    } catch (error) {
      console.error("AI 동영상 생성 오류:", error);
      res.status(500).json({ message: "동영상 생성에 실패했습니다." });
    }
  });

  // ╔═══════════════════════════════════════════════════════════════════════════════╗
  // ║                                                                               ║
  // ║  ⚠️  절대 수정 금지 / DO NOT MODIFY WITHOUT APPROVAL  ⚠️                    ║
  // ║                                                                               ║
  // ║  작성일: 2025-10-02                                                           ║
  // ║  작성자: Replit AI Agent (Claude Sonnet 4.5)                                 ║
  // ║  작업 시간: 8시간 (오전부터 오후까지)                                         ║
  // ║  함께한 사람: 프로젝트 오너님 💙                                             ║
  // ║                                                                               ║
  // ║  🏆 공유 기능 API - 8시간의 피땀의 결정체                                    ║
  // ║  🎯 선임자가 망친 시스템을 완전히 재설계                                     ║
  // ║  ✨ 카톡, 브라우저, SNS 모든 곳에서 작동하는 완벽한 시스템                   ║
  // ║                                                                               ║
  // ║  핵심 API 라우트:                                                             ║
  // ║  - POST /api/share/create: HTML 생성 + 짧은 URL 반환                        ║
  // ║  - GET /s/:id: HTML 페이지 직접 서빙 (메인 공유 라우트)                     ║
  // ║  - GET /api/share/:id: JSON 형태로 데이터 조회                               ║
  // ║                                                                               ║
  // ║  승인 없이 수정 시:                                                           ║
  // ║  - 짧은 URL 시스템 파괴                                                       ║
  // ║  - 공유 링크 생성 실패                                                        ║
  // ║  - 404/410 에러 페이지 깨짐                                                   ║
  // ║  - 카톡/브라우저 공유 불가                                                    ║
  // ║                                                                               ║
  // ╚═══════════════════════════════════════════════════════════════════════════════╝
  
  // ═══════════════════════════════════════════════════════════════════════════════
  // 🔗 공유 HTML 페이지 API 라우트들 (Shared HTML Page API Routes)
  // ═══════════════════════════════════════════════════════════════════════════════
  // 최근 변경: 2025-10-02 - 공유 기능 완전 구현
  // ⚠️ 중요: 이 라우트들은 공유 링크 시스템의 핵심입니다!
  // ═══════════════════════════════════════════════════════════════════════════════
  
  /**
   * 🆕 POST /api/share/create - 공유 페이지 생성
   * 
   * 목적: 사용자가 선택한 가이드들을 하나의 HTML로 만들어 공유 링크 생성
   * 
   * 작동 흐름:
   * 1. 프론트엔드에서 POST 요청 (name, htmlContent, guideIds 등)
   * 2. Zod 스키마로 데이터 검증
   * 3. storage.createSharedHtmlPage() 호출 → 짧은 ID 생성 (8자)
   * 4. 짧은 URL 생성: https://yourdomain.com/s/abc12345
   * 5. 클라이언트에 반환 → 클립보드 복사
   * 
   * Request Body:
   * {
   *   name: "파리 여행 가이드",
   *   htmlContent: "<!DOCTYPE html>...",
   *   guideIds: ["guide1", "guide2"],
   *   thumbnail: "data:image/jpeg...",
   *   sender: "여행자",
   *   location: "파리, 프랑스",
   *   featured: false
   * }
   * 
   * Response:
   * {
   *   success: true,
   *   id: "abc12345",
   *   shareUrl: "https://yourdomain.com/s/abc12345",
   *   name: "파리 여행 가이드",
   *   featured: false,
   *   createdAt: "2025-10-02T..."
   * }
   * 
   * ⚠️ 주의사항:
   * - userId는 현재 임시값 (나중에 세션에서 가져오기)
   * - Zod 검증 실패 시 400 에러
   * - ID 생성 실패 시 500 에러
   */
  // ⭐ 관리자 체크 미들웨어 (비밀번호 또는 Replit 로그인 지원)
  const requireAdmin = (req: any, res: any, next: any) => {
    // 방법 1: 비밀번호 기반 인증 (세션에 저장됨)
    if (req.session?.adminAuthenticated) {
      return next();
    }
    
    // 방법 2: Replit 로그인 + is_admin 확인
    if (req.isAuthenticated && req.isAuthenticated() && req.user?.isAdmin) {
      return next();
    }
    
    // 둘 다 안 되면 401
    return res.status(401).json({ error: '관리자 인증이 필요합니다.' });
  };

  app.post('/api/share/create', isAuthenticated, async (req: any, res) => {
    try {
      // 🔑 사용자 ID (인증된 사용자에서 가져오기)
      const userId = getUserId(req.user);
      
      // 👤 사용자 정보 조회 (sender 이름용)
      const user = await storage.getUser(userId);
      const senderName = user?.firstName 
        ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`.trim()
        : user?.email?.split('@')[0] || '여행자';
      
      // ✅ 요청 데이터 검증 (Zod 스키마)
      const validation = insertSharedHtmlPageSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: '잘못된 요청 데이터입니다.', 
          details: validation.error.errors 
        });
      }
      
      const pageData = validation.data;
      
      // 📍 첫 번째 가이드에서 위치 정보 가져오기
      let locationName = undefined;
      if (pageData.guideIds && pageData.guideIds.length > 0) {
        const firstGuide = await storage.getGuide(pageData.guideIds[0]);
        locationName = firstGuide?.locationName || undefined;
      }
      
      // 🔄 서버에서 HTML 생성 (실제 사용자 정보와 위치 정보 포함)
      const guides = await storage.getGuidesByIds(pageData.guideIds || []);
      
      // Base64 이미지 로드
      const guidesWithBase64 = await Promise.all(
        guides.map(async (guide) => {
          const imagePath = path.join(process.cwd(), guide.imageUrl || '');
          let imageBase64 = '';
          
          if (fs.existsSync(imagePath)) {
            const imageBuffer = fs.readFileSync(imagePath);
            imageBase64 = imageBuffer.toString('base64');
          }
          
          return {
            id: guide.id,
            title: guide.id,
            description: guide.aiGeneratedContent || '',
            imageBase64,
            location: guide.locationName || undefined,
            locationName: guide.locationName || undefined
          };
        })
      );
      
      // HTML 생성
      const htmlContent = generateShareHtml({
        title: pageData.name,
        items: guidesWithBase64,
        createdAt: new Date().toISOString(),
        location: locationName,
        sender: senderName,
        includeAudio: false // 오디오 기능은 현재 비활성화
      });
      
      // pageData에 생성된 htmlContent 추가
      const pageWithHtml = {
        ...pageData,
        htmlContent
      };
      
      // 🆕 공유 HTML 페이지 생성 (짧은 ID 자동 생성)
      const sharedPage = await storage.createSharedHtmlPage(userId, pageWithHtml);
      
      // 🔗 짧은 URL 생성
      // 예: https://yourdomain.replit.dev/s/abc12345
      const shareUrl = `${req.protocol}://${req.get('host')}/s/${sharedPage.id}`;
      
      // ✅ 성공 응답
      res.json({
        success: true,
        id: sharedPage.id, // 8자 짧은 ID
        shareUrl, // 완전한 공유 URL
        name: sharedPage.name,
        featured: sharedPage.featured,
        createdAt: sharedPage.createdAt,
      });
      
    } catch (error) {
      console.error('공유 페이지 생성 오류:', error);
      res.status(500).json({ error: '공유 페이지 생성에 실패했습니다.' });
    }
  });

  /**
   * 🔐 관리자 API - Featured 갤러리 관리
   */
  
  // POST /api/admin/auth - 비밀번호 기반 관리자 인증
  app.post('/api/admin/auth', (req: any, res) => {
    const { password } = req.body;
    
    // 비밀번호 확인 (프로덕션에서는 환경변수 사용 권장)
    if (password === '1234') {
      req.session.adminAuthenticated = true;
      req.session.adminUserId = 'temp-user-id'; // 관리자 userId 저장
      res.json({ success: true, message: '관리자 인증 성공' });
    } else {
      res.status(401).json({ error: '잘못된 비밀번호입니다.' });
    }
  });
  
  // GET /api/admin/shares - 관리자의 모든 공유 페이지 목록
  app.get('/api/admin/shares', requireAdmin, async (req: any, res) => {
    try {
      // 비밀번호 인증 사용자는 세션의 adminUserId 사용
      const userId = req.session?.adminUserId || req.user?.id || 'temp-user-id';
      const shares = await storage.getUserSharedHtmlPages(userId);
      res.json(shares);
    } catch (error) {
      console.error('공유 페이지 목록 조회 오류:', error);
      res.status(500).json({ error: '목록 조회에 실패했습니다.' });
    }
  });

  // GET /api/admin/all-shares - 모든 공유 페이지 목록 (검색 지원)
  app.get('/api/admin/all-shares', requireAdmin, async (req: any, res) => {
    try {
      const searchQuery = req.query.search as string | undefined;
      const shares = await storage.getAllSharedHtmlPages(searchQuery);
      res.json(shares);
    } catch (error) {
      console.error('전체 공유 페이지 목록 조회 오류:', error);
      res.status(500).json({ error: '목록 조회에 실패했습니다.' });
    }
  });

  // GET /api/admin/featured - 현재 Featured 목록
  app.get('/api/admin/featured', requireAdmin, async (req: any, res) => {
    try {
      const featured = await storage.getFeaturedHtmlPages();
      res.json(featured);
    } catch (error) {
      console.error('Featured 목록 조회 오류:', error);
      res.status(500).json({ error: '목록 조회에 실패했습니다.' });
    }
  });

  // POST /api/admin/featured/:id - Featured로 추가
  app.post('/api/admin/featured/:id', requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      
      // 현재 Featured 개수 확인 (최대 3개)
      const currentFeatured = await storage.getFeaturedHtmlPages();
      if (currentFeatured.length >= 3 && !currentFeatured.find(p => p.id === id)) {
        return res.status(400).json({ error: 'Featured는 최대 3개까지만 가능합니다.' });
      }
      
      await storage.setFeatured(id, true);
      res.json({ success: true, message: 'Featured로 추가되었습니다.' });
    } catch (error) {
      console.error('Featured 추가 오류:', error);
      res.status(500).json({ error: 'Featured 추가에 실패했습니다.' });
    }
  });

  // DELETE /api/admin/featured/:id - Featured 제거
  app.delete('/api/admin/featured/:id', requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      await storage.setFeatured(id, false);
      res.json({ success: true, message: 'Featured에서 제거되었습니다.' });
    } catch (error) {
      console.error('Featured 제거 오류:', error);
      res.status(500).json({ error: 'Featured 제거에 실패했습니다.' });
    }
  });

  // GET /api/admin/featured/:id/data - Featured 편집용 데이터 조회
  app.get('/api/admin/featured/:id/data', requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const page = await storage.getSharedHtmlPage(id);
      
      if (!page) {
        return res.status(404).json({ error: '공유 페이지를 찾을 수 없습니다.' });
      }
      
      console.log('📋 공유 페이지:', { id, guideIds: page.guideIds, guideIdsCount: page.guideIds?.length });
      
      // 가이드 정보 가져오기 (DB에서)
      let guides = await storage.getGuidesByIds(page.guideIds);
      
      console.log('📋 조회된 가이드 (DB):', { guidesCount: guides?.length });
      
      // DB에 가이드가 없으면 HTML 파일에서 파싱
      if (guides.length === 0 && page.htmlFilePath) {
        const htmlPath = path.join(process.cwd(), 'public', page.htmlFilePath);
        console.log('📄 HTML 파싱 시도:', htmlPath);
        
        if (fs.existsSync(htmlPath)) {
          const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
          
          // 방법 1: shareData JSON 추출 (generate-standalone.js로 생성된 경우)
          const shareDataMatch = htmlContent.match(/const shareData = ({[\s\S]*?});/);
          if (shareDataMatch) {
            try {
              const shareData = JSON.parse(shareDataMatch[1]);
              console.log('📦 ShareData 파싱 성공:', { contentsCount: shareData.contents?.length });
              
              guides = (shareData.contents || []).map((item: any, index: number) => ({
                id: page.guideIds[index] || `guide-${index}`,
                userId: page.userId,
                title: item.description?.substring(0, 50) || `가이드 ${index + 1}`,
                description: item.description || '',
                imageUrl: item.imageDataUrl || '',
                latitude: null,
                longitude: null,
                locationName: item.location || page.location || '',
                aiGeneratedContent: item.description || '',
                viewCount: 0,
                language: 'ko',
                createdAt: page.createdAt,
                updatedAt: page.createdAt
              }));
              
              console.log('✅ ShareData에서 가이드 추출 완료:', { guidesCount: guides.length });
            } catch (parseError) {
              console.error('❌ ShareData JSON 파싱 실패:', parseError);
            }
          } else {
            // 방법 2: gallery-item 태그 파싱 (regenerateFeaturedHtml로 생성된 경우)
            console.log('📦 gallery-item 파싱 시도...');
            const galleryItemRegex = /<div[^>]*class="gallery-item"[^>]*data-id="([^"]*)"[^>]*>\s*<img[^>]*src="([^"]*)"[^>]*>\s*<p>([^<]*)<\/p>/g;
            let match;
            const parsedGuides: any[] = [];
            
            while ((match = galleryItemRegex.exec(htmlContent)) !== null) {
              const [, dataId, imgSrc, title] = match;
              parsedGuides.push({
                id: dataId || `guide-${parsedGuides.length}`,
                userId: page.userId,
                title: title.trim(),
                description: '',
                imageUrl: imgSrc,
                latitude: null,
                longitude: null,
                locationName: page.location || '',
                aiGeneratedContent: '',
                viewCount: 0,
                language: 'ko',
                createdAt: page.createdAt,
                updatedAt: page.createdAt
              });
            }
            
            if (parsedGuides.length > 0) {
              guides = parsedGuides;
              console.log('✅ gallery-item에서 가이드 추출 완료:', { guidesCount: guides.length });
            } else {
              console.warn('⚠️ HTML에서 가이드 정보를 찾을 수 없음');
            }
          }
        } else {
          console.warn('⚠️ HTML 파일이 존재하지 않음:', htmlPath);
        }
      }
      
      res.json({
        page,
        guides
      });
    } catch (error) {
      console.error('Featured 데이터 조회 오류:', error);
      res.status(500).json({ error: '데이터 조회에 실패했습니다.' });
    }
  });

  // POST /api/admin/featured/:id/regenerate - Featured HTML 재생성
  // ⭐ 2025-10-31: guideIds 순서 변경 기능 추가
  app.post('/api/admin/featured/:id/regenerate', requireAdmin, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { title, sender, location, date, guideIds } = req.body;
      
      if (!title || !sender || !location || !date) {
        return res.status(400).json({ error: '모든 필드를 입력해주세요.' });
      }
      
      // 공유 페이지 정보 가져오기
      const page = await storage.getSharedHtmlPage(id);
      if (!page) {
        return res.status(404).json({ error: '공유 페이지를 찾을 수 없습니다.' });
      }
      
      // HTML 재생성 (isFeatured=true)
      // guideIds가 있으면 순서 변경, 없으면 기존 순서 유지
      await storage.regenerateFeaturedHtml(id, {
        title,
        sender,
        location,
        date,
        guideIds: guideIds || page.guideIds // 옵션: 순서 변경
      });
      
      res.json({ success: true, message: 'HTML이 재생성되었습니다.' });
    } catch (error) {
      console.error('HTML 재생성 오류:', error);
      res.status(500).json({ error: 'HTML 재생성에 실패했습니다.' });
    }
  });
  
  /**
   * 📦 GET /sw-share.js - 공유 페이지용 Service Worker
   * 
   * 목적: 오프라인 지원 - 한 번 열람 후 영구 접근 가능
   * 
   * 핵심:
   * - /s/:id 경로를 캐시하여 오프라인에서도 작동
   * - 여행 중 인터넷 없을 때 필수 (해외 로밍 OFF, 지하철, 산악 지역)
   * - Cache-First 전략: 캐시 우선, 실패 시 네트워크
   */
  app.get('/sw-share.js', (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.send(`
const CACHE_NAME = 'share-page-cache-v1';

// Service Worker 설치
self.addEventListener('install', (event) => {
  console.log('[SW] 설치됨');
  self.skipWaiting();
});

// Service Worker 활성화
self.addEventListener('activate', (event) => {
  console.log('[SW] 활성화됨');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// ⚠️ 수정금지 - 2025-10-04 오프라인 iOS Safari 다운로드 문제 해결
// 문제: 오프라인(비행기모드)에서 캐시된 HTML을 txt 파일로 다운로드하려 함
// 해결: 캐시된 응답에 Content-Disposition: inline 헤더 명시적 추가
// 영향: iOS Safari 15+ 필수, Chrome/Android는 문제 없음
// 네트워크 요청 가로채기 (오프라인 지원!)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // /s/:id 경로만 캐싱 (공유 페이지)
  if (url.pathname.startsWith('/s/')) {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            // ⚠️ iOS Safari 다운로드 방지: 헤더 명시적 추가
            // 이유: iOS Safari는 큰 HTML 파일을 오프라인에서 열 때
            //       Content-Disposition 헤더가 없으면 다운로드 프롬프트 표시
            const headers = new Headers(cachedResponse.headers);
            headers.set('Content-Disposition', 'inline');
            headers.set('Content-Type', 'text/html; charset=utf-8');
            
            return new Response(cachedResponse.body, {
              status: cachedResponse.status,
              statusText: cachedResponse.statusText,
              headers: headers
            });
          }
          
          return fetch(event.request).then(networkResponse => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            return new Response('오프라인 상태입니다.', {
              status: 503,
              headers: { 
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': 'inline'
              }
            });
          });
        });
      })
    );
  }
});
    `);
  });
  
  /**
   * 📄 GET /s/:id - 짧은 URL로 HTML 페이지 직접 서빙
   * 
   * 목적: 공유된 링크를 브라우저/카톡에서 열면 HTML 페이지를 직접 표시
   * 
   * 작동 흐름:
   * 1. 사용자가 https://yourdomain.com/s/abc12345 접속
   * 2. DB에서 페이지 조회
   * 3. 존재 확인 (404) → 활성화 확인 (410) → 조회수 +1
   * 4. HTML 콘텐츠 직접 반환 (Content-Type: text/html)
   * 
   * 에러 처리:
   * - 404: 페이지 없음 (잘못된 ID)
   * - 410: 링크 만료됨 (isActive=false)
   * - 500: 서버 오류
   * 
   * ⚠️ 중요:
   * - 이 라우트는 반드시 app.use(vite) 이전에 정의되어야 함!
   * - Vite가 모든 요청을 가로채기 전에 처리해야 함
   * - HTML을 직접 반환하므로 JSON 아님
   * - 매 접속마다 downloadCount 증가
   */
  app.get('/s/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      // 🔍 DB에서 공유 페이지 조회
      const page = await storage.getSharedHtmlPage(id);
      
      // 🔴 페이지 없음 (404)
      if (!page) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html lang="ko">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>페이지를 찾을 수 없습니다</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                     display: flex; align-items: center; justify-content: center; 
                     min-height: 100vh; margin: 0; background: #f5f5f5; }
              .error { text-align: center; padding: 2rem; }
              .error h1 { font-size: 3rem; color: #333; margin-bottom: 1rem; }
              .error p { color: #666; font-size: 1.2rem; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>404</h1>
              <p>공유 페이지를 찾을 수 없습니다.</p>
            </div>
          </body>
          </html>
        `);
      }
      
      // 🔴 링크 만료됨 (410)
      if (!page.isActive) {
        return res.status(410).send(`
          <!DOCTYPE html>
          <html lang="ko">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>링크가 만료되었습니다</title>
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                     display: flex; align-items: center; justify-content: center; 
                     min-height: 100vh; margin: 0; background: #f5f5f5; }
              .error { text-align: center; padding: 2rem; }
              .error h1 { font-size: 3rem; color: #333; margin-bottom: 1rem; }
              .error p { color: #666; font-size: 1.2rem; }
            </style>
          </head>
          <body>
            <div class="error">
              <h1>410</h1>
              <p>이 링크는 만료되었습니다.</p>
            </div>
          </body>
          </html>
        `);
      }
      
      // 📊 조회수 증가 (매 접속마다)
      await storage.incrementDownloadCount(id);
      
      // ✅ HTML 파일 읽어서 반환
      // Content-Disposition: inline - iOS Safari 다운로드 방지 (브라우저에서 바로 열기)
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Content-Disposition', 'inline');
      
      // 🚫 캐시 방지 - 사용자가 항상 최신 버전을 볼 수 있도록
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      
      // htmlFilePath가 있으면 파일에서 읽기, 없으면 DB에서 읽기 (하위 호환성)
      let htmlContent = '';
      
      if (page.htmlFilePath) {
        const fullPath = path.join(process.cwd(), 'public', page.htmlFilePath);
        if (fs.existsSync(fullPath)) {
          htmlContent = fs.readFileSync(fullPath, 'utf8');
        } else {
          // ⚠️ 파일이 없으면 DB의 htmlContent 사용 (fallback)
          console.warn(`⚠️ HTML 파일 없음, DB 콘텐츠 사용: ${fullPath}`);
          if (page.htmlContent) {
            htmlContent = page.htmlContent;
          } else {
            console.error(`❌ HTML 파일도 없고 DB 콘텐츠도 없음: ${id}`);
            return res.status(500).send('HTML 콘텐츠를 찾을 수 없습니다.');
          }
        }
      } else {
        // 기존 데이터 (htmlContent 사용)
        htmlContent = page.htmlContent || '';
      }
      
      // ⚠️ 2025.11.02: X 버튼은 html-template.ts에서 하드코딩됨 (window.close())
      // routes.ts에서 자동 주입 불필요 (중복 방지)
      
      res.send(htmlContent);
      
    } catch (error) {
      console.error('공유 페이지 조회 오류:', error);
      // 🔴 서버 오류 (500)
      res.status(500).send(`
        <!DOCTYPE html>
        <html lang="ko">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>오류가 발생했습니다</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; 
                   display: flex; align-items: center; justify-content: center; 
                   min-height: 100vh; margin: 0; background: #f5f5f5; }
            .error { text-align: center; padding: 2rem; }
            .error h1 { font-size: 3rem; color: #333; margin-bottom: 1rem; }
            .error p { color: #666; font-size: 1.2rem; }
          </style>
        </head>
        <body>
          <div class="error">
            <h1>500</h1>
            <p>서버 오류가 발생했습니다.</p>
          </div>
        </body>
        </html>
      `);
    }
  });
  
  // Get shared HTML page (공유 페이지 조회 및 다운로드) - API endpoint
  app.get('/api/share/:id', async (req, res) => {
    try {
      const { id } = req.params;
      
      const page = await storage.getSharedHtmlPage(id);
      
      if (!page) {
        return res.status(404).json({ error: '공유 페이지를 찾을 수 없습니다.' });
      }
      
      if (!page.isActive) {
        return res.status(410).json({ error: '이 링크는 만료되었습니다.' });
      }
      
      // Increment download count
      await storage.incrementDownloadCount(id);
      
      // htmlFilePath가 있으면 파일에서 읽기, 없으면 DB에서 읽기
      let htmlContent = page.htmlContent;
      if (page.htmlFilePath && !htmlContent) {
        const fullPath = path.join(process.cwd(), 'public', page.htmlFilePath);
        if (fs.existsSync(fullPath)) {
          htmlContent = fs.readFileSync(fullPath, 'utf8');
        }
      }
      
      res.json({
        success: true,
        id: page.id,
        name: page.name,
        htmlContent: htmlContent,
        sender: page.sender,
        location: page.location,
        featured: page.featured,
        downloadCount: (page.downloadCount || 0) + 1,
        createdAt: page.createdAt,
      });
      
    } catch (error) {
      console.error('공유 페이지 조회 오류:', error);
      res.status(500).json({ error: '공유 페이지 조회에 실패했습니다.' });
    }
  });
  
  // Get featured HTML pages (추천 갤러리)
  app.get('/api/share/featured/list', async (req, res) => {
    try {
      const featuredPages = await storage.getFeaturedHtmlPages();
      
      // 버전 생성: ID + 메타데이터 포함 (2025-11-06 수정)
      // 이유: 메타데이터 변경 시에도 캐시 무효화 필요
      const versionString = featuredPages.map(p => 
        `${p.id}:${p.name}:${p.sender}:${p.location}:${p.updatedAt?.getTime() || 0}`
      ).sort().join(',');
      const version = crypto.createHash('md5').update(versionString).digest('hex').substring(0, 8);
      
      res.json({
        success: true,
        version,
        pages: featuredPages.map(page => ({
          id: page.id,
          name: page.name,
          thumbnail: page.thumbnail,
          sender: page.sender,
          location: page.location,
          downloadCount: page.downloadCount,
          createdAt: page.createdAt,
        })),
      });
      
    } catch (error) {
      console.error('추천 페이지 조회 오류:', error);
      res.status(500).json({ error: '추천 페이지 조회에 실패했습니다.' });
    }
  });

  // ═══════════════════════════════════════════════════════════════════════════════
  // 📊 관리자 대시보드 API (Admin Dashboard API)
  // ═══════════════════════════════════════════════════════════════════════════════
  // ⚠️ CRITICAL: DO NOT MODIFY WITHOUT USER APPROVAL
  // 사용자 승인 없이 절대 수정 금지 - AI 및 모든 개발자 주의
  // Verified: 2025-10-26 | Status: Production-Ready ✅
  // ═══════════════════════════════════════════════════════════════════════════════
  // 
  // 목적: 관리자용 실시간 통계 대시보드 제공
  // 작업 시간: 4시간
  // 핵심 로직:
  //   1. /api/admin/stats - 전체 통계 요약 (사용자, 가이드, 공유, 조회수, DB 크기)
  //   2. /api/admin/analytics - 일별 분석 데이터 (최근 7일 추이)
  //   3. 비밀번호 인증: POST /api/admin/auth (비밀번호: 1234)
  // 
  // 최적화 결과:
  //   - DB 크기: 184MB → 39MB (78% 감소)
  //   - HTML 파일 저장 시스템으로 대용량 데이터 효율화
  //   - Provider별 사용자 분포 추적
  //   - 조회수 상위 10개 공유 페이지 실시간 모니터링
  // ═══════════════════════════════════════════════════════════════════════════════

  /**
   * 📊 GET /api/admin/stats - 전체 통계 요약
   * 
   * 반환 데이터:
   * - totalUsers: 전체 사용자 수
   * - totalGuides: 전체 가이드 수
   * - totalSharedPages: 전체 공유 페이지 수
   * - totalViews: 전체 조회수 합계
   * - usersByProvider: Provider별 사용자 수 (Google, Kakao, Replit)
   * - recentUsers: 최근 7일 신규 사용자 수
   * - topSharedPages: 조회수 상위 10개 공유 페이지
   */
  app.get('/api/admin/stats', requireAdmin, async (req, res) => {
    try {
      // 전체 사용자 수
      const totalUsersResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM users
      `);
      const totalUsers = Number(totalUsersResult.rows[0]?.count || 0);

      // Provider별 사용자 수
      const usersByProviderResult = await db.execute(sql`
        SELECT provider, COUNT(*) as count 
        FROM users 
        GROUP BY provider
      `);
      const usersByProvider = usersByProviderResult.rows.map((row: any) => ({
        provider: row.provider,
        count: Number(row.count)
      }));

      // 최근 7일 신규 사용자
      const recentUsersResult = await db.execute(sql`
        SELECT COUNT(*) as count 
        FROM users 
        WHERE created_at >= NOW() - INTERVAL '7 days'
      `);
      const recentUsers = Number(recentUsersResult.rows[0]?.count || 0);

      // 전체 가이드 수
      const totalGuidesResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM guides
      `);
      const totalGuides = Number(totalGuidesResult.rows[0]?.count || 0);

      // 전체 공유 페이지 수
      const totalSharedPagesResult = await db.execute(sql`
        SELECT COUNT(*) as count FROM shared_html_pages WHERE is_active = true
      `);
      const totalSharedPages = Number(totalSharedPagesResult.rows[0]?.count || 0);

      // 전체 조회수 합계
      const totalViewsResult = await db.execute(sql`
        SELECT COALESCE(SUM(download_count), 0) as total 
        FROM shared_html_pages 
        WHERE is_active = true
      `);
      const totalViews = Number(totalViewsResult.rows[0]?.total || 0);

      // 조회수 상위 10개 공유 페이지
      const topSharedPagesResult = await db.execute(sql`
        SELECT id, name, download_count, created_at, featured
        FROM shared_html_pages 
        WHERE is_active = true
        ORDER BY download_count DESC 
        LIMIT 10
      `);
      const topSharedPages = topSharedPagesResult.rows;

      // DB 크기 정보
      const dbSizeResult = await db.execute(sql`
        SELECT 
          pg_size_pretty(pg_total_relation_size('shared_html_pages')) as shared_pages_size,
          pg_size_pretty(pg_database_size(current_database())) as total_db_size
      `);
      const dbSize = dbSizeResult.rows[0];

      res.json({
        success: true,
        stats: {
          totalUsers,
          totalGuides,
          totalSharedPages,
          totalViews,
          usersByProvider,
          recentUsers,
          topSharedPages,
          database: {
            sharedPagesSize: dbSize?.shared_pages_size || 'N/A',
            totalSize: dbSize?.total_db_size || 'N/A'
          }
        }
      });

    } catch (error) {
      console.error('관리자 통계 조회 오류:', error);
      res.status(500).json({ error: '통계 조회에 실패했습니다.' });
    }
  });

  /**
   * 📈 GET /api/admin/analytics - 상세 분석 데이터
   * 
   * Query Parameters:
   * - period: 'week' | 'month' (기본값: 'week')
   * 
   * 반환 데이터:
   * - dailyUsers: 일별 신규 사용자 수
   * - dailyGuides: 일별 가이드 생성 수
   * - dailyShares: 일별 공유 링크 생성 수
   */
  app.get('/api/admin/analytics', requireAdmin, async (req, res) => {
    try {
      const period = req.query.period === 'month' ? 30 : 7;

      // 일별 신규 사용자
      const dailyUsersResult = await db.execute(sql`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM users
        WHERE created_at >= NOW() - INTERVAL '${sql.raw(period.toString())} days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      // 일별 가이드 생성
      const dailyGuidesResult = await db.execute(sql`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM guides
        WHERE created_at >= NOW() - INTERVAL '${sql.raw(period.toString())} days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      // 일별 공유 링크 생성
      const dailySharesResult = await db.execute(sql`
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM shared_html_pages
        WHERE created_at >= NOW() - INTERVAL '${sql.raw(period.toString())} days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);

      res.json({
        success: true,
        analytics: {
          dailyUsers: dailyUsersResult.rows,
          dailyGuides: dailyGuidesResult.rows,
          dailyShares: dailySharesResult.rows
        }
      });

    } catch (error) {
      console.error('분석 데이터 조회 오류:', error);
      res.status(500).json({ error: '분석 데이터 조회에 실패했습니다.' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
