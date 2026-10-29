import { pgTable, text, jsonb, integer, timestamp } from 'drizzle-orm/pg-core';
export const pages = pgTable('builder_pages', {
  id: text().primaryKey(),
  draft: jsonb().notNull(),
  published: jsonb(),
  revision: integer().notNull().default(1),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
