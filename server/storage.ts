import { 
  User, InsertUser, 
  Event, InsertEvent, 
  TicketType, InsertTicketType,
  Ticket, InsertTicket,
  CreateEventInput,
  PurchaseTicketInput,
  EventSearchParams,
  AttendeeDetails,
  users, events, ticketTypes, tickets,
  // Venue and Rental types
  Venue, InsertVenue,
  Rental, InsertRental,
  CreateRentalInput,
  RentalStatus, PaymentStatus,
  venues, rentals,
  // Share tracking types
  EventShare, InsertEventShare,
  EventShareAnalytics, SharePlatform,
  eventShares
} from "@shared/schema";
import { nanoid } from "nanoid";
import { db, pool } from "./db";
import { eq, and, or, ne, gt, lt, gte, lte, SQL, sql, like, desc, asc, ilike } from "drizzle-orm";
import session from "express-session";
import QRCode from "qrcode";
import connectPgSimple from "connect-pg-simple";
import { sendTicketConfirmationEmail } from "./email";
import { hashPassword } from "./auth";
import { randomBytes } from "crypto";

export interface IStorage {
  // Session store for authentication
  sessionStore: session.Store;
  
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, userData: Partial<Omit<InsertUser, "id">>): Promise<User>;
  deleteUser(id: number): Promise<boolean>;
  
  // Email verification operations
  createVerificationToken(userId: number): Promise<string>;
  verifyEmail(token: string): Promise<boolean>;
  
  // Password reset operations
  createPasswordResetToken(email: string): Promise<string | null>;
  resetPassword(token: string, newPassword: string): Promise<boolean>;
  
  // Event operations
  getEvent(id: number): Promise<Event | undefined>;
  getEvents(options?: EventSearchParams): Promise<Event[]>;
  createEvent(event: CreateEventInput): Promise<Event>;
  
  // TicketType operations
  getTicketTypes(eventId: number): Promise<TicketType[]>;
  getTicketType(id: number): Promise<TicketType | undefined>;
  
  // Ticket operations
  getTicket(id: number): Promise<Ticket | undefined>;
  purchaseTickets(purchase: PurchaseTicketInput, userId: number): Promise<Ticket[]>;
  getUserTickets(userId: number): Promise<Ticket[]>;
  getEventTickets(eventId: number): Promise<Ticket[]>;
  removeTicket(ticketId: number): Promise<void>;
  getEventSales(eventId: number): Promise<{ 
    totalSales: number; 
    ticketsSold: number;
    salesByTicketType: {
      name: string;
      sold: number;
      revenue: number;
    }[]
  }>;
  
  // Ticket validation and QR code operations
  generateTicketQR(ticketId: number): Promise<string>;
  validateTicket(ticketId: number): Promise<boolean>;
  
  // Venue operations
  getVenue(id: number): Promise<Venue | undefined>;
  getVenues(centerId?: number): Promise<Venue[]>;
  createVenue(venue: InsertVenue): Promise<Venue>;
  updateVenue(id: number, venue: Partial<InsertVenue>): Promise<Venue>;
  deleteVenue(id: number): Promise<void>;
  
  // Rental operations
  getRental(id: number): Promise<Rental | undefined>;
  getRentals(filters?: { 
    venueId?: number; 
    customerId?: number; 
    centerId?: number; 
    startDate?: Date; 
    endDate?: Date;
    status?: RentalStatus; 
  }): Promise<Rental[]>;
  createRental(rental: CreateRentalInput): Promise<Rental>;
  updateRentalStatus(id: number, status: RentalStatus): Promise<Rental>;
  updatePaymentStatus(id: number, status: PaymentStatus): Promise<Rental>;
  
  // Event shares operations
  trackEventShare(shareData: InsertEventShare): Promise<EventShare>;
  getEventShareAnalytics(eventId: number): Promise<EventShareAnalytics>;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    // Initialize session store with PostgreSQL connection
    const PostgresSessionStore = connectPgSimple(session);
    this.sessionStore = new PostgresSessionStore({
      pool,
      tableName: 'session',
      createTableIfMissing: true
    });
  }
  
  // User operations
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const [newUser] = await db.insert(users)
      .values(user)
      .returning();
    return newUser;
  }
  
  async updateUser(id: number, userData: Partial<Omit<InsertUser, "id">>): Promise<User> {
    const [updatedUser] = await db.update(users)
      .set(userData)
      .where(eq(users.id, id))
      .returning();
      
    if (!updatedUser) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    return updatedUser;
  }
  
  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users)
      .where(eq(users.id, id))
      .returning({ id: users.id });
      
    return result.length > 0;
  }
  
  // Email verification operations
  async createVerificationToken(userId: number): Promise<string> {
    try {
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
      
      return token;
    } catch (error) {
      console.error('Error creating verification token:', error);
      throw new Error('Failed to create verification token');
    }
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
      
      // Check if token has expired
      if (user.verificationTokenExpires && user.verificationTokenExpires < new Date()) {
        return false; // Token expired
      }
      
      // Mark email as verified and clear token
      await db.update(users)
        .set({
          emailVerified: true,
          verificationToken: null,
          verificationTokenExpires: null
        })
        .where(eq(users.id, user.id));
      
      return true;
    } catch (error) {
      console.error('Error verifying email:', error);
      return false;
    }
  }
  
  // Password reset operations
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
      
      // Check if token has expired
      if (user.resetTokenExpires && user.resetTokenExpires < new Date()) {
        return false; // Token expired
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update password and clear token
      await db.update(users)
        .set({
          password: hashedPassword,
          resetToken: null,
          resetTokenExpires: null
        })
        .where(eq(users.id, user.id));
      
      return true;
    } catch (error) {
      console.error('Error resetting password:', error);
      return false;
    }
  }

  // Event operations
  async getEvent(id: number): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async getEvents(options?: EventSearchParams): Promise<Event[]> {
    let query = db.select().from(events);
    
    if (options) {
      const conditions: SQL[] = [];
      
      // Basic filters
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
        // Cast query to appropriate type to satisfy TypeScript
        // This doesn't affect functionality but resolves type issues with query.where()
        query = query.where(and(...conditions)) as any;
      }
    }
    
    // Apply sorting
    if (options?.sortBy) {
      switch (options.sortBy) {
        case 'date-asc':
          return await query.orderBy(asc(events.startDate));
        case 'date-desc':
          return await query.orderBy(desc(events.startDate));
        case 'price-asc':
        case 'price-desc':
          // For price sorting, we need to first get the events, then fetch ticket types and sort
          // This is because price isn't in the events table but in ticket_types
          const eventsData = await query.orderBy(desc(events.startDate)); // default sort as a fallback
          return eventsData;
        default:
          return await query.orderBy(desc(events.startDate));
      }
    }
    
    // Default sorting by date (newest first)
    return await query.orderBy(desc(events.startDate));
  }

  async createEvent(eventData: CreateEventInput): Promise<Event> {
    const { ticketTypes: ticketTypesData, ...eventDetails } = eventData;
    
    // Start a transaction
    return await db.transaction(async (tx) => {
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
  }

  // TicketType operations
  async getTicketTypes(eventId: number): Promise<TicketType[]> {
    return await db.select()
      .from(ticketTypes)
      .where(eq(ticketTypes.eventId, eventId));
  }

  async getTicketType(id: number): Promise<TicketType | undefined> {
    const [ticketType] = await db.select()
      .from(ticketTypes)
      .where(eq(ticketTypes.id, id));
    return ticketType;
  }

  // Ticket operations
  async getTicket(id: number): Promise<Ticket | undefined> {
    const [ticket] = await db.select()
      .from(tickets)
      .where(eq(tickets.id, id));
    return ticket;
  }
  async purchaseTickets(purchase: PurchaseTicketInput, userId: number): Promise<Ticket[]> {
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
            purchaseDate: new Date(),
            isUsed: false,
            attendeeDetails: attendeeData
          })
          .returning();
        
        // Generate QR code for the ticket
        const ticketData = {
          id: ticket.id,
          eventId: ticket.eventId,
          ticketTypeId: ticket.ticketTypeId,
          orderId: ticket.orderId,
          timestamp: new Date().toISOString(),
        };
        
        try {
          // Generate a QR code in data URL format
          const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(ticketData));
          
          // Update the ticket with the QR code
          await tx.update(tickets)
            .set({ qrCode: qrCodeDataURL })
            .where(eq(tickets.id, ticket.id));
          
          // Update our local ticket object with QR code
          ticket.qrCode = qrCodeDataURL;
          
          // Send email confirmation with the ticket details
          if (customerDetails && customerDetails.email) {
            try {
              const emailSent = await sendTicketConfirmationEmail({
                ticket,
                event,
                ticketType,
                attendeeEmail: customerDetails.email,
                attendeeName: customerDetails.fullName,
                qrCodeDataUrl: qrCodeDataURL
              });
              
              // Update the ticket with email sent status
              if (emailSent) {
                await tx.update(tickets)
                  .set({ emailSent: true })
                  .where(eq(tickets.id, ticket.id));
                
                ticket.emailSent = true;
              }
            } catch (emailError) {
              console.error('Error sending ticket confirmation email:', emailError);
              // Continue even if email sending fails
            }
          }
        } catch (error) {
          console.error('Error generating QR code:', error);
          // Continue even if QR generation fails
        }
        
        purchasedTickets.push(ticket);
      }
      
      return purchasedTickets;
    });
  }

  async getUserTickets(userId: number): Promise<Ticket[]> {
    return await db.select()
      .from(tickets)
      .where(eq(tickets.userId, userId))
      .orderBy(desc(tickets.purchaseDate));
  }
  
  // Get all tickets for a specific event
  async getEventTickets(eventId: number): Promise<Ticket[]> {
    return await db.select()
      .from(tickets)
      .where(eq(tickets.eventId, eventId))
      .orderBy(desc(tickets.purchaseDate));
  }
  
  // Remove a ticket
  async removeTicket(ticketId: number): Promise<void> {
    await db.delete(tickets)
      .where(eq(tickets.id, ticketId));
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
    // Get tickets for this event
    const eventTickets = await db.select()
      .from(tickets)
      .where(eq(tickets.eventId, eventId));
    
    // Get ticket types for this event
    const eventTicketTypes = await this.getTicketTypes(eventId);
    
    // Calculate sales metrics
    let totalSales = 0;
    let ticketsSold = 0;
    const salesByTicketType = new Map<number, { name: string; sold: number; revenue: number }>();
    
    // Initialize sales by ticket type
    for (const tt of eventTicketTypes) {
      salesByTicketType.set(tt.id, { 
        name: tt.name, 
        sold: 0, 
        revenue: 0 
      });
    }
    
    // Aggregate sales data
    for (const ticket of eventTickets) {
      totalSales += Number(ticket.totalPrice);
      ticketsSold += ticket.quantity;
      
      const ticketTypeSales = salesByTicketType.get(ticket.ticketTypeId);
      if (ticketTypeSales) {
        ticketTypeSales.sold += ticket.quantity;
        ticketTypeSales.revenue += Number(ticket.totalPrice);
        salesByTicketType.set(ticket.ticketTypeId, ticketTypeSales);
      }
    }
    
    return {
      totalSales,
      ticketsSold,
      salesByTicketType: Array.from(salesByTicketType.values())
    };
  }
  
  // QR code handling
  async generateTicketQR(ticketId: number): Promise<string> {
    try {
      // Get the ticket to ensure it exists
      const [ticket] = await db.select()
        .from(tickets)
        .where(eq(tickets.id, ticketId));
      
      if (!ticket) {
        throw new Error('Ticket not found');
      }
      
      // Create ticket validation data
      const ticketData = {
        id: ticket.id,
        eventId: ticket.eventId,
        ticketTypeId: ticket.ticketTypeId,
        orderId: ticket.orderId,
        timestamp: new Date().toISOString(),
      };
      
      // Generate a QR code in data URL format
      const qrCodeDataURL = await QRCode.toDataURL(JSON.stringify(ticketData));
      
      // Store the QR code in the database
      await db.update(tickets)
        .set({ qrCode: qrCodeDataURL })
        .where(eq(tickets.id, ticketId));
      
      return qrCodeDataURL;
    } catch (error) {
      console.error('Error generating QR code:', error);
      throw new Error('Failed to generate QR code for ticket');
    }
  }
  
  async validateTicket(ticketId: number): Promise<boolean> {
    try {
      // Get the ticket
      const [ticket] = await db.select()
        .from(tickets)
        .where(eq(tickets.id, ticketId));
      
      if (!ticket) {
        throw new Error('Ticket not found');
      }
      
      // Check if the ticket is already used
      if (ticket.isUsed) {
        return false; // Ticket already used
      }
      
      // Mark the ticket as used
      await db.update(tickets)
        .set({ isUsed: true })
        .where(eq(tickets.id, ticketId));
      
      return true;
    } catch (error) {
      console.error('Error validating ticket:', error);
      throw new Error('Failed to validate ticket');
    }
  }

  // Venue operations
  async getVenue(id: number): Promise<Venue | undefined> {
    const [venue] = await db.select()
      .from(venues)
      .where(eq(venues.id, id));
    return venue;
  }

  async getVenues(centerId?: number): Promise<Venue[]> {
    let query = db.select().from(venues);
    
    if (centerId) {
      query = query.where(eq(venues.ownerId, centerId));
    }
    
    return await query.orderBy(asc(venues.name));
  }

  async createVenue(venue: InsertVenue): Promise<Venue> {
    // The venue object should already have hourlyRate and dailyRate as strings
    // due to our schema transformation
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
    return updatedVenue;
  }

  async deleteVenue(id: number): Promise<void> {
    await db.delete(venues)
      .where(eq(venues.id, id));
  }

  // Rental operations
  async getRental(id: number): Promise<Rental | undefined> {
    const [rental] = await db.select()
      .from(rentals)
      .where(eq(rentals.id, id));
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
    // First get the base rentals data
    let query = db.select().from(rentals);
    
    if (filters) {
      const conditions: SQL[] = [];
      
      if (filters.venueId) {
        conditions.push(eq(rentals.venueId, filters.venueId));
      }
      
      if (filters.customerId) {
        conditions.push(eq(rentals.customerId, filters.customerId));
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
        query = query.where(and(...conditions)) as any;
      }
    }
    
    let rentalResults = await query.orderBy(desc(rentals.startTime));
    
    // If we need to filter by centerId, we need to get venues and check ownership
    if (filters?.centerId) {
      // Get all venues owned by this center
      const venueList = await db.select().from(venues).where(eq(venues.ownerId, filters.centerId));
      const venueIds = venueList.map(v => v.id);
      
      // Filter rental results to only include those for venues owned by this center
      rentalResults = rentalResults.filter(rental => venueIds.includes(rental.venueId));
    }
    
    // Now enrich with venue and customer names
    const enrichedRentals = [];
    
    for (const rental of rentalResults) {
      try {
        // Get venue name
        const venue = await this.getVenue(rental.venueId);
        const venueName = venue ? venue.name : `Venue #${rental.venueId}`;
        
        // Get customer name
        let customerName = rental.customerName;
        if (!customerName) {
          try {
            const user = await this.getUser(rental.customerId);
            customerName = user ? user.name || user.username : `Customer #${rental.customerId}`;
          } catch (err) {
            console.error("Error fetching customer:", err);
            customerName = `Customer #${rental.customerId}`;
          }
        }
        
        // Add venue and customer names to the rental object
        enrichedRentals.push({
          ...rental,
          venueName,
          customerName
        });
      } catch (err) {
        console.error("Error enriching rental data:", err);
        enrichedRentals.push(rental);
      }
    }
    
    return enrichedRentals;
  }

  async createRental(rental: CreateRentalInput): Promise<Rental> {
    // First, check venue availability for the requested time
    const venue = await this.getVenue(rental.venueId);
    if (!venue) {
      throw new Error('Venue not found');
    }
    
    // Check if there are overlapping rentals
    const overlappingRentals = await db.select()
      .from(rentals)
      .where(
        and(
          eq(rentals.venueId, rental.venueId),
          ne(rentals.status, 'canceled'), // Ignore canceled rentals
          or(
            // New rental starts during an existing rental
            and(
              gte(sql`${rental.startTime.toISOString()}`, rentals.startTime),
              lt(sql`${rental.startTime.toISOString()}`, rentals.endTime)
            ),
            // New rental ends during an existing rental
            and(
              gt(sql`${rental.endTime.toISOString()}`, rentals.startTime),
              lte(sql`${rental.endTime.toISOString()}`, rentals.endTime)
            ),
            // New rental completely contains an existing rental
            and(
              lte(sql`${rental.startTime.toISOString()}`, rentals.startTime),
              gte(sql`${rental.endTime.toISOString()}`, rentals.endTime)
            )
          )
        )
      );
    
    if (overlappingRentals.length > 0) {
      throw new Error('Venue is already booked during the requested time');
    }
    
    // Extract any customFields before inserting into database
    const { customFields, ...rentalData } = rental as any;

    // Ensure we have a customerName
    if (!rentalData.customerName) {
      rentalData.customerName = "Guest";
    }

    // Create the rental
    const [newRental] = await db.insert(rentals)
      .values({
        ...rentalData,
        status: rental.status || 'pending',
        paymentStatus: rental.paymentStatus || 'unpaid',
        updatedAt: new Date()
      })
      .returning();
    
    // Enrich the rental with venue name and customer name for immediate use
    const venueName = venue.name;
    
    return {
      ...newRental,
      venueName
    };
  }

  async updateRentalStatus(id: number, status: RentalStatus): Promise<Rental> {
    const [updatedRental] = await db.update(rentals)
      .set({ 
        status, 
        updatedAt: new Date() 
      })
      .where(eq(rentals.id, id))
      .returning();
    
    // Enrich with venue and customer details
    return this.enrichRental(updatedRental);
  }

  async updatePaymentStatus(id: number, paymentStatus: PaymentStatus): Promise<Rental> {
    const [updatedRental] = await db.update(rentals)
      .set({ 
        paymentStatus, 
        updatedAt: new Date() 
      })
      .where(eq(rentals.id, id))
      .returning();
    
    // Enrich with venue and customer details
    return this.enrichRental(updatedRental);
  }
  
  // Helper method to enrich rental with venue name
  private async enrichRental(rental: Rental): Promise<Rental> {
    if (!rental) return rental;
    
    try {
      // Get venue name
      const venue = await this.getVenue(rental.venueId);
      const venueName = venue ? venue.name : `Venue #${rental.venueId}`;
      
      // Return rental with venue name (customerName is already on the rental object)
      return {
        ...rental,
        venueName
      };
    } catch (err) {
      console.error("Error enriching rental:", err);
      return rental;
    }
  }

  // Event shares operations
  async trackEventShare(shareData: InsertEventShare): Promise<EventShare> {
    try {
      const [share] = await db
        .insert(eventShares)
        .values(shareData)
        .returning();
      
      return share;
    } catch (error) {
      console.error('Error tracking event share:', error);
      throw new Error('Failed to track event share');
    }
  }

  async getEventShareAnalytics(eventId: number): Promise<EventShareAnalytics> {
    try {
      // Get all shares for this event
      const shares = await db
        .select()
        .from(eventShares)
        .where(eq(eventShares.eventId, eventId));
      
      // Initialize with default platform counts
      const platforms: Record<SharePlatform, number> = {
        facebook: 0,
        twitter: 0,
        linkedin: 0,
        whatsapp: 0,
        copy_link: 0
      };
      
      // Count shares by platform
      shares.forEach(share => {
        const platform = share.platform as SharePlatform;
        if (platform in platforms) {
          platforms[platform]++;
        }
      });
      
      return {
        total: shares.length,
        platforms
      };
    } catch (error) {
      console.error('Error getting event share analytics:', error);
      throw new Error('Failed to get event share analytics');
    }
  }
}

// Create demo user
async function createInitialData() {
  try {
    // Check if demo user exists
    const demoUser = await db.select().from(users).where(eq(users.username, "demo"));
    
    if (demoUser.length === 0) {
      // Create demo user
      await db.insert(users).values({
        username: "demo",
        password: "password",
        name: "Demo User",
        email: "demo@example.com"
      });
    }
  } catch (error) {
    console.error("Error creating initial data:", error);
  }
}

// Initialize database with demo user
createInitialData();

export const storage = new DatabaseStorage();
