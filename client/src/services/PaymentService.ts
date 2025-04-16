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
      // Fetch ticket types to get prices
      const eventsRes = await fetch(`/api/events/${eventId}`);
      if (!eventsRes.ok) {
        throw new Error('Failed to fetch event details');
      }
      const eventData = await eventsRes.json();
      const ticketTypes = eventData.data.ticketTypes || [];
      
      // Format items for the API
      const items = Object.entries(quantities).map(([ticketTypeId, quantity]) => {
        const ticketType = ticketTypes.find((tt: any) => tt.id === parseInt(ticketTypeId));
        if (!ticketType) {
          throw new Error(`Ticket type ${ticketTypeId} not found`);
        }
        
        // Convert price to smallest unit (assuming cents/baisa) and calculate subtotal
        // For free tickets (price = 0), use a minimum price of 1 baisa
        let priceInSmallestUnit = Math.round(parseFloat(ticketType.price) * 100);
        if (priceInSmallestUnit === 0) {
          // Handle free tickets - some payment gateways don't accept zero payments
          // Check if all ticket types selected are free
          const allTicketsAreFree = Object.entries(quantities).every(([id, qty]) => {
            const tt = ticketTypes.find((t: any) => t.id === parseInt(id));
            return tt && parseFloat(tt.price) === 0;
          });
          
          if (allTicketsAreFree) {
            // If all tickets are free, set at least one ticket to have minimal price
            // to satisfy payment gateway requirements
            priceInSmallestUnit = 1; // 1 baisa = 0.001 OMR
          }
        }
        
        return {
          ticketTypeId: parseInt(ticketTypeId),
          quantity,
          subtotal: priceInSmallestUnit * quantity
        };
      });
      
      // Format customer details
      const customerDetails = {
        name: `${customer.firstName} ${customer.lastName}`,
        email: customer.email,
        phone: customer.phone
      };
      
      // Make API request with the correct format
      const res = await apiRequest('POST', '/api/payments/tickets', {
        eventId,
        items,
        customerDetails
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
    rentalId: number,
    customer: CustomerDetails
  ): Promise<PaymentSession | null> {
    try {
      // Format customer details for the API
      const customerDetails = {
        name: `${customer.firstName} ${customer.lastName}`,
        email: customer.email,
        phone: customer.phone
      };
      
      // Make API request with the correct format
      const res = await apiRequest('POST', '/api/payments/rentals', {
        rentalId,
        customerDetails
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