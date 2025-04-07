import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Calendar, MapPin, Tag, Check, AlertTriangle, Ticket as TicketIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TabsComponent from "@/components/ui/tabs-component";
import { format } from "date-fns";
import { Event, TicketType } from "@shared/schema";
import type { Ticket } from "@shared/schema";

interface ExpandedTicket extends Ticket {
  event?: Event;
  ticketType?: TicketType;
}

const MyTickets = () => {
  // Fetch user tickets
  const ticketsQuery = useQuery<ExpandedTicket[]>({
    queryKey: ["/api/tickets/user"],
    queryFn: async () => {
      const res = await fetch("/api/tickets/user");
      if (!res.ok) throw new Error("Failed to fetch tickets");
      return res.json();
    }
  });
  
  // Group tickets by order ID for display
  const groupTicketsByOrder = (tickets: ExpandedTicket[]) => {
    return tickets.reduce<Record<string, ExpandedTicket[]>>((acc, ticket) => {
      const orderId = ticket.orderId;
      if (!acc[orderId]) {
        acc[orderId] = [];
      }
      acc[orderId].push(ticket);
      return acc;
    }, {});
  };
  
  // Check if an event is upcoming (event date is in the future)
  const isUpcomingEvent = (ticket: ExpandedTicket) => {
    if (!ticket.event) return false;
    const eventDate = new Date(ticket.event.startDate);
    return eventDate > new Date();
  };
  
  const renderTicket = (ticket: ExpandedTicket) => {
    if (!ticket.event || !ticket.ticketType) return null;
    
    const eventDate = new Date(ticket.event.startDate);
    const isPast = eventDate < new Date();
    
    return (
      <Card key={ticket.id} className="mb-4">
        <CardHeader className="flex flex-row items-start justify-between pb-2">
          <div>
            <CardTitle className="text-xl">{ticket.event.title}</CardTitle>
            <div className="text-sm text-gray-500">{ticket.orderId}</div>
          </div>
          {isPast ? (
            <div className="px-2 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded">
              PAST
            </div>
          ) : (
            <div className="px-2 py-1 bg-success/10 text-success text-xs font-medium rounded">
              UPCOMING
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="sm:w-1/4">
              <div className="h-24 w-full bg-gray-200 rounded overflow-hidden">
                <img 
                  src={ticket.event.imageUrl || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"} 
                  alt={ticket.event.title}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            
            <div className="sm:w-3/4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="flex items-center text-sm mb-2">
                    <Calendar className="h-4 w-4 mr-1 text-gray-500" />
                    <span>{format(eventDate, "MMMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center text-sm mb-2">
                    <MapPin className="h-4 w-4 mr-1 text-gray-500" />
                    <span>{ticket.event.location}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Tag className="h-4 w-4 mr-1 text-gray-500" />
                    <span>{ticket.ticketType.name} x {ticket.quantity}</span>
                  </div>
                </div>
                
                <div className="md:text-right">
                  <div className="text-sm mb-1">Purchased on {format(new Date(ticket.purchaseDate), "MMMM d, yyyy")}</div>
                  <div className="font-semibold mb-3">Total: ${Number(ticket.totalPrice).toFixed(2)}</div>
                  
                  {!isPast && (
                    <Link href={`/events/${ticket.event.id}`}>
                      <Button size="sm" variant="outline">View Event</Button>
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };
  
  if (ticketsQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs
          tabs={[
            { id: "browse", label: "Browse Events", href: "/" },
            { id: "tickets", label: "My Tickets", href: "/my-tickets" },
            { id: "managed", label: "Managed Events", href: "/managed-events" },
            { id: "sales", label: "Sales Reports", href: "/managed-events" }
          ]}
          activeTab="tickets"
        />
        
        <div className="my-8 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse bg-white rounded-lg p-6 shadow-md">
              <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="sm:w-1/4 h-24 bg-gray-200 rounded"></div>
                <div className="sm:w-3/4 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-2/3"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (ticketsQuery.error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs
          tabs={[
            { id: "browse", label: "Browse Events", href: "/" },
            { id: "tickets", label: "My Tickets", href: "/my-tickets" },
            { id: "managed", label: "Managed Events", href: "/managed-events" },
            { id: "sales", label: "Sales Reports", href: "/managed-events" }
          ]}
          activeTab="tickets"
        />
        
        <div className="my-12 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Error Loading Tickets</h2>
          <p className="text-gray-600 mb-6">There was a problem loading your tickets. Please try again later.</p>
          <Button onClick={() => ticketsQuery.refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }
  
  const upcomingTickets = ticketsQuery.data?.filter(isUpcomingEvent) || [];
  const pastTickets = ticketsQuery.data?.filter(ticket => !isUpcomingEvent(ticket)) || [];
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <TabsComponent
        tabs={[
          { id: "browse", label: "Browse Events", href: "/" },
          { id: "tickets", label: "My Tickets", href: "/my-tickets" },
          { id: "managed", label: "Managed Events", href: "/managed-events" },
          { id: "sales", label: "Sales Reports", href: "/managed-events" }
        ]}
        activeTab="tickets"
      />
      
      <div className="my-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">My Tickets</h1>
        
        {ticketsQuery.data?.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <TicketIcon className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Tickets Found</h2>
            <p className="text-gray-600 mb-6">You haven't purchased any tickets yet.</p>
            <Link href="/">
              <Button>Browse Events</Button>
            </Link>
          </div>
        ) : (
          <>
            {upcomingTickets.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-semibold mb-4">Upcoming Events</h2>
                {upcomingTickets.map(renderTicket)}
              </div>
            )}
            
            {pastTickets.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Past Events</h2>
                {pastTickets.map(renderTicket)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MyTickets;
