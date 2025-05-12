import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Header from "@/components/ui/header";
import Footer from "@/components/ui/footer";
import Home from "@/pages/home";
import EventDetails from "@/pages/event-details";
import CreateEvent from "@/pages/create-event";
import MyTickets from "@/pages/my-tickets";
import ManagedEvents from "@/pages/managed-events";
import SalesReports from "@/pages/sales-reports";
import SalesReportList from "@/pages/sales-report-list";
import TicketManagement from "@/pages/ticket-management";
import CenterDashboard from "@/pages/center-dashboard";
import CenterHomePage from "@/pages/center-home-new"; // Using our fixed version
import CenterBookingsPage from "@/pages/center-bookings";
import CenterVenuesPage from "@/pages/center-venues";
import CenterSchedulePage from "@/pages/center-schedule";
import CenterReportsPage from "@/pages/center-reports";
import CenterCashiersPage from "@/pages/center-cashiers";
import AuthPage from "@/pages/auth-page";
import ProfilePage from "@/pages/profile";
import PaymentStatus from "@/pages/payment-status";
import PaymentConfirmation from "@/pages/payment-confirmation";
import Subscriptions from "@/pages/subscriptions";
import Settings from "@/pages/settings";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";
import { PaymentStatusChecker } from "@/components/domain/payments";
import { SubscriptionStatusChecker } from "@/components/domain/subscriptions";

// Note: We've moved the authenticated layout into the ProtectedRoute component

// Home redirect component to handle special user roles
function HomeRedirect() {
  const { user } = useAuth();
  
  // If user is center, redirect to center dashboard
  if (user?.role === "center") {
    return <Redirect to="/center" />;
  }
  
  // Admin users will use a separate app
  
  // Render the regular Home component for customers and event managers
  return <Home />;
}

function Router() {
  return (
    <div className="flex flex-col min-h-screen">
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/payment-success" component={PaymentStatus} />
        <Route path="/payment-cancel" component={PaymentStatus} />
        <ProtectedRoute path="/payment-confirmation/:sessionId" component={PaymentConfirmation} />
        
        {/* Use conditional home redirect component instead of conditional routes */}
        <ProtectedRoute path="/" component={HomeRedirect} />
        
        {/* Event-related routes (protected by role in the components) */}
        <ProtectedRoute path="/events/:id" component={EventDetails} />
        <ProtectedRoute 
          path="/create-event" 
          component={CreateEvent} 
          requiredRoles={["eventManager"]} 
        />
        <ProtectedRoute 
          path="/my-tickets" 
          component={MyTickets} 
          requiredRoles={["customer", "eventManager"]}
        />
        <ProtectedRoute 
          path="/managed-events" 
          component={ManagedEvents} 
          requiredRoles={["eventManager"]} 
        />
        <ProtectedRoute 
          path="/sales-reports" 
          component={SalesReportList} 
          requiredRoles={["eventManager"]} 
        />
        <ProtectedRoute 
          path="/sales-reports/:id" 
          component={SalesReports} 
          requiredRoles={["eventManager"]} 
        />
        <ProtectedRoute 
          path="/ticket-management/:id" 
          component={TicketManagement} 
          requiredRoles={["eventManager"]} 
        />
        
        {/* Common routes for all authenticated users */}
        <ProtectedRoute path="/profile" component={ProfilePage} />
        <ProtectedRoute path="/settings" component={Settings} />
        <ProtectedRoute 
          path="/subscriptions" 
          component={Subscriptions} 
          requiredRoles={["eventManager", "center"]} 
        />
        
        {/* Center routes */}
        <ProtectedRoute
          path="/center-old"
          component={CenterDashboard}
          requiredRoles={["center"]}
        />
        <ProtectedRoute
          path="/center"
          component={CenterHomePage}
          requiredRoles={["center"]}
        />
        <ProtectedRoute
          path="/center/bookings"
          component={CenterBookingsPage}
          requiredRoles={["center"]}
        />
        <ProtectedRoute
          path="/center/venues"
          component={CenterVenuesPage}
          requiredRoles={["center"]}
        />
        <ProtectedRoute
          path="/center/schedule"
          component={CenterSchedulePage}
          requiredRoles={["center"]}
        />
        <ProtectedRoute
          path="/center/reports"
          component={CenterReportsPage}
          requiredRoles={["center"]}
        />
        <ProtectedRoute
          path="/center/cashiers"
          component={CenterCashiersPage}
          requiredRoles={["center"]}
        />
        <ProtectedRoute path="*" component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router />
        <PaymentStatusChecker />
        <SubscriptionStatusChecker />
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
