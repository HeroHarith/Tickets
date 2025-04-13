import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, Download, Calendar, Clock, MapPin, Ticket as TicketIcon, User, Mail, QrCode } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Event, Ticket as TicketType } from '@shared/schema';
import TabsComponent from '@/components/ui/tabs-component';
import { useAuth } from '@/hooks/use-auth';

/**
 * Payment confirmation page that shows ticket purchase details
 * This page is shown after successful payment and ticket generation
 */
const PaymentConfirmation = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [match, params] = useRoute<{ sessionId: string }>('/payment-confirmation/:sessionId');
  const [isAddingToWallet, setIsAddingToWallet] = useState(false);
  
  // Safely get the session ID
  const sessionId = match ? params.sessionId : '';
  
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
  
  // Get tickets for this payment session
  const ticketsQuery = useQuery({
    queryKey: [`/api/tickets/payment/${sessionId}`],
    enabled: !!sessionId,
    queryFn: async () => {
      const res = await fetch(`/api/tickets/payment/${sessionId}`);
      if (!res.ok) throw new Error("Failed to fetch tickets");
      const data = await res.json();
      return data.data;
    }
  });
  
  // Get the event data for the tickets
  const eventQuery = useQuery({
    queryKey: [`/api/events/${ticketsQuery.data?.[0]?.eventId}`],
    enabled: !!ticketsQuery.data?.[0]?.eventId,
    queryFn: async () => {
      const res = await fetch(`/api/events/${ticketsQuery.data[0].eventId}`);
      if (!res.ok) throw new Error("Failed to fetch event details");
      const data = await res.json();
      return data.data;
    }
  });
  
  const handleAddToWallet = async (ticketId: number) => {
    setIsAddingToWallet(true);
    try {
      const res = await fetch(`/api/tickets/${ticketId}/wallet`);
      if (!res.ok) throw new Error("Failed to generate wallet pass");
      
      const data = await res.json();
      
      if (data.success) {
        // Open the wallet URL in a new tab
        window.open(data.data.walletUrl, '_blank');
        
        toast({
          title: "Wallet Pass Generated",
          description: "Your ticket has been added to your digital wallet.",
        });
      } else {
        throw new Error(data.description || "Failed to generate wallet pass");
      }
    } catch (error: any) {
      toast({
        title: "Error Adding to Wallet",
        description: error.message || "There was an error generating your wallet pass.",
        variant: "destructive",
      });
    } finally {
      setIsAddingToWallet(false);
    }
  };
  
  const handleDownloadTicket = async (ticketId: number) => {
    try {
      // Redirect to ticket download endpoint
      window.open(`/api/tickets/${ticketId}/download`, '_blank');
    } catch (error) {
      toast({
        title: "Download Failed",
        description: "There was an error downloading your ticket.",
        variant: "destructive",
      });
    }
  };
  
  if (ticketsQuery.isLoading || eventQuery.isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <TabsComponent 
          tabs={getNavTabs()}
          activeTab="tickets"
        />
        
        <div className="mt-8 animate-pulse">
          <div className="h-10 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4 mb-6"></div>
            <div className="space-y-4">
              <div className="h-12 bg-gray-200 rounded w-full"></div>
              <div className="h-12 bg-gray-200 rounded w-full"></div>
              <div className="h-12 bg-gray-200 rounded w-full"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (ticketsQuery.error || eventQuery.error || !ticketsQuery.data || !eventQuery.data) {
    return (
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <TabsComponent 
          tabs={getNavTabs()}
          activeTab="tickets"
        />
        
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            No Tickets Found
          </h2>
          <p className="text-gray-600 mb-6">
            We couldn't find any tickets associated with this payment session.
          </p>
          <Button 
            onClick={() => setLocation("/my-tickets")}
            className="bg-primary hover:bg-primary/90"
          >
            View My Tickets
          </Button>
        </div>
      </div>
    );
  }
  
  const tickets = ticketsQuery.data as TicketType[];
  const event = eventQuery.data as Event;
  
  // Group tickets by type for display
  const ticketsByType: Record<string, TicketType[]> = {};
  tickets.forEach(ticket => {
    const typeId = ticket.ticketTypeId.toString();
    if (!ticketsByType[typeId]) {
      ticketsByType[typeId] = [];
    }
    ticketsByType[typeId].push(ticket);
  });
  
  // Calculate total amount paid
  const totalAmount = tickets.reduce((sum, ticket) => {
    return sum + Number(ticket.price);
  }, 0);
  
  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <TabsComponent 
        tabs={getNavTabs()}
        activeTab="tickets"
      />
      
      <div className="my-8">
        <div className="flex items-center mb-6">
          <CheckCircle className="text-green-500 h-8 w-8 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900">Payment Successful</h1>
        </div>
        
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Purchase Summary</CardTitle>
            <CardDescription>
              Thank you for your purchase. Your tickets are confirmed.
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 bg-gray-100 rounded-md flex items-center justify-center">
                  <TicketIcon className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{event.title}</h3>
                  <div className="flex flex-col gap-1 text-sm text-gray-500">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      <span>{format(new Date(event.startDate), 'MMM d, yyyy')}</span>
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      <span>
                        {format(new Date(event.startDate), 'h:mm a')}
                        {event.endDate && ` - ${format(new Date(event.endDate), 'h:mm a')}`}
                      </span>
                    </div>
                    <div className="flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      <span>{event.location}</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <Separator />
              
              <div>
                <h3 className="font-medium mb-2">Ticket Details</h3>
                <div className="space-y-3">
                  {Object.entries(ticketsByType).map(([typeId, ticketsOfType]) => (
                    <div key={typeId} className="flex justify-between">
                      <span>{ticketsOfType[0].ticketTypeName} × {ticketsOfType.length}</span>
                      <span className="font-medium">${Number(ticketsOfType[0].price).toFixed(2)} each</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <Separator />
              
              <div className="flex justify-between font-semibold">
                <span>Total Amount</span>
                <span>${totalAmount.toFixed(2)}</span>
              </div>
              
              <div className="pt-2 mt-4 border-t border-gray-100">
                <h4 className="font-medium mb-2">Attendee Information</h4>
                <div className="bg-gray-50 p-3 rounded-md">
                  <div className="flex items-center text-sm mb-1">
                    <User className="h-4 w-4 text-gray-400 mr-2" />
                    {tickets[0].attendeeName}
                  </div>
                  <div className="flex items-center text-sm">
                    <Mail className="h-4 w-4 text-gray-400 mr-2" />
                    {tickets[0].attendeeEmail}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              onClick={() => setLocation("/my-tickets")}
            >
              View All Tickets
            </Button>
            
            <Button 
              onClick={() => handleAddToWallet(tickets[0].id)}
              disabled={isAddingToWallet}
              className="bg-primary hover:bg-primary/90"
            >
              {isAddingToWallet ? "Adding to Wallet..." : "Add to Wallet"}
            </Button>
          </CardFooter>
        </Card>
        
        <h2 className="text-xl font-semibold mb-4">Your Tickets</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tickets.map(ticket => (
            <Card key={ticket.id} className="overflow-hidden">
              <div className="bg-primary text-white font-medium px-4 py-2">
                Ticket #{ticket.id}
              </div>
              <CardContent className="pt-4">
                <div className="flex justify-between mb-3">
                  <div>
                    <h4 className="font-semibold">{ticket.ticketTypeName}</h4>
                    <p className="text-sm text-gray-500">
                      {ticket.attendeeName}
                    </p>
                  </div>
                  <div className="text-center">
                    <QrCode className="h-16 w-16 text-gray-800 mb-1" />
                    <span className="text-xs text-gray-500 block">
                      Scan to validate
                    </span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between bg-gray-50">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => handleDownloadTicket(ticket.id)}
                  className="flex items-center gap-1 text-primary"
                >
                  <Download className="h-4 w-4" />
                  Download
                </Button>
                <span className="text-xs text-gray-500 pt-1">
                  Ticket ID: {ticket.uuid.substring(0, 8)}
                </span>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PaymentConfirmation;