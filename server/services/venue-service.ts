import { db } from '../db';
import { eq, and, asc, desc, sql, inArray, ilike, type SQL } from 'drizzle-orm';
import NodeCache from 'node-cache';
import { randomBytes } from 'crypto';
import { hashPassword } from '../auth';
import { 
  venues, 
  rentals,
  cashiers,
  cashierVenues,
  users,
  type Venue,
  type Rental,
  type Cashier,
  type CashierVenue,
  type InsertVenue, 
  type InsertCashier,
  type InsertCashierVenue,
  type RentalStatus,
  type PaymentStatus,
  DEFAULT_CASHIER_PERMISSIONS
} from '@shared/schema';

/**
 * Venue Service - Handles all venue and rental related database operations
 */
export class VenueService {
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
   * Get a venue by ID
   */
  async getVenue(id: number): Promise<Venue | undefined> {
    const cacheKey = this.getCacheKey('venue', id);
    const cachedVenue = this.cache.get<Venue>(cacheKey);
    
    if (cachedVenue) {
      return cachedVenue;
    }
    
    const [venue] = await db.select().from(venues).where(eq(venues.id, id));
    
    if (venue) {
      this.cache.set(cacheKey, venue);
    }
    
    return venue;
  }
  
  /**
   * Get all venues, optionally filtered by center ID
   */
  async getVenues(centerId?: number): Promise<Venue[]> {
    const cacheKey = this.getCacheKey('venues', centerId || 'all');
    const cachedVenues = this.cache.get<Venue[]>(cacheKey);
    
    if (cachedVenues) {
      return cachedVenues;
    }
    
    let query = db.select().from(venues);
    
    if (centerId) {
      query = query.where(eq(venues.ownerId, centerId));
    }
    
    // Sort by name ascending
    query = query.orderBy(asc(venues.name));
    
    const venuesList = await query;
    this.cache.set(cacheKey, venuesList);
    
    return venuesList;
  }
  
  /**
   * Create a new venue
   */
  async createVenue(venue: InsertVenue): Promise<Venue> {
    // Ensure we have both hourlyRate and dailyRate (required by schema)
    const venueData = {
      ...venue,
      // If dailyRate is not provided, calculate it as 8x hourlyRate
      dailyRate: venue.dailyRate || (venue.hourlyRate ? String(parseFloat(venue.hourlyRate) * 8) : "0.00"),
      // Convert amenities/images to jsonb if they exist
      facilities: venue.amenities ? JSON.stringify(venue.amenities) : undefined,
      images: venue.images ? JSON.stringify(venue.images) : undefined
    };
    
    // Extract only the properties we need to insert
    const insertData = {
      name: venueData.name,
      location: venueData.location,
      description: venueData.description,
      capacity: venueData.capacity,
      hourlyRate: venueData.hourlyRate,
      dailyRate: venueData.dailyRate,
      facilities: venueData.facilities,
      availabilityHours: venueData.availabilityHours,
      ownerId: venueData.ownerId,
      images: venueData.images,
      isActive: venueData.isActive ?? true
    };
    
    const [newVenue] = await db.insert(venues).values(insertData).returning();
    this.invalidateTypeCache('venues');
    return newVenue;
  }
  
  /**
   * Update an existing venue
   */
  async updateVenue(id: number, venue: Partial<InsertVenue>): Promise<Venue> {
    const [updatedVenue] = await db
      .update(venues)
      .set(venue)
      .where(eq(venues.id, id))
      .returning();
    
    this.invalidateCache('venue', id);
    this.invalidateTypeCache('venues');
    
    return updatedVenue;
  }
  
  /**
   * Delete a venue
   */
  async deleteVenue(id: number): Promise<void> {
    await db.delete(venues).where(eq(venues.id, id));
    
    this.invalidateCache('venue', id);
    this.invalidateTypeCache('venues');
  }
  
