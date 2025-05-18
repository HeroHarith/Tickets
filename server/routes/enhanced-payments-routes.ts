/**
 * Enhanced Payment Routes
 * 
 * This file contains routes for handling payments through the Thawani payment gateway
 * with support for add-ons based on the Thawani Pay Integration Guide.
 */

import { Router, Request, Response } from 'express';
import { optimizedStorage } from '../optimized-storage';
import { successResponse, errorResponse } from '../utils/api-response';
import { requireLogin, requireRole } from '../middleware/auth-middleware';
import fetch from 'node-fetch';

const router = Router();

// Thawani API configurations from environment variables
const THAWANI_API_KEY = process.env.THAWANI_API_KEY;
const THAWANI_PUBLIC_KEY = process.env.THAWANI_PUBLIC_KEY;
const THAWANI_API_URL = 'https://uatcheckout.thawani.om/api/v1';
const THAWANI_CHECKOUT_URL = 'https://uatcheckout.thawani.om/pay';

/**
 * Create a payment session for ticket purchase
 * POST /api/payments/enhanced/create-session
 */
router.post('/create-session', requireRole(["customer", "admin"]), async (req: Request, res: Response) => {
  try {
    const { 
      ticketSelections, 
      eventId,
      addOnSelections = []
    } = req.body;

    if (!ticketSelections || !Array.isArray(ticketSelections) || !eventId) {
      return res.status(400).json(errorResponse('Invalid request data', 400));
    }

    // Get the event details
    const event = await optimizedStorage.getEvent(eventId);
    if (!event) {
      return res.status(404).json(errorResponse('Event not found', 404));
    }

    // Get all ticket types for this event
    const ticketTypes = await optimizedStorage.getTicketTypes(eventId);
    
    // Prepare products array for Thawani
    const products = [];

    // Add tickets to products array
    for (const selection of ticketSelections) {
      const ticketType = ticketTypes.find(t => t.id === selection.ticketTypeId);
      if (!ticketType) {
        return res.status(400).json(errorResponse(`Ticket type ${selection.ticketTypeId} not found`, 400));
      }

      const ticketName = selection.eventDate 
        ? `${event.title} - ${ticketType.name} (${new Date(selection.eventDate).toLocaleDateString()})` 
        : `${event.title} - ${ticketType.name}`;
      
      // Convert price to baisa (smallest currency unit, 1 OMR = 1000 baisa)
      const unitAmount = Math.max(1, Math.round(parseFloat(ticketType.price) * 1000));
      
      products.push({
        name: ticketName,
        quantity: selection.quantity,
        unit_amount: unitAmount
      });
    }

    // Add add-ons to products if any
    if (addOnSelections && addOnSelections.length > 0) {
      // This is a simplified approach for add-ons
      // In a production system, you would fetch the actual add-ons from the database
      for (const addOn of addOnSelections) {
        // Convert price to baisa
        const unitAmount = Math.max(1, Math.round(parseFloat(addOn.price || "0") * 1000));
        
        products.push({
          name: `${addOn.name || 'Add-on'} (Extra)`,
          quantity: addOn.quantity || 1,
          unit_amount: unitAmount
        });
      }
    }

    // Create a unique client reference ID
    const clientReferenceId = `order_${Date.now()}_${req.user!.id}`;
    
    // Determine the success and cancel URLs
    const hostUrl = req.get('host') || '';
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${hostUrl}`;
    
    const successUrl = `${baseUrl}/payment-success?session_id={session_id}`;
    const cancelUrl = `${baseUrl}/payment-cancelled?session_id={session_id}`;

    try {
      // Create a Thawani payment session
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
          metadata: {
            userId: req.user!.id,
            eventId,
            ticketSelections: JSON.stringify(ticketSelections),
            addOnSelections: JSON.stringify(addOnSelections)
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Thawani API error:', errorText);
        return res.status(500).json(errorResponse(`Thawani payment failed: ${errorText}`, 500));
      }

      const result = await response.json();
      if (!result.success) {
        return res.status(500).json(errorResponse(`Thawani error: ${result.message}`, 500));
      }

      const sessionId = result.data.session_id;
      const checkoutUrl = `${THAWANI_CHECKOUT_URL}/${sessionId}?key=${THAWANI_PUBLIC_KEY}`;

      return res.status(200).json(successResponse({
        sessionId,
        checkoutUrl,
        clientReferenceId
      }, 'Payment session created successfully'));
    } catch (error: any) {
      console.error('Error creating Thawani session:', error);
      return res.status(500).json(errorResponse(`Failed to create payment session: ${error.message}`, 500));
    }
  } catch (error: any) {
    console.error('Error in create-session:', error);
    return res.status(500).json(errorResponse(`Server error: ${error.message}`, 500));
  }
});

/**
 * Verify a payment session and complete the purchase
 * GET /api/payments/enhanced/verify/:sessionId
 */
router.get('/verify/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json(errorResponse('Session ID is required', 400));
    }

    // Verify the session with Thawani
    const response = await fetch(`${THAWANI_API_URL}/checkout/session/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'thawani-api-key': THAWANI_API_KEY!
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json(errorResponse(`Failed to verify Thawani session: ${errorText}`, 500));
    }

    const result = await response.json();
    if (!result.success) {
      return res.status(500).json(errorResponse(`Thawani verification error: ${result.message}`, 500));
    }

    const sessionData = result.data;
    
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

      // Create the tickets in the database
      const purchaseData = {
        userId,
        eventId,
        ticketSelections,
        addOnSelections,
        paymentSessionId: sessionId,
        paymentStatus: 'paid'
      };

      try {
        const tickets = await optimizedStorage.purchaseTickets(purchaseData);
        
        return res.status(200).json(successResponse({
          paymentStatus: sessionData.payment_status,
          clientReferenceId: sessionData.client_reference_id,
          total: sessionData.total_amount / 1000, // Convert from baisa to OMR
          tickets
        }, 'Payment successful and tickets created'));
      } catch (purchaseError: any) {
        return res.status(500).json(errorResponse(`Failed to create tickets: ${purchaseError.message}`, 500));
      }
    } else {
      return res.status(200).json(successResponse({
        paymentStatus: sessionData.payment_status,
        clientReferenceId: sessionData.client_reference_id
      }, 'Payment not completed'));
    }
  } catch (error: any) {
    console.error('Error verifying payment session:', error);
    return res.status(500).json(errorResponse(`Failed to verify payment: ${error.message}`, 500));
  }
});

