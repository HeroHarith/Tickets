/**
 * Service for managing event add-ons
 */
import { db } from '../db';
import { 
  eventAddOns, 
  eventToAddOns, 
  events,
  EventAddOn, 
  InsertEventAddOn, 
  EventToAddOn, 
  InsertEventToAddOn 
} from '@shared/schema';
import { eq, and, inArray } from 'drizzle-orm';
import NodeCache from 'node-cache';

export class AddOnsService {
  private cache: NodeCache;

  constructor() {
    // Set up cache with 5-minute TTL by default
    this.cache = new NodeCache({ stdTTL: 300 });
  }

  /**
   * Get cache key for an item
   */
  private getCacheKey(type: string, id: number | string): string {
    return `${type}:${id}`;
  }

  /**
   * Create a new add-on
   */
  async createAddOn(addOnData: InsertEventAddOn): Promise<EventAddOn> {
    const [addOn] = await db.insert(eventAddOns).values(addOnData).returning();
    return addOn;
  }

  /**
   * Get add-on by ID
   */
  async getAddOn(id: number): Promise<EventAddOn | undefined> {
    const cacheKey = this.getCacheKey('addOn', id);
    const cachedAddOn = this.cache.get<EventAddOn>(cacheKey);
    
    if (cachedAddOn) {
      return cachedAddOn;
    }
    
    const [addOn] = await db.select().from(eventAddOns).where(eq(eventAddOns.id, id));
    
    if (addOn) {
      this.cache.set(cacheKey, addOn);
    }
    
    return addOn;
  }

  /**
   * Get all add-ons
   */
  async getAllAddOns(activeOnly: boolean = false): Promise<EventAddOn[]> {
    const cacheKey = this.getCacheKey('allAddOns', activeOnly ? 'active' : 'all');
    const cachedAddOns = this.cache.get<EventAddOn[]>(cacheKey);
    
    if (cachedAddOns) {
      return cachedAddOns;
    }
    
    let query = db.select().from(eventAddOns);
    
    if (activeOnly) {
      query = query.where(eq(eventAddOns.isActive, true));
    }
    
    const addOns = await query;
    this.cache.set(cacheKey, addOns);
    
    return addOns;
  }

  /**
   * Update an add-on
   */
  async updateAddOn(id: number, addOnData: Partial<InsertEventAddOn>): Promise<EventAddOn> {
    const [updatedAddOn] = await db
      .update(eventAddOns)
      .set(addOnData)
      .where(eq(eventAddOns.id, id))
      .returning();
    
    // Invalidate cache
    this.cache.del(this.getCacheKey('addOn', id));
    this.cache.del(this.getCacheKey('allAddOns', 'active'));
    this.cache.del(this.getCacheKey('allAddOns', 'all'));
    
    return updatedAddOn;
  }

  /**
   * Delete an add-on
   */
  async deleteAddOn(id: number): Promise<boolean> {
    const result = await db
      .delete(eventAddOns)
      .where(eq(eventAddOns.id, id))
      .returning({ id: eventAddOns.id });
    
    // Invalidate cache
    this.cache.del(this.getCacheKey('addOn', id));
    this.cache.del(this.getCacheKey('allAddOns', 'active'));
    this.cache.del(this.getCacheKey('allAddOns', 'all'));
    
    return result.length > 0;
  }

  /**
   * Associate add-ons with an event
   */
  async addAddOnsToEvent(eventId: number, addOnRelations: Omit<InsertEventToAddOn, 'eventId'>[]): Promise<EventToAddOn[]> {
    // Verify that the event exists
    const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, eventId));
    
    if (!event) {
      throw new Error(`Event with ID ${eventId} not found`);
    }
    
    // Verify that all add-ons exist
    const addOnIds = addOnRelations.map(relation => relation.addOnId);
    const existingAddOns = await db
      .select({ id: eventAddOns.id })
      .from(eventAddOns)
      .where(inArray(eventAddOns.id, addOnIds));
    
    if (existingAddOns.length !== addOnIds.length) {
      throw new Error('One or more add-ons do not exist');
    }
    
    // Create the relations
    const insertData = addOnRelations.map(relation => ({
      ...relation,
      eventId
    }));
    
    const eventAddOnRelations = await db.insert(eventToAddOns).values(insertData).returning();
    
    // Invalidate cache
    this.cache.del(this.getCacheKey('eventAddOns', eventId));
    
    return eventAddOnRelations;
  }

  /**
   * Get all add-ons for an event
   */
  async getEventAddOns(eventId: number): Promise<EventAddOn[]> {
    const cacheKey = this.getCacheKey('eventAddOns', eventId);
    const cachedAddOns = this.cache.get<EventAddOn[]>(cacheKey);
    
    if (cachedAddOns) {
      return cachedAddOns;
    }
    
    const result = await db
      .select({
        addOn: eventAddOns,
        relation: eventToAddOns
      })
      .from(eventToAddOns)
      .innerJoin(eventAddOns, eq(eventToAddOns.addOnId, eventAddOns.id))
      .where(eq(eventToAddOns.eventId, eventId));
    
    // Map results to add-ons with additional properties from the relation
    const addOns = result.map(item => ({
      ...item.addOn,
      isRequired: item.relation.isRequired,
      maximumQuantity: item.relation.maximumQuantity,
      relationId: item.relation.id
    }));
    
    this.cache.set(cacheKey, addOns);
    
    return addOns;
  }

  /**
   * Remove an add-on from an event
   */
  async removeAddOnFromEvent(eventId: number, addOnId: number): Promise<boolean> {
    const result = await db
      .delete(eventToAddOns)
      .where(
        and(
          eq(eventToAddOns.eventId, eventId),
          eq(eventToAddOns.addOnId, addOnId)
        )
      )
      .returning({ id: eventToAddOns.id });
    
    // Invalidate cache
    this.cache.del(this.getCacheKey('eventAddOns', eventId));
    
    return result.length > 0;
  }

  /**
   * Update an event-to-add-on relation
   */
  async updateEventAddOnRelation(relationId: number, data: Partial<Omit<InsertEventToAddOn, 'eventId' | 'addOnId'>>): Promise<EventToAddOn> {
    const [relation] = await db
      .select()
      .from(eventToAddOns)
      .where(eq(eventToAddOns.id, relationId));
    
    if (!relation) {
      throw new Error(`Relation with ID ${relationId} not found`);
    }
    
    const [updatedRelation] = await db
      .update(eventToAddOns)
      .set(data)
      .where(eq(eventToAddOns.id, relationId))
      .returning();
    
    // Invalidate cache
    this.cache.del(this.getCacheKey('eventAddOns', relation.eventId));
    
    return updatedRelation;
  }
}

export const addOnsService = new AddOnsService();