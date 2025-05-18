import { db } from '../db';
import { eq, and, inArray } from 'drizzle-orm';
import NodeCache from 'node-cache';
import {
  eventAddOns,
  eventToAddOns,
  type EventAddOn,
  type InsertEventAddOn,
  type EventToAddOn,
  type InsertEventToAddOn
} from '@shared/schema';

/**
 * Service for managing event add-ons
 */
export class AddOnsService {
  private cache: NodeCache;
  
  constructor() {
    this.cache = new NodeCache({ stdTTL: 60, checkperiod: 120 });
  }
  
  /**
   * Get cache key for an item
   */
  private getCacheKey(type: string, id: number | string): string {
    return `${type}_${id}`;
  }
  
  /**
   * Create a new add-on
   */
  async createAddOn(addOnData: InsertEventAddOn): Promise<EventAddOn> {
    const [addOn] = await db
      .insert(eventAddOns)
      .values(addOnData)
      .returning();
    
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
    
    const [addOn] = await db
      .select()
      .from(eventAddOns)
      .where(eq(eventAddOns.id, id));
    
    if (addOn) {
      this.cache.set(cacheKey, addOn);
    }
    
    return addOn;
  }
  
  /**
   * Get all add-ons
   */
  async getAllAddOns(activeOnly: boolean = false): Promise<EventAddOn[]> {
    const cacheKey = `addOns_${activeOnly ? 'active' : 'all'}`;
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
    const [addOn] = await db
      .update(eventAddOns)
      .set(addOnData)
      .where(eq(eventAddOns.id, id))
      .returning();
    
    if (!addOn) {
      throw new Error(`Add-on with ID ${id} not found`);
    }
    
    // Invalidate cache
    this.cache.del(this.getCacheKey('addOn', id));
    this.cache.del('addOns_all');
    this.cache.del('addOns_active');
    
    return addOn;
  }
  
  /**
   * Delete an add-on
   */
  async deleteAddOn(id: number): Promise<boolean> {
    const [addOn] = await db
      .delete(eventAddOns)
      .where(eq(eventAddOns.id, id))
      .returning();
    
    if (!addOn) {
      throw new Error(`Add-on with ID ${id} not found`);
    }
    
    // Invalidate cache
    this.cache.del(this.getCacheKey('addOn', id));
    this.cache.del('addOns_all');
    this.cache.del('addOns_active');
    
    return true;
  }
  
  /**
   * Associate add-ons with an event
   */
  async addAddOnsToEvent(eventId: number, addOnRelations: Omit<InsertEventToAddOn, 'eventId'>[]): Promise<EventToAddOn[]> {
    const relations = await db
      .insert(eventToAddOns)
      .values(addOnRelations.map(relation => ({
        ...relation,
        eventId
      })))
      .returning();
    
    // Invalidate cache
    this.cache.del(this.getCacheKey('eventAddOns', eventId));
    
    return relations;
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
    
    // Get add-ons associated with the event
    const result = await db
      .select({
        addOn: eventAddOns,
        relation: eventToAddOns
      })
      .from(eventAddOns)
      .innerJoin(
        eventToAddOns,
        and(
          eq(eventToAddOns.addOnId, eventAddOns.id),
          eq(eventToAddOns.eventId, eventId)
        )
      )
      .where(eq(eventAddOns.isActive, true));
    
    // Merge add-on and relation data
    const addOns = result.map(item => ({
      ...item.addOn,
      relationId: item.relation.id,
      isRequired: item.relation.isRequired,
      maximumQuantity: item.relation.maximumQuantity
    }));
    
    this.cache.set(cacheKey, addOns);
    
    return addOns;
  }
  
  /**
   * Remove an add-on from an event
   */
  async removeAddOnFromEvent(eventId: number, addOnId: number): Promise<boolean> {
    const [relation] = await db
      .delete(eventToAddOns)
      .where(
        and(
          eq(eventToAddOns.eventId, eventId),
          eq(eventToAddOns.addOnId, addOnId)
        )
      )
      .returning();
    
    if (!relation) {
      return false; // Relation not found
    }
    
    // Invalidate cache
    this.cache.del(this.getCacheKey('eventAddOns', eventId));
    
    return true;
  }
  
  /**
   * Update an event-to-add-on relation
   */
  async updateEventAddOnRelation(relationId: number, data: Partial<Omit<InsertEventToAddOn, 'eventId' | 'addOnId'>>): Promise<EventToAddOn> {
    const [relation] = await db
      .update(eventToAddOns)
      .set(data)
      .where(eq(eventToAddOns.id, relationId))
      .returning();
    
    if (!relation) {
      throw new Error(`Relation with ID ${relationId} not found`);
    }
    
    // Invalidate cache
    this.cache.del(this.getCacheKey('eventAddOns', relation.eventId));
    
    return relation;
  }
}

export const addOnsService = new AddOnsService();