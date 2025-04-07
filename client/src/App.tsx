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

function Router() {
  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow">
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/events/:id" component={EventDetails} />
          <Route path="/create-event" component={CreateEvent} />
          <Route path="/my-tickets" component={MyTickets} />
          <Route path="/managed-events" component={ManagedEvents} />
          <Route path="/sales/:id" component={SalesReports} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;
