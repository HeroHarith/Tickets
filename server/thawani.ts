/**
 * Thawani Payment Gateway Integration
 * API Documentation: https://thawani-technologies.stoplight.io/docs/thawani-ecommerce-api
 */

import fetch from 'node-fetch';
import { Event, TicketType } from '@shared/schema';

// Environment check
const isProduction = process.env.NODE_ENV === 'production';

// API base URLs - Test and Production
const BASE_URL = isProduction 
  ? 'https://checkout.thawani.om/api/v1/' 
  : 'https://uatcheckout.thawani.om/api/v1/';

// Client URLs for redirection
export const SUCCESS_URL = isProduction 
  ? 'https://your-site.replit.app/payment-success' 
  : 'http://localhost:5000/payment-success';

export const CANCEL_URL = isProduction 
  ? 'https://your-site.replit.app/payment-cancel' 
  : 'http://localhost:5000/payment-cancel';

// API credentials
const THAWANI_API_KEY = process.env.THAWANI_API_KEY;
const THAWANI_PUBLIC_KEY = process.env.THAWANI_PUBLIC_KEY;

if (!THAWANI_API_KEY || !THAWANI_PUBLIC_KEY) {
  console.error('Missing Thawani API credentials. Please set THAWANI_API_KEY and THAWANI_PUBLIC_KEY environment variables.');
}

/**
 * Get headers required for Thawani API requests
 */
const getHeaders = (): Record<string, string> => ({
  'Content-Type': 'application/json',
  'thawani-api-key': THAWANI_API_KEY || ''
});

/**
 * Customer information for payment session
 */
export interface CustomerDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

/**
 * Product/Ticket Details for payment
 */
export interface ProductDetails {
  name: string;
  quantity: number;
  unitAmount: number; // Amount in baisa (1 OMR = 1000 baisa)
}

/**
 * Create a payment session with Thawani
 */
export const createPaymentSession = async (
  products: ProductDetails[],
  customer: CustomerDetails,
  metadata?: Record<string, any>
): Promise<{ session_id: string; checkout_url: string } | null> => {
  try {
    const totalAmount = products.reduce((sum, product) => {
      return sum + (product.unitAmount * product.quantity);
    }, 0);

    const payload = {
      client_reference_id: `order_${Date.now()}`,
      products: products.map(product => ({
        name: product.name,
        quantity: product.quantity,
        unit_amount: product.unitAmount
      })),
      customer_id: customer.email, // Using email as customer ID
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
      metadata: {
        customer: {
          first_name: customer.firstName,
          last_name: customer.lastName,
          email: customer.email,
          phone: customer.phone
        },
        ...metadata
      }
    };

    const response = await fetch(`${BASE_URL}checkout/session`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Thawani payment session creation failed:', errorData);
      return null;
    }

    const data = await response.json() as any;
    return {
      session_id: data.data.session_id,
      checkout_url: `${isProduction ? 'https://checkout.thawani.om' : 'https://uatcheckout.thawani.om'}/pay/${data.data.session_id}?key=${THAWANI_PUBLIC_KEY}`
    };
  } catch (error) {
    console.error('Error creating Thawani payment session:', error);
    return null;
  }
};

/**
 * Get payment session details
 */
export const getSessionDetails = async (sessionId: string): Promise<any | null> => {
  try {
    const response = await fetch(`${BASE_URL}checkout/session/${sessionId}`, {
      method: 'GET',
      headers: getHeaders()
    });

    if (!response.ok) {
      console.error(`Failed to get session details for session ID: ${sessionId}`);
      return null;
    }

    const data = await response.json() as any;
    return data.data;
  } catch (error) {
    console.error('Error fetching payment session details:', error);
    return null;
  }
};

/**
 * Check payment status by session ID
 */
export const checkPaymentStatus = async (sessionId: string): Promise<'paid' | 'unpaid' | 'error'> => {
  try {
    const sessionDetails = await getSessionDetails(sessionId);
    if (!sessionDetails) {
      return 'error';
    }
    
    return sessionDetails.payment_status === 'paid' ? 'paid' : 'unpaid';
  } catch (error) {
    console.error('Error checking payment status:', error);
    return 'error';
  }
};

/**
 * Create a payment session for ticket purchase
 */
