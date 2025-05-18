/**
 * Thawani Payment Service
 * 
 * This service handles all interactions with the Thawani payment gateway
 * based on the Thawani Pay Integration Guide.
 */

import fetch from 'node-fetch';
import { db } from '../db';
import { tickets, AddOnSelection } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Environment variables for Thawani API keys
const THAWANI_API_KEY = process.env.THAWANI_API_KEY;
const THAWANI_PUBLIC_KEY = process.env.THAWANI_PUBLIC_KEY;

// Thawani API URLs - Using test endpoints from the integration guide
const THAWANI_API_URL = 'https://uatcheckout.thawani.om/api/v1';
const THAWANI_CHECKOUT_URL = 'https://uatcheckout.thawani.om/pay';

// Check if Thawani API keys are available
if (!THAWANI_API_KEY || !THAWANI_PUBLIC_KEY) {
  console.warn('Thawani API keys are not set in environment variables');
}

interface ThawaniProduct {
  name: string;
  quantity: number;
  unit_amount: number;
}

interface CreateSessionParams {
  clientReferenceId: string;
  products: ThawaniProduct[];
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, any>;
}

interface SessionResponse {
  success: boolean;
  code: number;
  message: string;
  data: {
    session_id: string;
  };
}

interface SessionVerificationResponse {
  success: boolean;
  code: number;
  message: string;
  data: {
    id: string;
    client_reference_id: string;
    payment_status: 'paid' | 'unpaid' | 'cancelled';
    customer_id: string | null;
    products: ThawaniProduct[];
    created_at: string;
    total_amount: number;
    metadata?: Record<string, any>;
  };
}

export interface TicketSelection {
  ticketTypeId: number;
  quantity: number;
  attendeeDetails?: Record<string, string>[];
  eventDate?: string;
  isGift?: boolean;
  giftRecipients?: Array<{ name: string; email: string; message?: string }>;
}

export interface CustomAddOn {
  id: string; // Temporary ID for custom add-ons
  name: string;
  description: string;
  price: string;
  isCustom: true;
}

