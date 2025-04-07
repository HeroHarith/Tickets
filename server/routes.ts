import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { 
  createEventSchema, 
  insertUserSchema, 
  purchaseTicketSchema,
  eventSearchSchema
} from "@shared/schema";
import { ZodError } from "zod";
import { setupAuth, requireRole } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // Helper function to verify user is authenticated
  function ensureAuthenticated(req: Request): asserts req is Request & { user: Express.User } {
    if (!req.isAuthenticated() || !req.user) {
      throw new Error("User is not authenticated");
    }
  }
  
  // Helper for handling validation errors
  const validateRequest = (schema: any, data: any) => {
    try {
      return { data: schema.parse(data), error: null };
    } catch (error) {
      if (error instanceof ZodError) {
        return { 
          data: null, 
          error: { message: "Validation error", details: error.errors } 
        };
      }
      return { data: null, error: { message: "Unknown error" } };
    }
  };

  // User routes
  app.post("/api/users", async (req: Request, res: Response) => {
    const { data, error } = validateRequest(insertUserSchema, req.body);
    if (error) return res.status(400).json(error);

    try {
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      const user = await storage.createUser(data);
      return res.status(201).json({ id: user.id, username: user.username, name: user.name, email: user.email });
    } catch (err) {
      console.error("Error creating user:", err);
      return res.status(500).json({ message: "Failed to create user" });
    }
  });

  // Event routes
  app.get("/api/events", async (req: Request, res: Response) => {
    try {
      const { 
        category, 
        featured, 
        search, 
        organizer, 
        dateFilter, 
        priceFilter, 
        minDate, 
        maxDate, 
        location,
        sortBy
      } = req.query;
      
      // Validate the params using our eventSearchSchema
      const { data, error } = validateRequest(eventSearchSchema, {
        category,
        featured: featured === "true",
        search,
        organizer: organizer ? parseInt(organizer as string) : undefined,
        dateFilter,
        priceFilter,
        minDate,
        maxDate,
        location,
        sortBy
      });
      
      if (error) {
        return res.status(400).json(error);
      }
      
      const events = await storage.getEvents(data);
      
      // If we need to filter by price, we need to do it here after fetching ticket types
      // since the price is in the ticket_types table, not in the events table
      if (data.priceFilter && data.priceFilter !== 'all') {
        // Fetch ticket types for each event to determine price ranges
        const eventIds = events.map(e => e.id);
        const ticketTypesPromises = eventIds.map(id => storage.getTicketTypes(id));
        const ticketTypesResults = await Promise.all(ticketTypesPromises);
        
        // Create a map of event ID to min/max prices
        const eventPrices = new Map<number, { min: number, max: number }>();
        
        events.forEach((event, index) => {
          const eventTicketTypes = ticketTypesResults[index];
          if (eventTicketTypes.length > 0) {
            const prices = eventTicketTypes.map(tt => Number(tt.price));
            eventPrices.set(event.id, {
              min: Math.min(...prices),
              max: Math.max(...prices)
            });
          } else {
            // If no ticket types, consider it a free event
            eventPrices.set(event.id, { min: 0, max: 0 });
          }
        });
        
        // Filter events based on price filter
        const filteredEvents = events.filter(event => {
          const price = eventPrices.get(event.id);
          if (!price) return false;
          
          switch (data.priceFilter) {
            case 'free':
              return price.min === 0;
            case 'paid':
              return price.min > 0;
            case 'under-25':
              return price.min < 25;
            case '25-to-50':
              return price.min >= 25 && price.min <= 50;
            case '50-to-100':
              return price.min > 50 && price.min <= 100;
            case 'over-100':
              return price.min > 100;
            default:
              return true;
          }
        });
        
        // If we have a price sort, apply it
        if (data.sortBy === 'price-asc' || data.sortBy === 'price-desc') {
          filteredEvents.sort((a, b) => {
            const priceA = eventPrices.get(a.id)?.min || 0;
            const priceB = eventPrices.get(b.id)?.min || 0;
            return data.sortBy === 'price-asc' ? priceA - priceB : priceB - priceA;
          });
        }
        
        return res.json(filteredEvents);
      }
      
      return res.json(events);
    } catch (err) {
      console.error("Error fetching events:", err);
      return res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      const ticketTypes = await storage.getTicketTypes(eventId);
      
      return res.json({ ...event, ticketTypes });
    } catch (err) {
      console.error("Error fetching event:", err);
      return res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post("/api/events", requireRole(["eventManager", "admin"]), async (req: Request, res: Response) => {
    const { data, error } = validateRequest(createEventSchema, req.body);
    if (error) return res.status(400).json(error);

    try {
      // Ensure user is authenticated and get their ID
      ensureAuthenticated(req);
      
      const event = await storage.createEvent({
        ...data,
        organizer: req.user.id
      });
      
      return res.status(201).json(event);
    } catch (err) {
      console.error("Error creating event:", err);
      return res.status(500).json({ message: "Failed to create event" });
    }
  });

  // Ticket routes
  app.post("/api/tickets/purchase", requireRole(["customer", "eventManager", "admin"]), async (req: Request, res: Response) => {
    const { data, error } = validateRequest(purchaseTicketSchema, req.body);
    if (error) return res.status(400).json(error);

    try {
      // Ensure user is authenticated and get their ID
      ensureAuthenticated(req);
      
      const tickets = await storage.purchaseTickets(data, req.user.id);
      return res.status(201).json(tickets);
    } catch (err: any) {
      console.error("Error purchasing tickets:", err);
      return res.status(500).json({ message: err.message || "Failed to purchase tickets" });
    }
  });

  app.get("/api/tickets/user", requireRole(["customer", "eventManager", "admin"]), async (req: Request, res: Response) => {
    try {
      // Ensure user is authenticated and get their ID
      ensureAuthenticated(req);
      
      const tickets = await storage.getUserTickets(req.user.id);
      
      // Expand ticket information with event and ticket type details
      const expandedTickets = await Promise.all(
        tickets.map(async (ticket) => {
          const event = await storage.getEvent(ticket.eventId);
          const ticketType = await storage.getTicketType(ticket.ticketTypeId);
          
          return {
            ...ticket,
            event,
            ticketType
          };
        })
      );
      
      return res.json(expandedTickets);
    } catch (err) {
      console.error("Error fetching user tickets:", err);
      return res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.get("/api/events/:id/sales", requireRole(["eventManager", "admin"]), async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Ensure user is authenticated and get their ID
      ensureAuthenticated(req);
      
      // Verify the user has permission (is admin or the event organizer)
      if (req.user.role !== 'admin' && event.organizer !== req.user.id) {
        return res.status(403).json({ message: "You do not have permission to view sales for this event" });
      }
      
      const salesData = await storage.getEventSales(eventId);
      
      return res.json({
        event,
        ...salesData
      });
    } catch (err) {
      console.error("Error fetching event sales:", err);
      return res.status(500).json({ message: "Failed to fetch event sales" });
    }
  });
  
  // QR code generation for ticket
  app.get("/api/tickets/:id/qr", requireRole(["customer", "eventManager", "admin"]), async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.id);
      
      // Generate or retrieve QR code
      const qrCodeUrl = await storage.generateTicketQR(ticketId);
      
      res.json({ qrCode: qrCodeUrl });
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json({ message: "Failed to generate QR code" });
    }
  });

  // Ticket validation - requires event manager or admin role
  app.post("/api/tickets/:id/validate", requireRole(["eventManager", "admin"]), async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.id);
      const isValid = await storage.validateTicket(ticketId);
      
      if (isValid) {
        res.json({ valid: true, message: "Ticket successfully validated" });
      } else {
        res.json({ valid: false, message: "Ticket already used or invalid" });
      }
    } catch (error) {
      console.error("Error validating ticket:", error);
      res.status(500).json({ message: "Failed to validate ticket" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
