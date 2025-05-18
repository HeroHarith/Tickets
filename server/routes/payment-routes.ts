/**
 * Payment Routes
 * 
 * This file contains routes for handling payments through the Thawani payment gateway.
 */

import { Router, Request, Response } from 'express';
import { thawaniPaymentService } from '../services/thawani-payment-service';
import { optimizedStorage } from '../optimized-storage';
import { successResponse, errorResponse } from '../utils/api-response';
import { requireLogin } from '../middleware/auth-middleware';
import { db } from '../db';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * Create a payment session for ticket purchase
 * POST /api/payments/create-session
 */
router.post('/create-session', requireLogin, async (req: Request, res: Response) => {
  try {
    const { 
      ticketSelections, 
      eventId,
      addOnSelections = [],
      customAddOns = []
    } = req.body;

    if (!ticketSelections || !Array.isArray(ticketSelections) || !eventId) {
      return res.status(400).json(errorResponse('Invalid request data: ticket selections and event ID are required', 400));
    }

    // Get the event details
    const event = await optimizedStorage.getEvent(eventId);
    if (!event) {
      return res.status(404).json(errorResponse('Event not found', 404));
    }

    // Get all ticket types for this event
    const ticketTypes = await optimizedStorage.getTicketTypes(eventId);
    
    // Get event add-ons if needed
    let eventAddOns: any[] = [];
    if (addOnSelections && addOnSelections.length > 0) {
      // In a production system, this would come from your add-ons service
      // For now, we'll use a simple implementation
      try {
        const addOnsService = await import('../services/add-ons-service');
        eventAddOns = await addOnsService.default.getEventAddOns(eventId);
      } catch (error) {
        console.error("Error loading event add-ons:", error);
        // Continue even if add-ons can't be loaded
      }
    }

    // Create session using the enhanced service
    try {
      const { sessionId, checkoutUrl } = await thawaniPaymentService.createTicketSessionWithAddOns(
        eventId,
        event.title,
        ticketSelections,
        ticketTypes,
        addOnSelections,
        eventAddOns,
        customAddOns,
        req.user!.id
      );

      return res.status(200).json(successResponse({
        sessionId,
        checkoutUrl
      }, 200, 'Payment session created successfully'));
    } catch (error: any) {
      return res.status(500).json(errorResponse(`Payment session creation failed: ${error.message}`, 500));
    }
  } catch (error: any) {
    console.error('Error creating payment session:', error);
    return res.status(500).json(errorResponse(`Failed to create payment session: ${error.message}`, 500));
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
      return res.status(400).json(errorResponse('Session ID is required', 400));
    }

    // Verify the session with Thawani
    const sessionData = await thawaniPaymentService.verifySession(sessionId);
    
    // If the payment was successful, complete the purchase
    if (sessionData.payment_status === 'paid') {
      // Extract metadata
      const metadata = sessionData.metadata || {};
      const userId = metadata.userId ? parseInt(metadata.userId) : undefined;
      const eventId = metadata.eventId ? parseInt(metadata.eventId) : undefined;
      const ticketSelections = metadata.ticketSelections ? JSON.parse(metadata.ticketSelections) : [];
      const addOnSelections = metadata.addOnSelections ? JSON.parse(metadata.addOnSelections) : [];

      if (!userId || !eventId || !ticketSelections.length) {
        return res.status(400).json(errorResponse('Invalid session metadata', 400));
      }

      // Create the tickets in the database using the optimized storage
      await optimizedStorage.purchaseTickets({
        userId,
        eventId,
        ticketSelections,
        addOnSelections,
        paymentSessionId: sessionId,
        paymentStatus: 'paid'
      });

      return res.status(200).json(successResponse({
        paymentStatus: sessionData.payment_status,
        clientReferenceId: sessionData.client_reference_id,
        total: sessionData.total_amount / 1000 // Convert from baisa to OMR
      }, 200, 'Payment successful and tickets created'));
    } else {
      return res.status(200).json(successResponse({
        paymentStatus: sessionData.payment_status,
        clientReferenceId: sessionData.client_reference_id
      }, 200, 'Payment not completed'));
    }
  } catch (error: any) {
    console.error('Error verifying payment session:', error);
    return res.status(500).json(errorResponse(`Failed to verify payment: ${error.message}`, 500));
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
      return res.status(400).json(errorResponse('Session ID is required', 400));
    }

    // Verify the session with Thawani
    const sessionData = await thawaniPaymentService.verifySession(sessionId);
    
    return res.status(200).json(successResponse({
      paymentStatus: sessionData.payment_status,
      clientReferenceId: sessionData.client_reference_id,
      total: sessionData.total_amount / 1000, // Convert from baisa to OMR
      products: sessionData.products
    }, 200, 'Payment status retrieved'));
  } catch (error: any) {
    console.error('Error getting payment status:', error);
    return res.status(500).json(errorResponse(`Failed to get payment status: ${error.message}`, 500));
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
    
    if (event === 'payment_completed' || event === 'payment_success') {
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

/**
 * Success and cancel routes for payment redirection
 */
router.get('/success', (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  return res.status(200).json(successResponse({ 
    message: 'Payment successful',
    sessionId 
  }, 200, 'Payment completed successfully'));
});

router.get('/cancel', (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  return res.status(200).json(successResponse({ 
    message: 'Payment canceled',
    sessionId 
  }, 200, 'Payment was canceled'));
});

export default router;