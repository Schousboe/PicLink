import { sql } from "drizzle-orm";
import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const images = sqliteTable("images", {
  id: text("id").primaryKey(),
  provider: text("provider", { enum: ["cloudinary", "local"] }).notNull(),
  providerKey: text("provider_key").notNull(),
  rawUrl: text("raw_url").notNull(),
  width: integer("width"),
  height: integer("height"),
  mime: text("mime").notNull(),
  size: integer("size").notNull(), // bytes
  deleteToken: text("delete_token").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const insertImageSchema = createInsertSchema(images).omit({
  createdAt: true,
});

export type InsertImage = z.infer<typeof insertImageSchema>;
export type Image = typeof images.$inferSelect;

// Upload response type
export const uploadResponseSchema = z.object({
  id: z.string(),
  rawUrl: z.string(),
  shortUrl: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  size: z.number(),
  mime: z.string(),
});

export type UploadResponse = z.infer<typeof uploadResponseSchema>;
