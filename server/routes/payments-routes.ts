import { Router, Request, Response } from 'express';
import { optimizedStorage as storage } from '../optimized-storage';
import { requireRole } from '../auth';
import { successResponse, errorResponse } from '../utils/api-response';
import { z } from 'zod';
import { createPaymentSession, getSessionDetails as getSession, checkPaymentStatus as getSessionStatus, CustomerDetails, ProductDetails } from '../thawani';
import { db } from '../db';
import { tickets } from '@shared/schema';
import { eq } from 'drizzle-orm';

const router = Router();

/**
 * @route POST /api/payments/tickets
 * @desc Create a payment session for tickets
 * @access customer, admin
 */
router.post('/tickets', requireRole(["customer", "admin"]), async (req: Request, res: Response) => {
  try {
    // Validate input
    const paymentSchema = z.object({
      items: z.array(z.object({
        ticketTypeId: z.number(),
        quantity: z.number().min(1),
        subtotal: z.number() // Price in smallest currency unit (e.g., baisa)
      })),
      customerDetails: z.object({
        name: z.string(),
        email: z.string().email(),
        phone: z.string().optional()
      }),
      eventId: z.number(),
      metadata: z.record(z.string(), z.any()).optional()
    });
    
    const validatedData = paymentSchema.parse(req.body);
    
    // Format items for Thawani
    const paymentItems: ProductDetails[] = validatedData.items.map(item => {
      // Handle zero price tickets - Thawani might not accept 0 as a valid price
      // So we set a minimum price of 1 baisa (0.001 OMR) for free tickets
      const unitAmount = Math.max(1, Math.round(item.subtotal / item.quantity));
      
      return {
        name: `Ticket Type #${item.ticketTypeId}`,
        quantity: item.quantity,
        unitAmount
      };
    });
    
    // Set up customer details
    const customerDetails: CustomerDetails = {
      firstName: validatedData.customerDetails.name.split(' ')[0] || validatedData.customerDetails.name,
      lastName: validatedData.customerDetails.name.split(' ').slice(1).join(' ') || '-',
      email: validatedData.customerDetails.email,
      phone: validatedData.customerDetails.phone || '0000000000'
    };
    
    // Create session with metadata
    const metadata = {
      userId: req.user?.id.toString() || '0',
      eventId: validatedData.eventId.toString(),
      items: JSON.stringify(validatedData.items),
      purchaseType: 'ticket',
      ...(validatedData.metadata || {})
    };
    
    // Create payment session
    const session = await createPaymentSession(paymentItems, customerDetails, metadata);
    
    return res.json(successResponse(session, 200, 'Payment session created'));
  } catch (error: any) {
    console.error('Error creating ticket payment session:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse('Validation failed: ' + error.errors[0].message, 400));
    }
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route POST /api/payments/rentals
 * @desc Create a payment session for venue rentals
 * @access customer, admin
 */
router.post('/rentals', requireRole(["customer", "admin"]), async (req: Request, res: Response) => {
  try {
    // Validate input
    const rentalPaymentSchema = z.object({
      rentalId: z.number(),
      customerDetails: z.object({
        name: z.string(),
        email: z.string().email(),
        phone: z.string().optional()
      })
    });
    
    const validatedData = rentalPaymentSchema.parse(req.body);
    
    // Get rental
    const rental = await storage.getRental(validatedData.rentalId);
    if (!rental) {
      return res.status(404).json(errorResponse('Rental not found', 404));
    }
    
    // Check if rental is already paid
    if (rental.paymentStatus === 'paid') {
      return res.status(400).json(errorResponse('Rental is already paid', 400));
    }
    
    // Format items for Thawani
    const paymentItems: ProductDetails[] = [{
      name: `Venue Rental: ${rental.venueName || `Venue #${rental.venueId}`}`,
      quantity: 1,
      unitAmount: Math.round(parseFloat(rental.totalPrice) * 1000), // Convert to baisa (smallest unit)
    }];
    
    // Set up customer details
    const customerDetails: CustomerDetails = {
      firstName: validatedData.customerDetails.name.split(' ')[0] || validatedData.customerDetails.name,
      lastName: validatedData.customerDetails.name.split(' ').slice(1).join(' ') || '-',
      email: validatedData.customerDetails.email,
      phone: validatedData.customerDetails.phone || '0000000000'
    };
    
    // Create session with metadata
    const metadata = {
      userId: req.user?.id.toString() || '0',
      rentalId: rental.id.toString(),
      purchaseType: 'rental'
    };
    
    // Create payment session
    const session = await createPaymentSession(paymentItems, customerDetails, metadata);
    
    return res.json(successResponse(session, 200, 'Rental payment session created'));
  } catch (error: any) {
    console.error('Error creating rental payment session:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse('Validation failed: ' + error.errors[0].message, 400));
    }
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route GET /api/payments/status/:sessionId
 * @desc Check payment status by session ID
 * @access public
 */
router.get('/status/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    const status = await getSessionStatus(sessionId);
    return res.json(successResponse(status, 200, 'Payment status retrieved'));
  } catch (error: any) {
    console.error('Error checking payment status:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route POST /api/payments/webhook
 * @desc Handle Thawani payment webhook
 * @access public
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    // Validate webhook payload
    const { event, data } = req.body;
    
    if (event !== 'payment_completed') {
      // Only handle completed payments
      return res.json(successResponse(null, 200, 'Event ignored'));
    }
    
    // Process the webhook
    const { session_id } = data;
    const session = await getSession(session_id);
    
    if (!session || !session.metadata) {
      return res.status(400).json(errorResponse('Invalid session data', 400));
    }
    
    const { metadata } = session;
    const purchaseType = metadata.purchaseType;
    
    if (purchaseType === 'ticket') {
      // Update ticket status to paid
      await db.update(tickets)
        .set({ paymentStatus: 'paid' })
        .where(eq(tickets.paymentSessionId, session_id));
        
      // Additional processing if needed...
    } else if (purchaseType === 'rental') {
      // Update rental payment status
      const rentalId = parseInt(metadata.rentalId);
      await storage.updatePaymentStatus(rentalId, 'paid');
    }
    
    return res.json(successResponse(null, 200, 'Webhook processed successfully'));
  } catch (error: any) {
    console.error('Error processing payment webhook:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route GET /payment-success
 * @desc Payment success page
 * @access public
 */
router.get('/success', (req: Request, res: Response) => {
  return res.json(successResponse({ message: 'Payment successful' }, 200, 'Payment completed successfully'));
});

/**
 * @route GET /payment-cancel
 * @desc Payment canceled page
 * @access public
 */
router.get('/cancel', (req: Request, res: Response) => {
  return res.json(successResponse({ message: 'Payment canceled' }, 200, 'Payment was canceled'));
});

export default router;