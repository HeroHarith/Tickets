/**
 * Add-ons Schema
 * 
 * This file defines the schema for event add-ons and purchased add-ons
 */

import { pgTable, serial, integer, text, numeric, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";
import { events, tickets } from "./schema";

// Purchased add-ons model
export const purchasedAddOns = pgTable("purchased_add_ons", {
  id: serial("id").primaryKey(),
  ticketId: integer("ticket_id").notNull().references(() => tickets.id, { onDelete: "cascade" }),
  addOnId: integer("add_on_id").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  note: text("note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define schema for purchased add-on
export const purchasedAddOnSchema = createInsertSchema(purchasedAddOns).omit({
  id: true,
  createdAt: true,
});

export type PurchasedAddOn = typeof purchasedAddOns.$inferSelect;
export type InsertPurchasedAddOn = z.infer<typeof purchasedAddOnSchema>;

// Relations
export const purchasedAddOnsRelations = relations(purchasedAddOns, ({ one }) => ({
  ticket: one(tickets, {
    fields: [purchasedAddOns.ticketId],
    references: [tickets.id],
  }),
}));