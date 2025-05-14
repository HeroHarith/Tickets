import { Router, Request, Response, NextFunction } from 'express';
import { ticketingService } from '../services/ticketing-service';
import { successResponse, errorResponse } from '../utils/api-response';
import { z } from 'zod';
import { purchaseTicketSchema, PurchaseTicketInput, User } from '@shared/schema';

const router = Router();

// API key middleware for external access
const apiKeyAuth = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json(errorResponse('API key is required', 401));
  }
  
  // In a real implementation, you would validate the API key against a database
  // For now, we'll use a simple check for demonstration purposes
  // In production, this should be replaced with a proper validation against stored API keys
  if (typeof apiKey !== 'string') {
    return res.status(401).json(errorResponse('Invalid API key format', 401));
  }
  
  // Set the user context based on the API key
  // In production, you would look up the user associated with this API key
  (req as any).user = {
    id: 0, // This will be populated from the API key lookup
    role: 'eventManager',
    // We're using any type here to bypass the complete User requirement
    // In a real implementation, you would retrieve the full user object
  };
  
  next();
};

/**
 * @route GET /api/external/events/:eventId/tickets
 * @desc Get all tickets for an event (requires API key authentication)
 * @access External API (event managers only)
 */
router.get('/events/:eventId/tickets', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.eventId);
    if (isNaN(eventId)) {
      return res.status(400).json(errorResponse('Invalid event ID', 400));
    }
    
    // Verify the event exists
    const event = await ticketingService.getEvent(eventId);
    if (!event) {
      return res.status(404).json(errorResponse('Event not found', 404));
    }
    
    // In a real implementation, verify that the API key belongs to the event organizer
    // For now, we'll skip this check for demonstration purposes
    
    // Get all tickets for this event
    const tickets = await ticketingService.getEventTickets(eventId);
    
    return res.json(successResponse(tickets, 200, 'Event tickets retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching event tickets:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route GET /api/external/tickets/:ticketId
 * @desc Get details for a specific ticket (requires API key authentication)
 * @access External API (event managers only)
 */
router.get('/tickets/:ticketId', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    if (isNaN(ticketId)) {
      return res.status(400).json(errorResponse('Invalid ticket ID', 400));
    }
    
    // Get the ticket
    const ticket = await ticketingService.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json(errorResponse('Ticket not found', 404));
    }
    
    // In a real implementation, verify that the API key belongs to the event organizer
    // For now, we'll skip this check for demonstration purposes
    
    return res.json(successResponse(ticket, 200, 'Ticket details retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching ticket details:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route POST /api/external/tickets/purchase
 * @desc Purchase tickets for an event (requires API key authentication)
 * @access External API (event managers only)
 */
router.post('/tickets/purchase', apiKeyAuth, async (req: Request, res: Response) => {
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
    
    // In a real implementation, verify that the API key belongs to the event organizer
    // For now, we'll skip this check for demonstration purposes
    
    // Purchase tickets
    // Note: In an external API context, you might want to specify the user ID for whom 
    // the tickets are being purchased (passed in the request body)
    const userId = req.body.userId || req.user?.id;
    const tickets = await ticketingService.purchaseTickets(purchaseInput, userId);
    
    return res.status(201).json(successResponse(tickets, 201, 'Tickets purchased successfully'));
  } catch (error: any) {
    console.error('Error purchasing tickets:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

export const externalApiRoutes = router;