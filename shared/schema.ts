import { pgTable, text, serial, integer, boolean, timestamp, varchar, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Event model
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date"),
  category: text("category").notNull(),
  imageUrl: text("image_url"),
  organizer: integer("organizer_id").notNull(), // References users.id
  createdAt: timestamp("created_at").defaultNow().notNull(),
  featured: boolean("featured").default(false).notNull(),
});

// Ticket Type model
export const ticketTypes = pgTable("ticket_types", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(), // References events.id
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  availableQuantity: integer("available_quantity").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Ticket model (purchased tickets)
export const tickets = pgTable("tickets", {
  id: serial("id").primaryKey(),
  ticketTypeId: integer("ticket_type_id").notNull(), // References ticketTypes.id
  eventId: integer("event_id").notNull(), // References events.id
  userId: integer("user_id").notNull(), // References users.id
  purchaseDate: timestamp("purchase_date").defaultNow().notNull(),
  quantity: integer("quantity").notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  orderId: text("order_id").notNull(), // For grouping tickets in an order
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertEventSchema = createInsertSchema(events).omit({
  id: true,
  createdAt: true,
});

export const insertTicketTypeSchema = createInsertSchema(ticketTypes).omit({
  id: true,
  createdAt: true,
});

export const insertTicketSchema = createInsertSchema(tickets).omit({
  id: true,
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type TicketType = typeof ticketTypes.$inferSelect;
export type InsertTicketType = z.infer<typeof insertTicketTypeSchema>;

export type Ticket = typeof tickets.$inferSelect;
export type InsertTicket = z.infer<typeof insertTicketSchema>;

// Extended schemas for validation
export const createEventSchema = insertEventSchema.extend({
  startDate: z.coerce.date(),
  endDate: z.coerce.date().optional().nullable(),
  ticketTypes: z.array(
    insertTicketTypeSchema.omit({ eventId: true })
  ).min(1, "At least one ticket type is required"),
});

export type CreateEventInput = z.infer<typeof createEventSchema>;

export const purchaseTicketSchema = z.object({
  ticketSelections: z.array(
    z.object({
      ticketTypeId: z.number(),
      quantity: z.number().min(1),
    })
  ).min(1, "At least one ticket must be selected"),
  eventId: z.number(),
});

export type PurchaseTicketInput = z.infer<typeof purchaseTicketSchema>;

// Categories
export const EVENT_CATEGORIES = [
  "Music",
  "Sports",
  "Arts",
  "Business",
  "Food",
  "Wellness",
  "Tech",
  "Comedy"
] as const;

export const categorySchema = z.enum(EVENT_CATEGORIES);
export type Category = z.infer<typeof categorySchema>;
