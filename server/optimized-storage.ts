import { db } from './db';
import session from 'express-session';
import { eq, and, asc, desc, sql, inArray, ilike, type SQL } from 'drizzle-orm';
import connectPg from 'connect-pg-simple';
import NodeCache from 'node-cache';
import { randomBytes } from 'crypto';
import QRCode from 'qrcode';
import { nanoid } from 'nanoid';
import { 
  users, 
  events,
  ticketTypes,
  tickets,
  venues, 
  rentals,
  eventShares,
  type User,
  type Event,
  type TicketType,
  type Ticket,
  type Venue,
  type Rental,
  type EventShare,
  type InsertUser,
  type InsertVenue, 
  type InsertEventShare,
  type RentalStatus,
  type PaymentStatus
} from '@shared/schema';
import { 
  type EventSearchParams, 
  type CreateEventInput,
  type PurchaseTicketInput,
  type CreateRentalInput,
  type EventShareAnalytics,
  type Json
} from './types';
import { pool } from './db';
import { IStorage } from './storage';

// Create a shared cache instance
const cache = new NodeCache({
  stdTTL: 300, // 5 minutes in seconds
  checkperiod: 120, // Check for expired keys every 2 minutes
  useClones: false // Don't clone objects to improve performance
});

const TTL = {
  SHORT: 60, // 1 minute
  MEDIUM: 300, // 5 minutes
  LONG: 3600, // 1 hour
  VERY_LONG: 86400 // 24 hours
};

/**
 * An optimized version of the DatabaseStorage class that implements caching
 * for frequently accessed data
 */
