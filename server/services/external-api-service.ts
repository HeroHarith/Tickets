import { db } from '../db';
import { tickets, events, ticketTypes, users, Event, Ticket, TicketType, PurchaseTicketInput } from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import NodeCache from 'node-cache';
import { generateTicketQRCode } from '../utils/external-qrcode-generator';

/**
 * Service for handling external API operations
 * This service is completely separate from the internal ticketing service
 * to maintain separation between internal and external API systems
 */
export class ExternalApiService {
  private cache: NodeCache;

  constructor() {
    // Cache with 5 minute TTL
    this.cache = new NodeCache({ stdTTL: 300 });
  }

  /**
   * Get cache key for an item
   */
  private getCacheKey(type: string, id: number | string): string {
    return `external_${type}_${id}`;
  }
  
  /**
   * Validate API key and return associated user ID
   * In a real implementation, this would validate against a database of API keys
   */
  async validateApiKey(apiKey: string): Promise<number | null> {
    // For now, return a dummy user ID
    // In production, you would validate this key against stored API keys
    // and return the associated user ID
    if (apiKey === 'test-api-key') {
      return 1; // Example event manager ID
    }
    return null;
  }

  /**
   * Get event by ID
   */
  async getEvent(id: number): Promise<Event | undefined> {
    const cacheKey = this.getCacheKey('event', id);
    const cachedEvent = this.cache.get<Event>(cacheKey);
    
    if (cachedEvent) {
      return cachedEvent;
    }
    
    const [event] = await db.select().from(events).where(eq(events.id, id));
    
    if (event) {
      this.cache.set(cacheKey, event);
    }
    
    return event;
  }

  /**
   * Check if a user is the organizer of an event
   */
  async isEventOrganizer(eventId: number, userId: number): Promise<boolean> {
    const event = await this.getEvent(eventId);
    return event?.organizer === userId;
  }

  /**
   * Get all tickets for an event
   */
  async getEventTickets(eventId: number): Promise<Ticket[]> {
    const cacheKey = this.getCacheKey('event_tickets', eventId);
    const cachedTickets = this.cache.get<Ticket[]>(cacheKey);
    
    if (cachedTickets) {
      return cachedTickets;
    }
    
    const eventTickets = await db.select()
      .from(tickets)
      .where(eq(tickets.eventId, eventId));
    
    this.cache.set(cacheKey, eventTickets);
    return eventTickets;
  }

  /**
   * Get a ticket by ID
   */
  async getTicket(id: number): Promise<Ticket | undefined> {
    const cacheKey = this.getCacheKey('ticket', id);
    const cachedTicket = this.cache.get<Ticket>(cacheKey);
    
    if (cachedTicket) {
      return cachedTicket;
    }
    
    const [ticket] = await db.select().from(tickets).where(eq(tickets.id, id));
    
    if (ticket) {
      this.cache.set(cacheKey, ticket);
    }
    
    return ticket;
  }

  /**
   * Get ticket type by ID
   */
  async getTicketType(id: number): Promise<TicketType | undefined> {
    const cacheKey = this.getCacheKey('ticket_type', id);
    const cachedTicketType = this.cache.get<TicketType>(cacheKey);
    
    if (cachedTicketType) {
      return cachedTicketType;
    }
    
    const [ticketType] = await db.select().from(ticketTypes).where(eq(ticketTypes.id, id));
    
    if (ticketType) {
      this.cache.set(cacheKey, ticketType);
    }
    
    return ticketType;
  }

  /**
   * Purchase tickets for an event
   * Note: This is a simplified version for external API use
   */
  async purchaseTickets(purchase: PurchaseTicketInput, userId: number): Promise<Ticket[]> {
    // Verify the event exists
    const event = await this.getEvent(purchase.eventId);
    if (!event) {
      throw new Error('Event not found');
    }

    // Get ticket type
    const ticketType = await this.getTicketType(purchase.ticketTypeId);
    if (!ticketType) {
      throw new Error('Ticket type not found');
    }

    // Check if quantity is valid
    if (purchase.quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }

    // Create tickets
    const newTickets = [];
    for (let i = 0; i < purchase.quantity; i++) {
      const [ticket] = await db.insert(tickets)
        .values({
          eventId: purchase.eventId,
          ticketTypeId: purchase.ticketTypeId,
          userId: userId,
          purchasedAt: new Date(),
          status: 'active',
          eventDate: purchase.eventDate,
          attendeeEmail: purchase.attendeeEmail,
          attendeeName: purchase.attendeeName,
          paymentSessionId: purchase.paymentSessionId || null,
        })
        .returning();

      // Generate QR code
      const qrCodeData = await generateTicketQRCode(ticket.id);
      
      // Update ticket with QR code
      const [updatedTicket] = await db
        .update(tickets)
        .set({ qrCodeData })
        .where(eq(tickets.id, ticket.id))
        .returning();

      newTickets.push(updatedTicket);
    }

    return newTickets;
  }

  /**
   * Validate a ticket (check-in)
   */
  async validateTicket(ticketId: number): Promise<boolean> {
    const ticket = await this.getTicket(ticketId);
    
    if (!ticket) {
      throw new Error('Ticket not found');
    }
    
    if (ticket.status !== 'active') {
      throw new Error(`Ticket is not active (current status: ${ticket.status})`);
    }
    
    // Update ticket status to 'used'
    const [updatedTicket] = await db
      .update(tickets)
      .set({ status: 'used', validatedAt: new Date() })
      .where(eq(tickets.id, ticketId))
      .returning();
    
    return !!updatedTicket;
  }

  /**
   * Get ticket details with event and ticket type info
   */
  async getTicketDetails(ticketId: number): Promise<{
    ticket: Ticket,
    event: Event,
    ticketType: TicketType
  } | null> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      return null;
    }
    
    const event = await this.getEvent(ticket.eventId);
    if (!event) {
      return null;
    }
    
    const ticketType = await this.getTicketType(ticket.ticketTypeId);
    if (!ticketType) {
      return null;
    }
    
    return { ticket, event, ticketType };
  }
}

export const externalApiService = new ExternalApiService();