  /**
   * Get a rental by ID
   */
  async getRental(id: number): Promise<Rental | undefined> {
    const cacheKey = this.getCacheKey('rental', id);
    const cachedRental = this.cache.get<Rental>(cacheKey);
    
    if (cachedRental) {
      return cachedRental;
    }
    
    const [rental] = await db.select().from(rentals).where(eq(rentals.id, id));
    
    if (rental) {
      const enrichedRental = await this.enrichRental(rental);
      this.cache.set(cacheKey, enrichedRental);
      return enrichedRental;
    }
    
    return undefined;
  }
  
  /**
   * Get all rentals, with optional filters
   */
  async getRentals(filters?: { 
    venueId?: number;
    customerId?: number;
    startDate?: Date;
    endDate?: Date;
    status?: RentalStatus;
    paymentStatus?: PaymentStatus;
  }): Promise<Rental[]> {
    // Create a cache key based on filters
    const filterKey = filters ? JSON.stringify(filters) : 'all';
    const cacheKey = this.getCacheKey('rentals', filterKey);
    const cachedRentals = this.cache.get<Rental[]>(cacheKey);
    
    if (cachedRentals) {
      return cachedRentals;
    }
    
    let query = db.select().from(rentals);
    
    if (filters) {
      const conditions: SQL[] = [];
      
      if (filters.venueId) {
        conditions.push(eq(rentals.venueId, filters.venueId));
      }
      
      if (filters.startDate) {
        conditions.push(sql`${rentals.startTime} >= ${filters.startDate}`);
      }
      
      if (filters.endDate) {
        conditions.push(sql`${rentals.endTime} <= ${filters.endDate}`);
      }
      
      if (filters.status) {
        conditions.push(eq(rentals.status, filters.status));
      }
      
      if (filters.paymentStatus) {
        conditions.push(eq(rentals.paymentStatus, filters.paymentStatus));
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
    }
    
    // Sort by start time descending (newest first)
    query = query.orderBy(desc(rentals.startTime));
    
    const rentalsList = await query;
    
    // Enrich rentals with venue names
    const enrichedRentals = await Promise.all(
      rentalsList.map(rental => this.enrichRental(rental))
    );
    
    this.cache.set(cacheKey, enrichedRentals);
    
    return enrichedRentals;
  }
  
  /**
   * Create a new rental
   */
  async createRental(rental: any): Promise<Rental> {
    const [newRental] = await db.insert(rentals).values(rental).returning();
    
    this.invalidateTypeCache('rentals');
    
    const enrichedRental = await this.enrichRental(newRental);
    return enrichedRental;
  }
  
  /**
   * Update rental status
   */
  async updateRentalStatus(id: number, status: RentalStatus): Promise<Rental> {
    const [updatedRental] = await db
      .update(rentals)
      .set({ status, updatedAt: new Date() })
      .where(eq(rentals.id, id))
      .returning();
    
    this.invalidateCache('rental', id);
    this.invalidateTypeCache('rentals');
    
    const enrichedRental = await this.enrichRental(updatedRental);
    return enrichedRental;
  }
  
  /**
   * Update payment status
   */
  async updatePaymentStatus(id: number, paymentStatus: PaymentStatus): Promise<Rental> {
    const [updatedRental] = await db
      .update(rentals)
      .set({ paymentStatus, updatedAt: new Date() })
      .where(eq(rentals.id, id))
      .returning();
    
    this.invalidateCache('rental', id);
    this.invalidateTypeCache('rentals');
    
    const enrichedRental = await this.enrichRental(updatedRental);
    return enrichedRental;
  }
  
  /**
   * Generate a sales report for venues, optionally filtered by venue, date range
   */
  async getVenueSalesReport(
    venueIds?: number[], 
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
    venueBreakdown: Array<{
      venueId: number;
      venueName: string;
      revenue: number;
      bookings: number;
    }>;
    timeBreakdown: Array<{
      period: string;
      revenue: number;
      bookings: number;
    }>;
  }> {
    try {
      let query = db.select().from(rentals);
      const conditions: SQL[] = [];
      
      // Filter by venueIds if provided
      if (venueIds && venueIds.length > 0) {
        conditions.push(inArray(rentals.venueId, venueIds));
      }
      
      // Filter by date range if provided
      if (startDate) {
        conditions.push(sql`${rentals.startTime} >= ${startDate}`);
      }
      
      if (endDate) {
        conditions.push(sql`${rentals.endTime} <= ${endDate}`);
      }
      
      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }
      
      const allRentals = await query;
      
      // Calculate summary metrics
      let totalRevenue = 0;
      let completedBookings = 0;
      let canceledBookings = 0;
      let pendingPayments = 0;
      let paidBookings = 0;
      let refundedBookings = 0;
      
      // Create venue and time breakdowns
      const venueMap = new Map<number, { revenue: number; bookings: number }>();
      const timeMap = new Map<string, { revenue: number; bookings: number }>();
      
      for (const rental of allRentals) {
        const rentalPrice = parseFloat(rental.totalPrice.toString());
        
        // Update total metrics
        totalRevenue += rentalPrice;
        
        // Update status metrics
        if (rental.status === 'completed') completedBookings++;
        if (rental.status === 'canceled') canceledBookings++;
        
        // Update payment status metrics
        if (rental.paymentStatus === 'unpaid') pendingPayments++;
        if (rental.paymentStatus === 'paid') paidBookings++;
        if (rental.paymentStatus === 'refunded') refundedBookings++;
        
        // Update venue breakdown
        if (!venueMap.has(rental.venueId)) {
          venueMap.set(rental.venueId, { revenue: 0, bookings: 0 });
        }
        const venueData = venueMap.get(rental.venueId)!;
        venueData.revenue += rentalPrice;
        venueData.bookings++;
        
        // Update time breakdown (by month)
        const startTime = new Date(rental.startTime);
        const period = `${startTime.getFullYear()}-${String(startTime.getMonth() + 1).padStart(2, '0')}`;
        
        if (!timeMap.has(period)) {
          timeMap.set(period, { revenue: 0, bookings: 0 });
        }
        const timeData = timeMap.get(period)!;
        timeData.revenue += rentalPrice;
        timeData.bookings++;
      }
      
      const averageBookingValue = paidBookings > 0 ? totalRevenue / paidBookings : 0;
      
      // Prepare venue breakdown for output
      const venueBreakdown = await Promise.all(
        Array.from(venueMap.entries()).map(async ([venueId, data]) => ({
          venueId,
          venueName: await this.getVenueName(venueId),
          revenue: data.revenue,
          bookings: data.bookings
        }))
      );
      
      // Prepare time breakdown for output
      const timeBreakdown = Array.from(timeMap.entries())
        .map(([period, data]) => ({
          period,
          revenue: data.revenue,
          bookings: data.bookings
        }))
        .sort((a, b) => a.period.localeCompare(b.period));
      
      return {
        totalRevenue,
        completedBookings,
        canceledBookings,
        pendingPayments,
        paidBookings,
        refundedBookings,
        averageBookingValue,
        venueBreakdown,
        timeBreakdown
      };
    } catch (error) {
      console.error('Error generating venue sales report:', error);
      throw new Error('Failed to generate venue sales report');
    }
  }
  
