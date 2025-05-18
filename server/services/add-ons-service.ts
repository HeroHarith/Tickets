/**
 * Add-ons Service
 * 
 * This service handles the management of event add-ons.
 */

import { db } from '../db';
import { eventAddOns, purchasedAddOns } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

class AddOnsService {
  /**
   * Get all add-ons for an event
   */
  async getEventAddOns(eventId: number) {
    try {
      const addOns = await db.select()
        .from(eventAddOns)
        .where(eq(eventAddOns.eventId, eventId));
      
      return addOns;
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
      const [addOn] = await db.insert(eventAddOns)
        .values({
          eventId,
          name: addOnData.name,
          description: addOnData.description,
          price: addOnData.price,
          isRequired: !!addOnData.isRequired,
          maximumQuantity: addOnData.maximumQuantity || null
        })
        .returning();
      
      return addOn;
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