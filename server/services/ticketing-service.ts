import { db } from '../db';
import { eq, and, asc, desc, sql, inArray, ilike, type SQL } from 'drizzle-orm';
import NodeCache from 'node-cache';
import QRCode from 'qrcode';
import {
  events,
  ticketTypes,
  tickets,
  users,
  eventAttendees,
  eventAddOns,
  eventToAddOns,
  type Event,
  type TicketType,
  type Ticket,
  type User,
  type EventAttendee,
  type InsertEventAttendee,
  type EventAddOn,
  type AddOnSelection
} from '@shared/schema';
import { 
  type EventSearchParams,
  type CreateEventInput, 
  type PurchaseTicketInput, 
  eventSearchSchema 
} from '@shared/schema';

/**
 * Ticketing Service - Handles all event and ticket related database operations
 */
export class TicketingService {
  private cache: NodeCache;
  
  constructor() {
    this.cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
  }
  
  // Cache helpers
  private getCacheKey(type: string, id: number | string): string {
    return `${type}_${id}`;
  }

  private invalidateCache(type: string, id: number | string): void {
    const key = this.getCacheKey(type, id);
    this.cache.del(key);
  }

  private invalidateTypeCache(type: string): void {
    const keys = this.cache.keys().filter(key => key.startsWith(`${type}_`));
    keys.forEach(key => this.cache.del(key));
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
   * Get multiple events with optional filters
   */
  async getEvents(options?: EventSearchParams): Promise<Event[]> {
    const cacheKey = this.getCacheKey('events', options ? JSON.stringify(options) : 'all');
    const cachedEvents = this.cache.get<Event[]>(cacheKey);
    
    if (cachedEvents) {
      return cachedEvents;
    }
    
    let query = db.select().from(events);
    
    if (options) {
      const conditions: SQL[] = [];
      
      if (options.search) {
        conditions.push(
          sql`(${events.title} ILIKE ${`%${options.search}%`} OR ${events.description} ILIKE ${`%${options.search}%`})`
        );
      }
      
      if (options.category) {
        conditions.push(eq(events.category, options.category));
      }
      
      if (options.minDate) {
        conditions.push(sql`${events.startDate} >= ${options.minDate}`);
      }
      
      if (options.maxDate) {
        conditions.push(sql`${events.endDate} <= ${options.maxDate}`);
      }
      
      if (options.featured !== undefined) {
        conditions.push(eq(events.featured, options.featured));
      }
      
      if (options.organizer) {
        conditions.push(eq(events.organizer, options.organizer));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    // Filter out past events by default
    const currentDate = new Date();
    query = query.where(sql`${events.startDate} >= ${currentDate}`);
    
    // Sort by start date ascending by default
    query = query.orderBy(asc(events.startDate));
    
    const eventsList = await query;
    
    this.cache.set(cacheKey, eventsList);
    
    return eventsList;
  }
  
  /**
   * Create a new event
   */
  async createEvent(eventData: CreateEventInput): Promise<Event> {
    const { ticketTypes: ticketTypesData, ...eventFields } = eventData;
    
    // Insert event
    const [event] = await db.insert(events).values(eventFields).returning();
    
    // Insert ticket types
    if (ticketTypesData && ticketTypesData.length > 0) {
      await Promise.all(
        ticketTypesData.map(ticketType => 
          db.insert(ticketTypes).values({
            ...ticketType,
            eventId: event.id,
            availableQuantity: ticketType.quantity
          })
        )
      );
    }
    
    this.invalidateTypeCache('events');
    
    return event;
  }
  
  /**
   * Get ticket types for an event
   */
  async getTicketTypes(eventId: number): Promise<TicketType[]> {
    const cacheKey = this.getCacheKey('ticketTypes', eventId);
    const cachedTicketTypes = this.cache.get<TicketType[]>(cacheKey);
    
    if (cachedTicketTypes) {
      return cachedTicketTypes;
    }
    
    const ticketTypesList = await db
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, eventId))
      .orderBy(asc(ticketTypes.price));
    
    this.cache.set(cacheKey, ticketTypesList);
    
    return ticketTypesList;
  }
  
  /**
   * Get a specific ticket type
   */
  async getTicketType(id: number): Promise<TicketType | undefined> {
    const cacheKey = this.getCacheKey('ticketType', id);
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
   * Purchase tickets
   */
  async purchaseTickets(purchase: PurchaseTicketInput, userId: number): Promise<Ticket[]> {
    const orderId = Date.now().toString() + Math.floor(Math.random() * 1000);
    const purchasedTickets: Ticket[] = [];
    
    // Get add-ons for the event
    let eventAddOnsList: (EventAddOn & { isRequired?: boolean; maximumQuantity?: number })[] = [];
    if (purchase.addOnSelections && purchase.addOnSelections.length > 0) {
      const result = await db
        .select()
        .from(eventAddOns)
        .innerJoin(
          eventToAddOns, 
          and(
            eq(eventToAddOns.addOnId, eventAddOns.id),
            eq(eventToAddOns.eventId, purchase.eventId)
          )
        )
        .where(
          inArray(
            eventAddOns.id, 
            purchase.addOnSelections.map(addOn => addOn.addOnId)
          )
        );
      
      eventAddOnsList = result.map(item => ({
        ...item.event_add_ons,
        isRequired: item.event_to_add_ons.isRequired,
        maximumQuantity: item.event_to_add_ons.maximumQuantity
      }));
    }
    
    // Process each ticket selection
    for (const selection of purchase.ticketSelections) {
      const ticketType = await this.getTicketType(selection.ticketTypeId);
      
      if (!ticketType) {
        throw new Error(`Ticket type ${selection.ticketTypeId} not found`);
      }
      
      if (ticketType.availableQuantity < selection.quantity) {
        throw new Error(`Not enough tickets available for ${ticketType.name}`);
      }
      
      // Calculate ticket base price
      let totalPrice = parseFloat(ticketType.price.toString()) * selection.quantity;
      
      // Process add-ons if present
      let purchasedAddOns = null;
      if (purchase.addOnSelections && purchase.addOnSelections.length > 0) {
        purchasedAddOns = [];
        
        for (const addOnSelection of purchase.addOnSelections) {
          const matchingAddOn = eventAddOnsList.find(addOn => addOn.id === addOnSelection.addOnId);
          
          if (!matchingAddOn) {
            throw new Error(`Add-on ${addOnSelection.addOnId} not found or not available for this event`);
          }
          
          // Validate quantity if maximumQuantity constraint exists
          const maxQuantity = matchingAddOn.maximumQuantity;
          if (maxQuantity && addOnSelection.quantity > maxQuantity) {
            throw new Error(`Maximum quantity for add-on ${matchingAddOn.name} is ${maxQuantity}`);
          }
          
          // Calculate add-on price
          const addOnPrice = parseFloat(matchingAddOn.price.toString()) * addOnSelection.quantity;
          totalPrice += addOnPrice;
          
          // Add to purchased add-ons
          purchasedAddOns.push({
            id: matchingAddOn.id,
            name: matchingAddOn.name,
            description: matchingAddOn.description,
            quantity: addOnSelection.quantity,
            unitPrice: matchingAddOn.price.toString(),
            totalPrice: addOnPrice.toString(),
            note: addOnSelection.note || null
          });
        }
      }
      
      // Create ticket record with add-ons
      const ticketData = {
        ticketTypeId: selection.ticketTypeId,
        eventId: purchase.eventId,
        userId,
        quantity: selection.quantity,
        totalPrice: totalPrice.toString(),
        orderId,
        attendeeDetails: selection.attendeeDetails || null,
        eventDate: selection.eventDate || null,
        // Handle gift tickets
        isGift: selection.isGift || false,
        giftRecipients: selection.giftRecipients || null,
        // Add purchased add-ons
        purchasedAddOns
      };
      
      const [ticket] = await db.insert(tickets).values(ticketData).returning();
      
      // Update available quantity
      await db
        .update(ticketTypes)
        .set({ 
          availableQuantity: ticketType.availableQuantity - selection.quantity 
        })
        .where(eq(ticketTypes.id, selection.ticketTypeId));
      
      // Generate QR code
      const qrCodeDataUrl = await this.generateTicketQR(ticket.id);
      
      // Update ticket with QR code
      const [updatedTicket] = await db
        .update(tickets)
        .set({ qrCode: qrCodeDataUrl })
        .where(eq(tickets.id, ticket.id))
        .returning();
      
      purchasedTickets.push(updatedTicket);
      
      this.invalidateCache('ticketType', selection.ticketTypeId);
      this.invalidateTypeCache('ticketTypes');
    }
    
    return purchasedTickets;
  }
  
  /**
   * Generate QR code for a ticket
   */
  async generateTicketQR(ticketId: number): Promise<string> {
    try {
      const ticketData = JSON.stringify({
        id: ticketId,
        timestamp: Date.now()
      });
      
      const qrCodeDataUrl = await QRCode.toDataURL(ticketData);
      return qrCodeDataUrl;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code for ticket');
    }
  }
  
  /**
   * Get tickets for a user
   */
  async getUserTickets(userId: number): Promise<Ticket[]> {
    const cacheKey = this.getCacheKey('userTickets', userId);
    const cachedTickets = this.cache.get<Ticket[]>(cacheKey);
    
    if (cachedTickets) {
      return cachedTickets;
    }
    
    const ticketsList = await db
      .select()
      .from(tickets)
      .where(eq(tickets.userId, userId))
      .orderBy(desc(tickets.purchaseDate));
    
    this.cache.set(cacheKey, ticketsList);
    
    return ticketsList;
  }
  
  /**
   * Get tickets for an event
   */
  async getEventTickets(eventId: number): Promise<Ticket[]> {
    const cacheKey = this.getCacheKey('eventTickets', eventId);
    const cachedTickets = this.cache.get<Ticket[]>(cacheKey);
    
    if (cachedTickets) {
      return cachedTickets;
    }
    
    const ticketsList = await db
      .select()
      .from(tickets)
      .where(eq(tickets.eventId, eventId))
      .orderBy(desc(tickets.purchaseDate));
    
    this.cache.set(cacheKey, ticketsList);
    
    return ticketsList;
  }
  
  /**
   * Get tickets by payment session ID
   */
  async getTicketsByPaymentSession(sessionId: string): Promise<Ticket[]> {
    const ticketsList = await db
      .select()
      .from(tickets)
      .where(eq(tickets.paymentSessionId, sessionId));
    
    return ticketsList;
  }
  
  /**
   * Remove a ticket
   */
  async removeTicket(ticketId: number): Promise<void> {
    const ticket = await this.getTicket(ticketId);
    
    if (!ticket) {
      throw new Error('Ticket not found');
    }
    
    // Update available quantity in ticket type
    const ticketType = await this.getTicketType(ticket.ticketTypeId);
    
    if (ticketType) {
      await db
        .update(ticketTypes)
        .set({ 
          availableQuantity: ticketType.availableQuantity + ticket.quantity 
        })
        .where(eq(ticketTypes.id, ticket.ticketTypeId));
      
      this.invalidateCache('ticketType', ticket.ticketTypeId);
      this.invalidateTypeCache('ticketTypes');
    }
    
    // Delete the ticket
    await db.delete(tickets).where(eq(tickets.id, ticketId));
    
    this.invalidateCache('ticket', ticketId);
    this.invalidateCache('userTickets', ticket.userId);
    this.invalidateCache('eventTickets', ticket.eventId);
  }
  
  /**
   * Get sales data for an event
   */
  async getEventSales(eventId: number): Promise<{ 
    totalSales: number;
    ticketsSold: number;
    salesByTicketType: Array<{
      ticketTypeId: number;
      name: string;
      price: string;
      sold: number;
      revenue: number;
    }>;
  }> {
    // Get ticket types for this event
    const eventTicketTypes = await this.getTicketTypes(eventId);
    
    // Calculate sales for each ticket type
    const salesByTicketType = eventTicketTypes.map(tt => {
      const sold = tt.quantity - tt.availableQuantity;
      const revenue = parseFloat(tt.price.toString()) * sold;
      
      return {
        ticketTypeId: tt.id,
        name: tt.name,
        price: tt.price.toString(),
        sold,
        revenue
      };
    });
    
    // Calculate totals
    const totalSales = salesByTicketType.reduce((sum, item) => sum + item.revenue, 0);
    const ticketsSold = salesByTicketType.reduce((sum, item) => sum + item.sold, 0);
    
    return {
      totalSales,
      ticketsSold,
      salesByTicketType
    };
  }
  
  /**
   * Validate a ticket
   */
  async validateTicket(ticketId: number): Promise<boolean> {
    const ticket = await this.getTicket(ticketId);
    
    if (!ticket) {
      throw new Error('Ticket not found');
    }
    
    if (ticket.isUsed) {
      throw new Error('Ticket has already been used');
    }
    
    // Mark ticket as used
    await db
      .update(tickets)
      .set({ isUsed: true })
      .where(eq(tickets.id, ticketId));
    
    this.invalidateCache('ticket', ticketId);
    
    return true;
  }

  /**
   * Get event attendees
   */
  async getEventAttendees(eventId: number): Promise<EventAttendee[]> {
    const cacheKey = this.getCacheKey('attendees', eventId);
    const cached = this.cache.get<EventAttendee[]>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const attendees = await db
      .select()
      .from(eventAttendees)
      .where(eq(eventAttendees.eventId, eventId))
      .orderBy(asc(eventAttendees.fullName));
    
    this.cache.set(cacheKey, attendees);
    
    return attendees;
  }
  
  /**
   * Get attendee by ID
   */
  async getAttendee(id: number): Promise<EventAttendee | undefined> {
    const cacheKey = this.getCacheKey('attendee', id);
    const cached = this.cache.get<EventAttendee>(cacheKey);
    
    if (cached) {
      return cached;
    }
    
    const [attendee] = await db
      .select()
      .from(eventAttendees)
      .where(eq(eventAttendees.id, id));
    
    if (attendee) {
      this.cache.set(cacheKey, attendee);
    }
    
    return attendee;
  }
  
  /**
   * Add attendees to a private event
   */
  async addEventAttendees(
    eventId: number,
    attendeeList: InsertEventAttendee[]
  ): Promise<EventAttendee[]> {
    // Check if event exists and is private
    const event = await this.getEvent(eventId);
    
    if (!event) {
      throw new Error('Event not found');
    }
    
    if (event.eventType !== 'private' && !event.isPrivate) {
      throw new Error('Event is not a private event');
    }
    
    // Insert all attendees
    const attendees = await db
      .insert(eventAttendees)
      .values(attendeeList.map(a => ({ ...a, eventId })))
      .returning();
    
    // Generate QR codes for each attendee
    for (const attendee of attendees) {
      const qrData = JSON.stringify({
        attendeeId: attendee.id,
        eventId: attendee.eventId,
        name: attendee.fullName,
        email: attendee.email
      });
      
      const qrCode = await QRCode.toDataURL(qrData);
      
      await db
        .update(eventAttendees)
        .set({ qrCode })
        .where(eq(eventAttendees.id, attendee.id));
        
      // Update the attendee in our response with the QR code
      attendee.qrCode = qrCode;
    }
    
    // Invalidate cache
    this.invalidateCache('attendees', eventId);
    
    return attendees;
  }
  
  /**
   * Check in an attendee
   */
  async checkInAttendee(attendeeId: number): Promise<boolean> {
    const attendee = await this.getAttendee(attendeeId);
    
    if (!attendee) {
      throw new Error('Attendee not found');
    }
    
    if (attendee.isCheckedIn) {
      throw new Error('Attendee has already been checked in');
    }
    
    // Mark attendee as checked in
    await db
      .update(eventAttendees)
      .set({ isCheckedIn: true })
      .where(eq(eventAttendees.id, attendeeId));
    
    this.invalidateCache('attendee', attendeeId);
    this.invalidateCache('attendees', attendee.eventId);
    
    return true;
  }

  /**
   * Delete an attendee from a private event
   */
  async deleteAttendee(attendeeId: number): Promise<boolean> {
    const attendee = await this.getAttendee(attendeeId);
    
    if (!attendee) {
      throw new Error('Attendee not found');
    }
    
    // Get the eventId before deleting for cache invalidation
    const eventId = attendee.eventId;
    
    // Delete the attendee
    await db
      .delete(eventAttendees)
      .where(eq(eventAttendees.id, attendeeId));
    
    // Invalidate relevant caches
    this.invalidateCache('attendee', attendeeId);
    this.invalidateCache('attendees', eventId);
    
    return true;
  }
}

// Create and export singleton instance
export const ticketingService = new TicketingService();