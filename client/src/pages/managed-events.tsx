import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Calendar, MapPin, Users, Ticket, AlertTriangle, Plus, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import ShareAnalytics from "@/components/ui/share-analytics";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import TabsComponent from "@/components/ui/tabs-component";
import { format } from "date-fns";
import { Event, TicketType } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

interface EventWithTicketTypes extends Event {
  ticketTypes?: TicketType[];
}

const ManagedEvents = () => {
  const { user } = useAuth();
  
  // Get navigation tabs based on user role
  const getNavTabs = () => {
    const tabs = [
      { id: "browse", label: "Browse Events", href: "/" },
      { id: "tickets", label: "My Tickets", href: "/my-tickets" }
    ];
    
    // Add manager-specific tabs if user has appropriate role
    if (user && ['eventManager', 'admin'].includes(user.role)) {
      tabs.push(
        { id: "managed", label: "Managed Events", href: "/managed-events" },
        { id: "sales", label: "Sales Reports", href: "/sales-reports" }
      );
    }
    
    return tabs;
  };
  
  // Fetch events created by the current user
  const eventsQuery = useQuery<{ data: Event[] }>({
    queryKey: ["/api/events", { organizer: user?.id }],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch(`/api/events?organizer=${user?.id}`);
      if (!res.ok) throw new Error("Failed to fetch managed events");
      return res.json();
    }
  });
  
  // Fetch ticket types for each event
  const eventsWithTicketTypesQuery = useQuery<Record<number, TicketType[]>>({
    queryKey: ["/api/events/ticketTypes", eventsQuery.data?.data?.map(e => e.id)],
    enabled: !!eventsQuery.data?.data && eventsQuery.data.data.length > 0,
    queryFn: async () => {
      const eventIds = eventsQuery.data!.data.map(e => e.id);
      const promises = eventIds.map(id => 
        fetch(`/api/events/${id}`)
          .then(res => res.json())
          .then(data => ({ id, ticketTypes: data.data?.ticketTypes || [] }))
      );
      
      const results = await Promise.all(promises);
      return results.reduce((acc, { id, ticketTypes }) => {
        acc[id] = ticketTypes;
        return acc;
      }, {} as Record<number, TicketType[]>);
    }
  });
  
  // Get total tickets sold for an event
  const getTicketsSold = (eventId: number) => {
    const ticketTypes = eventsWithTicketTypesQuery.data?.[eventId];
    if (!ticketTypes) return 0;
    
    return ticketTypes.reduce((total, tt) => {
      return total + (tt.quantity - tt.availableQuantity);
    }, 0);
  };
  
  // Get total revenue for an event
  const getEventRevenue = (eventId: number) => {
    const ticketTypes = eventsWithTicketTypesQuery.data?.[eventId];
    if (!ticketTypes) return 0;
    
    return ticketTypes.reduce((total, tt) => {
      const sold = tt.quantity - tt.availableQuantity;
      return total + (Number(tt.price) * sold);
    }, 0);
  };
  
  if (eventsQuery.isLoading || eventsWithTicketTypesQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TabsComponent
          tabs={getNavTabs()}
          activeTab="managed"
        />
        
        <div className="my-8">
          <div className="flex justify-between items-center mb-6">
            <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse"></div>
            <div className="h-10 bg-gray-200 rounded w-1/6 animate-pulse"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-lg shadow-md p-6 animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3 mb-6"></div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="h-12 bg-gray-200 rounded"></div>
                  <div className="h-12 bg-gray-200 rounded"></div>
                </div>
                <div className="h-10 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (eventsQuery.error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TabsComponent
          tabs={getNavTabs()}
          activeTab="managed"
        />
        
        <div className="my-12 text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Error Loading Events</h2>
          <p className="text-gray-600 mb-6">There was a problem loading your managed events. Please try again later.</p>
          <Button onClick={() => eventsQuery.refetch()}>Try Again</Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <TabsComponent
        tabs={getNavTabs()}
        activeTab="managed"
      />
      
      <div className="my-8">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Managed Events</h1>
          <Link href="/create-event">
            <Button className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 mr-2" />
              Create Event
            </Button>
          </Link>
        </div>
        
        {!eventsQuery.data?.data || eventsQuery.data.data.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow-md">
            <div className="mx-auto w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Calendar className="h-8 w-8 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Events Created</h2>
            <p className="text-gray-600 mb-6">You haven't created any events yet. Create your first event to start selling tickets.</p>
            <Link href="/create-event">
              <Button className="bg-primary hover:bg-primary/90">Create Event</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {eventsQuery.data.data.map(event => (
              <Card key={event.id} className="overflow-hidden hover:shadow-lg transition-shadow duration-300">
                <div className="h-40 bg-gray-200 relative">
                  <img
                    src={event.imageUrl || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"}
                    alt={event.title}
                    className="w-full h-full object-cover"
                  />
                  {event.featured && (
                    <div className="absolute top-2 right-2 bg-secondary text-white text-xs font-bold px-2 py-1 rounded">
                      FEATURED
                    </div>
                  )}
                </div>
                
                <CardContent className="p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{event.title}</h3>
                  <div className="flex items-center text-sm text-gray-600 mb-2">
                    <Calendar className="h-4 w-4 mr-1" />
                    {format(new Date(event.startDate), "MMM d, yyyy")}
                  </div>
                  <div className="flex items-center text-sm text-gray-600 mb-4">
                    <MapPin className="h-4 w-4 mr-1" />
                    {event.location}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="bg-gray-50 p-2 rounded-md text-center">
                      <div className="text-sm text-gray-500">Tickets Sold</div>
                      <div className="font-semibold">
                        {getTicketsSold(event.id)}
                      </div>
                    </div>
                    <div className="bg-gray-50 p-2 rounded-md text-center">
                      <div className="text-sm text-gray-500">Revenue</div>
                      <div className="font-semibold">
                        ${getEventRevenue(event.id).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <Link href={`/sales-reports/${event.id}`}>
                      <Button 
                        variant="outline" 
                        className="w-full"
                      >
                        View Sales Report
                      </Button>
                    </Link>
                    <Link href={`/ticket-management/${event.id}`}>
                      <Button 
                        variant="outline" 
                        className="w-full"
                      >
                        Manage Tickets
                      </Button>
                    </Link>
                  </div>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full flex items-center gap-2"
                      >
                        <Share2 className="h-4 w-4" />
                        Share Analytics
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                      <DialogHeader>
                        <DialogTitle>Share Analytics</DialogTitle>
                      </DialogHeader>
                      <ShareAnalytics eventId={event.id} />
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ManagedEvents;
