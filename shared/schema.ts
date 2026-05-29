import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: text("id").notNull().primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  isOnline: boolean("is_online").notNull().default(false),
  lastSeen: timestamp("last_seen").notNull().defaultNow(),
  displayName: text("display_name").notNull().default(""),
  bio: text("bio").notNull().default("Hey there! I am using QuickTalk."),
  avatarUrl: text("avatar_url").notNull().default(""),
});

export const groups = pgTable("groups", {
  id: text("id").notNull().primaryKey(),
  name: text("name").notNull(),
  adminId: text("admin_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const groupMembers = pgTable("group_members", {
  groupId: text("group_id").notNull(),
  userId: text("user_id").notNull(),
});

export const messages = pgTable("messages", {
  id: text("id").notNull().primaryKey(),
  senderId: text("sender_id").notNull(),
  recipientId: text("recipient_id"),
  groupId: text("group_id"),
  content: text("content").notNull(),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  isDeleted: boolean("is_deleted").notNull().default(false),
  timestamp: timestamp("timestamp").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertGroupSchema = createInsertSchema(groups).pick({
  name: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  recipientId: true,
  groupId: true,
  content: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Group = typeof groups.$inferSelect & { 
  memberIds: string[];
  adminIds: string[];
  onlyAdminsCanEditInfo: boolean;
  onlyAdminsCanSendMessages: boolean;
};
export type InsertGroup = z.infer<typeof insertGroupSchema>;