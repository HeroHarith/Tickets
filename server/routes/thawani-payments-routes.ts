/**
 * Thawani Payment Routes
 * 
 * This file contains routes for handling payments through the Thawani payment gateway
 * based on the Thawani Pay Integration Guide.
 */

import { Router, Request, Response } from 'express';
import { optimizedStorage } from '../optimized-storage';
import { successResponse, errorResponse } from '../utils/api-response';
import { requireRole } from '../middleware/auth-middleware';
import fetch from 'node-fetch';
import { z } from 'zod';

const router = Router();

// Thawani API configurations from environment variables
const THAWANI_API_KEY = process.env.THAWANI_API_KEY;
const THAWANI_PUBLIC_KEY = process.env.THAWANI_PUBLIC_KEY;
const THAWANI_API_URL = 'https://uatcheckout.thawani.om/api/v1';
const THAWANI_CHECKOUT_URL = 'https://uatcheckout.thawani.om/pay';

// Input validation schema
const ticketPaymentSchema = z.object({
  eventId: z.number(),
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
  addOnSelections: z.array(z.object({
    addOnId: z.number(),
    quantity: z.number().min(1),
    price: z.string().or(z.number()),
    name: z.string().optional()
  })).optional().default([])
});

/**
 * Create a payment session for tickets
 * POST /api/payments/thawani/tickets
 */
