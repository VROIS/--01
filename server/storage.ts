import {
  users,
  guides,
  shareLinks,
  type User,
  type UpsertUser,
  type Guide,
  type InsertGuide,
  type ShareLink,
  type InsertShareLink
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, inArray, and, sql } from "drizzle-orm";

export interface IStorage {
  // User operations (mandatory for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserPreferences(userId: string, preferences: Partial<User>): Promise<User>;
  
  // Guide operations
  createGuide(userId: string, guide: InsertGuide): Promise<Guide>;
  getUserGuides(userId: string): Promise<Guide[]>;
  getGuide(id: string): Promise<Guide | undefined>;
  getGuidesByIds(ids: string[]): Promise<Guide[]>;
  updateGuide(id: string, updates: Partial<InsertGuide>): Promise<Guide>;
  deleteGuide(id: string): Promise<void>;
  incrementGuideViews(id: string): Promise<void>;
  
  // Share link operations
  createShareLink(userId: string, shareLink: InsertShareLink): Promise<ShareLink>;
  getUserShareLinks(userId: string): Promise<ShareLink[]>;
  getShareLink(id: string): Promise<ShareLink | undefined>;
  updateShareLink(id: string, updates: Partial<InsertShareLink>): Promise<ShareLink>;
  deleteShareLink(id: string): Promise<void>;
  incrementShareLinkViews(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserPreferences(userId: string, preferences: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...preferences, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Guide operations
  async createGuide(userId: string, guide: InsertGuide): Promise<Guide> {
    const [newGuide] = await db
      .insert(guides)
      .values({ ...guide, userId })
      .returning();
    return newGuide;
  }

  async getUserGuides(userId: string): Promise<Guide[]> {
    return await db
      .select()
      .from(guides)
      .where(eq(guides.userId, userId))
      .orderBy(desc(guides.createdAt));
  }

  async getGuide(id: string): Promise<Guide | undefined> {
    const [guide] = await db.select().from(guides).where(eq(guides.id, id));
    return guide;
  }

  async getGuidesByIds(ids: string[]): Promise<Guide[]> {
    if (ids.length === 0) return [];
    return await db.select().from(guides).where(inArray(guides.id, ids));
  }

  async updateGuide(id: string, updates: Partial<InsertGuide>): Promise<Guide> {
    const [guide] = await db
      .update(guides)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(guides.id, id))
      .returning();
    return guide;
  }

  async deleteGuide(id: string): Promise<void> {
    await db.delete(guides).where(eq(guides.id, id));
  }

  async incrementGuideViews(id: string): Promise<void> {
    await db
      .update(guides)
      .set({ viewCount: sql`view_count + 1` })
      .where(eq(guides.id, id));
  }

  // Share link operations
  async createShareLink(userId: string, shareLink: InsertShareLink): Promise<ShareLink> {
    const [newShareLink] = await db
      .insert(shareLinks)
      .values({ ...shareLink, userId })
      .returning();
    return newShareLink;
  }

  async getUserShareLinks(userId: string): Promise<ShareLink[]> {
    return await db
      .select()
      .from(shareLinks)
      .where(and(eq(shareLinks.userId, userId), eq(shareLinks.isActive, true)))
      .orderBy(desc(shareLinks.createdAt));
  }

  async getShareLink(id: string): Promise<ShareLink | undefined> {
    const [shareLink] = await db.select().from(shareLinks).where(eq(shareLinks.id, id));
    return shareLink;
  }

  async updateShareLink(id: string, updates: Partial<InsertShareLink>): Promise<ShareLink> {
    const [shareLink] = await db
      .update(shareLinks)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(shareLinks.id, id))
      .returning();
    return shareLink;
  }

  async deleteShareLink(id: string): Promise<void> {
    await db
      .update(shareLinks)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(shareLinks.id, id));
  }

  async incrementShareLinkViews(id: string): Promise<void> {
    await db
      .update(shareLinks)
      .set({ viewCount: sql`view_count + 1` })
      .where(eq(shareLinks.id, id));
  }
}

export const storage = new DatabaseStorage();
