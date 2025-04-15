import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { 
  Calendar, MapPin, Tag, AlertTriangle, Ticket as TicketIcon, 
  Wallet, QrCode, Check, Clock, BriefcaseBusiness, Building, UserCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { Event, TicketType } from "@shared/schema";
import type { Ticket, BadgeInfo } from "@shared/schema";
import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";

interface ExpandedTicket extends Ticket {
  event?: Event;
  ticketType?: TicketType;
}

const MyTickets = () => {
  const { user } = useAuth();
  const [selectedTicket, setSelectedTicket] = useState<ExpandedTicket | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [addToWalletLoading, setAddToWalletLoading] = useState(false);
  const [selectedWalletType, setSelectedWalletType] = useState<'apple' | 'google'>('apple');
  
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
    
    try {
      if (selectedTicket.passId) {
        // For digital passes, we'll create a wallet pass and update the status
        const response = await apiRequest("POST", `/api/tickets/${selectedTicket.id}/wallet-pass`, {
          passType: selectedTicket.passType || 'standard',
          walletType: selectedWalletType // Use the selected wallet type
        });
        
        if (!response.ok) {
          throw new Error("Failed to create wallet pass");
        }
        
        const data = await response.json();
        
        // In a real app, we would redirect to the wallet app or download the pass file
        // For simulation, we'll just update the status
        
        // Update the ticket in our local state
        setSelectedTicket(prev => {
          if (!prev) return null;
          return {
            ...prev,
            passStatus: 'added_to_wallet',
            passUrl: data.passUrl || prev.passUrl
          };
        });
        
        setAddToWalletLoading(false);
        
        // Show success message
        alert('Digital pass added to wallet successfully!');
      } else {
        // For regular tickets, we'll use a simpler approach
        // Simulate adding to wallet (in a real app, this would integrate with the wallet API)
        setTimeout(() => {
          setAddToWalletLoading(false);
          // In a real implementation, we would redirect to the wallet app or show a success message
          alert('Ticket added to wallet successfully!');
        }, 1500);
      }
    } catch (error) {
      console.error('Error adding to wallet:', error);
      setAddToWalletLoading(false);
      alert('Failed to add to wallet. Please try again.');
    }
  }, [selectedTicket, selectedWalletType]);

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
    const isDigitalPass = !!ticket.passId;
    const isConference = ticket.event.eventType === 'conference';
    
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
                <div className="flex flex-col gap-1 items-end">
                  {isPast ? (
                    <Badge variant="outline" className="bg-gray-100 text-gray-700">PAST</Badge>
                  ) : (
                    <Badge variant="outline" className="bg-success/10 text-success">UPCOMING</Badge>
                  )}
                  
                  {isDigitalPass && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <QrCode className="h-3 w-3" />
                      Digital Pass
                    </Badge>
                  )}
                  
                  {isConference && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <Building className="h-3 w-3" />
                      Conference
                    </Badge>
                  )}
                </div>
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
                  {isDigitalPass && ticket.passStatus && (
                    <div className="flex items-center text-sm mt-1">
                      <Clock className="h-4 w-4 mr-1 text-gray-500" />
                      <span>Status: {ticket.passStatus === 'added_to_wallet' ? 'In Wallet' : 'Available'}</span>
                    </div>
                  )}
                </div>
                
                <div className="mt-3 md:mt-0 md:ml-4">
                  {!isPast && (
                    <Button 
                      size="sm"
                      variant="default"
                      onClick={() => handleViewTicket(ticket)}
                    >
                      {isDigitalPass ? 'View Pass' : 'View Ticket'}
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
              {/* Ticket or pass card */}
              <div className="bg-white rounded-lg overflow-hidden shadow-sm">
                {/* Top section with event image */}
                <div className="w-full h-32 bg-gray-200 overflow-hidden relative">
                  <img 
                    src={selectedTicket.event.imageUrl || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"} 
                    alt={selectedTicket.event.title}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Digital Pass badge */}
                  {selectedTicket.passId && (
                    <div className="absolute top-2 right-2 bg-indigo-500 text-white px-2 py-1 rounded-md text-xs font-medium flex items-center gap-1">
                      <QrCode className="h-3 w-3" />
                      Digital Pass
                    </div>
                  )}
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
                    {selectedTicket.passType && (
                      <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-xs rounded-full">
                        {selectedTicket.passType.charAt(0).toUpperCase() + selectedTicket.passType.slice(1)} Pass
                      </span>
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
                      <div className="text-xs text-gray-500 mb-1">
                        {selectedTicket.event.eventType === 'conference' ? 'Venue' : 'Location'}
                      </div>
                      <div className="text-sm font-medium truncate">{selectedTicket.event.location}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">
                        {selectedTicket.event.eventType === 'conference' ? 'Type' : 'Seat'}
                      </div>
                      <div className="text-sm font-medium">
                        {selectedTicket.ticketType?.name} {selectedTicket.quantity > 1 && `(×${selectedTicket.quantity})`}
                      </div>
                    </div>
                  </div>
                  
                  {/* Digital Pass Badge Info */}
                  {selectedTicket.passId && selectedTicket.badgeInfo && (
                    <div className="border p-3 rounded-md bg-gray-50 mb-4">
                      <h4 className="text-sm font-medium mb-2 flex items-center">
                        <UserCircle className="h-4 w-4 mr-1" /> Badge Information
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        {(selectedTicket.badgeInfo as any).badgeType && (
                          <div>
                            <div className="text-xs text-gray-500">Badge Type</div>
                            <div className="capitalize">{(selectedTicket.badgeInfo as any).badgeType}</div>
                          </div>
                        )}
                        {(selectedTicket.badgeInfo as any).accessLevel && (
                          <div>
                            <div className="text-xs text-gray-500">Access Level</div>
                            <div className="capitalize">{(selectedTicket.badgeInfo as any).accessLevel}</div>
                          </div>
                        )}
                        {(selectedTicket.badgeInfo as any).companyName && (
                          <div className="col-span-2">
                            <div className="text-xs text-gray-500">Company</div>
                            <div>{(selectedTicket.badgeInfo as any).companyName}</div>
                          </div>
                        )}
                        {(selectedTicket.badgeInfo as any).jobTitle && (
                          <div className="col-span-2">
                            <div className="text-xs text-gray-500">Job Title</div>
                            <div>{(selectedTicket.badgeInfo as any).jobTitle}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Pass Status */}
                  {selectedTicket.passId && selectedTicket.passStatus && (
                    <div className="flex items-center justify-between mb-4 p-2 border-l-4 border-indigo-400 bg-indigo-50 rounded-r-md">
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-indigo-500" />
                        <span className="text-sm text-indigo-700">
                          Status: <span className="font-medium capitalize">{selectedTicket.passStatus.replace('_', ' ')}</span>
                        </span>
                      </div>
                      {selectedTicket.checkInStatus && (
                        <Badge variant={selectedTicket.checkInStatus === 'checked_in' ? 'secondary' : 'outline'} className={`ml-2 capitalize ${selectedTicket.checkInStatus === 'checked_in' ? 'bg-green-100 text-green-800' : ''}`}>
                          {selectedTicket.checkInStatus === 'checked_in' ? (
                            <><Check className="h-3 w-3 mr-1" /> Checked In</>
                          ) : (
                            'Not Checked In'
                          )}
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
                
                {/* Separator line */}
                <div className="border-t border-dashed border-gray-200"></div>
                
                {/* QR Code section */}
                <div className="p-4">
                  <p className="text-xs text-center text-gray-500 mb-2">
                    {selectedTicket.passId 
                      ? 'Scan this QR code to check in to the event' 
                      : 'Scan the QR code to validate your ticket'}
                  </p>
                  
                  {qrCodeUrl ? (
                    <div className="flex justify-center">
                      <img 
                        src={qrCodeUrl} 
                        alt="Ticket QR Code" 
                        className="h-32 w-32"
                      />
                    </div>
                  ) : (
                    <div className="h-32 w-32 bg-gray-200 animate-pulse rounded mx-auto"></div>
                  )}
                  
                  <p className="text-xs font-mono text-center mt-2">
                    {selectedTicket.passId 
                      ? `Pass ID: ${selectedTicket.passId}` 
                      : `Booking Code: ${selectedTicket.orderId.slice(-8).toUpperCase()}`}
                  </p>
                </div>
              </div>
              
              {/* Wallet type selector - only show for digital passes that are not already in a wallet */}
              {selectedTicket.passId && selectedTicket.passStatus !== 'added_to_wallet' && (
                <div className="mt-4 mb-2">
                  <div className="text-sm text-gray-600 mb-2">Select wallet type:</div>
                  <div className="flex space-x-3">
                    <button
                      type="button"
                      onClick={() => setSelectedWalletType('apple')}
                      className={`flex-1 py-2 px-3 border rounded-md flex items-center justify-center ${
                        selectedWalletType === 'apple' 
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                          : 'border-gray-300 text-gray-700'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                      </svg>
                      Apple Wallet
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedWalletType('google')}
                      className={`flex-1 py-2 px-3 border rounded-md flex items-center justify-center ${
                        selectedWalletType === 'google' 
                          ? 'border-indigo-500 bg-indigo-50 text-indigo-700' 
                          : 'border-gray-300 text-gray-700'
                      }`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0a12 12 0 1 0 0 24 12 12 0 0 0 0-24zm0 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20zm-5-8.59l1.41-1.41 3.59 3.59 3.59-3.59 1.41 1.41-5 5-5-5z" />
                      </svg>
                      Google Wallet
                    </button>
                  </div>
                </div>
              )}
              
              <Button 
                className="mt-4 w-full"
                onClick={handleAddToWallet}
                disabled={addToWalletLoading || (selectedTicket.passStatus === 'added_to_wallet')}
                variant={selectedTicket.passStatus === 'added_to_wallet' ? 'outline' : 'default'}
              >
                {addToWalletLoading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </span>
                ) : selectedTicket.passStatus === 'added_to_wallet' ? (
                  <span className="flex items-center justify-center text-success">
                    <Check className="mr-2 h-4 w-4" />
                    Added to Wallet
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    <Wallet className="mr-2 h-4 w-4" />
                    {selectedTicket.passId 
                      ? `Add to ${selectedWalletType === 'apple' ? 'Apple' : 'Google'} Wallet` 
                      : 'Add to Wallet'}
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
