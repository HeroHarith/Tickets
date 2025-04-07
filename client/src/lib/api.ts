import { apiRequest } from "./queryClient";
import { 
  Event, 
  TicketType, 
  Ticket,
  InsertEvent,
  InsertTicketType,
  PurchaseTicketInput
} from "@shared/schema";

// Events API
export const fetchEvents = async (options?: { 
  category?: string; 
  featured?: boolean; 
  search?: string;
}) => {
  const params = new URLSearchParams();
  
  if (options?.category) params.append("category", options.category);
  if (options?.featured !== undefined) params.append("featured", options.featured.toString());
  if (options?.search) params.append("search", options.search);
  
  const url = `/api/events${params.toString() ? `?${params.toString()}` : ''}`;
  const res = await fetch(url);
  
  if (!res.ok) {
    throw new Error("Failed to fetch events");
  }
  
  return res.json() as Promise<Event[]>;
};

export const fetchEventById = async (id: number) => {
  const res = await fetch(`/api/events/${id}`);
  
  if (!res.ok) {
    throw new Error("Failed to fetch event details");
  }
  
  return res.json() as Promise<Event & { ticketTypes: TicketType[] }>;
};

export const createEvent = async (eventData: InsertEvent & { ticketTypes: InsertTicketType[] }) => {
  const res = await apiRequest("POST", "/api/events", eventData);
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to create event");
  }
  
  return res.json() as Promise<Event>;
};

// Tickets API
export const purchaseTickets = async (purchaseData: PurchaseTicketInput) => {
  const res = await apiRequest("POST", "/api/tickets/purchase", purchaseData);
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to purchase tickets");
  }
  
  return res.json() as Promise<Ticket[]>;
};

export const fetchUserTickets = async () => {
  const res = await fetch("/api/tickets/user");
  
  if (!res.ok) {
    throw new Error("Failed to fetch user tickets");
  }
  
  return res.json() as Promise<(Ticket & { event?: Event, ticketType?: TicketType })[]>;
};

// Sales API
export const fetchEventSales = async (eventId: number) => {
  const res = await fetch(`/api/events/${eventId}/sales`);
  
  if (!res.ok) {
    throw new Error("Failed to fetch event sales data");
  }
  
  return res.json() as Promise<{
    event: Event;
    totalSales: number;
    ticketsSold: number;
    salesByTicketType: {
      name: string;
      sold: number;
      revenue: number;
    }[];
  }>;
};

// User API (for future implementation)
export const registerUser = async (userData: { 
  username: string; 
  password: string;
  name: string;
  email: string;
}) => {
  const res = await apiRequest("POST", "/api/users", userData);
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to register user");
  }
  
  return res.json();
};
