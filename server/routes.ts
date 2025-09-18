import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { generateLocationBasedContent, getLocationName, generateShareLinkDescription } from "./gemini";
import { insertGuideSchema, insertShareLinkSchema } from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";

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

export async function registerRoutes(app: Express): Promise<Server> {
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
  app.use('/uploads', (req, res, next) => {
    const imagePath = path.join('.', 'uploads', req.path);
    if (fs.existsSync(imagePath)) {
      res.sendFile(path.resolve(imagePath));
    } else {
      res.status(404).json({ message: "Image not found" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
