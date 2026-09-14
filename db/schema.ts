import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const complaints = sqliteTable('complaints',{id:text('id').primaryKey(),payload:text('payload').notNull(),version:integer('version').notNull().default(1)});