/**
 * Get payment status
 * GET /api/payments/enhanced/status/:sessionId
 */
router.get('/status/:sessionId', async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json(errorResponse('Session ID is required', 400));
    }

    // Verify the session with Thawani
    const response = await fetch(`${THAWANI_API_URL}/checkout/session/${sessionId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'thawani-api-key': THAWANI_API_KEY!
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return res.status(500).json(errorResponse(`Failed to get session details: ${errorText}`, 500));
    }

    const result = await response.json();
    if (!result.success) {
      return res.status(500).json(errorResponse(`Thawani error: ${result.message}`, 500));
    }

    const sessionData = result.data;
    
    return res.status(200).json(successResponse({
      paymentStatus: sessionData.payment_status,
      clientReferenceId: sessionData.client_reference_id,
      total: sessionData.total_amount / 1000, // Convert from baisa to OMR
      products: sessionData.products
    }, 'Payment status retrieved'));
  } catch (error: any) {
    console.error('Error getting payment status:', error);
    return res.status(500).json(errorResponse(`Failed to get payment status: ${error.message}`, 500));
  }
});

/**
 * Webhook for Thawani payment notifications
 * POST /api/payments/enhanced/webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event, data } = req.body;
    
    if (event === 'payment_success' || event === 'payment_completed') {
      const sessionId = data.session_id;
      
      // Using raw SQL to update tickets payment status
      try {
        await optimizedStorage.pool.query(`
          UPDATE tickets 
          SET payment_status = 'paid' 
          WHERE payment_session_id = $1
        `, [sessionId]);
        
        return res.status(200).send('Webhook processed successfully');
      } catch (dbError: any) {
        console.error('Database error in webhook:', dbError);
        return res.status(500).send(`Database error: ${dbError.message}`);
      }
    }
    
    return res.status(200).send('Webhook event ignored');
  } catch (error: any) {
    console.error('Error handling webhook:', error);
    return res.status(500).send(`Webhook error: ${error.message}`);
  }
});

export default router;