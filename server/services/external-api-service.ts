import { db } from '../db';
import { tickets, events, ticketTypes, users, Event, Ticket, TicketType, PurchaseTicketInput } from '@shared/schema';
import { eq, and, inArray, or, like, gte, lte, asc } from 'drizzle-orm';
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
   * Get all events with filtering
   */
  async getEvents(options: {
    organizerId?: number;
    category?: string;
    minDate?: Date;
    maxDate?: Date;
    search?: string;
    featured?: boolean;
    limit?: number;
    offset?: number;
  } = {}): Promise<Event[]> {
    const { 
      organizerId, 
      category, 
      minDate, 
      maxDate, 
      search, 
      featured,
      limit = 100,
      offset = 0
    } = options;
    
    // Build a cache key based on filter parameters
    const cacheParams = JSON.stringify({ 
      organizerId, 
      category, 
      minDate, 
      maxDate, 
      search, 
      featured,
      limit,
      offset
    });
    
    const cacheKey = this.getCacheKey('events', cacheParams);
    const cachedEvents = this.cache.get<Event[]>(cacheKey);
    
    if (cachedEvents) {
      return cachedEvents;
    }
    
    // Create base query
    let query = db.select().from(events);
    
    // Apply filters
    if (organizerId) {
      query = query.where(eq(events.organizer, organizerId));
    }
    
    if (category) {
      query = query.where(eq(events.category, category));
    }
    
    if (minDate) {
      query = query.where(gte(events.startDate, minDate));
    }
    
    if (maxDate) {
      query = query.where(lte(events.startDate, maxDate));
    }
    
    if (featured) {
      query = query.where(eq(events.featured, true));
    }
    
    if (search) {
      query = query.where(
        or(
          like(events.title, `%${search}%`),
          like(events.description, `%${search}%`),
          like(events.location, `%${search}%`)
        )
      );
    }
    
    // Only fetch future events
    const now = new Date();
    query = query.where(gte(events.startDate, now));
    
    // Apply pagination
    query = query.limit(limit).offset(offset);
    
    // Order by start date
    query = query.orderBy(asc(events.startDate));
    
    // Execute query
    const eventsList = await query;
    
    // Cache results
    this.cache.set(cacheKey, eventsList);
    
    return eventsList;
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
    
    // External API supports simplified ticket purchase
    // We'll process the first ticket selection
    if (!purchase.ticketSelections || purchase.ticketSelections.length === 0) {
      throw new Error('No ticket selections provided');
    }
    
    const selection = purchase.ticketSelections[0];
    const ticketTypeId = selection.ticketTypeId;
    
    // Get ticket type
    const ticketType = await this.getTicketType(ticketTypeId);
    if (!ticketType) {
      throw new Error('Ticket type not found');
    }

    // Check if quantity is valid
    const quantity = selection.quantity;
    if (quantity <= 0) {
      throw new Error('Quantity must be greater than 0');
    }
    
    // Generate a random order ID (would be transaction ID in real system)
    const orderId = `ext-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Calculate total price
    const pricePerTicket = parseFloat(ticketType.price);
    const totalPrice = (pricePerTicket * quantity).toFixed(2);
    
    // Extract attendee details
    let attendeeDetails = null;
    
    if (selection.attendeeDetails && selection.attendeeDetails.length > 0) {
      attendeeDetails = selection.attendeeDetails[0];
    }
    
    // Create tickets
    const newTickets = [];
    for (let i = 0; i < quantity; i++) {
      const [ticket] = await db.insert(tickets)
        .values({
          eventId: purchase.eventId,
          ticketTypeId: ticketTypeId,
          userId: userId,
          purchaseDate: new Date(),
          quantity: 1, // Each row is 1 ticket in our schema
          totalPrice: pricePerTicket.toFixed(2),
          orderId: orderId,
          eventDate: selection.eventDate || null,
          attendeeDetails: attendeeDetails,
          emailSent: false,
          // Use a session ID if provided in the purchase, otherwise null
          paymentSessionId: typeof purchase.paymentSessionId === 'string' ? purchase.paymentSessionId : null
        })
        .returning();

      // Generate QR code
      const qrCode = await generateTicketQRCode(ticket.id);
      
      // Update ticket with QR code
      const [updatedTicket] = await db
        .update(tickets)
        .set({ qrCode })
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
    
    if (ticket.isUsed) {
      throw new Error('Ticket has already been used');
    }
    
    // Create new attendee details object with validation timestamp
    const currentAttendeeDetails = ticket.attendeeDetails || {};
    const updatedAttendeeDetails = {
      ...currentAttendeeDetails,
      validatedAt: new Date().toISOString()
    };
    
    // Update ticket status to used
    const [updatedTicket] = await db
      .update(tickets)
      .set({ 
        isUsed: true,
        attendeeDetails: updatedAttendeeDetails
      })
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