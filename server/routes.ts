import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
import { db } from "./db";
import { eq } from "drizzle-orm";

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

  // Get tickets for an event (for event managers)
  app.get("/api/events/:id/tickets", requireRole(["eventManager", "admin"]), async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      
      // Check if event exists
      const event = await storage.getEvent(eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Ensure user is authenticated
      ensureAuthenticated(req);
      
      // Verify the user has permission (is admin or the event organizer)
      if (req.user.role !== 'admin' && event.organizer !== req.user.id) {
        return res.status(403).json({ message: "You do not have permission to view tickets for this event" });
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
      
      return res.json(ticketsWithDetails);
    } catch (err) {
      console.error("Error fetching event tickets:", err);
      return res.status(500).json({ message: "Failed to fetch event tickets" });
    }
  });
  
  // Delete a ticket (for event managers)
  app.delete("/api/tickets/:id", requireRole(["eventManager", "admin"]), async (req: Request, res: Response) => {
    try {
      const ticketId = parseInt(req.params.id);
      
      // Get the ticket to ensure it exists and to get the event ID
      const ticket = await storage.getTicket(ticketId);
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      
      // Get the event to check permissions
      const event = await storage.getEvent(ticket.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      
      // Ensure user is authenticated
      ensureAuthenticated(req);
      
      // Verify the user has permission (is admin or the event organizer)
      if (req.user.role !== 'admin' && event.organizer !== req.user.id) {
        return res.status(403).json({ message: "You do not have permission to delete tickets for this event" });
      }
      
      // Delete the ticket
      await storage.removeTicket(ticketId);
      
      return res.status(200).json({ message: "Ticket successfully removed" });
    } catch (err) {
      console.error("Error removing ticket:", err);
      return res.status(500).json({ message: "Failed to remove ticket" });
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
  
  // Apple Wallet pass generation
  app.get("/api/wallet/pass", async (req: Request, res: Response) => {
    try {
      const { ticketId, eventId, ticketTypeId, timestamp, signature } = req.query;
      
      if (!ticketId || !eventId || !ticketTypeId || !timestamp || !signature) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      // Verify signature to ensure the link is valid and hasn't been tampered with
      const expectedSignature = Buffer.from(`${ticketId}-${timestamp}`).toString('base64');
      if (signature !== expectedSignature) {
        return res.status(403).json({ message: "Invalid wallet pass request" });
      }
      
      // In production, we'd generate an actual .pkpass file here
      // For this demo, create an HTML page that simulates a wallet pass
      const ticket = await storage.getTicket(Number(ticketId));
      const event = await storage.getEvent(Number(eventId));
      const ticketType = await storage.getTicketType(Number(ticketTypeId));
      
      if (!ticket || !event || !ticketType) {
        return res.status(404).json({ message: "Ticket, event, or ticket type not found" });
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
      res.status(500).json({ message: "Failed to generate wallet pass" });
    }
  });
  
  // Google Pay pass generation (similar to Apple Wallet but with Google Pay branding)
  app.get("/api/wallet/gpay", async (req: Request, res: Response) => {
    try {
      const { ticketId, eventId, ticketTypeId, timestamp, signature } = req.query;
      
      if (!ticketId || !eventId || !ticketTypeId || !timestamp || !signature) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      // Verify signature to ensure the link is valid and hasn't been tampered with
      const expectedSignature = Buffer.from(`${ticketId}-${timestamp}-gpay`).toString('base64');
      if (signature !== expectedSignature) {
        return res.status(403).json({ message: "Invalid wallet pass request" });
      }
      
      // In production, we'd generate an actual Google Pay pass here
      // For this demo, create an HTML page that simulates a Google Pay pass
      const ticket = await storage.getTicket(Number(ticketId));
      const event = await storage.getEvent(Number(eventId));
      const ticketType = await storage.getTicketType(Number(ticketTypeId));
      
      if (!ticket || !event || !ticketType) {
        return res.status(404).json({ message: "Ticket, event, or ticket type not found" });
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
      res.status(500).json({ message: "Failed to generate wallet pass" });
    }
  });

  // Admin API endpoints
  app.get("/api/admin/users", requireRole(["admin"]), async (req: Request, res: Response) => {
    try {
      // Get all users from the database via a raw SQL query since storage doesn't offer this method
      const result = await db.execute("SELECT * FROM users");
      // Extract the rows array from the query result object
      res.json(Array.isArray(result.rows) ? result.rows : []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });
  
  app.post("/api/admin/users", requireRole(["admin"]), async (req: Request, res: Response) => {
    try {
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(req.body.username);
      
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Create new user
      const newUser = await storage.createUser({
        username: req.body.username,
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        role: req.body.role,
      });
      
      res.status(201).json(newUser);
    } catch (error: any) {
      console.error("Error creating user:", error);
      res.status(500).json({ message: "Failed to create user" });
    }
  });
  
  app.put("/api/admin/users/:id", requireRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if the user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Update the user
      const updatedUser = await storage.updateUser(userId, req.body);
      res.json(updatedUser);
    } catch (error: any) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: error.message || "Failed to update user" });
    }
  });
  
  app.delete("/api/admin/users/:id", requireRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Protect the main admin users
      if (existingUser.role === "admin" && (userId === 5 || userId === 10)) {
        return res.status(403).json({ message: "Cannot delete the main admin user" });
      }
      
      // Delete the user
      const success = await storage.deleteUser(userId);
      
      if (success) {
        res.json({ message: "User deleted successfully" });
      } else {
        res.status(500).json({ message: "Failed to delete user" });
      }
    } catch (error: any) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: error.message || "Failed to delete user" });
    }
  });
  
  app.get("/api/admin/events", requireRole(["admin"]), async (req: Request, res: Response) => {
    try {
      const events = await storage.getEvents();
      res.json(events);
    } catch (error: any) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
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
        
      res.json(venues);
    } catch (error) {
      console.error("Error fetching venues:", error);
      res.status(500).json({ message: "Error fetching venues" });
    }
  });
  
  // Get a specific venue by ID
  app.get("/api/venues/:id", requireRole(["center", "admin", "customer"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const venueId = parseInt(req.params.id);
      const venue = await storage.getVenue(venueId);
      
      if (!venue) {
        return res.status(404).json({ message: "Venue not found" });
      }
      
      // Check permissions - centers can only view their own venues
      if (req.user.role === "center" && venue.ownerId !== req.user.id) {
        return res.status(403).json({ message: "You don't have permission to view this venue" });
      }
      
      res.json(venue);
    } catch (error) {
      console.error("Error fetching venue:", error);
      res.status(500).json({ message: "Error fetching venue" });
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
      res.status(201).json(venue);
    } catch (error) {
      console.error("Error creating venue:", error);
      
      if (error instanceof ZodError) {
        return res.status(400).json({ 
          message: "Invalid venue data", 
          errors: error.errors 
        });
      }
      
      res.status(500).json({ message: "Error creating venue" });
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
        // Customers can only see their own rentals
        filters.customerId = req.user.id;
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
      
      // Check permissions
      if (
        (req.user.role === "center" && venue.ownerId !== req.user.id) ||
        (req.user.role === "customer" && rental.customerId !== req.user.id)
      ) {
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
      
      // Set the current user as the customer
      const customerId = req.user.id;
      
      // Validate rental data
      const rentalData = schema.createRentalSchema.parse({
        ...req.body,
        customerId,
        totalPrice: totalPrice.toString(),
        status: "pending",
        paymentStatus: "unpaid"
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

  const httpServer = createServer(app);
  return httpServer;
}
