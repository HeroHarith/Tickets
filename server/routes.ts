import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
// Import optimized storage instead of standard storage
import { optimizedStorage as storage } from "./optimized-storage"; 
import { 
  createEventSchema, 
  insertUserSchema, 
  purchaseTicketSchema,
  eventSearchSchema,
  users as usersSchema
} from "@shared/schema";
import * as schema from "@shared/schema";
import { ZodError, z } from "zod";
import { setupAuth, requireRole } from "./auth";
import { generateAppleWalletPassUrl, generateGooglePayPassUrl } from "./wallet";
import { sendVerificationEmail, sendPasswordResetEmail } from "./email";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "./utils/api-response";

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
          error: errorResponse("Validation error", 400, { details: error.errors })
        };
      }
      return { data: null, error: errorResponse("Unknown error", 400) };
    }
  };

  // User routes
  app.post("/api/users", async (req: Request, res: Response) => {
    const { data, error } = validateRequest(insertUserSchema, req.body);
    if (error) return res.status(400).json(error);

    try {
      const existingUser = await storage.getUserByUsername(data.username);
      if (existingUser) {
        return res.status(400).json(errorResponse("Username already exists", 400));
      }
      
      const user = await storage.createUser(data);
      const userData = { id: user.id, username: user.username, name: user.name, email: user.email };
      return res.status(201).json(successResponse(userData, 201, "User created successfully"));
    } catch (err) {
      console.error("Error creating user:", err);
      return res.status(500).json(errorResponse("Failed to create user", 500));
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
        
        return res.json(successResponse(filteredEvents, 200, "Events retrieved successfully"));
      }
      
      return res.json(successResponse(events, 200, "Events retrieved successfully"));
    } catch (err) {
      console.error("Error fetching events:", err);
      return res.status(500).json(errorResponse("Failed to fetch events", 500));
    }
  });

  app.get("/api/events/:id", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json(errorResponse("Event not found", 404));
      }
      
      const ticketTypes = await storage.getTicketTypes(eventId);
      
      return res.json(successResponse({ ...event, ticketTypes }, 200, "Event retrieved successfully"));
    } catch (err) {
      console.error("Error fetching event:", err);
      return res.status(500).json(errorResponse("Failed to fetch event", 500));
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
      
      return res.status(201).json(successResponse(event, 201, "Event created successfully"));
    } catch (err) {
      console.error("Error creating event:", err);
      return res.status(500).json(errorResponse("Failed to create event", 500));
    }
  });

  // Get tickets for an event (for event managers)
  app.get("/api/events/:id/tickets", requireRole(["eventManager", "admin"]), async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      
      // Check if event exists
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json(errorResponse("Event not found", 404));
      }
      
      // Ensure user is authenticated
      ensureAuthenticated(req);
      
      // Verify the user has permission (is admin or the event organizer)
      if (req.user.role !== 'admin' && event.organizer !== req.user.id) {
        return res.status(403).json(errorResponse("You do not have permission to view tickets for this event", 403));
      }
      
      // Get tickets for the event
      const eventTickets = await storage.getEventTickets(eventId);
      
      // Get ticket types to include in response
      const ticketTypes = await storage.getTicketTypes(eventId);
      const ticketTypesMap = new Map(ticketTypes.map(tt => [tt.id, tt]));
      
      // Add ticket type information to each ticket and format attendee details
      const ticketsWithDetails = eventTickets.map(ticket => {
        // Prepare the ticket with additional information
        const formattedTicket = {
          ...ticket,
          ticketType: ticketTypesMap.get(ticket.ticketTypeId),
          attendeeDetails: Array.isArray(ticket.attendeeDetails) 
            ? ticket.attendeeDetails 
            : (ticket.attendeeDetails ? [ticket.attendeeDetails] : [])
        };
        
        return formattedTicket;
      });
      
      return res.json(successResponse(ticketsWithDetails, 200, "Event tickets retrieved successfully"));
    } catch (err) {
      console.error("Error fetching event tickets:", err);
      return res.status(500).json(errorResponse("Failed to fetch event tickets", 500));
    }
  });
  
  // Delete a ticket (for event managers)
  app.delete("/api/tickets/:id", requireRole(["eventManager", "admin"]), async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.id);
      
      // Get the ticket to ensure it exists and to get the event ID
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json(errorResponse("Ticket not found", 404));
      }
      
      // Get the event to check permissions
      const event = await storage.getEvent(ticket.eventId);
      if (!event) {
        return res.status(404).json(errorResponse("Event not found", 404));
      }
      
      // Ensure user is authenticated
      ensureAuthenticated(req);
      
      // Verify the user has permission (is admin or the event organizer)
      if (req.user.role !== 'admin' && event.organizer !== req.user.id) {
        return res.status(403).json(errorResponse("You do not have permission to delete tickets for this event", 403));
      }
      
      // Delete the ticket
      await storage.removeTicket(ticketId);
      
      return res.status(200).json(successResponse(null, 200, "Ticket successfully removed"));
    } catch (err) {
      console.error("Error removing ticket:", err);
      return res.status(500).json(errorResponse("Failed to remove ticket", 500));
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
      return res.status(201).json(successResponse(tickets, 201, "Tickets purchased successfully"));
    } catch (err: any) {
      console.error("Error purchasing tickets:", err);
      return res.status(500).json(errorResponse(err.message || "Failed to purchase tickets", 500));
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
      
      return res.json(successResponse(expandedTickets, 200, "User tickets retrieved successfully"));
    } catch (err) {
      console.error("Error fetching user tickets:", err);
      return res.status(500).json(errorResponse("Failed to fetch tickets", 500));
    }
  });

  app.get("/api/events/:id/sales", requireRole(["eventManager", "admin"]), async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json(errorResponse("Event not found", 404));
      }
      
      // Ensure user is authenticated and get their ID
      ensureAuthenticated(req);
      
      // Verify the user has permission (is admin or the event organizer)
      if (req.user.role !== 'admin' && event.organizer !== req.user.id) {
        return res.status(403).json(errorResponse("You do not have permission to view sales for this event", 403));
      }
      
      const salesData = await storage.getEventSales(eventId);
      
      return res.json(successResponse({
        event,
        ...salesData
      }, 200, "Event sales data retrieved successfully"));
    } catch (err) {
      console.error("Error fetching event sales:", err);
      return res.status(500).json(errorResponse("Failed to fetch event sales", 500));
    }
  });
  
  // QR code generation for ticket
  app.get("/api/tickets/:id/qr", requireRole(["customer", "eventManager", "admin"]), async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.id);
      
      // Generate or retrieve QR code
      const qrCodeUrl = await storage.generateTicketQR(ticketId);
      
      res.json(successResponse({ qrCode: qrCodeUrl }, 200, "QR code generated successfully"));
    } catch (error) {
      console.error("Error generating QR code:", error);
      res.status(500).json(errorResponse("Failed to generate QR code", 500));
    }
  });

  // Ticket validation - requires event manager or admin role
  app.post("/api/tickets/:id/validate", requireRole(["eventManager", "admin"]), async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.id);
      const isValid = await storage.validateTicket(ticketId);
      
      if (isValid) {
        res.json(successResponse({ valid: true }, 200, "Ticket successfully validated"));
      } else {
        res.json(successResponse({ valid: false }, 200, "Ticket already used or invalid"));
      }
    } catch (error) {
      console.error("Error validating ticket:", error);
      res.status(500).json(errorResponse("Failed to validate ticket", 500));
    }
  });
  
  // Apple Wallet pass generation
  app.get("/api/wallet/pass", async (req: Request, res: Response) => {
    try {
      const { ticketId, eventId, ticketTypeId, timestamp, signature } = req.query;
      
      if (!ticketId || !eventId || !ticketTypeId || !timestamp || !signature) {
        return res.status(400).json(errorResponse("Missing required parameters", 400));
      }
      
      // Verify signature to ensure the link is valid and hasn't been tampered with
      const expectedSignature = Buffer.from(`${ticketId}-${timestamp}`).toString('base64');
      if (signature !== expectedSignature) {
        return res.status(403).json(errorResponse("Invalid wallet pass request", 403));
      }
      
      // In production, we'd generate an actual .pkpass file here
      // For this demo, create an HTML page that simulates a wallet pass
      const ticket = await storage.getTicket(Number(ticketId));
      const event = await storage.getEvent(Number(eventId));
      const ticketType = await storage.getTicketType(Number(ticketTypeId));
      
      if (!ticket || !event || !ticketType) {
        return res.status(404).json(errorResponse("Ticket, event, or ticket type not found", 404));
      }
      
      // Generate QR code for the ticket if it doesn't have one
      const qrCodeUrl = ticket.qrCode || await storage.generateTicketQR(Number(ticketId));
      
      // Generate a simple HTML "pass" as a demo
      const walletPassHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Ticket - ${event.title}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            max-width: 400px;
            margin: 0 auto;
            padding: 0;
            background-color: #000;
            color: white;
          }
          .ticket {
            background: linear-gradient(135deg, #6366F1 0%, #EC4899 100%);
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 10px 25px rgba(0,0,0,0.3);
            margin: 20px;
          }
          .ticket-header {
            padding: 20px;
            text-align: center;
            border-bottom: 1px dashed rgba(255,255,255,0.3);
          }
          .ticket-body {
            padding: 20px;
          }
          .ticket-footer {
            background-color: rgba(0,0,0,0.2);
            padding: 15px 20px;
            text-align: center;
          }
          h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 700;
          }
          p {
            margin: 8px 0;
            font-size: 14px;
          }
          .qr-code {
            text-align: center;
            padding: 20px 0;
          }
          .qr-code img {
            max-width: 180px;
            border: 8px solid white;
            border-radius: 8px;
          }
          .apple-wallet-badge {
            display: block;
            margin: 30px auto;
            max-width: 180px;
          }
          .event-info {
            display: flex;
            justify-content: space-between;
            margin: 20px 0;
            font-size: 16px;
          }
          .event-info div {
            text-align: center;
            flex: 1;
          }
          .label {
            font-size: 12px;
            text-transform: uppercase;
            opacity: 0.7;
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="ticket-header">
            <h1>${event.title}</h1>
            <p>${new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <div class="ticket-body">
            <div class="event-info">
              <div>
                <div class="label">Location</div>
                <div>${event.location.split(',')[0]}</div>
              </div>
              <div>
                <div class="label">Time</div>
                <div>${new Date(event.startDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div>
                <div class="label">Ticket</div>
                <div>${ticketType.name}</div>
              </div>
            </div>
            <div class="qr-code">
              <img src="${qrCodeUrl}" alt="Ticket QR Code">
            </div>
          </div>
          <div class="ticket-footer">
            <p>Ticket #: ${ticket.id}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}</p>
            <p>Present this ticket at the entrance</p>
          </div>
        </div>
        <p style="text-align: center; color: #888; font-size: 12px;">
          This is a simulated wallet pass for demonstration purposes.
        </p>
      </body>
      </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      res.send(walletPassHtml);
    } catch (error) {
      console.error("Error generating Apple Wallet pass:", error);
      res.status(500).json(errorResponse("Failed to generate wallet pass", 500));
    }
  });
  
  // Google Pay pass generation (similar to Apple Wallet but with Google Pay branding)
  app.get("/api/wallet/gpay", async (req: Request, res: Response) => {
    try {
      const { ticketId, eventId, ticketTypeId, timestamp, signature } = req.query;
      
      if (!ticketId || !eventId || !ticketTypeId || !timestamp || !signature) {
        return res.status(400).json(errorResponse("Missing required parameters", 400));
      }
      
      // Verify signature to ensure the link is valid and hasn't been tampered with
      const expectedSignature = Buffer.from(`${ticketId}-${timestamp}-gpay`).toString('base64');
      if (signature !== expectedSignature) {
        return res.status(403).json(errorResponse("Invalid wallet pass request", 403));
      }
      
      // In production, we'd generate an actual Google Pay pass here
      // For this demo, create an HTML page that simulates a Google Pay pass
      const ticket = await storage.getTicket(Number(ticketId));
      const event = await storage.getEvent(Number(eventId));
      const ticketType = await storage.getTicketType(Number(ticketTypeId));
      
      if (!ticket || !event || !ticketType) {
        return res.status(404).json(errorResponse("Ticket, event, or ticket type not found", 404));
      }
      
      // Generate QR code for the ticket if it doesn't have one
      const qrCodeUrl = ticket.qrCode || await storage.generateTicketQR(Number(ticketId));
      
      // Generate a simple HTML "pass" as a demo (with Google Pay styling)
      const googlePayPassHtml = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Event Ticket - ${event.title}</title>
        <style>
          body {
            font-family: 'Roboto', sans-serif;
            max-width: 400px;
            margin: 0 auto;
            padding: 0;
            background-color: #f8f9fa;
            color: #202124;
          }
          .ticket {
            background: white;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 4px 8px rgba(0,0,0,0.1);
            margin: 20px;
          }
          .ticket-header {
            background-color: #4285F4;
            color: white;
            padding: 20px;
            text-align: center;
          }
          .ticket-body {
            padding: 20px;
          }
          .ticket-footer {
            background-color: #f1f3f4;
            padding: 15px 20px;
            text-align: center;
            border-top: 1px solid #dadce0;
          }
          h1 {
            margin: 0;
            font-size: 24px;
            font-weight: 500;
          }
          p {
            margin: 8px 0;
            font-size: 14px;
          }
          .qr-code {
            text-align: center;
            padding: 20px 0;
          }
          .qr-code img {
            max-width: 180px;
            border: 1px solid #dadce0;
            border-radius: 4px;
            padding: 8px;
          }
          .google-pay-badge {
            display: block;
            margin: 30px auto;
            max-width: 180px;
          }
          .event-info {
            display: flex;
            justify-content: space-between;
            margin: 20px 0;
            font-size: 16px;
          }
          .event-info div {
            text-align: center;
            flex: 1;
          }
          .label {
            font-size: 12px;
            text-transform: uppercase;
            color: #5f6368;
          }
        </style>
      </head>
      <body>
        <div class="ticket">
          <div class="ticket-header">
            <h1>${event.title}</h1>
            <p>${new Date(event.startDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
          </div>
          <div class="ticket-body">
            <div class="event-info">
              <div>
                <div class="label">Location</div>
                <div>${event.location.split(',')[0]}</div>
              </div>
              <div>
                <div class="label">Time</div>
                <div>${new Date(event.startDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</div>
              </div>
              <div>
                <div class="label">Ticket</div>
                <div>${ticketType.name}</div>
              </div>
            </div>
            <div class="qr-code">
              <img src="${qrCodeUrl}" alt="Ticket QR Code">
            </div>
          </div>
          <div class="ticket-footer">
            <p>Ticket #: ${ticket.id}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}</p>
            <p>Present this ticket at the entrance</p>
          </div>
        </div>
        <p style="text-align: center; color: #5f6368; font-size: 12px;">
          This is a simulated Google Pay pass for demonstration purposes.
        </p>
      </body>
      </html>
      `;
      
      res.setHeader('Content-Type', 'text/html');
      res.send(googlePayPassHtml);
    } catch (error) {
      console.error("Error generating Google Pay pass:", error);
      res.status(500).json(errorResponse("Failed to generate wallet pass", 500));
    }
  });

  // Admin API endpoints
  app.get("/api/admin/users", requireRole(["admin"]), async (req: Request, res: Response) => {
    try {
      // Get all users from the database via a raw SQL query since storage doesn't offer this method
      const result = await db.execute("SELECT * FROM users");
      // Extract the rows array from the query result object
      const users = Array.isArray(result.rows) ? result.rows : [];
      res.json(successResponse(users, 200, "Users retrieved successfully"));
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json(errorResponse("Failed to fetch users", 500));
    }
  });
  
  app.post("/api/admin/users", requireRole(["admin"]), async (req: Request, res: Response) => {
    try {
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(req.body.username);
      
      if (existingUser) {
        return res.status(400).json(errorResponse("Username already exists", 400));
      }
      
      // Create new user
      const newUser = await storage.createUser({
        username: req.body.username,
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        role: req.body.role,
      });
      
      res.status(201).json(successResponse(newUser, 201, "User created successfully"));
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json(errorResponse("Failed to create user", 500));
    }
  });
  
  app.put("/api/admin/users/:id", requireRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if the user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json(errorResponse("User not found", 404));
      }
      
      // Update the user
      const updatedUser = await storage.updateUser(userId, req.body);
      res.json(successResponse(updatedUser, 200, "User updated successfully"));
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json(errorResponse(error.message || "Failed to update user", 500));
    }
  });
  
  app.delete("/api/admin/users/:id", requireRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json(errorResponse("User not found", 404));
      }
      
      // Protect the main admin users
      if (existingUser.role === "admin" && (userId === 5 || userId === 10)) {
        return res.status(403).json(errorResponse("Cannot delete the main admin user", 403));
      }
      
      // Delete the user
      const success = await storage.deleteUser(userId);
      
      if (success) {
        res.json(successResponse(null, 200, "User deleted successfully"));
      } else {
        res.status(500).json(errorResponse("Failed to delete user", 500));
      }
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json(errorResponse(error.message || "Failed to delete user", 500));
    }
  });
  
  app.get("/api/admin/events", requireRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const events = await storage.getEvents();
      res.json(successResponse(events, 200, "Events retrieved successfully"));
    } catch (error: any) {
      console.error("Error fetching events:", error);
      res.status(500).json(errorResponse("Failed to fetch events", 500));
    }
  });

  // ===== Venue Management Routes (Center Role) =====
  
  // Get all venues owned by current center
  app.get("/api/venues", requireRole(["center", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      // For center users, only show their own venues
      // For admins, show all venues
      const venues = req.user.role === "center" 
        ? await storage.getVenues(req.user.id)  
        : await storage.getVenues();
        
      res.json(successResponse(venues, 200, "Venues retrieved successfully"));
    } catch (error) {
      console.error("Error fetching venues:", error);
      res.status(500).json(errorResponse("Error fetching venues", 500));
    }
  });
  
  // Get a specific venue by ID
  app.get("/api/venues/:id", requireRole(["center", "admin", "customer"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const venueId = parseInt(req.params.id);
      const venue = await storage.getVenue(venueId);
      
      if (!venue) {
        return res.status(404).json(errorResponse("Venue not found", 404));
      }
      
      // Check permissions - centers can only view their own venues
      if (req.user.role === "center" && venue.ownerId !== req.user.id) {
        return res.status(403).json(errorResponse("You don't have permission to view this venue", 403));
      }
      
      res.json(successResponse(venue, 200, "Venue retrieved successfully"));
    } catch (error) {
      console.error("Error fetching venue:", error);
      res.status(500).json(errorResponse("Error fetching venue", 500));
    }
  });
  
  // Create a new venue
  app.post("/api/venues", requireRole(["center"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      // Validate venue data
      const venueData = schema.insertVenueSchema.parse({
        ...req.body,
        ownerId: req.user.id // Set the logged-in center as the owner
      });
      
      const venue = await storage.createVenue(venueData);
      res.status(201).json(successResponse(venue, 201, "Venue created successfully"));
    } catch (error) {
      console.error("Error creating venue:", error);
      
      if (error instanceof ZodError) {
        return res.status(400).json(errorResponse("Invalid venue data", 400, { errors: error.errors }));
      }
      
      res.status(500).json(errorResponse("Error creating venue", 500));
    }
  });
  
  // Update a venue
  app.put("/api/venues/:id", requireRole(["center"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const venueId = parseInt(req.params.id);
      const venue = await storage.getVenue(venueId);
      
      if (!venue) {
        return res.status(404).json({ message: "Venue not found" });
      }
      
      // Check ownership - centers can only update their own venues
      if (venue.ownerId !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to update this venue" });
      }
      
      // Validate venue update data - since we can't use .partial() on a transformed schema,
      // we'll create a simplified validation for updates
      const venueData = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional().nullable(),
        location: z.string().min(1).optional(),
        capacity: z.number().optional().nullable(),
        hourlyRate: z.coerce.number().min(0.01).optional().transform(val => val ? String(val) : undefined),
        dailyRate: z.coerce.number().optional().nullable().transform(val => val !== null ? String(val) : null),
        facilities: z.any().optional(),
        availabilityHours: z.any().optional(),
        images: z.any().optional(),
        isActive: z.boolean().optional()
      }).parse(req.body);
      
      const updatedVenue = await storage.updateVenue(venueId, venueData);
      res.json(updatedVenue);
    } catch (error) {
      console.error("Error updating venue:", error);
      
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Invalid venue data", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Error updating venue" });
    }
  });
  
  // Delete a venue
  app.delete("/api/venues/:id", requireRole(["center"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const venueId = parseInt(req.params.id);
      const venue = await storage.getVenue(venueId);
      
      if (!venue) {
        return res.status(404).json({ message: "Venue not found" });
      }
      
      // Check ownership - centers can only delete their own venues
      if (venue.ownerId !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to delete this venue" });
      }
      
      // Check if venue has active rentals
      const rentals = await storage.getRentals({ venueId });
      const activeRentals = rentals.filter(r => r.status !== "canceled" && r.status !== "completed");
      
      if (activeRentals.length > 0) {
        return res.status(400).json({ 
          message: "Cannot delete venue with active rentals. Cancel all rentals first." 
        });
      }
      
      await storage.deleteVenue(venueId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting venue:", error);
      res.status(500).json({ message: "Error deleting venue" });
    }
  });
  
  // ===== Rental Management Routes =====
  
  // Get rentals with various filters
  app.get("/api/rentals", requireRole(["center", "admin", "customer"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const filters: any = {};
      
      // Parse query parameters
      if (req.query.venueId) {
        filters.venueId = parseInt(req.query.venueId as string);
      }
      
      if (req.query.startDate) {
        filters.startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        filters.endDate = new Date(req.query.endDate as string);
      }
      
      if (req.query.status && schema.RENTAL_STATUS.includes(req.query.status as any)) {
        filters.status = req.query.status;
      }
      
      // Apply role-based filtering
      if (req.user.role === "center") {
        // Centers can only see rentals for their venues
        filters.centerId = req.user.id;
      } else if (req.user.role === "customer") {
        // Note: customerName is a direct string field, so we can't directly 
        // filter by user ID anymore. Customers will see all rentals for now.
      }
      // Admins can see all rentals
      
      const rentals = await storage.getRentals(filters);
      res.json(rentals);
    } catch (error) {
      console.error("Error fetching rentals:", error);
      res.status(500).json({ message: "Error fetching rentals" });
    }
  });
  
  // Get a specific rental
  app.get("/api/rentals/:id", requireRole(["center", "admin", "customer"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const rentalId = parseInt(req.params.id);
      const rental = await storage.getRental(rentalId);
      
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      
      // Get venue details to check permission
      const venue = await storage.getVenue(rental.venueId);
      
      if (!venue) {
        return res.status(404).json({ message: "Venue not found" });
      }
      
      // Check permissions - only center role needs checking now
      // as we can't check by customerId anymore (it's now a text field)
      if (req.user.role === "center" && venue.ownerId !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to view this rental" });
      }
      
      res.json(rental);
    } catch (error) {
      console.error("Error fetching rental:", error);
      res.status(500).json({ message: "Error fetching rental" });
    }
  });
  
  // Create a new rental
  app.post("/api/rentals", requireRole(["center", "admin", "customer"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      // Calculate total price based on duration and hourly rate
      const venue = await storage.getVenue(req.body.venueId);
      
      if (!venue) {
        return res.status(404).json({ message: "Venue not found" });
      }
      
      const startTime = new Date(req.body.startTime);
      const endTime = new Date(req.body.endTime);
      
      // Validate dates
      if (startTime >= endTime) {
        return res.status(400).json({ message: "End time must be after start time" });
      }
      
      if (startTime < new Date()) {
        return res.status(400).json({ message: "Start time cannot be in the past" });
      }
      
      // Calculate duration in hours
      const durationMs = endTime.getTime() - startTime.getTime();
      const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));
      
      // Calculate price
      const totalPrice = durationHours * Number(venue.hourlyRate);
      
      // Get the customer name from the form or use the current user's name
      let customerName = req.body.customerName;
      if (!customerName || customerName.trim() === '') {
        customerName = req.user.name || req.user.username;
      }
      
      // Validate rental data
      const rentalData = schema.createRentalSchema.parse({
        ...req.body,
        customerName,
        totalPrice: totalPrice.toString(),
        // Use provided status and paymentStatus or defaults
        status: req.body.status || "pending",
        paymentStatus: req.body.paymentStatus || "unpaid"
      });
      
      const rental = await storage.createRental(rentalData);
      res.status(201).json(rental);
    } catch (error) {
      console.error("Error creating rental:", error);
      
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Invalid rental data", 
          errors: error.errors 
        });
      }
      
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Error creating rental" });
    }
  });
  
  // Update rental status (centers only)
  app.patch("/api/rentals/:id/status", requireRole(["center", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const rentalId = parseInt(req.params.id);
      const status = req.body.status;
      
      // Validate status
      if (!schema.RENTAL_STATUS.includes(status)) {
        return res.status(400).json({ message: "Invalid rental status" });
      }
      
      const rental = await storage.getRental(rentalId);
      
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      
      // Get venue details to check permission
      const venue = await storage.getVenue(rental.venueId);
      
      if (!venue) {
        return res.status(404).json({ message: "Venue not found" });
      }
      
      // Check permissions for center users
      if (req.user.role === "center" && venue.ownerId !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to update this rental" });
      }
      
      const updatedRental = await storage.updateRentalStatus(rentalId, status);
      res.json(updatedRental);
    } catch (error) {
      console.error("Error updating rental status:", error);
      res.status(500).json({ message: "Error updating rental status" });
    }
  });
  
  // Update payment status (centers only)
  app.patch("/api/rentals/:id/payment", requireRole(["center", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const rentalId = parseInt(req.params.id);
      const paymentStatus = req.body.paymentStatus;
      
      // Validate payment status
      if (!schema.PAYMENT_STATUS.includes(paymentStatus)) {
        return res.status(400).json({ message: "Invalid payment status" });
      }
      
      const rental = await storage.getRental(rentalId);
      
      if (!rental) {
        return res.status(404).json({ message: "Rental not found" });
      }
      
      // Get venue details to check permission
      const venue = await storage.getVenue(rental.venueId);
      
      if (!venue) {
        return res.status(404).json({ message: "Venue not found" });
      }
      
      // Check permissions for center users
      if (req.user.role === "center" && venue.ownerId !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to update this rental" });
      }
      
      const updatedRental = await storage.updatePaymentStatus(rentalId, paymentStatus);
      res.json(updatedRental);
    } catch (error) {
      console.error("Error updating payment status:", error);
      res.status(500).json({ message: "Error updating payment status" });
    }
  });
  
  // Email verification route
  app.get("/api/verify-email", async (req: Request, res: Response) => {
    try {
      const { token } = req.query;
      
      if (!token || typeof token !== 'string') {
        return res.status(400).json({ message: "Invalid verification token" });
      }
      
      const verified = await storage.verifyEmail(token);
      
      if (verified) {
        return res.status(200).json({ message: "Email verified successfully" });
      } else {
        return res.status(400).json({ message: "Invalid or expired verification token" });
      }
    } catch (error) {
      console.error("Error verifying email:", error);
      return res.status(500).json({ message: "Server error during email verification" });
    }
  });
  
  // Request password reset route
  app.post("/api/forgot-password", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const user = await storage.getUserByEmail(email);
      
      if (!user) {
        // For security reasons, don't reveal that the email doesn't exist
        return res.status(200).json({ message: "If the email exists, a password reset link has been sent" });
      }
      
      const resetToken = await storage.createPasswordResetToken(email);
      
      if (resetToken) {
        // Send password reset email
        await sendPasswordResetEmail({
          username: user.username,
          email: user.email,
          name: user.name,
          resetToken
        });
      }
      
      return res.status(200).json({ message: "If the email exists, a password reset link has been sent" });
    } catch (error) {
      console.error("Error requesting password reset:", error);
      return res.status(500).json({ message: "Server error during password reset request" });
    }
  });
  
  // Reset password route
  app.post("/api/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }
      
      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      
      const resetSuccess = await storage.resetPassword(token, newPassword);
      
      if (resetSuccess) {
        return res.status(200).json({ message: "Password reset successful" });
      } else {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
    } catch (error) {
      console.error("Error resetting password:", error);
      return res.status(500).json({ message: "Server error during password reset" });
    }
  });
  
  // Resend verification email
  app.post("/api/resend-verification", requireRole(["customer", "eventManager", "admin", "center"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      // Check if email already verified
      if (req.user.emailVerified) {
        return res.status(400).json(errorResponse("Email already verified", 400));
      }
      
      // Create new verification token
      const token = await storage.createVerificationToken(req.user.id);
      
      // Send verification email
      await sendVerificationEmail({
        username: req.user.username,
        email: req.user.email,
        name: req.user.name,
        verificationToken: token
      });
      
      return res.status(200).json(successResponse(null, 200, "Verification email resent"));
    } catch (error) {
      console.error("Error resending verification email:", error);
      return res.status(500).json(errorResponse("Server error during email verification", 500));
    }
  });

  // ===== Event Sharing Routes =====
  
  // Track event shares
  app.post("/api/events/:id/share", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      const { platform } = req.body;
      
      // Validate that the event exists
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json(errorResponse("Event not found", 404));
      }
      
      // Create the share data
      const shareData = {
        eventId,
        platform,
        // Track user if authenticated
        userId: req.isAuthenticated() ? req.user.id : null,
        // Additional tracking data
        userAgent: req.headers['user-agent'] || null,
        ipAddress: req.ip || null,
        referer: req.headers.referer || null
      };
      
      // Track the share using our storage method
      const share = await storage.trackEventShare(shareData);
      
      return res.status(201).json(successResponse(share, 201, "Share tracked successfully"));
    } catch (error) {
      console.error("Error tracking event share:", error);
      return res.status(500).json(errorResponse("Error tracking event share", 500));
    }
  });
  
  // Get event share counts - for analytics dashboards
  app.get("/api/events/:id/shares", requireRole(["eventManager", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const eventId = parseInt(req.params.id);
      
      // Validate that the event exists
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json(errorResponse("Event not found", 404));
      }
      
      // Check if user has permission (event managers can only view their own events)
      if (req.user.role === "eventManager" && event.organizer !== req.user.id) {
        return res.status(403).json(errorResponse("You don't have permission to view share analytics for this event", 403));
      }
      
      // Get share analytics from storage
      const shareData = await storage.getEventShareAnalytics(eventId);
      
      return res.status(200).json(successResponse(shareData, 200, "Share analytics retrieved successfully"));
    } catch (error) {
      console.error("Error retrieving event share analytics:", error);
      return res.status(500).json(errorResponse("Error retrieving event share analytics", 500));
    }
  });
  
  // Venue Sales Report endpoint
  app.get("/api/venues/sales-report", requireRole(["center", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      // Parse query parameters
      let venueId: number | undefined = undefined;
      let startDate: Date | undefined = undefined;
      let endDate: Date | undefined = undefined;
      
      if (req.query.venueId) {
        venueId = parseInt(req.query.venueId as string);
      }
      
      if (req.query.startDate) {
        startDate = new Date(req.query.startDate as string);
      }
      
      if (req.query.endDate) {
        endDate = new Date(req.query.endDate as string);
      }
      
      // If center role, ensure they can only see their own venues
      if (req.user.role === "center" && venueId) {
        const venue = await storage.getVenue(venueId);
        if (!venue || venue.ownerId !== req.user.id) {
          return res.status(403).json(errorResponse(
            "You don't have permission to view sales for this venue", 
            403
          ));
        }
      }
      
      // Get sales report
      const salesReport = await optimizedStorage.getVenueSalesReport(venueId, startDate, endDate);
      
      return res.status(200).json(successResponse(
        salesReport, 
        200, 
        "Venue sales report retrieved successfully"
      ));
    } catch (error) {
      console.error('Error generating venue sales report:', error);
      return res.status(500).json(errorResponse(
        "Error generating venue sales report", 
        500
      ));
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