  /**
   * Get cashiers by owner ID
   */
  async getCashiers(ownerId: number): Promise<Cashier[]> {
    const cacheKey = this.getCacheKey('cashiers', ownerId);
    const cachedCashiers = this.cache.get<Cashier[]>(cacheKey);
    
    if (cachedCashiers) {
      return cachedCashiers;
    }
    
    const cashiersList = await db
      .select()
      .from(cashiers)
      .where(eq(cashiers.ownerId, ownerId));
    
    this.cache.set(cacheKey, cashiersList);
    
    return cashiersList;
  }
  
  /**
   * Get cashiers by user ID
   */
  async getCashiersByUserId(userId: number): Promise<Cashier[]> {
    const cacheKey = this.getCacheKey('cashiers_user', userId);
    const cachedCashiers = this.cache.get<Cashier[]>(cacheKey);
    
    if (cachedCashiers) {
      return cachedCashiers;
    }
    
    const cashiersList = await db
      .select()
      .from(cashiers)
      .where(eq(cashiers.userId, userId));
    
    this.cache.set(cacheKey, cashiersList);
    
    return cashiersList;
  }
  
  /**
   * Create a new cashier
   */
  async createCashier(
    userData: { username: string; email: string; name: string; }, 
    ownerId: number,
    permissions: Record<string, boolean> = DEFAULT_CASHIER_PERMISSIONS,
    venueIds: number[] = []
  ): Promise<any> {
    // Generate a temporary password
    const tempPassword = randomBytes(4).toString('hex');
    const hashedPassword = await hashPassword(tempPassword);
    
    // Create user first
    const [user] = await db.insert(users).values({
      username: userData.username,
      email: userData.email,
      name: userData.name,
      password: hashedPassword,
      role: 'cashier',
    }).returning();
    
    // Create cashier record
    const [cashier] = await db.insert(cashiers).values({
      userId: user.id,
      ownerId,
      permissions,
    }).returning();
    
    // Add venue assignments if any
    if (venueIds.length > 0) {
      await Promise.all(
        venueIds.map(venueId => 
          db.insert(cashierVenues).values({
            cashierId: cashier.id,
            venueId,
          })
        )
      );
    }
    
    this.invalidateTypeCache('cashiers');
    
    return { cashier, user, tempPassword };
  }
  
