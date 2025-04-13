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

  const httpServer = createServer(app);
  return httpServer;
}