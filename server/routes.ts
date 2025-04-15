import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
// Import optimized storage instead of standard storage
import { optimizedStorage as storage } from "./optimized-storage"; 
import { 
  createEventSchema, 
  insertUserSchema, 
  purchaseTicketSchema,
  eventSearchSchema,
  users as usersSchema,
  PurchaseTicketInput
} from "@shared/schema";
import * as schema from "@shared/schema";
import { ZodError, z } from "zod";
import { setupAuth, requireRole } from "./auth";
import { generateAppleWalletPassUrl, generateGooglePayPassUrl } from "./wallet";
import { 
  sendVerificationEmail, 
  sendPasswordResetEmail,
  sendTicketConfirmationEmail,
  sendCashierInvitationEmail
} from "./email";
import { db } from "./db";
import { eq } from "drizzle-orm";
import { successResponse, errorResponse } from "./utils/api-response";
import { sql } from "drizzle-orm";
import thawaniService, { 
  CustomerDetails, 
  ProductDetails 
} from "./thawani";
// Import routes
import subscriptionRoutes from './routes/subscription-routes';

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
        return { data: null, error: error.format() };
      }
      return { data: null, error: "Validation failed" };
    }
  };

  // Add all your routes here...
  
  // Venues API endpoints
  app.get("/api/venues", requireRole(["center", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      // Get all venues for the center user
      let venues;
      if (req.user.role === "center") {
        venues = await storage.getVenues(req.user.id);
      } else {
        // Admin sees all venues
        venues = await storage.getVenues();
      }
      
      return res.json(successResponse(venues, 200, "Venues retrieved successfully"));
    } catch (error) {
      console.error("Error retrieving venues:", error);
      return res.status(500).json(errorResponse("Error retrieving venues", 500));
    }
  });
  
  // Create venue endpoint
  app.post("/api/venues", requireRole(["center", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      // Validate request body
      // For center users, enforce their ID as owner
      if (req.user.role === "center") {
        req.body.ownerId = req.user.id;
      }
      
      try {
        const venue = await storage.createVenue(req.body);
        return res.status(201).json(successResponse(venue, 201, "Venue created successfully"));
      } catch (error: any) {
        console.error("Error creating venue:", error);
        
        if (error.message?.includes("Zod")) {
          return res.status(400).json(errorResponse("Invalid venue data: " + error.message, 400));
        }
        
        return res.status(500).json(errorResponse("Error creating venue: " + error.message, 500));
      }
    } catch (error) {
      console.error("Error creating venue:", error);
      return res.status(500).json(errorResponse("Error creating venue", 500));
    }
  });

  // Venue Sales Report endpoint - IMPORTANT: placing this first to avoid route conflicts
  app.get("/api/venues/sales-report", requireRole(["center", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      // Parse query parameters
      let venueId: number | undefined = undefined;
      
      if (req.query.venueId) {
        // Convert 'all' to undefined for proper handling
        if (req.query.venueId === 'all') {
          venueId = undefined;
          console.log("Processing report for all venues");
        } else {
          // Parse and validate venueId
          const parsedId = parseInt(req.query.venueId as string);
          if (!isNaN(parsedId) && parsedId > 0) {
            venueId = parsedId;
            console.log(`Processing report for venue ID: ${venueId}`);
          } else {
            console.log(`Invalid venue ID received: ${req.query.venueId}`);
            // Return empty report with an explanatory message
            return res.json(successResponse({
              totalRevenue: 0,
              completedBookings: 0,
              canceledBookings: 0,
              pendingPayments: 0,
              paidBookings: 0,
              refundedBookings: 0,
              averageBookingValue: 0,
              timeBreakdown: []
            }, 200, "Invalid venue ID"));
          }
        }
      } else {
        console.log("No venue ID provided, showing all venues");
      }
      
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
      
      // If venue ID is specified, verify ownership
      if (venueId) {
        try {
          const venue = await storage.getVenue(venueId);
          
          if (!venue) {
            console.log(`Venue not found: ${venueId}`);
            // Return empty report with a descriptive message
            return res.json(successResponse({
              totalRevenue: 0,
              completedBookings: 0,
              canceledBookings: 0,
              pendingPayments: 0,
              paidBookings: 0,
              refundedBookings: 0,
              averageBookingValue: 0,
              timeBreakdown: []
            }, 200, "No data found for this venue"));
          }
          
          // Check if center user has permission for this venue
          if (req.user.role === "center" && venue.ownerId !== req.user.id) {
            return res.status(403).json(errorResponse("You don't have permission to view this venue's reports", 403));
          }
          
          console.log(`Venue verified: ${venue.name} (ID: ${venue.id})`);
        } catch (error) {
          console.error("Error verifying venue ownership:", error);
          // Return empty report with error explanation
          return res.json(successResponse({
            totalRevenue: 0,
            completedBookings: 0,
            canceledBookings: 0,
            pendingPayments: 0,
            paidBookings: 0,
            refundedBookings: 0,
            averageBookingValue: 0,
            timeBreakdown: []
          }, 200, "Error retrieving venue information"));
        }
      }
      
      try {  
        // Generate the sales report from the storage layer
        const salesReport = await storage.getVenueSalesReport(
          venueId,
          startDate,
          endDate
        );
        
        return res.json(successResponse(salesReport, 200, "Venue sales report retrieved successfully"));
      } catch (dbError: any) {
        console.error("Database error generating sales report:", dbError);
        const errorMessage = dbError.message || "Unknown database error";
        return res.status(500).json(errorResponse(`Error generating sales report: ${errorMessage}`, 500));
      }
    } catch (error) {
      console.error('Error generating venue sales report:', error);
      return res.status(500).json(errorResponse("Error generating venue sales report", 500));
    }
  });
  
  app.get("/api/venues/:id", requireRole(["center", "admin", "customer"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const venueId = parseInt(req.params.id);
      if (isNaN(venueId)) {
        return res.status(400).json(errorResponse("Invalid venue ID", 400));
      }
      
      const venue = await storage.getVenue(venueId);
      
      if (!venue) {
        return res.status(404).json(errorResponse("Venue not found", 404));
      }
      
      // If user is a center, ensure they own this venue
      if (req.user.role === "center" && venue.ownerId !== req.user.id) {
        return res.status(403).json(errorResponse("You don't have permission to view this venue", 403));
      }
      
      return res.json(successResponse(venue, 200, "Venue retrieved successfully"));
    } catch (error) {
      console.error("Error retrieving venue:", error);
      return res.status(500).json(errorResponse("Error retrieving venue", 500));
    }
  });
  
  // Venue update endpoint
  app.patch("/api/venues/:id", requireRole(["center", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const venueId = parseInt(req.params.id);
      if (isNaN(venueId)) {
        return res.status(400).json(errorResponse("Invalid venue ID", 400));
      }
      
      // Get the venue to check ownership
      const venue = await storage.getVenue(venueId);
      
      if (!venue) {
        return res.status(404).json(errorResponse("Venue not found", 404));
      }
      
      // Check ownership unless admin
      if (req.user.role === "center" && venue.ownerId !== req.user.id) {
        return res.status(403).json(errorResponse("You don't have permission to edit this venue", 403));
      }
      
      // Perform the update
      try {
        const updatedVenue = await storage.updateVenue(venueId, req.body);
        return res.json(successResponse(updatedVenue, 200, "Venue updated successfully"));
      } catch (error: any) {
        console.error("Error updating venue:", error);
        
        if (error.message?.includes("Zod")) {
          return res.status(400).json(errorResponse("Invalid venue data: " + error.message, 400));
        }
        
        return res.status(500).json(errorResponse("Error updating venue", 500));
      }
    } catch (error) {
      console.error("Error updating venue:", error);
      return res.status(500).json(errorResponse("Error updating venue", 500));
    }
  });
  
  // Venue delete endpoint
  app.delete("/api/venues/:id", requireRole(["center", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const venueId = parseInt(req.params.id);
      if (isNaN(venueId)) {
        return res.status(400).json(errorResponse("Invalid venue ID", 400));
      }
      
      // Get the venue to check ownership
      const venue = await storage.getVenue(venueId);
      
      if (!venue) {
        return res.status(404).json(errorResponse("Venue not found", 404));
      }
      
      // Check ownership unless admin
      if (req.user.role === "center" && venue.ownerId !== req.user.id) {
        return res.status(403).json(errorResponse("You don't have permission to delete this venue", 403));
      }
      
      // Perform the delete
      try {
        await storage.deleteVenue(venueId);
        return res.json(successResponse(null, 200, "Venue deleted successfully"));
      } catch (error: any) {
        console.error("Error deleting venue:", error);
        return res.status(500).json(errorResponse("Error deleting venue: " + error.message, 500));
      }
    } catch (error) {
      console.error("Error deleting venue:", error);
      return res.status(500).json(errorResponse("Error deleting venue", 500));
    }
  });

  // Events API endpoints
  app.get("/api/events", async (req: Request, res: Response) => {
    try {
      // Parse and validate query parameters
      const { featured, category, search, dateFilter, priceFilter, minDate, maxDate, location, organizer, sortBy } = req.query;
      
      // Convert featured from string to boolean if present
      const featuredBool = featured === 'true' ? true : 
                          featured === 'false' ? false : undefined;
      
      // Convert organizer from string to number if present
      const organizerId = organizer ? parseInt(organizer as string) : undefined;
      
      // Prepare search options
      const searchOptions = {
        featured: featuredBool,
        category: category as string | undefined,
        search: search as string | undefined,
        dateFilter: dateFilter as string | undefined,
        priceFilter: priceFilter as string | undefined,
        minDate: minDate as string | undefined,
        maxDate: maxDate as string | undefined,
        location: location as string | undefined,
        organizer: !isNaN(organizerId as number) ? organizerId : undefined,
        sortBy: sortBy as 'date-asc' | 'date-desc' | 'price-asc' | 'price-desc' | undefined
      };
      
      // Get events from storage
      const events = await storage.getEvents(searchOptions);
      
      return res.json(successResponse(events, 200, "Events retrieved successfully"));
    } catch (error) {
      console.error("Error retrieving events:", error);
      return res.status(500).json(errorResponse("Error retrieving events", 500));
    }
  });
  
  // Get single event endpoint
  app.get("/api/events/:id", async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.id);
      if (isNaN(eventId)) {
        return res.status(400).json(errorResponse("Invalid event ID", 400));
      }
      
      const event = await storage.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json(errorResponse("Event not found", 404));
      }
      
      // Get ticket types for this event
      const ticketTypes = await storage.getTicketTypes(eventId);
      
      // Return event with ticket types
      return res.json(successResponse({...event, ticketTypes}, 200, "Event retrieved successfully"));
    } catch (error) {
      console.error("Error retrieving event:", error);
      return res.status(500).json(errorResponse("Error retrieving event", 500));
    }
  });
  
  // Create event endpoint
  app.post("/api/events", requireRole(["eventManager", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      // Validate event data
      const validation = validateRequest(createEventSchema, req.body);
      if (validation.error) {
        return res.status(400).json(errorResponse("Invalid event data", 400, validation.error));
      }
      
      // Set organizer to current user if not admin
      if (req.user.role !== "admin") {
        req.body.organizer = req.user.id;
      }
      
      try {
        const event = await storage.createEvent(req.body);
        return res.status(201).json(successResponse(event, 201, "Event created successfully"));
      } catch (error: any) {
        console.error("Error creating event:", error);
        return res.status(500).json(errorResponse("Error creating event: " + error.message, 500));
      }
    } catch (error) {
      console.error("Error creating event:", error);
      return res.status(500).json(errorResponse("Error creating event", 500));
    }
  });

  // === Thawani Payment Integration ===

  // Create payment session for ticket purchase
  app.post("/api/payments/tickets", requireRole(["customer", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const { eventId, ticketTypeIds, quantities, customer } = req.body;
      
      if (!eventId || !ticketTypeIds || !quantities || !customer) {
        return res.status(400).json(errorResponse("Missing required fields", 400));
      }
      
      // Get event details
      const event = await storage.getEvent(parseInt(eventId));
      if (!event) {
        return res.status(404).json(errorResponse("Event not found", 404));
      }
      
      // Get ticket types for this event
      const ticketTypes = await storage.getTicketTypes(parseInt(eventId));
      
      // Create payment session
      const paymentSession = await thawaniService.createTicketPaymentSession(
        event,
        ticketTypes,
        quantities,
        customer
      );
      
      if (!paymentSession) {
        return res.status(500).json(errorResponse("Failed to create payment session", 500));
      }
      
      return res.json(successResponse(paymentSession, 200, "Payment session created"));
    } catch (error) {
      console.error("Error creating ticket payment session:", error);
      return res.status(500).json(errorResponse("Error creating payment session", 500));
    }
  });
  
  // Create payment session for venue rental
  app.post("/api/payments/rentals", requireRole(["customer", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const { venueId, startTime, endTime, customer } = req.body;
      
      if (!venueId || !startTime || !endTime || !customer) {
        return res.status(400).json(errorResponse("Missing required fields", 400));
      }
      
      // Get venue details
      const venue = await storage.getVenue(parseInt(venueId));
      if (!venue) {
        return res.status(404).json(errorResponse("Venue not found", 404));
      }
      
      // Calculate rental hours
      const start = new Date(startTime);
      const end = new Date(endTime);
      
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json(errorResponse("Invalid date format", 400));
      }
      
      if (start >= end) {
        return res.status(400).json(errorResponse("End time must be after start time", 400));
      }
      
      // Calculate hours and total price
      const hours = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60));
      const totalPrice = parseFloat(venue.hourlyRate) * hours;
      
      // Create payment session
      const paymentSession = await thawaniService.createRentalPaymentSession(
        venue.id,
        venue.name,
        customer.firstName + " " + customer.lastName,
        totalPrice,
        start,
        end,
        customer
      );
      
      if (!paymentSession) {
        return res.status(500).json(errorResponse("Failed to create payment session", 500));
      }
      
      return res.json(successResponse(paymentSession, 200, "Payment session created"));
    } catch (error) {
      console.error("Error creating rental payment session:", error);
      return res.status(500).json(errorResponse("Error creating payment session", 500));
    }
  });
  
  // Check payment status
  app.get("/api/payments/status/:sessionId", async (req: Request, res: Response) => {
    try {
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json(errorResponse("Missing session ID", 400));
      }
      
      const status = await thawaniService.checkPaymentStatus(sessionId);
      
      return res.json(successResponse({ status }, 200, "Payment status retrieved"));
    } catch (error) {
      console.error("Error checking payment status:", error);
      return res.status(500).json(errorResponse("Error checking payment status", 500));
    }
  });
  
  // Payment success webhook
  app.post("/api/payments/webhook", async (req: Request, res: Response) => {
    try {
      const { session_id, metadata } = req.body;
      
      if (!session_id) {
        return res.status(400).json(errorResponse("Missing session ID", 400));
      }
      
      // Verify payment status with Thawani
      const status = await thawaniService.checkPaymentStatus(session_id);
      
      if (status !== 'paid') {
        return res.status(400).json(errorResponse("Payment not completed", 400));
      }
      
      // Get session details to extract metadata
      const sessionDetails = await thawaniService.getSessionDetails(session_id);
      
      if (!sessionDetails || !sessionDetails.metadata) {
        return res.status(400).json(errorResponse("Invalid session details", 400));
      }
      
      // Process the payment based on metadata
      if (sessionDetails.metadata.event_id) {
        // This is a ticket purchase
        const eventId = sessionDetails.metadata.event_id;
        const ticketDetails = sessionDetails.metadata.ticket_details;
        const customer = sessionDetails.metadata.customer;
        
        // Here you would create tickets in your database and send confirmation emails
        // This is a placeholder for the actual implementation
        console.log(`Processing ticket purchase for event ${eventId}`);
        console.log('Ticket details:', ticketDetails);
        console.log('Customer:', customer);
        
        // Return success
        return res.json(successResponse(null, 200, "Ticket purchase processed"));
      } else if (sessionDetails.metadata.venue_id) {
        // This is a venue rental
        const venueId = sessionDetails.metadata.venue_id;
        const startTime = new Date(sessionDetails.metadata.start_time);
        const endTime = new Date(sessionDetails.metadata.end_time);
        const customerName = sessionDetails.metadata.customer_name;
        
        // Here you would create a rental in your database and send confirmation emails
        // This is a placeholder for the actual implementation
        console.log(`Processing venue rental for venue ${venueId}`);
        console.log(`Time: ${startTime.toISOString()} - ${endTime.toISOString()}`);
        console.log(`Customer: ${customerName}`);
        
        // Return success
        return res.json(successResponse(null, 200, "Venue rental processed"));
      } else {
        return res.status(400).json(errorResponse("Unknown payment type", 400));
      }
    } catch (error) {
      console.error("Error processing payment webhook:", error);
      return res.status(500).json(errorResponse("Error processing payment", 500));
    }
  });
  
  // Get tickets by payment session ID
  app.get("/api/tickets/payment/:sessionId", requireRole(["customer", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const { sessionId } = req.params;
      
      if (!sessionId) {
        return res.status(400).json(errorResponse("Session ID is required", 400));
      }
      
      // Get tickets associated with this payment session
      const tickets = await storage.getTicketsByPaymentSession(sessionId);
      
      if (!tickets || tickets.length === 0) {
        return res.status(404).json(errorResponse("No tickets found for this payment session", 404));
      }
      
      return res.json(successResponse(tickets, 200, "Tickets retrieved successfully"));
    } catch (error) {
      console.error("Error retrieving tickets:", error);
      return res.status(500).json(errorResponse("Error retrieving tickets", 500));
    }
  });
  
  // Get cashiers for center owner
  app.get("/api/cashiers", requireRole(["center", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const ownerId = req.user.id;
      const cashiers = await storage.getCashiers(ownerId);
      
      return res.json(successResponse(cashiers, 200, "Cashiers retrieved successfully"));
    } catch (error) {
      console.error("Error retrieving cashiers:", error);
      return res.status(500).json(errorResponse("Error retrieving cashiers", 500));
    }
  });
  
  // Create a new cashier
  app.post("/api/cashiers", requireRole(["center", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const { email, name, permissions, venueIds } = req.body;
      
      if (!email) {
        return res.status(400).json(errorResponse("Email is required", 400));
      }
      
      const result = await storage.createCashier(
        req.user.id,  // ownerId
        email,        // email
        name || "",   // name - provide empty string if undefined
        permissions || {},  // permissions
        venueIds || []      // venueIds
      );
      
      return res.json(successResponse(result, 201, "Cashier created successfully"));
    } catch (error: any) {
      console.error("Error creating cashier:", error);
      
      if (error.message?.includes("already exists")) {
        return res.status(400).json(errorResponse(error.message, 400));
      }
      
      return res.status(500).json(errorResponse("Error creating cashier", 500));
    }
  });
  
  // Delete a cashier
  app.delete("/api/cashiers/:id", requireRole(["center", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const cashierId = parseInt(req.params.id);
      
      if (isNaN(cashierId)) {
        return res.status(400).json(errorResponse("Invalid cashier ID", 400));
      }
      
      // First get the cashier to verify ownership
      const cashiers = await storage.getCashiers(req.user.id);
      const cashier = cashiers.find(c => c.id === cashierId);
      
      if (!cashier) {
        return res.status(404).json(errorResponse("Cashier not found or not authorized", 404));
      }
      
      const success = await storage.deleteCashier(cashierId);
      
      if (success) {
        return res.json(successResponse(null, 200, "Cashier deleted successfully"));
      } else {
        return res.status(500).json(errorResponse("Failed to delete cashier", 500));
      }
    } catch (error) {
      console.error("Error deleting cashier:", error);
      return res.status(500).json(errorResponse("Error deleting cashier", 500));
    }
  });
  
  // Update cashier permissions
  app.patch("/api/cashiers/:id/permissions", requireRole(["center", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const cashierId = parseInt(req.params.id);
      const { permissions } = req.body;
      
      if (isNaN(cashierId)) {
        return res.status(400).json(errorResponse("Invalid cashier ID", 400));
      }
      
      if (!permissions || typeof permissions !== 'object') {
        return res.status(400).json(errorResponse("Invalid permissions format", 400));
      }
      
      // First get the cashier to verify ownership
      const cashiers = await storage.getCashiers(req.user.id);
      const cashier = cashiers.find(c => c.id === cashierId);
      
      if (!cashier) {
        return res.status(404).json(errorResponse("Cashier not found or not authorized", 404));
      }
      
      const updatedCashier = await storage.updateCashierPermissions(cashierId, permissions);
      
      return res.json(successResponse(updatedCashier, 200, "Cashier permissions updated successfully"));
    } catch (error) {
      console.error("Error updating cashier permissions:", error);
      return res.status(500).json(errorResponse("Error updating cashier permissions", 500));
    }
  });
  
  // Update cashier venue access
  app.patch("/api/cashiers/:id/venues", requireRole(["center", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const cashierId = parseInt(req.params.id);
      const { venueIds } = req.body;
      
      if (isNaN(cashierId)) {
        return res.status(400).json(errorResponse("Invalid cashier ID", 400));
      }
      
      if (!Array.isArray(venueIds)) {
        return res.status(400).json(errorResponse("venueIds must be an array", 400));
      }
      
      // First get the cashier to verify ownership
      const cashiers = await storage.getCashiers(req.user.id);
      const cashier = cashiers.find(c => c.id === cashierId);
      
      if (!cashier) {
        return res.status(404).json(errorResponse("Cashier not found or not authorized", 404));
      }
      
      // Verify the venues belong to the user
      const userVenues = await storage.getVenues(req.user.id);
      const userVenueIds = userVenues.map(v => v.id);
      
      // Check if all venueIds are owned by the user
      const unauthorized = venueIds.some(id => !userVenueIds.includes(id));
      
      if (unauthorized) {
        return res.status(403).json(errorResponse("You can only assign venues that you own", 403));
      }
      
      const updatedCashier = await storage.updateCashierVenues(cashierId, venueIds);
      
      return res.json(successResponse(updatedCashier, 200, "Cashier venue access updated successfully"));
    } catch (error) {
      console.error("Error updating cashier venue access:", error);
      return res.status(500).json(errorResponse("Error updating cashier venue access", 500));
    }
  });

  // Complete ticket purchase after payment
  app.post("/api/tickets/purchase", requireRole(["customer", "admin"]), async (req: Request, res: Response) => {
    try {
      ensureAuthenticated(req);
      
      const { eventId, ticketSelections, customerDetails, paymentSessionId, isDigitalPass, passType } = req.body;
      
      // Validate input
      if (!eventId || !ticketSelections || !customerDetails) {
        return res.status(400).json(errorResponse("Missing required fields", 400));
      }
      
      // Verify payment if session ID is provided
      if (paymentSessionId) {
        const paymentStatus = await thawaniService.checkPaymentStatus(paymentSessionId);
        
        if (paymentStatus !== 'paid') {
          return res.status(400).json(errorResponse("Payment not completed", 400));
        }
      }
      
      // Create purchase input object
      const purchaseInput: PurchaseTicketInput = {
        eventId,
        ticketSelections,
        customerDetails,
        isDigitalPass: isDigitalPass || false,
        passType: passType
      };
      
      // Process ticket purchase
      const tickets = await storage.purchaseTickets(purchaseInput, req.user.id);
      
      return res.json(successResponse(tickets, 201, "Tickets purchased successfully"));
    } catch (error: any) {
      console.error("Error purchasing tickets:", error);
      
      if (error.message?.includes("not enough tickets") || error.message?.includes("not found")) {
        return res.status(400).json(errorResponse(error.message, 400));
      }
      
      return res.status(500).json(errorResponse("Error purchasing tickets", 500));
    }
  });

  // Payment success and cancel pages
  app.get("/payment-success", (req: Request, res: Response) => {
    res.send(`
      <html>
        <head>
          <title>Payment Successful</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              text-align: center;
              margin: 0;
              background-color: #f8f9fa;
            }
            .container {
              max-width: 600px;
              padding: 30px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            h1 {
              color: #4CAF50;
              margin-bottom: 20px;
            }
            .back-button {
              display: inline-block;
              margin-top: 20px;
              padding: 10px 20px;
              background-color: #6366F1;
              color: white;
              text-decoration: none;
              border-radius: 4px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Payment Successful!</h1>
            <p>Your payment has been processed successfully. Thank you for your purchase.</p>
            <p>You will receive a confirmation email shortly with all the details.</p>
            <a href="/" class="back-button">Return to Home</a>
          </div>
        </body>
      </html>
    `);
  });

  app.get("/payment-cancel", (req: Request, res: Response) => {
    res.send(`
      <html>
        <head>
          <title>Payment Cancelled</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              height: 100vh;
              text-align: center;
              margin: 0;
              background-color: #f8f9fa;
            }
            .container {
              max-width: 600px;
              padding: 30px;
              background-color: white;
              border-radius: 8px;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
            }
            h1 {
              color: #F44336;
              margin-bottom: 20px;
            }
            .back-button {
              display: inline-block;
              margin-top: 20px;
              padding: 10px 20px;
              background-color: #6366F1;
              color: white;
              text-decoration: none;
              border-radius: 4px;
              font-weight: bold;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>Payment Cancelled</h1>
            <p>Your payment was cancelled or did not complete.</p>
            <p>No charges have been made to your account.</p>
            <a href="/" class="back-button">Return to Home</a>
          </div>
        </body>
      </html>
    `);
  });


  // Initialize subscription routes
  const subscriptionRouteModule = await import('./routes/subscription-routes');
  app.use('/api/subscriptions', subscriptionRouteModule.default);

  const httpServer = createServer(app);
  return httpServer;
}