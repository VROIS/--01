import {
  users,
  guides,
  shareLinks,
  creditTransactions,
  type User,
  type UpsertUser,
  type Guide,
  type InsertGuide,
  type ShareLink,
  type InsertShareLink,
  type CreditTransaction,
  type InsertCreditTransaction
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, inArray, and, sql } from "drizzle-orm";
import crypto from "crypto";

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
  
  // Credit operations
  getUserCredits(userId: string): Promise<number>;
  updateUserCredits(userId: string, amount: number): Promise<User>;
  deductCredits(userId: string, amount: number, description: string): Promise<boolean>;
  addCredits(userId: string, amount: number, type: string, description: string, referenceId?: string): Promise<User>;
  getCreditHistory(userId: string, limit?: number): Promise<CreditTransaction[]>;
  awardSignupBonus(userId: string, referrerCode: string): Promise<{ bonusAwarded: boolean, newBalance: number, message?: string }>;
  generateReferralCode(userId: string): Promise<string>;
  processReferralReward(referralCode: string, newUserId: string): Promise<void>;
  processCashbackReward(paymentAmount: number, userId: string): Promise<void>;
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
    // Generate short, URL-friendly ID (8 characters)
    const generateShortId = () => crypto.randomBytes(6).toString('base64url').slice(0, 8);
    
    let attempts = 0;
    const maxAttempts = 5;
    
    while (attempts < maxAttempts) {
      try {
        const shortId = generateShortId();
        
        const [newShareLink] = await db
          .insert(shareLinks)
          .values({ ...shareLink, id: shortId, userId })
          .returning();
        
        // 🎁 공유링크 생성 보상: 1 크레딧 지급
        await this.addCredits(
          userId, 
          1, 
          'share_link_bonus', 
          `공유링크 생성 보상: ${shareLink.name}`
        );
        
        return newShareLink;
      } catch (error: any) {
        attempts++;
        if (error?.code === '23505' && attempts < maxAttempts) {
          // Unique constraint violation - try again with new ID
          console.log(`🔄 ID 충돌 발생 (시도 ${attempts}/${maxAttempts}), 재시도 중...`);
          continue;
        }
        throw error;
      }
    }
    
    throw new Error(`💥 ${maxAttempts}회 시도 후 고유 ID 생성 실패. 다시 시도해주세요.`);
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

  // Credit operations
  async getUserCredits(userId: string): Promise<number> {
    const user = await this.getUser(userId);
    return user?.credits || 0;
  }

  async updateUserCredits(userId: string, amount: number): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ credits: amount, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async deductCredits(userId: string, amount: number, description: string): Promise<boolean> {
    const user = await this.getUser(userId);
    if (!user || (user.credits || 0) < amount) return false;
    
    const newCredits = (user.credits || 0) - amount;
    await this.updateUserCredits(userId, newCredits);
    
    // Record transaction
    await db.insert(creditTransactions).values({
      userId,
      type: 'usage',
      amount: -amount,
      description,
    });
    
    return true;
  }

  async addCredits(userId: string, amount: number, type: string, description: string, referenceId?: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');
    
    const newCredits = (user.credits || 0) + amount;
    const updatedUser = await this.updateUserCredits(userId, newCredits);
    
    // Record transaction
    await db.insert(creditTransactions).values({
      userId,
      type,
      amount,
      description,
      referenceId,
    });
    
    return updatedUser;
  }

  async getCreditHistory(userId: string, limit: number = 50): Promise<CreditTransaction[]> {
    return await db
      .select()
      .from(creditTransactions)
      .where(eq(creditTransactions.userId, userId))
      .orderBy(desc(creditTransactions.createdAt))
      .limit(limit);
  }

  async awardSignupBonus(userId: string, referrerCode: string): Promise<{ bonusAwarded: boolean, newBalance: number, message?: string }> {
    // 이미 보너스를 받았는지 확인
    const existingBonus = await db.query.creditTransactions.findFirst({
      where: and(
        eq(creditTransactions.userId, userId),
        eq(creditTransactions.type, 'referral_signup_bonus')
      )
    });
    
    if (existingBonus) {
      const currentCredits = await this.getUserCredits(userId);
      return { bonusAwarded: false, newBalance: currentCredits, message: 'Already received signup bonus' };
    }
    
    // 추천인 찾기
    const referrer = await db.query.users.findFirst({
      where: eq(users.referralCode, referrerCode)
    });
    
    if (!referrer) {
      const currentCredits = await this.getUserCredits(userId);
      return { bonusAwarded: false, newBalance: currentCredits, message: 'Invalid referral code' };
    }
    
    // 자기 자신 추천 방지
    if (referrer.id === userId) {
      const currentCredits = await this.getUserCredits(userId);
      return { bonusAwarded: false, newBalance: currentCredits, message: 'Cannot refer yourself' };
    }
    
    // 새 사용자에게 2크레딧 지급
    const user = await this.addCredits(userId, 2, 'referral_signup_bonus', `${referrerCode}님의 추천으로 가입 보너스`, referrer.id);
    
    // 추천인에게도 1크레딧 지급
    await this.addCredits(referrer.id, 1, 'referral_reward', `${userId} 추천 성공 보상`, userId);
    
    // 사용자의 추천인 정보 업데이트
    await db.update(users)
      .set({ referredBy: referrer.id })
      .where(eq(users.id, userId));
    
    return { bonusAwarded: true, newBalance: user.credits };
  }

  async generateReferralCode(userId: string): Promise<string> {
    const user = await this.getUser(userId);
    if (!user) throw new Error('User not found');
    
    if (user.referralCode) return user.referralCode;
    
    // Generate unique referral code
    const referralCode = `REF_${userId.substring(0, 8)}_${Date.now().toString(36)}`;
    
    const [updatedUser] = await db
      .update(users)
      .set({ referralCode, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
      
    return updatedUser.referralCode!;
  }

  async processReferralReward(referralCode: string, newUserId: string): Promise<void> {
    // Find referrer by referral code
    const [referrer] = await db
      .select()
      .from(users)
      .where(eq(users.referralCode, referralCode));
    
    if (!referrer) return;
    
    // Set referredBy for new user
    await db
      .update(users)
      .set({ referredBy: referrer.id, updatedAt: new Date() })
      .where(eq(users.id, newUserId));
    
    // 🎁 향상된 추천 보상: 추천인 5 크레딧, 신규 2 크레딧
    await this.addCredits(
      referrer.id, 
      5, 
      'referral_bonus', 
      `추천 보상: ${newUserId}`, 
      newUserId
    );
    
    await this.addCredits(
      newUserId,
      2,
      'referral_bonus',
      `추천 가입 보너스`,
      referrer.id
    );
  }

  async processCashbackReward(paymentAmount: number, userId: string): Promise<void> {
    const user = await this.getUser(userId);
    if (!user?.referredBy) return;
    
    // 💰 현금 킥백: 결제 금액의 30%를 추천인에게
    const cashbackAmount = Math.round(paymentAmount * 0.3);
    
    await this.addCredits(
      user.referredBy,
      cashbackAmount,
      'cashback_reward',
      `현금 킥백: $${(paymentAmount/100).toFixed(2)}의 30%`,
      userId
    );
    
    // 📊 킥백 지급 기록
    await db.insert(creditTransactions).values({
      userId: user.referredBy,
      type: 'cashback_reward',
      amount: cashbackAmount,
      description: `💰 현금 킥백: ${user.email || userId}님 결제 $${(paymentAmount/100).toFixed(2)}`,
      referenceId: userId,
    });
  }
}

export const storage = new DatabaseStorage();
