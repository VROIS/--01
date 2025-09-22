import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateLocationBasedContent, getLocationName, generateShareLinkDescription, type GuideContent } from "./gemini";
import { insertGuideSchema, insertShareLinkSchema } from "@shared/schema";
import { GoogleGenAI } from "@google/genai";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

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
      if (user?.email === 'admin123' || user?.isAdmin) {
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
      if (user?.email === 'admin123' || user?.isAdmin) {
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

  const httpServer = createServer(app);
  return httpServer;
}