class ThawaniPaymentService {
  /**
   * Create a checkout session with Thawani
   */
  async createSession({
    clientReferenceId,
    products,
    successUrl,
    cancelUrl,
    metadata
  }: CreateSessionParams): Promise<string> {
    try {
      // Using the Thawani API format as specified in the integration guide
      const response = await fetch(`${THAWANI_API_URL}/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'thawani-api-key': THAWANI_API_KEY!
        },
        body: JSON.stringify({
          client_reference_id: clientReferenceId,
          mode: 'payment',
          products,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create Thawani session: ${errorText}`);
      }

      const result = await response.json() as SessionResponse;
      if (!result.success) {
        throw new Error(`Thawani error: ${result.message}`);
      }

      return result.data.session_id;
    } catch (error) {
      console.error('Error creating Thawani session:', error);
      throw error;
    }
  }

  /**
   * Get checkout URL for a session
   */
  getCheckoutUrl(sessionId: string): string {
    return `${THAWANI_CHECKOUT_URL}/${sessionId}?key=${THAWANI_PUBLIC_KEY}`;
  }

  /**
   * Verify a session status after payment
   */
  async verifySession(sessionId: string): Promise<SessionVerificationResponse['data']> {
    try {
      const response = await fetch(`${THAWANI_API_URL}/checkout/session/${sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'thawani-api-key': THAWANI_API_KEY!
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to verify Thawani session: ${errorText}`);
      }

      const result = await response.json() as SessionVerificationResponse;
      if (!result.success) {
        throw new Error(`Thawani verification error: ${result.message}`);
      }

      return result.data;
    } catch (error) {
      console.error('Error verifying Thawani session:', error);
      throw error;
    }
  }

  /**
   * Format amount for Thawani (converts to baisa - smallest currency unit)
   * 1 OMR = 1000 baisa
   */
  formatAmount(amount: string | number): number {
    const numericAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    
    // Convert from OMR to baisa (1 OMR = 1000 baisa)
    const baisaAmount = Math.round(numericAmount * 1000);
    
    // Thawani seems to require at least 100 baisa (0.1 OMR) for paid items
    // For free items, use 1 baisa as a minimum
    return numericAmount > 0 ? Math.max(100, baisaAmount) : 1;
  }

  /**
   * Update tickets payment status based on Thawani session verification
   */
  async updateTicketsPaymentStatus(sessionId: string): Promise<void> {
    try {
      const sessionData = await this.verifySession(sessionId);
      
      if (sessionData.payment_status === 'paid') {
        // Update all tickets associated with this payment session
        // Using the pool directly for raw SQL queries
        await db.$client.query(`
          UPDATE tickets 
          SET payment_status = 'paid' 
          WHERE payment_session_id = $1
        `, [sessionId]);
      }
    } catch (error) {
      console.error('Error updating tickets payment status:', error);
      throw error;
    }
  }

  /**
   * Prepare add-ons for Thawani checkout
   * This formats both custom and existing add-ons into the required Thawani product format
   */
  prepareAddOns(addOnSelections: any[], eventAddOns: any[] = [], customAddOns: CustomAddOn[] = []): ThawaniProduct[] {
    if (!addOnSelections || addOnSelections.length === 0) {
      return [];
    }
    
    return addOnSelections.map(selection => {
      const addOnId = selection.addOnId;
      let name, price;
      
      // Handle custom add-ons created during event creation
      if (typeof addOnId === 'string' && addOnId.toString().startsWith('temp_')) {
        const customAddOn = customAddOns.find(addon => addon.id === addOnId);
        if (!customAddOn) {
          throw new Error(`Custom add-on with ID ${addOnId} not found`);
        }
        name = `${customAddOn.name} (Custom Add-on)`;
        price = customAddOn.price;
      } else {
        // Handle existing add-ons from the database
        const existingAddOn = eventAddOns.find(addon => addon.id === addOnId);
        if (!existingAddOn) {
          throw new Error(`Add-on with ID ${addOnId} not found`);
        }
        name = existingAddOn.name;
        price = existingAddOn.price;
      }
      
      return {
        name,
        quantity: selection.quantity,
        unit_amount: this.formatAmount(price)
      };
    });
  }

  /**
   * Create a payment session for tickets with add-ons
   */
  async createTicketSessionWithAddOns(
    eventId: number,
    eventTitle: string,
    ticketSelections: TicketSelection[],
    ticketTypes: any[],
    addOnSelections: AddOnSelection[] = [],
    eventAddOns: any[] = [],
    customAddOns: CustomAddOn[] = [],
    userId: number
  ): Promise<{ sessionId: string, checkoutUrl: string }> {
    try {
      // Unique client reference ID
      const clientReferenceId = `order_${Date.now()}_${userId}_${eventId}`;
      
      // Prepare products array for tickets
      const ticketProducts: ThawaniProduct[] = [];
      
      // Add tickets to products array
      for (const selection of ticketSelections) {
        const ticketType = ticketTypes.find(t => t.id === selection.ticketTypeId);
        if (!ticketType) {
          throw new Error(`Ticket type with ID ${selection.ticketTypeId} not found`);
        }
        
        const ticketName = selection.eventDate 
          ? `${eventTitle} - ${ticketType.name} (${new Date(selection.eventDate).toLocaleDateString()})`
          : `${eventTitle} - ${ticketType.name}`;
        
        ticketProducts.push({
          name: ticketName,
          quantity: selection.quantity,
          unit_amount: this.formatAmount(ticketType.price)
        });
      }
      
      // Prepare add-ons products if any
      const addOnProducts = this.prepareAddOns(addOnSelections, eventAddOns, customAddOns);
      
      // Combine all products
      const allProducts = [...ticketProducts, ...addOnProducts];
      
      if (allProducts.length === 0) {
        throw new Error('No valid products provided for payment');
      }
      
      // Determine the success and cancel URLs
      // These would typically be set based on environment or configuration
      const baseUrl = process.env.BASE_URL || 'http://localhost:5000';
      const successUrl = `${baseUrl}/payment-status?session_id={sessionId}&status=success`;
      const cancelUrl = `${baseUrl}/payment-status?session_id={sessionId}&status=failed`;
      
      // Create session with appropriate metadata
      const sessionId = await this.createSession({
        clientReferenceId,
        products: allProducts,
        successUrl,
        cancelUrl,
        metadata: {
          userId,
          eventId,
          ticketSelections: JSON.stringify(ticketSelections),
          addOnSelections: JSON.stringify(addOnSelections),
          customAddOns: JSON.stringify(customAddOns)
        }
      });
      
      return {
        sessionId,
        checkoutUrl: this.getCheckoutUrl(sessionId)
      };
    } catch (error) {
      console.error('Error creating ticket payment session with add-ons:', error);
      throw error;
    }
  }
}

export const thawaniPaymentService = new ThawaniPaymentService();