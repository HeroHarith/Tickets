// Common interfaces used across multiple components

export interface Venue {
  id: number;
  name: string;
  description: string | null;
  location: string;
  capacity: number | null;
  hourlyRate: string;
  dailyRate: string | null;
  facilities?: string[] | null;
  availabilityHours?: Record<string, string> | null;
  ownerId?: number;
  images?: string[] | null;
  isActive: boolean;
  createdAt?: string;
}

export interface Rental {
  id: number;
  venueId: number;
  customerId: number;
  startTime: string;
  endTime: string;
  totalPrice: string;
  status: "pending" | "confirmed" | "canceled" | "completed";
  paymentStatus: "unpaid" | "paid" | "refunded";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  venueName?: string;
  customerName?: string;
}