export class OptimizedStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    const PostgresSessionStore = connectPg(session);
    
    this.sessionStore = new PostgresSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true,
    });
  }
  
  // CACHING UTILITIES
  private getCacheKey(type: string, id: number | string): string {
    return `${type}:${id}`;
  }
  
  private invalidateCache(type: string, id: number | string): void {
    const key = this.getCacheKey(type, id);
    cache.del(key);
  }
  
  private invalidateTypeCache(type: string): void {
    const keys = cache.keys();
    const typeKeys = keys.filter(key => key.startsWith(`${type}:`));
    if (typeKeys.length > 0) {
      cache.del(typeKeys);
    }
  }
  
  // USER OPERATIONS
  async getUser(id: number): Promise<User | undefined> {
    const cacheKey = this.getCacheKey('user', id);
    const cachedUser = cache.get<User>(cacheKey);
    
    if (cachedUser) {
      return cachedUser;
    }
    
    const [user] = await db.select().from(users).where(eq(users.id, id));
    
    if (user) {
      cache.set(cacheKey, user, TTL.MEDIUM);
    }
    
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const cacheKey = this.getCacheKey('user-username', username);
    const cachedUser = cache.get<User>(cacheKey);
    
    if (cachedUser) {
      return cachedUser;
    }
    
    const [user] = await db.select().from(users).where(eq(users.username, username));
    
    if (user) {
      // Store in both the username cache and the ID cache
      cache.set(cacheKey, user, TTL.MEDIUM);
      cache.set(this.getCacheKey('user', user.id), user, TTL.MEDIUM);
    }
    
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const cacheKey = this.getCacheKey('user-email', email);
    const cachedUser = cache.get<User>(cacheKey);
    
    if (cachedUser) {
      return cachedUser;
    }
    
    const [user] = await db.select().from(users).where(eq(users.email, email));
    
    if (user) {
      // Store in both the email cache and the ID cache
      cache.set(cacheKey, user, TTL.MEDIUM);
      cache.set(this.getCacheKey('user', user.id), user, TTL.MEDIUM);
    }
    
    return user;
  }
  
  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users).values(user).returning();
    
    // Cache the new user
    cache.set(this.getCacheKey('user', newUser.id), newUser, TTL.MEDIUM);
    cache.set(this.getCacheKey('user-username', newUser.username), newUser, TTL.MEDIUM);
    cache.set(this.getCacheKey('user-email', newUser.email), newUser, TTL.MEDIUM);
    
    return newUser;
  }
  
  async updateUser(id: number, userData: Partial<Omit<InsertUser, "id">>): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
    
    // Invalidate and update caches
    this.invalidateCache('user', id);
    cache.set(this.getCacheKey('user', updatedUser.id), updatedUser, TTL.MEDIUM);
    cache.set(this.getCacheKey('user-username', updatedUser.username), updatedUser, TTL.MEDIUM);
    cache.set(this.getCacheKey('user-email', updatedUser.email), updatedUser, TTL.MEDIUM);
    
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      
      if (!user) {
        return false;
      }
      
      // Delete the user
      await db.delete(users).where(eq(users.id, id));
      
      // Invalidate caches
      this.invalidateCache('user', id);
      this.invalidateCache('user-username', user.username);
      this.invalidateCache('user-email', user.email);
      
      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }
  
  // EMAIL VERIFICATION OPERATIONS
  async createVerificationToken(userId: number): Promise<string> {
    // Generate a random token
    const token = randomBytes(32).toString('hex');
    
    // Set token expiration (24 hours from now)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    
    // Update user with verification token
    await db.update(users)
      .set({
        verificationToken: token,
        verificationTokenExpires: expiresAt
      })
      .where(eq(users.id, userId));
    
    // Invalidate user cache
    this.invalidateCache('user', userId);
    
    return token;
  }
  
  async verifyEmail(token: string): Promise<boolean> {
    try {
      // Find user with this verification token
      const [user] = await db.select()
        .from(users)
        .where(eq(users.verificationToken, token));
      
      if (!user) {
        return false; // Token not found
      }
      
      // Check if token is expired
      if (user.verificationTokenExpires && new Date() > user.verificationTokenExpires) {
        return false; // Token expired
      }
      
      // Update user to mark email as verified
      await db.update(users)
        .set({
          emailVerified: true,
          verificationToken: null,
          verificationTokenExpires: null
        })
        .where(eq(users.id, user.id));
      
      // Invalidate user cache
      this.invalidateCache('user', user.id);
      
      return true;
    } catch (error) {
      console.error('Error verifying email:', error);
      return false;
    }
  }
  
  // PASSWORD RESET OPERATIONS
  async createPasswordResetToken(email: string): Promise<string | null> {
    try {
      // Find user by email
      const user = await this.getUserByEmail(email);
      
      if (!user) {
        return null; // User not found
      }
      
      // Generate a random token
      const token = randomBytes(32).toString('hex');
      
      // Set token expiration (1 hour from now)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 1);
      
      // Update user with reset token
      await db.update(users)
        .set({
          resetToken: token,
          resetTokenExpires: expiresAt
        })
        .where(eq(users.id, user.id));
      
      // Invalidate user cache
      this.invalidateCache('user', user.id);
      
      return token;
    } catch (error) {
      console.error('Error creating password reset token:', error);
      return null;
    }
  }
  
  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    try {
      // Find user with this reset token
      const [user] = await db.select()
        .from(users)
        .where(eq(users.resetToken, token));
      
      if (!user) {
        return false; // Token not found
      }
      
      // Check if token is expired
      if (user.resetTokenExpires && new Date() > user.resetTokenExpires) {
        return false; // Token expired
      }
      
      // Update user with new password
      await db.update(users)
        .set({
          password: newPassword,
          resetToken: null,
          resetTokenExpires: null
        })
        .where(eq(users.id, user.id));
      
      // Invalidate user cache
      this.invalidateCache('user', user.id);
      
      return true;
    } catch (error) {
      console.error('Error resetting password:', error);
      return false;
    }
  }
  
  // EVENT OPERATIONS
  async getEvent(id: number): Promise<Event | undefined> {
    const cacheKey = this.getCacheKey('event', id);
    const cachedEvent = cache.get<Event>(cacheKey);
    
    if (cachedEvent) {
      return cachedEvent;
    }
    
    const [event] = await db.select().from(events).where(eq(events.id, id));
    
    if (event) {
      cache.set(cacheKey, event, TTL.MEDIUM);
    }
    
    return event;
  }
  
  async getEvents(options?: EventSearchParams): Promise<Event[]> {
    // Only cache if simple queries with no search parameters
    const shouldCache = !options || (
      !options.search &&
      !options.category &&
      !options.dateFilter &&
      !options.location &&
      !options.priceFilter &&
      !options.minDate &&
      !options.maxDate &&
      !options.sortBy
    );
    
    // Create a cache key with relevant options 
    const cacheKey = shouldCache ? 
      this.getCacheKey('events', JSON.stringify(options || 'all')) : '';
    
    if (shouldCache) {
      const cachedEvents = cache.get<Event[]>(cacheKey);
      if (cachedEvents) {
        return cachedEvents;
      }
    }
    
    // Query construction similar to existing code
    let query = db.select().from(events);
    
    if (options) {
      const conditions: SQL[] = [];
      
      // Apply filters
      if (options.category) {
        conditions.push(eq(events.category, options.category));
      }
      
      if (options.featured !== undefined) {
        conditions.push(eq(events.featured, options.featured));
      }
      
      if (options.search) {
        conditions.push(
          sql`(${ilike(events.title, `%${options.search}%`)} OR
               ${ilike(events.description, `%${options.search}%`)} OR
               ${ilike(events.location, `%${options.search}%`)})`
        );
      }
      
      if (options.organizer) {
        conditions.push(eq(events.organizer, options.organizer));
      }
      
      // Location filter
      if (options.location) {
        conditions.push(ilike(events.location, `%${options.location}%`));
      }
      
      // Date filters
      if (options.dateFilter) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const nextWeek = new Date(today);
        nextWeek.setDate(nextWeek.getDate() + 7);
        
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        
        // Weekend calculation
        const dayOfWeek = today.getDay(); // 0 is Sunday, 6 is Saturday
        const daysUntilWeekend = dayOfWeek === 0 || dayOfWeek === 6 ? 0 : 6 - dayOfWeek;
        const thisWeekend = new Date(today);
        thisWeekend.setDate(thisWeekend.getDate() + daysUntilWeekend);
        
        const weekendEnd = new Date(thisWeekend);
        weekendEnd.setDate(weekendEnd.getDate() + 2); // Weekend spans 2 days
        
        switch (options.dateFilter) {
          case 'today':
            conditions.push(sql`DATE(${events.startDate}) = DATE(${today.toISOString()})`);
            break;
          case 'tomorrow':
            conditions.push(sql`DATE(${events.startDate}) = DATE(${tomorrow.toISOString()})`);
            break;
          case 'this-week':
            conditions.push(sql`${events.startDate} >= ${today.toISOString()} AND ${events.startDate} < ${nextWeek.toISOString()}`);
            break;
          case 'this-weekend':
            conditions.push(sql`${events.startDate} >= ${thisWeekend.toISOString()} AND ${events.startDate} < ${weekendEnd.toISOString()}`);
            break;
          case 'this-month':
            conditions.push(sql`${events.startDate} >= ${today.toISOString()} AND ${events.startDate} < ${nextMonth.toISOString()}`);
            break;
          case 'future':
            conditions.push(sql`${events.startDate} >= ${today.toISOString()}`);
            break;
        }
      }
      
      // Custom date range
      if (options.minDate) {
        conditions.push(sql`${events.startDate} >= ${options.minDate}`);
      }
      
      if (options.maxDate) {
        conditions.push(sql`${events.startDate} <= ${options.maxDate}`);
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as any;
      }
    }
    
    // Apply sorting
    let result: Event[];
    if (options?.sortBy) {
      switch (options.sortBy) {
        case 'date-asc':
          result = await query.orderBy(asc(events.startDate));
          break;
        case 'date-desc':
          result = await query.orderBy(desc(events.startDate));
          break;
        case 'price-asc':
        case 'price-desc':
          // For price sorting, we need to first get the events, then fetch ticket types and sort
          const eventsData = await query.orderBy(desc(events.startDate)); // default sort as a fallback
          result = eventsData;
          break;
        default:
          result = await query.orderBy(desc(events.startDate));
      }
    } else {
      // Default sorting by date (newest first)
      result = await query.orderBy(desc(events.startDate));
    }
    
    // Cache the results if appropriate
    if (shouldCache) {
      cache.set(cacheKey, result, TTL.SHORT); // Short TTL for listings
    }
    
    return result;
  }
  
  async createEvent(eventData: CreateEventInput): Promise<Event> {
    const { ticketTypes: ticketTypesData, ...eventDetails } = eventData;
    
    // Start a transaction
    const newEvent = await db.transaction(async (tx) => {
      // Insert event
      const [event] = await tx.insert(events)
        .values(eventDetails)
        .returning();
      
      // Insert ticket types
      for (const ticketType of ticketTypesData) {
        await tx.insert(ticketTypes)
          .values({
            ...ticketType,
            eventId: event.id,
            availableQuantity: ticketType.quantity
          });
      }
      
      return event;
    });
    
    // Invalidate events cache
    this.invalidateTypeCache('events');
    
    return newEvent;
  }
  
  // TICKET TYPE OPERATIONS
  async getTicketTypes(eventId: number): Promise<TicketType[]> {
    const cacheKey = this.getCacheKey('ticket-types', eventId);
    const cachedTicketTypes = cache.get<TicketType[]>(cacheKey);
    
    if (cachedTicketTypes) {
      return cachedTicketTypes;
    }
    
    const result = await db.select()
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, eventId));
    
    // Cache the results
    cache.set(cacheKey, result, TTL.MEDIUM);
    
    return result;
  }
  
  async getTicketType(id: number): Promise<TicketType | undefined> {
    const cacheKey = this.getCacheKey('ticket-type', id);
    const cachedTicketType = cache.get<TicketType>(cacheKey);
    
    if (cachedTicketType) {
      return cachedTicketType;
    }
    
    const [ticketType] = await db.select()
      .from(ticketTypes)
      .where(eq(ticketTypes.id, id));
    
    if (ticketType) {
      cache.set(cacheKey, ticketType, TTL.MEDIUM);
    }
    
    return ticketType;
  }
  
  // Other method implementations follow the same pattern...
  
  // Implement remaining methods following the same caching pattern
  async getTicket(id: number): Promise<Ticket | undefined> {
    const [ticket] = await db.select()
      .from(tickets)
      .where(eq(tickets.id, id));
    return ticket;
  }
  
  async purchaseTickets(purchase: PurchaseTicketInput, userId: number): Promise<Ticket[]> {
    // Implementation remains similar to original
    // After successful purchase, invalidate relevant caches:
    this.invalidateCache('event', purchase.eventId);
    this.invalidateTypeCache('ticket-types');
    
    // Continue with original implementation...
    const { eventId, ticketSelections, customerDetails } = purchase;
    const orderId = nanoid(10);
    
    // Use a transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      const purchasedTickets: Ticket[] = [];
      
      // Get the event details for email confirmation
      const event = await this.getEvent(eventId);
      if (!event) {
        throw new Error(`Event ${eventId} not found`);
      }
      
      for (const selection of ticketSelections) {
        const { ticketTypeId, quantity, attendeeDetails = [] } = selection;
        
        // Get ticket type
        const [ticketType] = await tx.select()
          .from(ticketTypes)
          .where(eq(ticketTypes.id, ticketTypeId));
        
        if (!ticketType) {
          throw new Error(`Ticket type ${ticketTypeId} not found`);
        }
        
        if (ticketType.availableQuantity < quantity) {
          throw new Error(`Not enough tickets available for ${ticketType.name}`);
        }
        
        // Update available quantity
        await tx.update(ticketTypes)
          .set({ availableQuantity: ticketType.availableQuantity - quantity })
          .where(eq(ticketTypes.id, ticketTypeId));
        
        // Calculate total price - convert price to number for calculation, then back to string
        const pricePerTicket = Number(ticketType.price);
        const totalPrice = String(pricePerTicket * quantity);
        
        // Use primary customer details if no specific attendee details provided
        const attendeeData = attendeeDetails.length > 0 ? 
          attendeeDetails : 
          Array(quantity).fill(customerDetails);
          
        // Create ticket purchase record
        const [ticket] = await tx.insert(tickets)
          .values({
            ticketTypeId,
            eventId,
            userId,
            quantity,
            totalPrice,
            orderId,
            attendeeDetails: attendeeData
          })
          .returning();
        
        purchasedTickets.push(ticket);
      }
      
      return purchasedTickets;
    });
  }
  
  // Add remaining methods from original implementation...

  // IMPLEMENT REMAINING METHODS FROM ISTORAGE INTERFACE
  
  // Helper for generating ticket QR
  async generateTicketQR(ticketId: number): Promise<string> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }
    
    // Generate QR code if not already present
    if (!ticket.qrCode) {
      const qrData = JSON.stringify({
        ticketId: ticket.id,
        eventId: ticket.eventId,
        orderId: ticket.orderId,
        hash: nanoid(10) // Add a unique hash for verification
      });
      
      const qrCodeDataUrl = await QRCode.toDataURL(qrData);
      
      // Update ticket with QR code
      await db.update(tickets)
        .set({ qrCode: qrCodeDataUrl })
        .where(eq(tickets.id, ticketId));
      
      return qrCodeDataUrl;
    }
    
    return ticket.qrCode;
  }
  
  // Remaining methods would be implemented here following 
  // the same pattern of caching and cache invalidation
  
  // Implement other required methods based on IStorage interface...
  
  async getUserTickets(userId: number): Promise<Ticket[]> {
    const cacheKey = this.getCacheKey('user-tickets', userId);
    const cachedTickets = cache.get<Ticket[]>(cacheKey);
    
    if (cachedTickets) {
      return cachedTickets;
    }
    
    const result = await db.select()
      .from(tickets)
      .where(eq(tickets.userId, userId));
    
    // Cache with a moderate TTL since tickets can change
    cache.set(cacheKey, result, TTL.SHORT);
    
    return result;
  }
  
  async getEventTickets(eventId: number): Promise<Ticket[]> {
    return await db.select()
      .from(tickets)
      .where(eq(tickets.eventId, eventId));
  }
  
  async removeTicket(ticketId: number): Promise<void> {
    const ticket = await this.getTicket(ticketId);
    if (!ticket) return;
    
    await db.delete(tickets).where(eq(tickets.id, ticketId));
    
    // Invalidate relevant caches
    this.invalidateTypeCache('user-tickets');
    this.invalidateCache('event', ticket.eventId);
  }
  
  async getEventSales(eventId: number): Promise<{ 
    totalSales: number; 
    ticketsSold: number;
    salesByTicketType: {
      name: string;
      sold: number;
      revenue: number;
    }[]
  }> {
    const cacheKey = this.getCacheKey('event-sales', eventId);
    const cachedSales = cache.get(cacheKey);
    
    if (cachedSales) {
      return cachedSales;
    }
    
    // Get all tickets for this event
    const eventTickets = await this.getEventTickets(eventId);
    
    // Get all ticket types for this event
    const eventTicketTypes = await this.getTicketTypes(eventId);
    
    // Calculate total sales
    const totalSales = eventTickets.reduce((total, ticket) => {
      return total + Number(ticket.totalPrice);
    }, 0);
    
    // Calculate tickets sold
    const ticketsSold = eventTickets.reduce((total, ticket) => {
      return total + ticket.quantity;
    }, 0);
    
    // Calculate sales by ticket type
    const salesByTicketType = eventTicketTypes.map(ticketType => {
      // Find all tickets of this type
      const ticketsOfType = eventTickets.filter(ticket => ticket.ticketTypeId === ticketType.id);
      
      // Calculate tickets sold and revenue for this type
      const sold = ticketsOfType.reduce((total, ticket) => total + ticket.quantity, 0);
      const revenue = ticketsOfType.reduce((total, ticket) => total + Number(ticket.totalPrice), 0);
      
      return {
        name: ticketType.name,
        sold,
        revenue
      };
    });
    
    const result = { totalSales, ticketsSold, salesByTicketType };
    
    // Cache the result
    cache.set(cacheKey, result, TTL.SHORT);
    
    return result;
  }
  
  async validateTicket(ticketId: number): Promise<boolean> {
    try {
      // Get the ticket
      const [ticket] = await db.select()
        .from(tickets)
        .where(eq(tickets.id, ticketId));
      
      if (!ticket) {
        return false;
      }
      
      // Check if ticket has already been used
      if (ticket.isUsed) {
        return false;
      }
      
      // Mark ticket as used
      await db.update(tickets)
        .set({ isUsed: true })
        .where(eq(tickets.id, ticketId));
      
      // Invalidate ticket cache
      this.invalidateCache('ticket', ticketId);
      
      return true;
    } catch (error) {
      console.error('Error validating ticket:', error);
      throw new Error('Failed to validate ticket');
    }
  }
  
  // VENUES AND RENTALS IMPLEMENTATION
  // These would follow the same pattern as above
  async getVenue(id: number): Promise<Venue | undefined> {
    const cacheKey = this.getCacheKey('venue', id);
    const cachedVenue = cache.get<Venue>(cacheKey);
    
    if (cachedVenue) {
      return cachedVenue;
    }
    
    const [venue] = await db.select()
      .from(venues)
      .where(eq(venues.id, id));
    
    if (venue) {
      cache.set(cacheKey, venue, TTL.MEDIUM);
    }
    
    return venue;
  }
  
  async getVenues(centerId?: number): Promise<Venue[]> {
    const cacheKey = centerId ? 
      this.getCacheKey('venues-center', centerId) : 
      'venues:all';
    
    const cachedVenues = cache.get<Venue[]>(cacheKey);
    
    if (cachedVenues) {
      return cachedVenues;
    }
    
    let query = db.select().from(venues);
    
    if (centerId) {
      query = query.where(eq(venues.ownerId, centerId));
    }
    
    const result = await query.orderBy(asc(venues.name));
    
    cache.set(cacheKey, result, TTL.MEDIUM);
    
    return result;
  }
  
  // Remaining venue and rental methods would go here
  // following the same caching approach
  
  async createVenue(venue: InsertVenue): Promise<Venue> {
    try {
      const [newVenue] = await db.insert(venues)
        .values({
          name: venue.name,
          description: venue.description,
          location: venue.location,
          capacity: venue.capacity,
          hourlyRate: venue.hourlyRate,
          dailyRate: venue.dailyRate,
          facilities: venue.facilities,
          availabilityHours: venue.availabilityHours,
          ownerId: venue.ownerId,
          images: venue.images,
          isActive: venue.isActive
        })
        .returning();
      
      // Invalidate venues caches
      this.invalidateTypeCache('venues');
      
      return newVenue;
    } catch (error) {
      console.error("Error in createVenue:", error);
      throw error;
    }
  }
  
  async updateVenue(id: number, venue: Partial<InsertVenue>): Promise<Venue> {
    const [updatedVenue] = await db.update(venues)
      .set(venue)
      .where(eq(venues.id, id))
      .returning();
    
    // Invalidate caches
    this.invalidateCache('venue', id);
    this.invalidateTypeCache('venues');
    
    return updatedVenue;
  }
  
  async deleteVenue(id: number): Promise<void> {
    await db.delete(venues)
      .where(eq(venues.id, id));
    
    // Invalidate caches
    this.invalidateCache('venue', id);
    this.invalidateTypeCache('venues');
  }
  
  // EVENT SHARE ANALYTICS
  async trackEventShare(shareData: InsertEventShare): Promise<EventShare> {
    const [share] = await db.insert(eventShares)
      .values(shareData)
      .returning();
    
    // Invalidate share analytics cache
    this.invalidateCache('event-shares', shareData.eventId);
    
    return share;
  }
  
  async getEventShareAnalytics(eventId: number): Promise<EventShareAnalytics> {
    const cacheKey = this.getCacheKey('event-shares', eventId);
    const cachedAnalytics = cache.get<EventShareAnalytics>(cacheKey);
    
    if (cachedAnalytics) {
      return cachedAnalytics;
    }
    
    // Get all shares for this event
    const shares = await db.select()
      .from(eventShares)
      .where(eq(eventShares.eventId, eventId));
    
    // Calculate total shares
    const total = shares.length;
    
    // Calculate shares by platform
    const platforms = shares.reduce<Record<string, number>>((acc, share) => {
      const platform = share.platform;
      acc[platform] = (acc[platform] || 0) + 1;
      return acc;
    }, {
      facebook: 0,
      twitter: 0,
      linkedin: 0,
      whatsapp: 0,
      copy_link: 0
    });
    
    const result = { total, platforms };
    
    // Cache the result
    cache.set(cacheKey, result, TTL.SHORT);
    
    return result;
  }
  
  /**
   * Generate a sales report for venues, optionally filtered by venue, date range
   */
  async getVenueSalesReport(
    venueId?: number, 
    startDate?: Date, 
    endDate?: Date
  ): Promise<{
    totalRevenue: number;
    completedBookings: number;
    canceledBookings: number;
    pendingPayments: number;
    paidBookings: number;
    refundedBookings: number;
    averageBookingValue: number;
    venueBreakdown?: {
      venueId: number;
      venueName: string;
      revenue: number;
      bookings: number;
    }[];
    timeBreakdown: {
      period: string;
      revenue: number;
      bookings: number;
    }[];
  }> {
    // Generate cache key based on parameters
    const cacheKey = this.getCacheKey('venue-sales-report', 
      `${venueId || 'all'}-${startDate?.toISOString() || 'any'}-${endDate?.toISOString() || 'any'}`);
    
    // Try to get from cache first
    const cachedReport = cache.get(cacheKey);
    if (cachedReport) {
      return cachedReport;
    }
    
    try {
      // Build the query with filters
      let query = db.select({
        id: rentals.id,
        venueId: rentals.venueId,
        totalPrice: rentals.totalPrice,
        status: rentals.status,
        paymentStatus: rentals.paymentStatus,
        startTime: rentals.startTime,
        endTime: rentals.endTime
      }).from(rentals);
      
      // Apply filters
      if (venueId) {
        query = query.where(eq(rentals.venueId, venueId));
      }
      
      if (startDate) {
        query = query.where(sql`${rentals.startTime} >= ${startDate}`);
      }
      
      if (endDate) {
        query = query.where(sql`${rentals.startTime} <= ${endDate}`);
      }
      
      // Execute query
      const rentalRecords = await query;
      
      // Initialize counters and aggregates
      let totalRevenue = 0;
      let completedBookings = 0;
      let canceledBookings = 0;
      let pendingPayments = 0;
      let paidBookings = 0;
      let refundedBookings = 0;
      
      // Map to track venue-specific data
      const venueData: Map<number, { 
        revenue: number; 
        bookings: number;
        venueName?: string;
      }> = new Map();
      
      // Map to track time-based data by month (format: YYYY-MM)
      const timeData: Map<string, { 
        revenue: number; 
        bookings: number;
      }> = new Map();
      
      // Process rentals
      for (const rental of rentalRecords) {
        const price = parseFloat(rental.totalPrice);
        const rentalDate = new Date(rental.startTime);
        const period = `${rentalDate.getFullYear()}-${String(rentalDate.getMonth() + 1).padStart(2, '0')}`;
        
        // Only count revenue for paid bookings
        if (rental.paymentStatus === 'paid') {
          totalRevenue += price;
          
          // Add to venue breakdown
          if (!venueData.has(rental.venueId)) {
            venueData.set(rental.venueId, { revenue: 0, bookings: 0 });
          }
          const venueInfo = venueData.get(rental.venueId)!;
          venueInfo.revenue += price;
          venueInfo.bookings += 1;
          
          // Add to time breakdown
          if (!timeData.has(period)) {
            timeData.set(period, { revenue: 0, bookings: 0 });
          }
          const periodData = timeData.get(period)!;
          periodData.revenue += price;
          periodData.bookings += 1;
        }
        
        // Count by status
        if (rental.status === 'completed') completedBookings++;
        if (rental.status === 'canceled') canceledBookings++;
        
        // Count by payment status
        if (rental.paymentStatus === 'unpaid') pendingPayments++;
        if (rental.paymentStatus === 'paid') paidBookings++;
        if (rental.paymentStatus === 'refunded') refundedBookings++;
      }
      
      // Fetch venue names if needed
      if (venueData.size > 0) {
        const venueIds = Array.from(venueData.keys());
        const venueRecords = await db.select({
          id: venues.id,
          name: venues.name
        }).from(venues).where(inArray(venues.id, venueIds));
        
        // Add venue names to the data
        for (const venue of venueRecords) {
          const data = venueData.get(venue.id);
          if (data) {
            data.venueName = venue.name;
          }
        }
      }
      
      // Prepare the final report
      const report = {
        totalRevenue,
        completedBookings,
        canceledBookings,
        pendingPayments,
        paidBookings,
        refundedBookings,
        averageBookingValue: paidBookings > 0 ? totalRevenue / paidBookings : 0,
        venueBreakdown: venueId ? undefined : Array.from(venueData.entries()).map(([venueId, data]) => ({
          venueId,
          venueName: data.venueName || `Venue #${venueId}`,
          revenue: data.revenue,
          bookings: data.bookings
        })),
        timeBreakdown: Array.from(timeData.entries())
          .map(([period, data]) => ({
            period,
            revenue: data.revenue,
            bookings: data.bookings
          }))
          .sort((a, b) => a.period.localeCompare(b.period))
      };
      
      // Cache the report
      cache.set(cacheKey, report, TTL.MEDIUM);
      
      return report;
    } catch (error) {
      console.error('Error generating venue sales report:', error);
      throw error;
    }
  }
  
  // RENTAL OPERATIONS
  async getRental(id: number): Promise<Rental | undefined> {
    const cacheKey = this.getCacheKey('rental', id);
    const cachedRental = cache.get<Rental>(cacheKey);
    
    if (cachedRental) {
      return cachedRental;
    }
    
    const [rental] = await db.select()
      .from(rentals)
      .where(eq(rentals.id, id));
    
    if (rental) {
      cache.set(cacheKey, rental, TTL.MEDIUM);
    }
    
    return rental;
  }
  
  async getRentals(filters?: { 
    venueId?: number; 
    customerId?: number; 
    centerId?: number; 
    startDate?: Date; 
    endDate?: Date;
    status?: RentalStatus; 
  }): Promise<Rental[]> {
    // This is a complex query with many filters, so we'll only cache very specific cases
    if (!filters) {
      const cacheKey = 'rentals:all';
      const cachedRentals = cache.get<Rental[]>(cacheKey);
      
      if (cachedRentals) {
        return cachedRentals;
      }
      
      const result = await db.select().from(rentals);
      cache.set(cacheKey, result, TTL.SHORT);
      
      return result;
    }
    
    // For filtered requests, perform DB query directly
    let query = db.select().from(rentals);
    
    if (filters) {
      const conditions: SQL[] = [];
      
      if (filters.venueId) {
        conditions.push(eq(rentals.venueId, filters.venueId));
      }
      
      // We'll handle centerId filtering separately after initial query
      
      if (filters.startDate) {
        conditions.push(sql`${rentals.startTime} >= ${filters.startDate.toISOString()}`);
      }
      
      if (filters.endDate) {
        conditions.push(sql`${rentals.endTime} <= ${filters.endDate.toISOString()}`);
      }
      
      if (filters.status) {
        conditions.push(eq(rentals.status, filters.status));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    let rentalsData = await query;
    
    // Additional filtering for center ID if needed
    if (filters.centerId) {
      // We need to get all venues owned by this center and filter rentals by those venues
      const centerVenues = await this.getVenues(filters.centerId);
      const centerVenueIds = centerVenues.map(v => v.id);
      
      rentalsData = rentalsData.filter(rental => centerVenueIds.includes(rental.venueId));
    }
    
    return rentalsData;
  }
  
  async createRental(rental: CreateRentalInput): Promise<Rental> {
    // Implementation similar to original
    
    // Invalidate relevant caches
    this.invalidateTypeCache('rentals');
    
    // Create the rental
    const [newRental] = await db.insert(rentals)
      .values(rental)
      .returning();
    
    return newRental;
  }
  
  async updateRentalStatus(id: number, status: RentalStatus): Promise<Rental> {
    const [updatedRental] = await db.update(rentals)
      .set({ status })
      .where(eq(rentals.id, id))
      .returning();
    
    // Invalidate caches
    this.invalidateCache('rental', id);
    
    return updatedRental;
  }
  
  async updatePaymentStatus(id: number, paymentStatus: PaymentStatus): Promise<Rental> {
    const [updatedRental] = await db.update(rentals)
      .set({ paymentStatus })
      .where(eq(rentals.id, id))
      .returning();
    
    // Invalidate caches
    this.invalidateCache('rental', id);
    
    return updatedRental;
  }
  
  // Helper method for rentals
  private async enrichRental(rental: Rental): Promise<Rental> {
    // Get venue
    const venue = await this.getVenue(rental.venueId);
    
    // Return rental with venue data
    return {
      ...rental,
      venue
    };
  }
}

// Create and export a singleton instance
export const optimizedStorage = new OptimizedStorage();