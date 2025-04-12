import { z } from 'zod';
import { type Json } from 'drizzle-orm';
import { 
  attendeeDetailsSchema,
  type SharePlatform
} from '@shared/schema';

// Event search parameters
export interface EventSearchParams {
  category?: string;
  featured?: boolean;
  search?: string;
  organizer?: number;
  dateFilter?: string;
  priceFilter?: string;
  minDate?: string;
  maxDate?: string;
  location?: string;
  sortBy?: string;
  eventType?: string;
}

// Input for creating a new event
export interface CreateEventInput {
  title: string;
  description: string;
  location: string;
  startDate: Date;
  endDate?: Date | null;
  category: string;
  eventType?: string;
  imageUrl?: string | null;
  seatingMap?: Json;
  organizer: number;
  featured?: boolean;
  ticketTypes: {
    name: string;
    description?: string | null;
    price: string;
    quantity: number;
    ticketFeatures?: Json;
  }[];
}

// Input for purchasing tickets
export interface PurchaseTicketInput {
  eventId: number;
  ticketSelections: {
    ticketTypeId: number;
    quantity: number;
    attendeeDetails?: z.infer<typeof attendeeDetailsSchema>[];
  }[];
  customerDetails: z.infer<typeof attendeeDetailsSchema>;
}

// Input for creating a rental
export interface CreateRentalInput {
  venueId: number;
  customerName: string;
  startTime: Date;
  endTime: Date;
  totalPrice: string;
  status: string;
  paymentStatus: string;
  notes?: string | null;
}

// Event share analytics
export interface EventShareAnalytics {
  total: number;
  platforms: Record<SharePlatform, number>;
}