import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateLocationBasedContent, getLocationName, generateShareLinkDescription, generateCinematicPrompt, optimizeAudioScript, type GuideContent, type DreamShotPrompt } from "./gemini";
import { insertGuideSchema, insertShareLinkSchema } from "@shared/schema";
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

export async function registerRoutes(app: Express): Promise<Server> {
  // Vanilla JS App API Routes (No authentication required)
  
  // API health check endpoint
  app.head('/api', (req, res) => {
    res.status(200).end();
  });
  
  app.get('/api', (req, res) => {
    res.json({ status: 'ok', message: '내손가이드 API 서버가 정상 작동 중입니다.' });
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

      const model = 'gemini-2.5-flash';
      const contents = { parts };

      const config: any = {
        systemInstruction,
        thinkingConfig: { thinkingBudget: 0 } // Speed optimization
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

  // Database-based share endpoints
  app.post('/api/share', isAuthenticated, async (req: any, res) => {
    try {
      const { contents } = req.body;
      const userId = req.user.claims.sub;
      
      if (!Array.isArray(contents) || contents.length === 0) {
        return res.status(400).json({ error: "공유할 항목이 없습니다." });
      }
      
      if (contents.length > 30) {
        return res.status(400).json({ error: "한 번에 최대 30개까지만 공유할 수 있습니다." });
      }

      // Create share link in database  
      const guideIds = contents.map(guide => guide.id);
      const shareLinkData = {
        name: '', // 기본값은 빈 문자열, 사용자가 나중에 입력
        guideIds: guideIds,
        includeLocation: true,
        includeAudio: false
      };
      const shareLink = await storage.createShareLink(userId, shareLinkData);
      
      res.json({ guidebookId: shareLink.id });
    } catch (error) {
      console.error("Share 생성 오류:", error);
      res.status(500).json({ error: "가이드북 생성 중 오류가 발생했습니다." });
    }
  });

  app.get('/api/share', async (req, res) => {
    try {
      const shareId = req.query.id;
      
      if (!shareId) {
        return res.status(400).json({ error: "가이드북 ID가 필요합니다." });
      }

      // Get share link from database
      const shareLink = await storage.getShareLink(shareId as string);
      
      if (!shareLink || !shareLink.isActive) {
        return res.status(404).json({ error: `해당 가이드북(${shareId})을 찾을 수 없습니다.` });
      }

      // Increment view count
      await storage.incrementShareLinkViews(shareId as string);
      
      res.json(shareLink);
      
    } catch (error) {
      console.error("Share 조회 오류:", error);
      res.status(500).json({ error: "가이드북을 불러오는 중 오류가 발생했습니다." });
    }
  });

  // Update share name endpoint
  app.put('/api/share/:id/name', async (req, res) => {
    try {
      const shareId = req.params.id;
      const { name } = req.body;
      
      if (!name || typeof name !== 'string' || name.trim() === '') {
        return res.status(400).json({ error: "유효한 링크 이름이 필요합니다." });
      }
      
      // Update share link name in database
      const updated = await storage.updateShareLink(shareId, { name: name.trim() });
      
      if (!updated) {
        return res.status(404).json({ error: `해당 가이드북(${shareId})을 찾을 수 없습니다.` });
      }
      
      res.json({ success: true, name: name.trim() });
      
    } catch (error) {
      console.error("Share 이름 업데이트 오류:", error);
      res.status(500).json({ error: "링크 이름 업데이트 중 오류가 발생했습니다." });
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
            <a href="/" style="color: #007bff; text-decoration: none;">내손가이드 홈페이지로 이동</a>
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
            <a href="/" style="color: #007bff; text-decoration: none;">내손가이드 홈페이지로 이동</a>
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
          location: shareLink.includeLocation ? (guide.locationName || undefined) : undefined
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

      // Set proper headers for caching and content type
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=300'); // 5 minute cache
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
          <a href="/" style="color: #007bff; text-decoration: none;">내손가이드 홈페이지로 이동</a>
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
          location: includeLocation ? (guide.locationName || undefined) : undefined
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

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User preferences
  app.patch('/api/user/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const preferences = req.body;
      
      const user = await storage.updateUserPreferences(userId, preferences);
      res.json(user);
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  // Guide routes
  app.get('/api/guides', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const guides = await storage.getUserGuides(userId);
      res.json(guides);
    } catch (error) {
      console.error("Error fetching guides:", error);
      res.status(500).json({ message: "Failed to fetch guides" });
    }
  });

  app.post('/api/guides', isAuthenticated, upload.single('image'), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      
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
      const userId = req.user.claims.sub;
      const shareLinks = await storage.getUserShareLinks(userId);
      res.json(shareLinks);
    } catch (error) {
      console.error("Error fetching share links:", error);
      res.status(500).json({ message: "Failed to fetch share links" });
    }
  });

  app.post('/api/share-links', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
      const history = await storage.getCreditHistory(userId);
      res.json(history);
    } catch (error) {
      console.error("Error fetching credit history:", error);
      res.status(500).json({ message: "Failed to fetch credit history" });
    }
  });

  app.post('/api/credits/deduct', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
      const userId = req.user.claims.sub;
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
          location: includeLocation ? (guide.locationName || undefined) : undefined
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
      const userId = req.user.claims.sub;
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

  const httpServer = createServer(app);
  return httpServer;
}