export const createTicketPaymentSession = async (
  event: Event,
  ticketTypes: TicketType[],
  quantities: Record<number, number>,
  customer: CustomerDetails
): Promise<{ session_id: string; checkout_url: string } | null> => {
  // Convert event tickets to Thawani product format
  const products: ProductDetails[] = [];
  
  for (const [ticketTypeId, quantity] of Object.entries(quantities)) {
    if (quantity <= 0) continue;
    
    const ticketType = ticketTypes.find(t => t.id === parseInt(ticketTypeId));
    if (!ticketType) continue;
    
    // Convert price from OMR to baisa (1 OMR = 1000 baisa)
    const unitAmount = Math.round(parseFloat(ticketType.price) * 1000);
    
    products.push({
      name: `${event.title} - ${ticketType.name}`,
      quantity,
      unitAmount
    });
  }
  
  if (products.length === 0) {
    return null;
  }
  
  // Add event metadata for post-payment processing
  const metadata = {
    event_id: event.id,
    ticket_details: Object.entries(quantities).map(([ticketTypeId, quantity]) => ({
      ticket_type_id: parseInt(ticketTypeId),
      quantity
    }))
  };
  
  return createPaymentSession(products, customer, metadata);
};

/**
 * Create a payment session for venue rental
 */
export const createRentalPaymentSession = async (
  venueId: number,
  venueName: string,
  customerName: string,
  amount: number,
  startTime: Date,
  endTime: Date,
  customer: CustomerDetails
): Promise<{ session_id: string; checkout_url: string } | null> => {
  // Convert rental price from OMR to baisa (1 OMR = 1000 baisa)
  const unitAmount = Math.round(amount * 1000);
  
  const startTimeString = startTime.toLocaleString();
  const endTimeString = endTime.toLocaleString();
  
  const products: ProductDetails[] = [
    {
      name: `Booking: ${venueName} (${startTimeString} - ${endTimeString})`,
      quantity: 1,
      unitAmount
    }
  ];
  
  // Add rental metadata for post-payment processing
  const metadata = {
    venue_id: venueId,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    customer_name: customerName
  };
  
  return createPaymentSession(products, customer, metadata);
};

/**
 * Create a payment session for subscription purchase
 */
export const createSubscriptionPaymentSession = async (
  planId: number,
  planName: string,
  planPrice: number,
  billingPeriod: string,
  customer: CustomerDetails
): Promise<{ session_id: string; checkout_url: string } | null> => {
  try {
    // Convert price from OMR to baisa (1 OMR = 1000 baisa)
    const unitAmount = Math.round(planPrice * 1000);
    
    const products: ProductDetails[] = [
      {
        name: `${planName} Subscription (${billingPeriod})`,
        quantity: 1,
        unitAmount
      }
    ];
    
    // Add subscription metadata for post-payment processing
    const metadata = {
      subscription_type: 'new', // new or renewal
      plan_id: planId,
      billing_period: billingPeriod
    };
    
    return createPaymentSession(products, customer, metadata);
  } catch (error) {
    console.error('Error creating subscription payment session:', error);
    return null;
  }
};

/**
 * Create a payment session for subscription renewal
 */
export const createSubscriptionRenewalSession = async (
  subscriptionId: number,
  planId: number,
  planName: string,
  planPrice: number,
  billingPeriod: string,
  customer: CustomerDetails
): Promise<{ session_id: string; checkout_url: string } | null> => {
  try {
    // Convert price from OMR to baisa (1 OMR = 1000 baisa)
    const unitAmount = Math.round(planPrice * 1000);
    
    const products: ProductDetails[] = [
      {
        name: `Renew ${planName} Subscription (${billingPeriod})`,
        quantity: 1,
        unitAmount
      }
    ];
    
    // Add subscription metadata for post-payment processing
    const metadata = {
      subscription_type: 'renewal',
      subscription_id: subscriptionId,
      plan_id: planId,
      billing_period: billingPeriod
    };
    
    return createPaymentSession(products, customer, metadata);
  } catch (error) {
    console.error('Error creating subscription renewal session:', error);
    return null;
  }
};

export default {
  createPaymentSession,
  getSessionDetails,
  checkPaymentStatus,
  createTicketPaymentSession,
  createRentalPaymentSession,
  createSubscriptionPaymentSession,
  createSubscriptionRenewalSession
};