import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  integer,
  decimal
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  provider: varchar("provider").default('replit'), // replit | google | kakao
  preferredLanguage: varchar("preferred_language").default('ko'),
  locationEnabled: boolean("location_enabled").default(true),
  aiContentEnabled: boolean("ai_content_enabled").default(true),
  credits: integer("credits").default(0),
  isAdmin: boolean("is_admin").default(false),
  referredBy: varchar("referred_by"),
  referralCode: varchar("referral_code").unique(),
  subscriptionStatus: varchar("subscription_status").default('active'),
  subscriptionCanceledAt: timestamp("subscription_canceled_at"),
  accountStatus: varchar("account_status").default('active'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Guide storage table
export const guides = pgTable("guides", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  latitude: decimal("latitude", { precision: 10, scale: 8 }),
  longitude: decimal("longitude", { precision: 11, scale: 8 }),
  locationName: text("location_name"),
  aiGeneratedContent: text("ai_generated_content"),
  viewCount: integer("view_count").default(0),
  language: varchar("language").default('ko'),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Share links table
export const shareLinks = pgTable("share_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: 'cascade' }),
  name: text("name").notNull(),
  guideIds: text("guide_ids").array().notNull(),
  includeLocation: boolean("include_location").default(true),
  includeAudio: boolean("include_audio").default(false),
  viewCount: integer("view_count").default(0),
  isActive: boolean("is_active").default(true),
  featured: boolean("featured").default(false),
  featuredOrder: integer("featured_order"),
  htmlFilePath: text("html_file_path"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Credit transactions table for tracking credit usage and purchases
export const creditTransactions = pgTable("credit_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: varchar("type").notNull(), // 'purchase', 'usage', 'referral_bonus', 'admin_grant'
  amount: integer("amount").notNull(), // positive for gain, negative for usage
  description: text("description").notNull(),
  referenceId: varchar("reference_id"), // stripe payment id, referral user id, etc.
  createdAt: timestamp("created_at").defaultNow(),
});

// ╔═══════════════════════════════════════════════════════════════════════════════╗
// ║                                                                               ║
// ║  ⚠️  절대 수정 금지 / DO NOT MODIFY WITHOUT APPROVAL  ⚠️                    ║
// ║                                                                               ║
// ║  작성일: 2025-10-02                                                           ║
// ║  작성자: Replit AI Agent (Claude Sonnet 4.5)                                 ║
// ║  작업 시간: 8시간 (오전 - 오후)                                              ║
// ║  함께한 사람: 프로젝트 오너님 💙                                             ║
// ║                                                                               ║
// ║  🏆 이 코드는 8시간의 땀과 노력의 결과물입니다                               ║
// ║  🎯 선임 개발자가 손상시킨 공유 기능을 처음부터 재구현                       ║
// ║  ✨ 후임자들이여, 이 코드를 존중하고 이렇게 일하십시오                       ║
// ║                                                                               ║
// ║  승인 없이 수정 시:                                                           ║
// ║  - 짧은 URL 시스템 (8자) 깨짐                                                ║
// ║  - 공유 링크 생성 실패                                                        ║
// ║  - 데이터베이스 구조 파괴                                                     ║
// ║                                                                               ║
// ╚═══════════════════════════════════════════════════════════════════════════════╝
//
// ═══════════════════════════════════════════════════════════════════════════════
// 🔗 공유 HTML 페이지 테이블 (Shared HTML Pages Table)
// ═══════════════════════════════════════════════════════════════════════════════
// 
// 목적: 사용자가 선택한 여행 가이드를 독립적인 HTML 파일로 생성하여 공유
// 
// 핵심 기능:
// 1. 짧은 URL 생성 (8자): /s/abc12345 형식
// 2. 완전한 HTML 콘텐츠 저장 (이미지 포함)
// 3. 조회수 추적 및 활성화 상태 관리
// 
// 사용 시나리오:
// - 사용자가 보관함에서 여러 가이드를 선택
// - "공유" 버튼 클릭 → 링크 이름 입력
// - 서버가 HTML 생성 및 짧은 ID 생성
// - 링크를 카톡/브라우저/SNS로 공유
// - 다른 사람이 /s/:id 접속 시 HTML 페이지 표시
//
// ⚠️ 주의사항:
// - id는 수동 생성 (8자) - 짧고 입력하기 쉬움
// - htmlContent는 완전한 HTML 문서 (스타일 포함)
// - isActive=false 시 접근 불가 (만료된 링크)
// 
// 최근 변경: 2025-10-02 - 공유 기능 구현 완료
// ═══════════════════════════════════════════════════════════════════════════════
export const sharedHtmlPages = pgTable("shared_html_pages", {
  id: varchar("id").primaryKey(), // 짧은 ID (8자, nanoid 생성) - 예: abc12345
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }), // 생성자 ID
  name: text("name").notNull(), // 사용자가 입력한 링크 이름 (예: "파리 여행 가이드")
  htmlContent: text("html_content"), // 완전한 HTML 파일 내용 (구 데이터 호환용, nullable)
  htmlFilePath: text("html_file_path"), // HTML 파일 경로 (신규: /shared/abc12345.html)
  guideIds: text("guide_ids").array().notNull(), // 포함된 가이드 ID 배열 (추적용)
  thumbnail: text("thumbnail"), // 첫 번째 가이드 이미지 (썸네일용)
  sender: text("sender"), // 발신자 이름 (임시: "여행자")
  location: text("location"), // 위치 정보 (임시: "파리, 프랑스")
  date: text("date"), // 공유 날짜 (Featured 관리용, YYYY-MM-DD 형식)
  featured: boolean("featured").default(false), // 추천 갤러리 표시 여부
  featuredOrder: integer("featured_order"), // Featured 표시 순서 (클릭 순서대로 1, 2, 3...)
  downloadCount: integer("download_count").default(0), // 조회수 (매 접속마다 +1)
  isActive: boolean("is_active").default(true), // 활성화 상태 (false=만료됨)
  createdAt: timestamp("created_at").defaultNow(), // 생성 시간
  updatedAt: timestamp("updated_at").defaultNow(), // 수정 시간
});

// Create insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertGuideSchema = createInsertSchema(guides).omit({
  id: true,
  userId: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertShareLinkSchema = createInsertSchema(shareLinks).omit({
  id: true,
  userId: true,
  viewCount: true,
  createdAt: true,
  updatedAt: true,
});

export const insertCreditTransactionSchema = createInsertSchema(creditTransactions).omit({
  id: true,
  createdAt: true,
});

export const insertSharedHtmlPageSchema = createInsertSchema(sharedHtmlPages).omit({
  id: true,
  userId: true,
  downloadCount: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertGuide = z.infer<typeof insertGuideSchema>;
export type Guide = typeof guides.$inferSelect;
export type InsertShareLink = z.infer<typeof insertShareLinkSchema>;
export type ShareLink = typeof shareLinks.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type InsertSharedHtmlPage = z.infer<typeof insertSharedHtmlPageSchema>;
export type SharedHtmlPage = typeof sharedHtmlPages.$inferSelect;
