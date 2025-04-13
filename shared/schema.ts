import { pgTable, text, serial, integer, boolean, timestamp, varchar, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// User roles
export const USER_ROLES = ["customer", "eventManager", "admin", "center"] as const;
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
  emailVerified: boolean("email_verified").default(false).notNull(),
  verificationToken: text("verification_token"),
  verificationTokenExpires: timestamp("verification_token_expires"),
  resetToken: text("reset_token"),
  resetTokenExpires: timestamp("reset_token_expires"),
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
  paymentSessionId: text("payment_session_id"), // Thawani payment session ID
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

export const eventSearchSchema = z.object({
  search: z.string().optional(),
  category: categorySchema.optional(),
  dateFilter: dateFilterSchema.optional(),
  priceFilter: priceFilterSchema.optional(),
  minDate: z.string().optional(),
  maxDate: z.string().optional(),
  location: z.string().optional(),
  featured: z.boolean().optional(),
  organizer: z.number().optional(),
  sortBy: z.enum(['date-asc', 'date-desc', 'price-asc', 'price-desc']).optional().default('date-desc')
});

export type EventSearchParams = z.infer<typeof eventSearchSchema>;

// Venue model
export const venues = pgTable("venues", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location").notNull(),
  capacity: integer("capacity"),
  hourlyRate: numeric("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  dailyRate: numeric("daily_rate", { precision: 10, scale: 2 }),
  facilities: jsonb("facilities"), // List of available facilities like projector, AC, etc.
  availabilityHours: jsonb("availability_hours"), // Operating hours
  ownerId: integer("owner_id").notNull(), // References users.id with role "center"
  images: jsonb("images"), // Array of image URLs
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Cashier model for venue centers
export const cashiers = pgTable("cashiers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(), // References users.id
  ownerId: integer("owner_id").notNull(), // References users.id with role "center"
  permissions: jsonb("permissions"), // JSON object with permission flags
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Cashier-Venue join table for many-to-many relationship
export const cashierVenues = pgTable("cashier_venues", {
  id: serial("id").primaryKey(),
  cashierId: integer("cashier_id").notNull(), // References cashiers.id
  venueId: integer("venue_id").notNull(), // References venues.id
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Rental model (bookings for venues)
export const rentals = pgTable("rentals", {
  id: serial("id").primaryKey(),
  venueId: integer("venue_id").notNull(), // References venues.id
  customerName: text("customer_name").notNull(), // Customer name as direct string
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  totalPrice: numeric("total_price", { precision: 10, scale: 2 }).notNull(),
  status: text("status").default("pending").notNull(), // pending, confirmed, canceled, completed
  paymentStatus: text("payment_status").default("unpaid").notNull(), // unpaid, paid, refunded
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas for venues and rentals
export const insertVenueSchema = createInsertSchema(venues).omit({
  id: true,
  createdAt: true,
}).transform((data) => {
  // Convert hourlyRate to string for db compatibility
  return {
    ...data,
    hourlyRate: data.hourlyRate !== undefined ? String(data.hourlyRate) : undefined,
    dailyRate: data.dailyRate !== undefined ? String(data.dailyRate) : undefined
  };
});

export const insertRentalSchema = createInsertSchema(rentals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Types
export type Venue = typeof venues.$inferSelect;
export type InsertVenue = z.infer<typeof insertVenueSchema>;

// Base Drizzle type
export type RentalBase = typeof rentals.$inferSelect;
// Extended type with UI-specific fields that are not in the database schema
export type Rental = RentalBase & {
  venueName?: string;
};
export type InsertRental = z.infer<typeof insertRentalSchema>;

// Rental status and payment status options
export const RENTAL_STATUS = ["pending", "confirmed", "canceled", "completed"] as const;
export const rentalStatusSchema = z.enum(RENTAL_STATUS);
export type RentalStatus = z.infer<typeof rentalStatusSchema>;

export const PAYMENT_STATUS = ["unpaid", "paid", "refunded"] as const;
export const paymentStatusSchema = z.enum(PAYMENT_STATUS);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

// Extended schema for rental creation
export const createRentalSchema = insertRentalSchema.extend({
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  customerName: z.string().min(1),
  status: z.string().min(1),
  paymentStatus: z.string().min(1),
  customFields: z.record(z.string(), z.any()).optional(),
});

export type CreateRentalInput = z.infer<typeof createRentalSchema>;

// Social Media Share platforms
export const SHARE_PLATFORMS = ["facebook", "twitter", "linkedin", "whatsapp", "copy_link"] as const;
export const sharePlatformSchema = z.enum(SHARE_PLATFORMS);
export type SharePlatform = z.infer<typeof sharePlatformSchema>;

// Event Shares model - to track social media shares
export const eventShares = pgTable("event_shares", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(), // References events.id
  userId: integer("user_id"), // References users.id (optional - can be null for anonymous shares)
  platform: text("platform").notNull(), // The social media platform used
  shareDate: timestamp("share_date").defaultNow().notNull(),
  userAgent: text("user_agent"), // Browser/device information
  ipAddress: text("ip_address"), // IP address (consider privacy regulations)
  referer: text("referer"), // Referring URL
});

// Define the event shares relationships
export const eventSharesRelations = relations(eventShares, ({ one }) => ({
  event: one(events, {
    fields: [eventShares.eventId],
    references: [events.id],
  }),
  user: one(users, {
    fields: [eventShares.userId],
    references: [users.id],
  }),
}));

// Insert schema for event shares
export const insertEventShareSchema = createInsertSchema(eventShares).omit({
  id: true,
  shareDate: true,
});

// Insert schema for cashiers
export const insertCashierSchema = createInsertSchema(cashiers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Default permissions object for cashiers
export const DEFAULT_CASHIER_PERMISSIONS = {
  manageBookings: true,
  viewReports: true,
  editVenues: false,
  deleteVenues: false,
  managePayments: true
};

// Define the cashier relationships
export const cashiersRelations = relations(cashiers, ({ one, many }) => ({
  user: one(users, {
    fields: [cashiers.userId],
    references: [users.id],
  }),
  owner: one(users, {
    fields: [cashiers.ownerId],
    references: [users.id],
  }),
  venues: many(cashierVenues),
}));

// Define the cashier_venues relationships
export const cashierVenuesRelations = relations(cashierVenues, ({ one }) => ({
  cashier: one(cashiers, {
    fields: [cashierVenues.cashierId],
    references: [cashiers.id],
  }),
  venue: one(venues, {
    fields: [cashierVenues.venueId],
    references: [venues.id],
  }),
}));

// Define the venue relationships
export const venuesRelations = relations(venues, ({ one, many }) => ({
  owner: one(users, {
    fields: [venues.ownerId],
    references: [users.id],
  }),
  rentals: many(rentals),
  cashierVenues: many(cashierVenues),
}));

// Define the rental relationships
export const rentalsRelations = relations(rentals, ({ one }) => ({
  venue: one(venues, {
    fields: [rentals.venueId],
    references: [venues.id],
  }),
}));

// Insert schema for cashier venues join table
export const insertCashierVenueSchema = createInsertSchema(cashierVenues).omit({
  id: true,
  createdAt: true,
});

// Types
export type Cashier = typeof cashiers.$inferSelect;
export type InsertCashier = z.infer<typeof insertCashierSchema>;
export type CashierVenue = typeof cashierVenues.$inferSelect;
export type InsertCashierVenue = z.infer<typeof insertCashierVenueSchema>;

export type EventShare = typeof eventShares.$inferSelect;
export type InsertEventShare = z.infer<typeof insertEventShareSchema>;

// Event Share Analytics type
export type EventShareAnalytics = {
  total: number;
  platforms: Record<SharePlatform, number>;
};

// Speaker model for event speakers
export const speakers = pgTable("speakers", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(), // References events.id
  name: text("name").notNull(),
  bio: text("bio"),
  profileImage: text("profile_image"),
  title: text("title"), // Job title or role
  company: text("company"),
  socialLinks: jsonb("social_links"), // JSON object with social media links
  presentationTopic: text("presentation_topic"),
  presentationDescription: text("presentation_description"),
  presentationTime: timestamp("presentation_time"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Workshop model for event workshops
export const workshops = pgTable("workshops", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(), // References events.id
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  location: text("location"), // Room or specific location within the event venue
  capacity: integer("capacity"),
  instructor: text("instructor"),
  prerequisites: text("prerequisites"),
  materials: jsonb("materials"), // JSON array of required materials
  registrationRequired: boolean("registration_required").default(false).notNull(),
  registeredAttendees: jsonb("registered_attendees"), // JSON array of registered user IDs
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Define the speaker relationships
export const speakersRelations = relations(speakers, ({ one }) => ({
  event: one(events, {
    fields: [speakers.eventId],
    references: [events.id],
  }),
}));

// Define the workshop relationships
export const workshopsRelations = relations(workshops, ({ one }) => ({
  event: one(events, {
    fields: [workshops.eventId],
    references: [events.id],
  }),
}));

// Insert schemas for speakers and workshops
export const insertSpeakerSchema = createInsertSchema(speakers).omit({
  id: true,
  createdAt: true,
});

export const insertWorkshopSchema = createInsertSchema(workshops).omit({
  id: true,
  createdAt: true,
});

// Types
export type Speaker = typeof speakers.$inferSelect;
export type InsertSpeaker = z.infer<typeof insertSpeakerSchema>;

export type Workshop = typeof workshops.$inferSelect;
export type InsertWorkshop = z.infer<typeof insertWorkshopSchema>;

// Now define the events relationships after all tables are defined
export const eventsRelations = relations(events, ({ many }) => ({
  ticketTypes: many(ticketTypes),
  shares: many(eventShares),
  speakers: many(speakers),
  workshops: many(workshops),
}));