router.post('/tickets', requireRole(["customer", "admin"]), async (req: Request, res: Response) => {
  try {
    // Validate input
    const validationResult = ticketPaymentSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json(errorResponse(`Validation failed: ${validationResult.error.message}`, 400));
    }

    const validatedData = validationResult.data;
    
    // Get the event details
    const event = await optimizedStorage.getEvent(validatedData.eventId);
    if (!event) {
      return res.status(404).json(errorResponse('Event not found', 404));
    }

    // Prepare products array for Thawani
    const products = [];

    // Add tickets to products
    for (const item of validatedData.items) {
      const ticketType = await optimizedStorage.getTicketType(item.ticketTypeId);
      if (!ticketType) {
        return res.status(404).json(errorResponse(`Ticket type not found: ${item.ticketTypeId}`, 404));
      }

      // Calculate the unit price in OMR (subtotal / quantity)
      const unitPriceOMR = item.subtotal / item.quantity;
      
      // Convert from OMR to baisa (1 OMR = 1000 baisa)
      // Thawani requires at least 100 baisa for paid items (0.1 OMR)
      const baisaAmount = Math.round(unitPriceOMR * 1000);
      const unitAmount = unitPriceOMR > 0 ? Math.max(100, baisaAmount) : 1;
      
      console.log(`Adding ticket: ${ticketType.name}, Price: ${unitPriceOMR} OMR (${unitAmount} baisa)`);
      
      products.push({
        name: `${event.title} - ${ticketType.name}`.substring(0, 80), // Limit name length
        quantity: item.quantity,
        unit_amount: unitAmount
      });
    }

    // Add add-ons to products if any
    if (validatedData.addOnSelections && validatedData.addOnSelections.length > 0) {
      for (const addOn of validatedData.addOnSelections) {
        // Ensure price is a number
        const addOnPrice = typeof addOn.price === 'string' ? parseFloat(addOn.price) : addOn.price;
        
        // Convert from OMR to baisa (1 OMR = 1000 baisa) for Thawani
        // Thawani requires at least 100 baisa for paid items (0.1 OMR)
        const baisaAmount = Math.round(addOnPrice * 1000);
        const unitAmount = addOnPrice > 0 ? Math.max(100, baisaAmount) : 1;
        
        console.log(`Adding add-on: ${addOn.name || `#${addOn.addOnId}`}, Price: ${addOnPrice} OMR (${unitAmount} baisa)`);
        
        products.push({
          name: `Add-on: ${addOn.name || `#${addOn.addOnId}`}`.substring(0, 80), // Limit name length
          quantity: addOn.quantity,
          unit_amount: unitAmount
        });
      }
    }

    // Set up customer details
    const customerDetails = {
      firstName: validatedData.customerDetails.name.split(' ')[0] || validatedData.customerDetails.name,
      lastName: validatedData.customerDetails.name.split(' ').slice(1).join(' ') || '-',
      email: validatedData.customerDetails.email,
      phone: validatedData.customerDetails.phone || '0000000000'
    };

    // Create a unique client reference ID
    const clientReferenceId = `order_${Date.now()}_${req.user!.id}`;
    
    // Determine the success and cancel URLs
    const hostUrl = req.get('host') || '';
    const protocol = req.protocol;
    const baseUrl = `${protocol}://${hostUrl}`;
    
    const successUrl = `${baseUrl}/payment-status?session_id={sessionId}&status=success`;
    const cancelUrl = `${baseUrl}/payment-status?session_id={sessionId}&status=failed`;

    try {
      // Create metadata for post-payment processing
      const metadata = {
        userId: req.user!.id.toString(),
        eventId: validatedData.eventId.toString(),
        items: JSON.stringify(validatedData.items),
        addOnSelections: JSON.stringify(validatedData.addOnSelections),
        purchaseType: 'ticket',
        customerDetails: JSON.stringify(validatedData.customerDetails)
      };

      // Logging the request data to debug
      const requestData = {
        client_reference_id: clientReferenceId,
        mode: 'payment',
        products,
        success_url: successUrl,
        cancel_url: cancelUrl,
        customer: {
          first_name: customerDetails.firstName,
          last_name: customerDetails.lastName,
          email: customerDetails.email,
          phone: customerDetails.phone
        }
        // Don't include metadata as it might not be supported by Thawani
      };
      
      console.log('Thawani payment request:', JSON.stringify(requestData, null, 2));
      
      // Create a Thawani payment session
      // Testing with basic minimum required fields for Thawani
      const simpleRequestData = {
        client_reference_id: clientReferenceId,
        mode: 'payment',
        products: products.map(product => ({
          name: product.name.substring(0, 80), // Ensure name isn't too long
          quantity: product.quantity,
          unit_amount: product.unit_amount
        })),
        success_url: successUrl,
        cancel_url: cancelUrl
      };
      
      console.log('Simplified Thawani request:', JSON.stringify(simpleRequestData, null, 2));
      
      const response = await fetch(`${THAWANI_API_URL}/checkout/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'thawani-api-key': THAWANI_API_KEY!
        },
        body: JSON.stringify(simpleRequestData)
      });

      const responseText = await response.text();
      console.log('Thawani API response:', responseText);
      
      try {
        const result = JSON.parse(responseText);
        
        if (!response.ok || !result.success) {
          console.error('Thawani payment session creation failed:', result);
          return res.status(500).json(errorResponse(`Payment error: ${result.description || 'Unknown error'}`, 500));
        }
        
        // Continue with the successful result
        const sessionData = result.data;
        const sessionId = sessionData.session_id;
        const checkoutUrl = `${THAWANI_CHECKOUT_URL}/${sessionId}?key=${THAWANI_PUBLIC_KEY}`;

        return res.json(successResponse({
          session_id: sessionId,
          checkout_url: checkoutUrl
        }, 200, 'Payment session created'));
      } catch (error) {
        console.error('Error parsing Thawani response:', error);
        return res.status(500).json(errorResponse(`Failed to process payment response: ${error.message}`, 500));
      }
    } catch (error: any) {
      console.error('Error creating payment session:', error);
      return res.status(500).json(errorResponse(`Failed to create payment session: ${error.message}`, 500));
    }
  } catch (error: any) {
    console.error('Error in create-session:', error);
    return res.status(500).json(errorResponse(`Server error: ${error.message}`, 500));
  }
});

/**
 * Get payment session status
 * GET /api/payments/thawani/status/:sessionId
 */
router.get('/status/:sessionId', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    
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
      return res.status(500).json(errorResponse(`Failed to get payment status: ${errorText}`, 500));
    }

    const result = await response.json() as any;
    if (!result.success) {
      return res.status(500).json(errorResponse(`Payment gateway error: ${result.message}`, 500));
    }

    const sessionData = result.data;
    const status = sessionData.payment_status;
    
    // If payment is completed, proceed with ticket creation if not already done
    if (status === 'paid') {
      try {
        // Check if tickets were already created for this session
        const existingTickets = await optimizedStorage.getTicketsByPaymentSession(sessionId);
        
        if (!existingTickets || existingTickets.length === 0) {
          // Extract metadata
          const metadata = sessionData.metadata || {};
          const userId = metadata.userId ? parseInt(metadata.userId) : req.user?.id;
          const eventId = metadata.eventId ? parseInt(metadata.eventId) : undefined;
          const items = metadata.items ? JSON.parse(metadata.items) : [];
          const addOnSelections = metadata.addOnSelections ? JSON.parse(metadata.addOnSelections) : [];
          
          if (!userId || !eventId || !items.length) {
            return res.status(400).json(errorResponse('Invalid payment metadata', 400));
          }
          
          // Format ticket selections from items
          const ticketSelections = items.map((item: any) => ({
            ticketTypeId: item.ticketTypeId,
            quantity: item.quantity
          }));
          
          // Create tickets in the database
          await optimizedStorage.purchaseTickets({
            userId,
            eventId,
            ticketSelections,
            addOnSelections,
            paymentSessionId: sessionId,
            paymentStatus: 'paid'
          });
        }
      } catch (error: any) {
        console.error('Error processing paid session:', error);
        // Continue and return status even if ticket creation fails
      }
    }
    
    return res.json(successResponse({
      payment_status: status,
      client_reference_id: sessionData.client_reference_id,
      total_amount: sessionData.total_amount / 1000 // Convert from baisa to OMR
    }, 200, 'Payment status retrieved'));
  } catch (error: any) {
    console.error('Error checking payment status:', error);
    return res.status(500).json(errorResponse(`Server error: ${error.message}`, 500));
  }
});

/**
 * Success endpoint
 * GET /api/payments/thawani/success
 */
router.get('/success', (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  return res.json(successResponse({
    session_id: sessionId,
    message: 'Payment successful'
  }, 200, 'Payment completed successfully'));
});

/**
 * Cancel endpoint
 * GET /api/payments/thawani/cancel
 */
router.get('/cancel', (req: Request, res: Response) => {
  const sessionId = req.query.session_id as string;
  return res.json(successResponse({
    session_id: sessionId,
    message: 'Payment canceled'
  }, 200, 'Payment was canceled'));
});

/**
 * Webhook for Thawani payment notifications
 * POST /api/payments/thawani/webhook
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { event, data } = req.body;
    
    if (event === 'payment_success' || event === 'payment_completed') {
      const sessionId = data.session_id;
      
      // Using direct SQL query to update ticket status
      try {
        const query = `
          UPDATE tickets 
          SET payment_status = 'paid' 
          WHERE payment_session_id = $1
        `;
        
        await optimizedStorage.executeRawQuery?.(query, [sessionId]) || 
        // Fallback if executeRawQuery isn't available
        await import('../db').then(({ pool }) => pool.query(query, [sessionId]));
        
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