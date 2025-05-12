import { Router, Request, Response } from 'express';
import { ticketingService } from '../services/ticketing-service';
import { requireRole } from '../auth';
import { successResponse, errorResponse } from '../utils/api-response';
import { createEventSchema, eventSearchSchema } from '@shared/schema';
import { z } from 'zod';
import { requireSubscription } from '../middleware/require-subscription';

const router = Router();

/**
 * @route GET /api/events
 * @desc Get all events or filter by search parameters
 * @access public
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    // Extract search parameters and map to ticketing-service expected format
    const searchParams = {
      sortBy: (req.query.sortBy as "date-asc" | "date-desc" | "price-asc" | "price-desc") || "date-asc",
      search: req.query.search as string | undefined,
      location: req.query.location as string | undefined,
      category: req.query.category as string | undefined,
      featured: req.query.featured === 'true' ? true : undefined,
      status: req.query.status as string | undefined,
      organizer: req.query.managerId ? parseInt(req.query.managerId as string) : undefined,
      minPrice: req.query.minPrice ? req.query.minPrice as string : undefined,
      maxPrice: req.query.maxPrice ? req.query.maxPrice as string : undefined,
      minDate: req.query.startDate ? req.query.startDate as string : undefined,
      maxDate: req.query.endDate ? req.query.endDate as string : undefined,
    };
    
    try {
      // Validate search params
      eventSearchSchema.parse(searchParams);
    } catch (e) {
      if (e instanceof z.ZodError) {
        return res.status(400).json(errorResponse(`Invalid search parameters: ${e.errors[0].message}`, 400));
      }
    }
    
    // Get events
    const events = await ticketingService.getEvents(searchParams);
    return res.json(successResponse(events, 200, 'Events retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching events:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route GET /api/events/managed-with-sales
 * @desc Get managed events with sales data
 * @access eventManager, admin
 */
router.get('/managed-with-sales', requireRole(["eventManager", "admin"]), async (req: Request, res: Response) => {
  try {
    // Get events from the database
    const events = await ticketingService.getEvents({ 
      sortBy: "date-asc",
      organizer: req.user?.id 
    });
    
    // Aggregate events with sales data to send to the frontend
    const eventsWithSales = await Promise.all(events.map(async (event) => {
      try {
        const salesData = await ticketingService.getEventSales(event.id);
        return {
          ...event,
          salesData
        };
      } catch (error) {
        console.error(`Error getting sales for event ${event.id}:`, error);
        return {
          ...event,
          salesData: {
            totalSales: 0,
            ticketsSold: 0,
            salesByTicketType: []
          }
        };
      }
    }));
    
    return res.json(successResponse(eventsWithSales, 200, 'Managed events with sales retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching managed events with sales:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route GET /api/events/:id
 * @desc Get event by ID with ticket types
 * @access public
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const event = await ticketingService.getEvent(id);
    
    if (!event) {
      return res.status(404).json(errorResponse('Event not found', 404));
    }
    
    // Get ticket types for this event
    const ticketTypes = await ticketingService.getTicketTypes(id);
    
    // Return event with ticket types
    return res.json(successResponse(
      { ...event, ticketTypes },
      200, 
      'Event retrieved successfully'
    ));
  } catch (error: any) {
    console.error('Error fetching event:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route POST /api/events
 * @desc Create a new event
 * @access eventManager, admin
 */
router.post('/', 
  requireRole(["eventManager", "admin"]), 
  async (req: Request, res: Response) => {
    try {
      // Validate input
      const eventData = createEventSchema.parse({
        ...req.body,
        organizer: req.user?.id
      });
      
      // Create event
      const newEvent = await ticketingService.createEvent(eventData);
      return res.status(201).json(successResponse(newEvent, 201, 'Event created successfully'));
    } catch (error: any) {
      console.error('Error creating event:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json(errorResponse('Validation failed: ' + error.errors[0].message, 400));
      }
      return res.status(500).json(errorResponse(error.message, 500));
    }
});

/**
 * @route GET /api/events/:id/tickets
 * @desc Get all tickets for an event
 * @access eventManager, admin
 */
router.get('/:id/tickets', 
  requireRole(["eventManager", "admin"]), 
  async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      
      // Get event
      const event = await ticketingService.getEvent(eventId);
      if (!event) {
        return res.status(404).json(errorResponse('Event not found', 404));
      }
      
      // Check if user has access to the event (only if they're an event manager)
      if (req.user?.role === 'eventManager' && event.organizer !== req.user?.id) {
        return res.status(403).json(errorResponse('Access denied', 403));
      }
      
      // Get all tickets for this event
      const tickets = await ticketingService.getEventTickets(eventId);
      
      return res.json(successResponse(tickets, 200, 'Event tickets retrieved successfully'));
    } catch (error: any) {
      console.error('Error fetching event tickets:', error);
      return res.status(500).json(errorResponse(error.message, 500));
    }
});

/**
 * @route GET /api/events/:id/sales
 * @desc Get sales data for an event
 * @access eventManager, admin
 */
router.get('/:id/sales', 
  requireRole(["eventManager", "admin"]), 
  async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      
      // Get event
      const event = await ticketingService.getEvent(eventId);
      if (!event) {
        return res.status(404).json(errorResponse('Event not found', 404));
      }
      
      // Check if user has access to the event
      if (req.user?.role === 'eventManager' && event.organizer !== req.user?.id) {
        return res.status(403).json(errorResponse('Access denied', 403));
      }
      
      // Get sales data
      const salesData = await ticketingService.getEventSales(eventId);
      
      return res.json(successResponse({
        event,
        ...salesData
      }, 200, 'Event sales data retrieved successfully'));
    } catch (error: any) {
      console.error('Error fetching event sales:', error);
      return res.status(500).json(errorResponse(error.message, 500));
    }
});

export default router;