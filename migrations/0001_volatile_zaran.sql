CREATE TABLE "cashier_venues" (
	"id" serial PRIMARY KEY NOT NULL,
	"cashier_id" integer NOT NULL,
	"venue_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cashiers" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"owner_id" integer NOT NULL,
	"permissions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event_shares" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"user_id" integer,
	"platform" text NOT NULL,
	"share_date" timestamp DEFAULT now() NOT NULL,
	"user_agent" text,
	"ip_address" text,
	"referer" text
);
--> statement-breakpoint
CREATE TABLE "rentals" (
	"id" serial PRIMARY KEY NOT NULL,
	"venue_id" integer NOT NULL,
	"customer_name" text NOT NULL,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payment_status" text DEFAULT 'unpaid' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "speakers" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"name" text NOT NULL,
	"bio" text,
	"profile_image" text,
	"title" text,
	"company" text,
	"social_links" jsonb,
	"presentation_topic" text,
	"presentation_description" text,
	"presentation_time" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "venues" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"location" text NOT NULL,
	"capacity" integer,
	"hourly_rate" numeric(10, 2) NOT NULL,
	"daily_rate" numeric(10, 2),
	"facilities" jsonb,
	"availability_hours" jsonb,
	"owner_id" integer NOT NULL,
	"images" jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workshops" (
	"id" serial PRIMARY KEY NOT NULL,
	"event_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"start_time" timestamp NOT NULL,
	"end_time" timestamp NOT NULL,
	"location" text,
	"capacity" integer,
	"instructor" text,
	"prerequisites" text,
	"materials" jsonb,
	"registration_required" boolean DEFAULT false NOT NULL,
	"registered_attendees" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "event_type" text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE "events" ADD COLUMN "seating_map" jsonb;--> statement-breakpoint
ALTER TABLE "ticket_types" ADD COLUMN "ticket_features" jsonb;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "qr_code" text;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "is_used" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "seat_assignment" jsonb;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "attendee_details" jsonb;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "email_sent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'customer' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verification_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "verification_token_expires" timestamp;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_token" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "reset_token_expires" timestamp;