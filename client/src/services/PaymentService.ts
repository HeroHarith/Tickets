import { apiRequest } from '@/lib/queryClient';

export interface CustomerDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
}

export interface PaymentSession {
  session_id: string;
  checkout_url: string;
}

/**
 * Service to handle payments through the Thawani payment gateway
 */
export const PaymentService = {
  /**
   * Create a payment session for ticket purchase
   * 
   * @param eventId - The ID of the event
   * @param quantities - Object mapping ticket type IDs to quantities
   * @param customer - Customer details
   * @returns Payment session data or null if there was an error
   */
  async createTicketPayment(
    eventId: number,
    quantities: Record<number, number>,
    customer: CustomerDetails
  ): Promise<PaymentSession | null> {
    try {
      const res = await apiRequest('POST', '/api/payments/tickets', {
        eventId,
        quantities,
        customer
      });
      
      const data = await res.json();
      
      if (!data.success) {
        console.error('Error creating ticket payment:', data.description);
        return null;
      }
      
      return data.data;
    } catch (error) {
      console.error('Failed to create ticket payment:', error);
      return null;
    }
  },
  
  /**
   * Create a payment session for venue rental
   * 
   * @param venueId - The ID of the venue
   * @param startTime - The start time of the booking
   * @param endTime - The end time of the booking
   * @param customer - Customer details
   * @returns Payment session data or null if there was an error
   */
  async createRentalPayment(
    venueId: number,
    startTime: Date,
    endTime: Date,
    customer: CustomerDetails
  ): Promise<PaymentSession | null> {
    try {
      const res = await apiRequest('POST', '/api/payments/rentals', {
        venueId,
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        customer
      });
      
      const data = await res.json();
      
      if (!data.success) {
        console.error('Error creating rental payment:', data.description);
        return null;
      }
      
      return data.data;
    } catch (error) {
      console.error('Failed to create rental payment:', error);
      return null;
    }
  },
  
  /**
   * Check the status of a payment session
   * 
   * @param sessionId - The Thawani session ID
   * @returns Payment status ('paid', 'unpaid', or 'error')
   */
  async checkPaymentStatus(sessionId: string): Promise<'paid' | 'unpaid' | 'error'> {
    try {
      const res = await apiRequest('GET', `/api/payments/status/${sessionId}`);
      const data = await res.json();
      
      if (!data.success) {
        console.error('Error checking payment status:', data.description);
        return 'error';
      }
      
      return data.data.status;
    } catch (error) {
      console.error('Failed to check payment status:', error);
      return 'error';
    }
  },
  
  /**
   * Open the Thawani checkout page in a new window
   * 
   * @param checkoutUrl - The Thawani checkout URL
   */
  openCheckoutPage(checkoutUrl: string): Window | null {
    return window.open(checkoutUrl, '_blank');
  }
};

export default PaymentService;