  /**
   * Update cashier permissions
   */
  async updateCashierPermissions(id: number, permissions: Record<string, boolean>): Promise<Cashier> {
    const [updatedCashier] = await db
      .update(cashiers)
      .set({ 
        permissions,
        updatedAt: new Date()
      })
      .where(eq(cashiers.id, id))
      .returning();
    
    this.invalidateCache('cashier', id);
    this.invalidateTypeCache('cashiers');
    
    return updatedCashier;
  }
  
  /**
   * Update cashier venue assignments
   */
  async updateCashierVenues(id: number, venueIds: number[]): Promise<Cashier> {
    // First, remove all existing venue assignments
    await db.delete(cashierVenues).where(eq(cashierVenues.cashierId, id));
    
    // Then add new assignments
    if (venueIds.length > 0) {
      await Promise.all(
        venueIds.map(venueId => 
          db.insert(cashierVenues).values({
            cashierId: id,
            venueId,
          })
        )
      );
    }
    
    const [cashier] = await db.select().from(cashiers).where(eq(cashiers.id, id));
    
    this.invalidateCache('cashier', id);
    this.invalidateTypeCache('cashiers');
    
    return cashier;
  }
  
  /**
   * Delete a cashier
   */
  async deleteCashier(id: number): Promise<boolean> {
    // Get the cashier to find the user ID
    const [cashier] = await db.select().from(cashiers).where(eq(cashiers.id, id));
    
    if (!cashier) {
      return false;
    }
    
    // Delete cashier venue assignments
    await db.delete(cashierVenues).where(eq(cashierVenues.cashierId, id));
    
    // Delete cashier record
    await db.delete(cashiers).where(eq(cashiers.id, id));
    
    // Delete user record
    await db.delete(users).where(eq(users.id, cashier.userId));
    
    this.invalidateCache('cashier', id);
    this.invalidateTypeCache('cashiers');
    
    return true;
  }
  
  /**
   * Helper method to enrich a rental with venue name
   */
  private async enrichRental(rental: Rental): Promise<Rental> {
    try {
      const venue = await this.getVenue(rental.venueId);
      return {
        ...rental,
        venueName: venue ? venue.name : `Venue #${rental.venueId}`
      };
    } catch (error) {
      console.error('Error enriching rental:', error);
      return {
        ...rental,
        venueName: `Venue #${rental.venueId}`
      };
    }
  }
  
  /**
   * Helper method to get venue name
   */
  private async getVenueName(venueId: number): Promise<string> {
    try {
      const venue = await this.getVenue(venueId);
      return venue ? venue.name : `Venue #${venueId}`;
    } catch (error) {
      return `Venue #${venueId}`;
    }
  }
}

// Create and export singleton instance
export const venueService = new VenueService();