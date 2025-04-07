import { pgTable, text, serial, integer, boolean, timestamp, varchar, numeric, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles
export const USER_ROLES = ["customer", "eventManager", "admin"] as const;
export const roleSchema = z.enum(USER_ROLES);
export type Role = z.infer<typeof roleSchema>;

// User model
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role").default("customer").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Event Types
export const EVENT_TYPES = ["general", "conference", "seated"] as const;
export const eventTypeSchema = z.enum(EVENT_TYPES);
export type EventType = z.infer<typeof eventTypeSchema>;

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
  eventType: text("event_type").default("general").notNull(), // Type of event: general, conference, seated
  seatingMap: jsonb("seating_map"), // For seated events, store a seating chart configuration
  organizer: integer("organizer_id").notNull(), // References users.id
  createdAt: timestamp("created_at").defaultNow().notNull(),
  featured: boolean("featured").default(false).notNull(),
  latitude: real("latitude"), // For location-based radius search
  longitude: real("longitude"), // For location-based radius search
  tags: text("tags").array(), // Store event tags as an array of strings
  ticketsSold: integer("tickets_sold").default(0).notNull(), // Count of tickets sold for popularity sorting
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
  ticketFeatures: jsonb("ticket_features"), // Additional features (like lunch for conferences, etc.)
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
  qrCode: text("qr_code"), // QR code data for ticket validation
  isUsed: boolean("is_used").default(false).notNull(), // Track if ticket has been used
  seatAssignment: jsonb("seat_assignment"), // For seated events: [{"row": "A", "seat": 5}, ...]
  attendeeDetails: jsonb("attendee_details"), // Store customer details for each ticket
  emailSent: boolean("email_sent").default(false).notNull(), // Track if confirmation email was sent
});

// Customer details schema for ticket purchase
export const attendeeDetailsSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  specialRequirements: z.string().optional(),
});

export type AttendeeDetails = z.infer<typeof attendeeDetailsSchema>;

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
      attendeeDetails: z.array(attendeeDetailsSchema)
        .optional()
        .default([]),
    })
  ).min(1, "At least one ticket must be selected"),
  eventId: z.number(),
  // Primary attendee/purchaser details
  customerDetails: attendeeDetailsSchema
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

export const EVENT_DATE_FILTERS = [
  "all", 
  "today", 
  "tomorrow", 
  "this-week", 
  "this-weekend", 
  "this-month", 
  "future"
] as const;

export const EVENT_PRICE_FILTERS = [
  "all",
  "free",
  "paid",
  "low-price",
  "mid-price",
  "high-price",
  "under-25",
  "25-to-50",
  "50-to-100",
  "over-100"
] as const;

export const categorySchema = z.enum(EVENT_CATEGORIES);
export type Category = z.infer<typeof categorySchema>;

export const dateFilterSchema = z.enum(EVENT_DATE_FILTERS);
export type DateFilter = z.infer<typeof dateFilterSchema>;

export const priceFilterSchema = z.enum(EVENT_PRICE_FILTERS);
export type PriceFilter = z.infer<typeof priceFilterSchema>;

// Popularity filters for trending events
export const EVENT_POPULARITY_FILTERS = [
  "all",
  "trending",
  "popular",
  "almost-sold-out",
  "just-announced",
  "most-tickets-sold", 
  "newest",
  "ending-soon"
] as const;

export const popularityFilterSchema = z.enum(EVENT_POPULARITY_FILTERS);
export type PopularityFilter = z.infer<typeof popularityFilterSchema>;

// Event tags for more specific filtering
export const EVENT_TAGS = [
  "family-friendly",
  "18-plus", 
  "21-plus",
  "outdoor",
  "indoor",
  "virtual",
  "weekend",
  "weekday",
  "evening",
  "morning",
  "afternoon",
  "accessibility"
] as const;

export const eventTagSchema = z.enum(EVENT_TAGS);
export type EventTag = z.infer<typeof eventTagSchema>;

export const eventSearchSchema = z.object({
  search: z.string().optional(),
  category: categorySchema.optional(),
  eventType: eventTypeSchema.optional(),
  dateFilter: dateFilterSchema.optional(),
  priceFilter: priceFilterSchema.optional(),
  popularityFilter: popularityFilterSchema.optional(),
  minDate: z.string().optional(),
  maxDate: z.string().optional(),
  location: z.string().optional(),
  radiusMiles: z.number().optional(),
  tags: z.array(eventTagSchema).optional(),
  featured: z.boolean().optional(),
  organizer: z.number().optional(),
  sortBy: z.enum(['date-asc', 'date-desc', 'price-asc', 'price-desc', 'popularity-desc']).optional().default('date-desc')
});

export type EventSearchParams = z.infer<typeof eventSearchSchema>;
