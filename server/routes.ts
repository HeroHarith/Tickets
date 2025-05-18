import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";

// Import route modules
import venuesRoutes from "./routes/venues-routes";
import eventsRoutes from "./routes/events-routes";
import ticketsRoutes from "./routes/tickets-routes";
import cashiersRoutes from "./routes/cashiers-routes";
import paymentsRoutes from "./routes/payments-routes";
import enhancedPaymentsRoutes from "./routes/enhanced-payments-routes";
import authRoutes from "./routes/auth-routes";
import subscriptionRoutes from "./routes/subscription-routes";
import { eventAttendeesRoutes } from "./routes/event-attendees-routes";
import { externalApiRoutes } from "./routes/api-external-routes";
import { addOnsRoutes } from "./routes/add-ons-routes";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  setupAuth(app);
  
  // Register route modules
  app.use("/api/venues", venuesRoutes);
  app.use("/api/events", eventsRoutes);
  app.use("/api/tickets", ticketsRoutes);
  app.use("/api/cashiers", cashiersRoutes);
  app.use("/api/payments", paymentsRoutes);
  app.use("/api/payments/enhanced", enhancedPaymentsRoutes);
  app.use("/api", authRoutes);
  app.use("/api/subscriptions", subscriptionRoutes);
  
  // Direct payment routes (these used to be at the root level)
  app.use("/payment", paymentsRoutes);
  
  // Event attendees routes
  app.use("/api/events", eventAttendeesRoutes);
  
  // External API routes with API key authentication
  app.use("/api/external", externalApiRoutes);
  
  // Add-ons routes
  app.use("/api/add-ons", addOnsRoutes);
  
  // Create and return the HTTP server
  const httpServer = createServer(app);
  return httpServer;
}