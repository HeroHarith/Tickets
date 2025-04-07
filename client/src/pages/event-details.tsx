import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useState } from "react";
import { Calendar, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Event, TicketType, PurchaseTicketInput } from "@shared/schema";

type TicketSelection = {
  ticketTypeId: number;
  quantity: number;
};

const EventDetails = () => {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute<{ id: string }>("/events/:id");
  const { toast } = useToast();
  
  const [ticketSelections, setTicketSelections] = useState<TicketSelection[]>([]);
  
  const eventId = match ? parseInt(params.id) : -1;
  
  // Fetch event details
  const eventQuery = useQuery<Event & { ticketTypes: TicketType[] }>({
    queryKey: [`/api/events/${eventId}`],
    enabled: eventId > 0,
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}`);
      if (!res.ok) throw new Error("Failed to fetch event details");
      return res.json();
    }
  });
  
  // Purchase tickets mutation
  const purchaseMutation = useMutation({
    mutationFn: (data: PurchaseTicketInput) => 
      apiRequest("POST", "/api/tickets/purchase", data),
    onSuccess: () => {
      toast({
        title: "Purchase successful!",
        description: "Your tickets have been reserved.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/tickets/user"] });
      setLocation("/my-tickets");
    },
    onError: (error: Error) => {
      toast({
        title: "Purchase failed",
        description: error.message || "There was an error processing your purchase.",
        variant: "destructive",
      });
    }
  });
  
  const handleQuantityChange = (ticketTypeId: number, change: number) => {
    setTicketSelections(current => {
      const existing = current.find(ts => ts.ticketTypeId === ticketTypeId);
      
      if (existing) {
        const newQuantity = Math.max(0, existing.quantity + change);
        if (newQuantity === 0) {
          return current.filter(ts => ts.ticketTypeId !== ticketTypeId);
        } else {
          return current.map(ts => 
            ts.ticketTypeId === ticketTypeId 
              ? { ...ts, quantity: newQuantity } 
              : ts
          );
        }
      } else if (change > 0) {
        return [...current, { ticketTypeId, quantity: 1 }];
      }
      
      return current;
    });
  };
  
  const getTicketQuantity = (ticketTypeId: number) => {
    const selection = ticketSelections.find(ts => ts.ticketTypeId === ticketTypeId);
    return selection ? selection.quantity : 0;
  };
  
  const calculateTotal = () => {
    if (!eventQuery.data?.ticketTypes) return 0;
    
    return ticketSelections.reduce((total, selection) => {
      const ticketType = eventQuery.data.ticketTypes.find(tt => tt.id === selection.ticketTypeId);
      if (ticketType) {
        return total + (Number(ticketType.price) * selection.quantity);
      }
      return total;
    }, 0);
  };
  
  const calculateServiceFee = () => {
    // Simple service fee calculation: 5% of total
    return calculateTotal() * 0.05;
  };
  
  const calculateGrandTotal = () => {
    return calculateTotal() + calculateServiceFee();
  };
  
  const handlePurchase = () => {
    if (ticketSelections.length === 0) {
      toast({
        title: "No tickets selected",
        description: "Please select at least one ticket to purchase.",
        variant: "destructive",
      });
      return;
    }
    
    purchaseMutation.mutate({
      eventId,
      ticketSelections: ticketSelections.filter(ts => ts.quantity > 0)
    });
  };
  
  if (eventQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1">
              <div className="h-60 bg-gray-200 rounded-lg mb-4"></div>
              <div className="space-y-2">
                <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                <div className="h-5 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
            <div className="md:col-span-2">
              <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
              <div className="h-24 bg-gray-200 rounded w-full mb-6"></div>
              <div className="space-y-4">
                <div className="h-16 bg-gray-200 rounded w-full"></div>
                <div className="h-16 bg-gray-200 rounded w-full"></div>
                <div className="h-16 bg-gray-200 rounded w-full"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (eventQuery.error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-12">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Event Not Found</h2>
          <p className="text-gray-600 mb-6">The event you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => setLocation("/")}>Browse Events</Button>
        </div>
      </div>
    );
  }
  
  if (!eventQuery.data) return null;
  
  const { title, description, location, startDate, endDate, category, imageUrl, ticketTypes } = eventQuery.data;
  
  // Format dates
  const formatEventDate = () => {
    const start = new Date(startDate);
    
    if (!endDate) {
      return format(start, "MMMM d, yyyy");
    }
    
    const end = new Date(endDate);
    
    if (start.toDateString() === end.toDateString()) {
      return format(start, "MMMM d, yyyy");
    }
    
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${format(start, "MMMM d")}-${format(end, "d, yyyy")}`;
    }
    
    return `${format(start, "MMMM d, yyyy")} - ${format(end, "MMMM d, yyyy")}`;
  };
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <div className="h-60 bg-gray-200 rounded-lg overflow-hidden mb-4">
            <img 
              src={imageUrl || "https://images.unsplash.com/photo-1501281668745-f7f57925c3b4?ixlib=rb-1.2.1&auto=format&fit=crop&w=800&q=80"} 
              alt={title}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center text-sm text-gray-600">
              <Calendar className="h-5 w-5 mr-2 text-gray-400" />
              {formatEventDate()}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="h-5 w-5 mr-2 text-gray-400" />
              {location}
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <span className="bg-accent text-white text-xs font-bold px-2 py-1 rounded">
                {category.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
        
        <div className="md:col-span-2">
          <h1 className="text-2xl font-bold font-poppins text-gray-900 mb-2">
            {title}
          </h1>
          <p className="text-gray-700 mb-6">
            {description}
          </p>
          
          <div className="border-t border-b border-gray-200 py-4 mb-6">
            <h2 className="text-lg font-semibold font-poppins mb-3">Available Tickets</h2>
            <div className="space-y-3">
              {ticketTypes && ticketTypes.length > 0 ? (
                ticketTypes.map(ticketType => (
                  <div key={ticketType.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-md">
                    <div>
                      <div className="font-medium">{ticketType.name}</div>
                      <div className="text-sm text-gray-500">{ticketType.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">${Number(ticketType.price).toFixed(2)}</div>
                      <div className={`text-sm ${
                        ticketType.availableQuantity === 0 
                          ? "text-gray-500" 
                          : ticketType.availableQuantity < 10 
                            ? "text-amber-500" 
                            : "text-success"
                      }`}>
                        {ticketType.availableQuantity === 0 
                          ? "Sold out" 
                          : ticketType.availableQuantity < 10 
                            ? "Almost sold out" 
                            : "Available"}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500">No tickets available for this event.</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="mb-6">
            <h2 className="text-lg font-semibold font-poppins mb-3">Select Tickets</h2>
            <div className="space-y-3">
              {ticketTypes && ticketTypes.map(ticketType => (
                <div 
                  key={ticketType.id} 
                  className="flex items-center justify-between bg-gray-50 p-3 rounded-md"
                >
                  <div>
                    <span className="font-medium">{ticketType.name}</span>
                    <span className="text-gray-500 ml-2">(${Number(ticketType.price).toFixed(2)} each)</span>
                  </div>
                  <div className="flex items-center">
                    <button 
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center"
                      onClick={() => handleQuantityChange(ticketType.id, -1)}
                      disabled={getTicketQuantity(ticketType.id) === 0}
                    >
                      <span className="text-lg">-</span>
                    </button>
                    <span className="mx-4 w-6 text-center">{getTicketQuantity(ticketType.id)}</span>
                    <button 
                      className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center"
                      onClick={() => handleQuantityChange(ticketType.id, 1)}
                      disabled={ticketType.availableQuantity === 0 || getTicketQuantity(ticketType.id) >= ticketType.availableQuantity}
                    >
                      <span className="text-lg">+</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="bg-gray-50 rounded-md p-4 mb-4">
            {ticketSelections.length > 0 ? (
              <>
                {ticketSelections.map(selection => {
                  const ticketType = ticketTypes?.find(tt => tt.id === selection.ticketTypeId);
                  if (!ticketType) return null;
                  return (
                    <div key={ticketType.id} className="flex justify-between mb-2">
                      <span>{ticketType.name} x{selection.quantity}</span>
                      <span>${(Number(ticketType.price) * selection.quantity).toFixed(2)}</span>
                    </div>
                  );
                })}
                <div className="flex justify-between mb-2">
                  <span>Service Fee</span>
                  <span>${calculateServiceFee().toFixed(2)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>${calculateGrandTotal().toFixed(2)}</span>
                </div>
              </>
            ) : (
              <div className="text-center py-2">
                <p className="text-gray-500">Select tickets to see total</p>
              </div>
            )}
          </div>
          
          <div className="flex justify-end">
            <Button
              onClick={handlePurchase}
              disabled={ticketSelections.length === 0 || purchaseMutation.isPending}
              className="w-full md:w-auto bg-primary hover:bg-primary/90"
            >
              {purchaseMutation.isPending ? "Processing..." : "Purchase Tickets"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDetails;
