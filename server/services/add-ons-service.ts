/**
 * Add-ons Service
 * 
 * This service handles the management of event add-ons.
 */

import { db } from '../db';
import { eventAddOns, eventToAddOns } from '@shared/schema';
import { purchasedAddOns } from '@shared/add-ons.schema';
import { eq, and } from 'drizzle-orm';

class AddOnsService {
  /**
   * Get all add-ons for an event
   */
  async getEventAddOns(eventId: number) {
    try {
      // First get all add-on IDs related to this event from the join table
      const relations = await db.select()
        .from(eventToAddOns)
        .where(eq(eventToAddOns.eventId, eventId));
      
      if (!relations.length) {
        return [];
      }
      
      // Then get the actual add-ons by their IDs using a simpler approach
      const addOnIds = relations.map(rel => rel.addOnId);
      
      // Use simple filter to avoid SQL template issues
      let addOns = [];
      for (const addOnId of addOnIds) {
        const [addOn] = await db.select()
          .from(eventAddOns)
          .where(eq(eventAddOns.id, addOnId));
        
        if (addOn) {
          addOns.push(addOn);
        }
      }
      
      // Enrich add-ons with relation data (like if it's required)
      return addOns.map(addOn => {
        const relation = relations.find(rel => rel.addOnId === addOn.id);
        return {
          ...addOn,
          isRequired: relation?.isRequired || false,
          maximumQuantity: relation?.maximumQuantity || null
        };
      });
    } catch (error) {
      console.error('Error fetching event add-ons:', error);
      throw error;
    }
  }

  /**
   * Get a specific add-on by ID
   */
  async getAddOn(addOnId: number) {
    try {
      const [addOn] = await db.select()
        .from(eventAddOns)
        .where(eq(eventAddOns.id, addOnId));
      
      return addOn;
    } catch (error) {
      console.error(`Error fetching add-on with ID ${addOnId}:`, error);
      throw error;
    }
  }

  /**
   * Create an add-on for an event
   */
  async createAddOn(eventId: number, addOnData: any) {
    try {
      // First create the add-on
      const [addOn] = await db.insert(eventAddOns)
        .values({
          name: addOnData.name,
          description: addOnData.description,
          price: addOnData.price,
          category: addOnData.category || "general",
          imageUrl: addOnData.imageUrl || null,
          isActive: true
        })
        .returning();
      
      // Then create the relationship to the event
      await db.insert(eventToAddOns)
        .values({
          eventId,
          addOnId: addOn.id,
          isRequired: !!addOnData.isRequired,
          maximumQuantity: addOnData.maximumQuantity || 1
        });
      
      return {
        ...addOn,
        isRequired: !!addOnData.isRequired,
        maximumQuantity: addOnData.maximumQuantity || 1
      };
    } catch (error) {
      console.error('Error creating add-on:', error);
      throw error;
    }
  }

  /**
   * Update an add-on
   */
  async updateAddOn(addOnId: number, updateData: any) {
    try {
      const [updatedAddOn] = await db.update(eventAddOns)
        .set(updateData)
        .where(eq(eventAddOns.id, addOnId))
        .returning();
      
      return updatedAddOn;
    } catch (error) {
      console.error(`Error updating add-on with ID ${addOnId}:`, error);
      throw error;
    }
  }

  /**
   * Delete an add-on
   */
  async deleteAddOn(addOnId: number) {
    try {
      await db.delete(eventAddOns)
        .where(eq(eventAddOns.id, addOnId));
      
      return true;
    } catch (error) {
      console.error(`Error deleting add-on with ID ${addOnId}:`, error);
      throw error;
    }
  }

  /**
   * Record purchased add-ons for a ticket
   */
  async recordPurchasedAddOns(ticketId: number, addOnSelections: any[]) {
    try {
      const records = addOnSelections.map(selection => ({
        ticketId,
        addOnId: selection.addOnId,
        quantity: selection.quantity,
        unitPrice: selection.unitPrice,
        totalPrice: selection.totalPrice,
        note: selection.note || null
      }));
      
      if (records.length === 0) return [];
      
      const purchasedItems = await db.insert(purchasedAddOns)
        .values(records)
        .returning();
      
      return purchasedItems;
    } catch (error) {
      console.error(`Error recording purchased add-ons for ticket ${ticketId}:`, error);
      throw error;
    }
  }

  /**
   * Get purchased add-ons for a ticket
   */
  async getTicketAddOns(ticketId: number) {
    try {
      const addOns = await db.select()
        .from(purchasedAddOns)
        .where(eq(purchasedAddOns.ticketId, ticketId));
      
      return addOns;
    } catch (error) {
      console.error(`Error fetching add-ons for ticket ${ticketId}:`, error);
      throw error;
    }
  }
}

export default new AddOnsService();