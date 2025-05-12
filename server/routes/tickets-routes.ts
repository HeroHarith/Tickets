import { Router, Request, Response } from 'express';
import { ticketingService } from '../services/ticketing-service';
import { requireRole } from '../auth';
import { successResponse, errorResponse } from '../utils/api-response';
import { z } from 'zod';
import { purchaseTicketSchema, PurchaseTicketInput } from '@shared/schema';
import { generateAppleWalletPassUrl, generateGooglePayPassUrl } from '../wallet';

const router = Router();

/**
 * @route GET /api/tickets/payment/:sessionId
 * @desc Get tickets by payment session ID
 * @access customer, admin
 */
router.get('/payment/:sessionId', requireRole(["customer", "admin"]), async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.sessionId;
    if (!sessionId) {
      return res.status(400).json(errorResponse('Session ID is required', 400));
    }
    
    const tickets = await ticketingService.getTicketsByPaymentSession(sessionId);
    return res.json(successResponse(tickets, 200, 'Tickets retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching tickets by payment session:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route POST /api/tickets/purchase
 * @desc Purchase tickets for an event
 * @access customer, admin
 */
router.post('/purchase', requireRole(["customer", "admin"]), async (req: Request, res: Response) => {
  try {
    // Validate the purchase ticket input
    let purchaseInput: PurchaseTicketInput;
    try {
      purchaseInput = purchaseTicketSchema.parse(req.body);
    } catch (e: any) {
      if (e instanceof z.ZodError) {
        return res.status(400).json(errorResponse(`Validation error: ${e.errors[0].message}`, 400));
      }
      throw e;
    }
    
    // Purchase tickets
    const tickets = await ticketingService.purchaseTickets(purchaseInput, req.user?.id || 0);
    return res.status(201).json(successResponse(tickets, 201, 'Tickets purchased successfully'));
  } catch (error: any) {
    console.error('Error purchasing tickets:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route GET /api/tickets/user
 * @desc Get tickets for the current user
 * @access customer, eventManager, admin
 */
router.get('/user', requireRole(["customer", "eventManager", "admin"]), async (req: Request, res: Response) => {
  try {
    const tickets = await ticketingService.getUserTickets(req.user?.id || 0);
    return res.json(successResponse(tickets, 200, 'User tickets retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching user tickets:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route GET /api/tickets/:id/qr
 * @desc Get QR code for a ticket
 * @access customer, eventManager, admin
 */
router.get('/:id/qr', requireRole(["customer", "eventManager", "admin"]), async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json(errorResponse('Invalid ticket ID', 400));
    }
    
    const qrCodeDataUrl = await ticketingService.generateTicketQR(ticketId);
    return res.json(successResponse({ qrCodeDataUrl }, 200, 'Ticket QR code generated successfully'));
  } catch (error: any) {
    console.error('Error generating ticket QR code:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route POST /api/tickets/:id/wallet-pass
 * @desc Generate wallet pass for a ticket
 * @access customer, admin
 */
router.post('/:id/wallet-pass', requireRole(["customer", "admin"]), async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.id);
    if (isNaN(ticketId)) {
      return res.status(400).json(errorResponse('Invalid ticket ID', 400));
    }
    
    const { walletType } = req.body;
    if (!walletType || !['apple', 'google'].includes(walletType)) {
      return res.status(400).json(errorResponse('Valid wallet type (apple or google) is required', 400));
    }
    
    // Get ticket details
    const ticket = await storage.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json(errorResponse('Ticket not found', 404));
    }
    
    // Check if user owns the ticket
    if (ticket.userId !== req.user.id) {
      return res.status(403).json(errorResponse('Access denied', 403));
    }
    
    // Generate wallet pass URL
    let walletPassUrl = '';
    if (walletType === 'apple') {
      walletPassUrl = await generateAppleWalletPassUrl(ticket);
    } else if (walletType === 'google') {
      walletPassUrl = await generateGooglePayPassUrl(ticket);
    }
    
    return res.json(successResponse({ walletPassUrl }, 200, 'Wallet pass generated successfully'));
  } catch (error: any) {
    console.error('Error generating wallet pass:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

export default router;