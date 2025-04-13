import { Switch, Route } from "wouter";
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
import TicketManagement from "@/pages/ticket-management";
import AdminDashboard from "@/pages/admin-dashboard";
import CenterDashboard from "@/pages/center-dashboard";
import CenterHomePage from "@/pages/center-home";
import CenterBookingsPage from "@/pages/center-bookings";
import CenterVenuesPage from "@/pages/center-venues";
import CenterSchedulePage from "@/pages/center-schedule";
import CenterReportsPage from "@/pages/center-reports";
import AuthPage from "@/pages/auth-page";
import ProfilePage from "@/pages/profile";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";

// Note: We've moved the authenticated layout into the ProtectedRoute component

function Router() {
  return (
    <div className="flex flex-col min-h-screen">
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <ProtectedRoute path="/" component={Home} />
        <ProtectedRoute path="/events/:id" component={EventDetails} />
        <ProtectedRoute 
          path="/create-event" 
          component={CreateEvent} 
          requiredRoles={["eventManager", "admin"]} 
        />
        <ProtectedRoute 
          path="/my-tickets" 
          component={MyTickets} 
        />
        <ProtectedRoute 
          path="/profile" 
          component={ProfilePage} 
        />
        <ProtectedRoute 
          path="/managed-events" 
          component={ManagedEvents} 
          requiredRoles={["eventManager", "admin"]} 
        />
        <ProtectedRoute 
          path="/sales-reports" 
          component={ManagedEvents} 
          requiredRoles={["eventManager", "admin"]} 
        />
        <ProtectedRoute 
          path="/sales-reports/:id" 
          component={SalesReports} 
          requiredRoles={["eventManager", "admin"]} 
        />
        <ProtectedRoute 
          path="/ticket-management/:id" 
          component={TicketManagement} 
          requiredRoles={["eventManager", "admin"]} 
        />
        <ProtectedRoute
          path="/admin"
          component={AdminDashboard}
          requiredRoles={["admin"]}
        />
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
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
