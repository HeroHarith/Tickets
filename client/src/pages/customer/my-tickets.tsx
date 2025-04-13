import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Calendar, MapPin, Tag, AlertTriangle, Ticket as TicketIcon, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import TabsComponent from "@/components/ui/tabs-component";
import { format } from "date-fns";
import { Event, TicketType } from "@shared/schema";
import type { Ticket } from "@shared/schema";
import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface ExpandedTicket extends Ticket {
  event?: Event;
  ticketType?: TicketType;
}

const MyTickets = () => {
  const { user } = useAuth();
  const [selectedTicket, setSelectedTicket] = useState<ExpandedTicket | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [addToWalletLoading, setAddToWalletLoading] = useState(false);
  
  // Fetch user tickets
  const ticketsQuery = useQuery<ExpandedTicket[]>({
    queryKey: ["/api/tickets/user"],
    queryFn: async () => {
      const res = await fetch("/api/tickets/user");
      if (!res.ok) throw new Error("Failed to fetch tickets");
      const jsonResponse = await res.json();
      // Check if the response has a data property (our standard API response format)
      return jsonResponse.data || [];
    }
  });
  
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
  
  // Function to fetch QR code
  const fetchQrCode = useCallback(async (ticketId: number) => {
    try {
      const res = await fetch(`/api/tickets/${ticketId}/qr`);
      if (!res.ok) throw new Error('Failed to fetch QR code');
      const response = await res.json();
      // Handle our standardized API response format
      return response.data?.qrCode || null;
    } catch (error) {
      console.error('Error fetching QR code:', error);
      return null;
    }
  }, []);
  
  // Function to handle viewing a ticket
  const handleViewTicket = useCallback(async (ticket: ExpandedTicket) => {
    setSelectedTicket(ticket);
    
    // Fetch QR code if not already loaded
    if (!qrCodeUrl) {
      const qrData = await fetchQrCode(ticket.id);
      setQrCodeUrl(qrData);
    }
  }, [fetchQrCode, qrCodeUrl]);
  
  // Function to handle adding to wallet
  const handleAddToWallet = useCallback(async () => {
    if (!selectedTicket) return;
    
    setAddToWalletLoading(true);
    
    // Simulate adding to wallet (in a real app, this would integrate with the wallet API)
    setTimeout(() => {
      setAddToWalletLoading(false);
      // In a real implementation, we would redirect to the wallet app or show a success message
      alert('Ticket added to wallet successfully!');
    }, 1500);
  }, [selectedTicket]);

  // Function to close ticket modal
  const closeTicketModal = useCallback(() => {
    setSelectedTicket(null);
    setQrCodeUrl(null);
  }, []);

  // Function to render ticket cards in the list
  const renderTicketCard = useCallback((ticket: ExpandedTicket) => {
    if (!ticket.event || !ticket.ticketType) return null;
    
    const eventDate = new Date(ticket.event.startDate);
    const eventTime = format(eventDate, "HH:mm");
    const isPast = eventDate < new Date();
    
    return (
      <Card key={ticket.id} className="mb-4 hover:shadow-md transition-shadow">
        <CardContent className="p-0 overflow-hidden">
          <div className="flex flex-col sm:flex-row">
            {/* Left side: Image */}
            <div className="sm:w-1/4 h-24 sm:h-auto bg-gray-200">
              <img 
                src={ticket.event.imageUrl || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"} 
                alt={ticket.event.title}
                className="w-full h-full object-cover"
              />
            </div>
            
            {/* Right side: Details */}
            <div className="sm:w-3/4 p-4">
              <div className="flex flex-row justify-between items-start">
                <div>
                  <h3 className="font-semibold text-lg mb-1">{ticket.event.title}</h3>
                  <div className="text-sm text-gray-500 mb-2">{format(eventDate, "dd MMM yyyy")} • {eventTime}</div>
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
              </div>
              
              <div className="md:flex md:justify-between md:items-end">
                <div>
                  <div className="flex items-center text-sm mb-1">
                    <MapPin className="h-4 w-4 mr-1 text-gray-500" />
                    <span>{ticket.event.location}</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <Tag className="h-4 w-4 mr-1 text-gray-500" />
                    <span>{ticket.ticketType.name} x {ticket.quantity}</span>
                  </div>
                </div>
                
                <div className="mt-3 md:mt-0 md:ml-4">
                  {!isPast && (
                    <Button 
                      size="sm"
                      variant="default"
                      onClick={() => handleViewTicket(ticket)}
                    >
                      View Ticket
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }, [handleViewTicket]);
  
  if (ticketsQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TabsComponent
          tabs={getNavTabs()}
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
        <TabsComponent
          tabs={getNavTabs()}
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
  
  // Format date for the ticket
  const formatTicketDate = (date: Date) => {
    return format(date, "dd MMM yyyy");
  };
  
  // Format time for the ticket
  const formatTicketTime = (date: Date) => {
    return format(date, "HH:mm");
  };
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <TabsComponent
        tabs={getNavTabs()}
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
                {upcomingTickets.map(renderTicketCard)}
              </div>
            )}
            
            {pastTickets.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Past Events</h2>
                {pastTickets.map(renderTicketCard)}
              </div>
            )}
          </>
        )}
      </div>
      
      {/* Ticket Detail Modal */}
      <Dialog open={selectedTicket !== null} onOpenChange={() => selectedTicket && closeTicketModal()}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-white rounded-lg shadow-xl">
          <DialogTitle className="sr-only">Event Ticket</DialogTitle>
          {selectedTicket && selectedTicket.event && (
            <div className="bg-gray-50 p-4 rounded-lg w-full max-w-sm mx-auto">
              {/* Movie ticket style card */}
              <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                {/* Top section with event image */}
                <div className="w-full h-32 bg-gray-200 overflow-hidden">
                  <img 
                    src={selectedTicket.event.imageUrl || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"} 
                    alt={selectedTicket.event.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                
                {/* Event title and category tags */}
                <div className="p-4">
                  <h3 className="text-lg font-semibold mb-1">{selectedTicket.event.title}</h3>
                  
                  <div className="flex flex-wrap gap-1 mb-4">
                    {selectedTicket.event.category && (
                      <span className="px-2 py-1 bg-gray-100 text-xs rounded-full">{selectedTicket.event.category}</span>
                    )}
                    {selectedTicket.ticketType && (
                      <span className="px-2 py-1 bg-gray-100 text-xs rounded-full">{selectedTicket.ticketType.name}</span>
                    )}
                  </div>
                  
                  {/* Event details in two columns */}
                  <div className="grid grid-cols-2 gap-6 mb-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Date</div>
                      <div className="text-sm font-medium">{formatTicketDate(new Date(selectedTicket.event.startDate))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Time</div>
                      <div className="text-sm font-medium">{formatTicketTime(new Date(selectedTicket.event.startDate))}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Cinema</div>
                      <div className="text-sm font-medium truncate">{selectedTicket.event.location}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Seat</div>
                      <div className="text-sm font-medium">
                        {selectedTicket.ticketType?.name === 'General Admission' 
                          ? 'B6, B7, C3, C4' 
                          : `${selectedTicket.ticketType?.name} (×${selectedTicket.quantity})`}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Separator line */}
                <div className="border-t border-dashed border-gray-200"></div>
                
                {/* QR Code section */}
                <div className="p-4">
                  <p className="text-xs text-center text-gray-500 mb-2">
                    Scan the Barcode to Print Your Tickets
                  </p>
                  
                  {qrCodeUrl ? (
                    <div className="flex justify-center">
                      <img 
                        src={qrCodeUrl} 
                        alt="Ticket QR Code" 
                        className="h-20"
                      />
                    </div>
                  ) : (
                    <div className="h-20 bg-gray-200 animate-pulse rounded mx-auto"></div>
                  )}
                  
                  <p className="text-xs font-mono text-center mt-2">
                    Booking Code: {selectedTicket.orderId.slice(-8).toUpperCase()}
                  </p>
                </div>
              </div>
              
              <Button 
                className="mt-4 w-full"
                onClick={handleAddToWallet}
                disabled={addToWalletLoading}
              >
                {addToWalletLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Wallet className="mr-2 h-4 w-4" />
                    Add to Wallet
                  </span>
                )}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyTickets;
