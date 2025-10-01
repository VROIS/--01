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

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertGuide = z.infer<typeof insertGuideSchema>;
export type Guide = typeof guides.$inferSelect;
export type InsertShareLink = z.infer<typeof insertShareLinkSchema>;
export type ShareLink = typeof shareLinks.$inferSelect;
export type InsertCreditTransaction = z.infer<typeof insertCreditTransactionSchema>;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
