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
import AuthPage from "@/pages/auth-page";
import { AuthProvider } from "@/hooks/use-auth";
import { ProtectedRoute } from "@/lib/protected-route";

function Router() {
  return (
    <div className="flex flex-col min-h-screen">
      <Switch>
        <Route path="/auth">
          <AuthPage />
        </Route>
        <Route>
          <Header />
          <main className="flex-grow">
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/events/:id" component={EventDetails} />
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
              <Route component={NotFound} />
            </Switch>
          </main>
          <Footer />
        </Route>
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
