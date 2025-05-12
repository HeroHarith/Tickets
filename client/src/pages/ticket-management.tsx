import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { AlertTriangle, ArrowLeft, Calendar, Download, MapPin, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TabsComponent from "@/components/ui/tabs-component";
import "date-fns";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { format } from "date-fns";
import { Event, Ticket, TicketType } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface AttendeeTicket extends Ticket {
  attendeeDetails: {
    name: string;
    email: string;
  }[];
  ticketType?: TicketType;
  // Use purchaseDate instead of createdAt
  purchaseDate: Date;
}

const TicketManagement = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [match, params] = useRoute<{ id: string }>("/ticket-management/:id");
  const eventId = match ? parseInt(params.id) : -1;
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<AttendeeTicket | null>(null);
  
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
        { id: "sales", label: "Sales Reports", href: "/managed-events" }
      );
    }
    
    return tabs;
  };
  
  // Fetch event data
  const eventQuery = useQuery<Event>({
    queryKey: [`/api/events/${eventId}`],
    enabled: eventId > 0,
    queryFn: async () => {
      const result = await apiRequest("GET", `/api/events/${eventId}`);
      if (!result.ok) {
        const errorData = await result.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch event");
      }
      return result.json();
    }
  });
  
  // Fetch tickets for the event
  const ticketsQuery = useQuery<{data: AttendeeTicket[], success: boolean, code: number}>({
    queryKey: [`/api/events/${eventId}/tickets`],
    enabled: eventId > 0,
    queryFn: async () => {
      const result = await apiRequest("GET", `/api/events/${eventId}/tickets`);
      if (!result.ok) {
        const errorData = await result.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to fetch tickets");
      }
      return result.json();
    }
  });
  
  // Mutation to remove a ticket
  const removeTicketMutation = useMutation({
    mutationFn: async (ticketId: number) => {
      await apiRequest("DELETE", `/api/tickets/${ticketId}`);
    },
    onSuccess: () => {
      toast({
        title: "Ticket removed",
        description: "The ticket has been successfully removed",
      });
      
      // Clear selected ticket and refresh data
      setSelectedTicket(null);
      queryClient.invalidateQueries({ queryKey: [`/api/events/${eventId}/tickets`] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove ticket",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Handle ticket removal
  const handleRemoveTicket = (ticket: AttendeeTicket) => {
    setSelectedTicket(ticket);
  };
  
  const confirmRemoveTicket = () => {
    if (selectedTicket) {
      removeTicketMutation.mutate(selectedTicket.id);
    }
  };
  
  // Filter tickets based on search query
  const filteredTickets = ticketsQuery.data && Array.isArray(ticketsQuery.data.data) 
    ? ticketsQuery.data.data.filter(ticket => {
        const searchString = searchQuery.toLowerCase();
        
        // Search through attendee details - with additional safety checks
        const attendeeMatch = Array.isArray(ticket.attendeeDetails) && ticket.attendeeDetails.some(attendee => 
          attendee && 
          ((attendee.name && attendee.name.toLowerCase().includes(searchString)) || 
           (attendee.email && attendee.email.toLowerCase().includes(searchString)))
        );
        
        // Search through ticket type name
        const ticketTypeMatch = ticket.ticketType?.name?.toLowerCase().includes(searchString);
        
        // Search through ticket ID
        const ticketIdMatch = ticket.id.toString().includes(searchString);
        
        return attendeeMatch || ticketTypeMatch || ticketIdMatch;
      }) 
    : [];
  
  if (!match || eventId <= 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TabsComponent
          tabs={getNavTabs()}
          activeTab="managed"
        />
        
        <div className="text-center py-12 bg-white rounded-lg shadow-md mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">No Event Selected</h2>
          <p className="text-gray-600 mb-6">
            Please select an event from your managed events to view its tickets.
          </p>
          <Link href="/managed-events">
            <Button>Go to Managed Events</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  if (eventQuery.isLoading || ticketsQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TabsComponent
          tabs={getNavTabs()}
          activeTab="managed"
        />
        
        <div className="animate-pulse mt-6">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="h-12 bg-gray-200 rounded w-full mb-6"></div>
          
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-24 bg-white rounded-lg shadow-md p-6">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (eventQuery.error || ticketsQuery.error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TabsComponent
          tabs={getNavTabs()}
          activeTab="managed"
        />
        
        <div className="text-center py-12 bg-white rounded-lg shadow-md mt-6">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Error Loading Ticket Data</h2>
          <p className="text-gray-600 mb-6">
            {eventQuery.error 
              ? `Error loading event: ${eventQuery.error.message}` 
              : `Error loading tickets: ${ticketsQuery.error?.message}`}
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/managed-events">
              <Button>Back to Managed Events</Button>
            </Link>
            <Button 
              variant="outline" 
              onClick={() => {
                eventQuery.refetch();
                ticketsQuery.refetch();
              }}
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  const event = eventQuery.data!;
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <TabsComponent
        tabs={getNavTabs()}
        activeTab="managed"
      />
      
      <div className="mb-6 mt-6">
        <Link href="/managed-events">
          <Button variant="ghost" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Managed Events
          </Button>
        </Link>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.title} - Ticket Management</h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-1" />
            {format(new Date(event.startDate), "MMMM d, yyyy")}
          </div>
          <div className="flex items-center">
            <MapPin className="h-4 w-4 mr-1" />
            {event.location}
          </div>
          <div className="flex items-center">
            <Users className="h-4 w-4 mr-1" />
            {ticketsQuery.data?.data?.length || 0} Attendees
          </div>
        </div>
      </div>
      
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle>Ticket Holders</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search by name, email or ticket type..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" className="gap-1">
              <Download className="h-4 w-4" />
              Export
            </Button>
          </div>
          
          {filteredTickets.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">No Tickets Found</h3>
              <p className="text-gray-500">
                {!ticketsQuery.data?.data?.length 
                  ? "No one has purchased tickets for this event yet." 
                  : "No tickets match your search criteria."}
              </p>
            </div>
          ) : (
            <div className="rounded-md border overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ticket ID
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ticket Type
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Purchase Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredTickets.map((ticket) => (
                    <tr key={ticket.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        #{ticket.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {Array.isArray(ticket.attendeeDetails) && ticket.attendeeDetails[0]?.name || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {Array.isArray(ticket.attendeeDetails) && ticket.attendeeDetails[0]?.email || "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {ticket.ticketType?.name || "Unknown"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {ticket.purchaseDate ? format(new Date(ticket.purchaseDate), "MMM d, yyyy") : "N/A"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800 hover:bg-red-50"
                          onClick={() => handleRemoveTicket(ticket)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Confirmation Dialog */}
      <Dialog open={!!selectedTicket} onOpenChange={(open) => !open && setSelectedTicket(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove Ticket</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove ticket #{selectedTicket?.id} for 
              {Array.isArray(selectedTicket?.attendeeDetails) && selectedTicket?.attendeeDetails[0]?.name || "this attendee"}?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedTicket(null)}>Cancel</Button>
            <Button 
              variant="destructive" 
              onClick={confirmRemoveTicket}
              disabled={removeTicketMutation.isPending}
            >
              {removeTicketMutation.isPending ? "Removing..." : "Remove Ticket"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TicketManagement;