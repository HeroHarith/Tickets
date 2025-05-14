import { Router, Request, Response, NextFunction } from 'express';
import { externalApiService } from '../services/external-api-service';
import { successResponse, errorResponse } from '../utils/api-response';
import { z } from 'zod';
import { purchaseTicketSchema, PurchaseTicketInput } from '@shared/schema';

const router = Router();

/**
 * API key middleware for external access
 * This middleware is separate from the internal authentication system
 * and uses a different mechanism for authorization
 */
const apiKeyAuth = async (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];
  
  if (!apiKey) {
    return res.status(401).json(errorResponse('API key is required', 401));
  }
  
  if (typeof apiKey !== 'string') {
    return res.status(401).json(errorResponse('Invalid API key format', 401));
  }
  
  // Validate API key using the external API service
  const userId = await externalApiService.validateApiKey(apiKey);
  
  if (!userId) {
    return res.status(401).json(errorResponse('Invalid API key', 401));
  }
  
  // Store userId in request for later use
  (req as any).externalUserId = userId;
  
  next();
};

/**
 * @route GET /api/external/events
 * @desc Get a list of events with optional filtering (requires API key authentication)
 * @access External API (event managers only)
 */
router.get('/events', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    // Extract query parameters
    const {
      category,
      minDate,
      maxDate,
      search,
      featured,
      limit = 100,
      offset = 0
    } = req.query;
    
    // Get the user ID associated with the API key
    const userId = (req as any).externalUserId;
    
    // Parse optional parameters
    const parsedLimit = limit ? parseInt(limit as string) : 100;
    const parsedOffset = offset ? parseInt(offset as string) : 0;
    
    // Parse date parameters if provided
    const parsedMinDate = minDate ? new Date(minDate as string) : undefined;
    const parsedMaxDate = maxDate ? new Date(maxDate as string) : undefined;
    
    // Parse boolean parameter
    const parsedFeatured = featured === 'true' ? true : undefined;
    
    // Fetch events with filters
    const events = await externalApiService.getEvents({
      organizerId: userId, // Only return events owned by the API key holder
      category: category as string | undefined,
      minDate: parsedMinDate,
      maxDate: parsedMaxDate,
      search: search as string | undefined,
      featured: parsedFeatured,
      limit: parsedLimit,
      offset: parsedOffset
    });
    
    return res.json(successResponse(events, 200, 'Events retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching events:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route GET /api/external/events/:eventId
 * @desc Get details for a specific event (requires API key authentication)
 * @access External API (event managers only)
 */
router.get('/events/:eventId', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.eventId);
    if (isNaN(eventId)) {
      return res.status(400).json(errorResponse('Invalid event ID', 400));
    }
    
    // Get event details
    const event = await externalApiService.getEvent(eventId);
    if (!event) {
      return res.status(404).json(errorResponse('Event not found', 404));
    }
    
    // Get the user ID associated with the API key
    const userId = (req as any).externalUserId;
    
    // Check if the API key's user is the organizer of this event
    if (event.organizer !== userId) {
      return res.status(403).json(errorResponse('Access denied: You are not the organizer of this event', 403));
    }
    
    return res.json(successResponse(event, 200, 'Event details retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching event details:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

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
    const event = await externalApiService.getEvent(eventId);
    if (!event) {
      return res.status(404).json(errorResponse('Event not found', 404));
    }
    
    // Check if the API key's user is the event organizer
    const userId = (req as any).externalUserId;
    if (event.organizer !== userId) {
      return res.status(403).json(errorResponse('Access denied: You are not the organizer of this event', 403));
    }
    
    // Get all tickets for this event using the external API service
    const tickets = await externalApiService.getEventTickets(eventId);
    
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
    
    // Get ticket details with related data
    const ticketDetails = await externalApiService.getTicketDetails(ticketId);
    if (!ticketDetails) {
      return res.status(404).json(errorResponse('Ticket not found', 404));
    }
    
    // Check if the API key's user is the organizer of the event this ticket belongs to
    const userId = (req as any).externalUserId;
    if (ticketDetails.event.organizer !== userId) {
      return res.status(403).json(errorResponse('Access denied: You are not the organizer of this ticket\'s event', 403));
    }
    
    return res.json(successResponse(ticketDetails, 200, 'Ticket details retrieved successfully'));
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
    
    // Get event to check ownership
    const event = await externalApiService.getEvent(purchaseInput.eventId);
    if (!event) {
      return res.status(404).json(errorResponse('Event not found', 404));
    }
    
    // Check if the API key's user is the organizer of this event
    const userId = (req as any).externalUserId;
    if (event.organizer !== userId) {
      return res.status(403).json(errorResponse('Access denied: You are not the organizer of this event', 403));
    }
    
    // Specify which user the tickets are being purchased for
    // This should be passed in the request body
    const purchaseForUserId = req.body.purchaseForUserId || userId;
    
    // Purchase tickets using the external API service
    const tickets = await externalApiService.purchaseTickets(purchaseInput, purchaseForUserId);
    
    return res.status(201).json(successResponse(tickets, 201, 'Tickets purchased successfully'));
  } catch (error: any) {
    console.error('Error purchasing tickets:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route POST /api/external/tickets/:ticketId/validate
 * @desc Validate a ticket (check-in) (requires API key authentication)
 * @access External API (event managers only)
 */
router.post('/tickets/:ticketId/validate', apiKeyAuth, async (req: Request, res: Response) => {
  try {
    const ticketId = parseInt(req.params.ticketId);
    if (isNaN(ticketId)) {
      return res.status(400).json(errorResponse('Invalid ticket ID', 400));
    }
    
    // Get ticket to check event ownership
    const ticket = await externalApiService.getTicket(ticketId);
    if (!ticket) {
      return res.status(404).json(errorResponse('Ticket not found', 404));
    }
    
    // Get the event to verify ownership
    const event = await externalApiService.getEvent(ticket.eventId);
    if (!event) {
      return res.status(404).json(errorResponse('Event not found', 404));
    }
    
    // Check if the API key's user is the organizer of this event
    const userId = (req as any).externalUserId;
    if (event.organizer !== userId) {
      return res.status(403).json(errorResponse('Access denied: You are not the organizer of this ticket\'s event', 403));
    }
    
    // Validate the ticket
    const validated = await externalApiService.validateTicket(ticketId);
    
    if (validated) {
      return res.json(successResponse({ validated: true }, 200, 'Ticket validated successfully'));
    } else {
      return res.status(400).json(errorResponse('Failed to validate ticket', 400));
    }
  } catch (error: any) {
    console.error('Error validating ticket:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

export const externalApiRoutes = router;