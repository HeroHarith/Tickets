/**
 * Payment Routes
 * 
 * This file contains routes for handling payments through the Thawani payment gateway.
 */

import { Router, Request, Response } from 'express';
import { thawaniPaymentService } from '../services/thawani-payment-service';
import { optimizedStorage } from '../optimized-storage';
import { successResponse, errorResponse } from '../utils/response';
import { isAuthenticated } from '../middleware/auth-middleware';

const router = Router();

/**
 * Create a payment session for ticket purchase
 * POST /api/payments/create-session
 */
router.post('/create-session', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const { 
      ticketSelections, 
      totalAmount, 
      eventId,
      addOnSelections = []
    } = req.body;

    if (!ticketSelections || !Array.isArray(ticketSelections) || !eventId) {
      return errorResponse(res, 400, 'Invalid request data');
    }

    // Create a unique client reference ID
    const clientReferenceId = `order_${Date.now()}_${req.user!.id}`;
    
    // Get the event details
    const event = await optimizedStorage.getEvent(eventId);
    if (!event) {
      return errorResponse(res, 404, 'Event not found');
    }

    // Prepare products array for Thawani
    const products = [];

    // Add tickets to products
    for (const selection of ticketSelections) {
      const ticketType = await optimizedStorage.getTicketType(selection.ticketTypeId);
      if (!ticketType) {
        return errorResponse(res, 404, `Ticket type not found: ${selection.ticketTypeId}`);
      }

      products.push({
        name: `${event.title} - ${ticketType.name}${selection.eventDate ? ` (${new Date(selection.eventDate).toLocaleDateString()})` : ''}`,
        quantity: selection.quantity,
        unit_amount: thawaniPaymentService.formatAmount(ticketType.price)
      });
    }

    // Add add-ons to products if any
    if (addOnSelections && addOnSelections.length > 0) {
      for (const addOn of addOnSelections) {
        // For custom add-ons created during event creation
        if (addOn.isCustom) {
          products.push({
            name: `${addOn.name} (Add-on)`,
            quantity: addOn.quantity,
            unit_amount: thawaniPaymentService.formatAmount(addOn.price)
          });
        } else {
          // For existing add-ons from the database
          const addOnDetails = await optimizedStorage.getAddOn(addOn.addOnId);
          if (!addOnDetails) {
            return errorResponse(res, 404, `Add-on not found: ${addOn.addOnId}`);
          }
          
          products.push({
            name: `${addOnDetails.name} (Add-on)`,
            quantity: addOn.quantity,
            unit_amount: thawaniPaymentService.formatAmount(addOnDetails.price)
          });
        }
      }
    }

    // Determine the success and cancel URLs
    const hostUrl = req.get('host') || '';
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${hostUrl}`;
    
    const successUrl = `${baseUrl}/payment-success?session_id={session_id}`;
    const cancelUrl = `${baseUrl}/payment-cancelled?session_id={session_id}`;

    // Create a session with Thawani
    const sessionId = await thawaniPaymentService.createSession({
      clientReferenceId,
      products,
      successUrl,
      cancelUrl,
      metadata: {
        userId: req.user!.id,
        eventId,
        ticketSelections: JSON.stringify(ticketSelections),
        addOnSelections: JSON.stringify(addOnSelections)
      }
    });

    // Generate checkout URL
    const checkoutUrl = thawaniPaymentService.getCheckoutUrl(sessionId);

    return successResponse(res, {
      sessionId,
      checkoutUrl,
      clientReferenceId
    }, 'Payment session created successfully');
  } catch (error: any) {
    console.error('Error creating payment session:', error);
    return errorResponse(res, 500, `Failed to create payment session: ${error.message}`);
  }
});

/**
 * Verify a payment session and complete the purchase
 * GET /api/payments/verify/:sessionId
 */
router.get('/verify/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return errorResponse(res, 400, 'Session ID is required');
    }

    // Verify the session with Thawani
    const sessionData = await thawaniPaymentService.verifySession(sessionId);
    
    // If the payment was successful, complete the purchase
    if (sessionData.payment_status === 'paid') {
      // Extract metadata to get the user and ticket details
      const metadata = sessionData.metadata || {};
      const userId = metadata.userId ? parseInt(metadata.userId) : undefined;
      const eventId = metadata.eventId ? parseInt(metadata.eventId) : undefined;
      const ticketSelections = metadata.ticketSelections ? JSON.parse(metadata.ticketSelections) : [];
      const addOnSelections = metadata.addOnSelections ? JSON.parse(metadata.addOnSelections) : [];

      if (!userId || !eventId || !ticketSelections.length) {
        return errorResponse(res, 400, 'Invalid session metadata');
      }

      // Create the tickets in the database
      await optimizedStorage.purchaseTickets({
        userId,
        eventId,
        ticketSelections,
        addOnSelections,
        paymentSessionId: sessionId,
        paymentStatus: 'paid'
      });

      return successResponse(res, {
        paymentStatus: sessionData.payment_status,
        clientReferenceId: sessionData.client_reference_id,
        total: sessionData.total_amount / 1000 // Convert from baisa to OMR
      }, 'Payment successful and tickets created');
    } else {
      return successResponse(res, {
        paymentStatus: sessionData.payment_status,
        clientReferenceId: sessionData.client_reference_id
      }, 'Payment not completed');
    }
  } catch (error: any) {
    console.error('Error verifying payment session:', error);
    return errorResponse(res, 500, `Failed to verify payment: ${error.message}`);
  }
});

/**
 * Get payment status
 * GET /api/payments/status/:sessionId
 */
router.get('/status/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return errorResponse(res, 400, 'Session ID is required');
    }

    // Verify the session with Thawani
    const sessionData = await thawaniPaymentService.verifySession(sessionId);
    
    return successResponse(res, {
      paymentStatus: sessionData.payment_status,
      clientReferenceId: sessionData.client_reference_id,
      total: sessionData.total_amount / 1000,
      products: sessionData.products
    }, 'Payment status retrieved');
  } catch (error: any) {
    console.error('Error getting payment status:', error);
    return errorResponse(res, 500, `Failed to get payment status: ${error.message}`);
  }
});

/**
 * Webhook for Thawani payment notifications
 * POST /api/payments/webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Validate the webhook signature (if Thawani provides this)
    // This would require additional security measures
    
    const { event, data } = req.body;
    
    if (event === 'payment_success') {
      const sessionId = data.session_id;
      
      // Update ticket payment status
      await thawaniPaymentService.updateTicketsPaymentStatus(sessionId);
      
      return res.status(200).send('Webhook received successfully');
    }
    
    return res.status(200).send('Webhook event ignored');
  } catch (error: any) {
    console.error('Error handling webhook:', error);
    return res.status(500).send(`Webhook error: ${error.message}`);
  }
});

export default router;