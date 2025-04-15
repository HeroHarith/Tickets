import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute, useLocation } from "wouter";
import { useState } from "react";
import { Calendar, MapPin, CreditCard, Mail, User, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import SocialShare from "@/components/ui/social-share";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Event, TicketType, PurchaseTicketInput, AttendeeDetails, attendeeDetailsSchema } from "@shared/schema";
import TabsComponent from "@/components/ui/tabs-component";
import { useAuth } from "@/hooks/use-auth";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Card, CardHeader, CardContent, CardFooter } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import PaymentService, { CustomerDetails } from "@/services/PaymentService";

type TicketSelection = {
  ticketTypeId: number;
  quantity: number;
  attendeeDetails?: AttendeeDetails[];
};

// Form schema for customer details
const customerDetailsSchema = attendeeDetailsSchema.extend({
  saveToWallet: z.boolean().default(false),
  agreeToTerms: z.boolean().refine(val => val === true, {
    message: "You must agree to the terms and conditions."
  })
});

const EventDetails = () => {
  const [, setLocation] = useLocation();
  const [match, params] = useRoute<{ id: string }>("/events/:id");
  const { toast } = useToast();
  const { user } = useAuth();
  
  const [ticketSelections, setTicketSelections] = useState<TicketSelection[]>([]);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  
  // Initialize form with default values
  const form = useForm<z.infer<typeof customerDetailsSchema>>({
    resolver: zodResolver(customerDetailsSchema),
    defaultValues: {
      fullName: user?.name || "",
      email: user?.email || "",
      phone: "",
      specialRequirements: "",
      saveToWallet: true,
      agreeToTerms: false
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
  
  const handleProceedToCheckout = () => {
    if (ticketSelections.length === 0) {
      toast({
        title: "No tickets selected",
        description: "Please select at least one ticket to purchase.",
        variant: "destructive",
      });
      return;
    }
    
    setShowCheckout(true);
  };
  
  const handleBackToSelection = () => {
    setShowCheckout(false);
  };
  
  const handlePurchase = async (values: z.infer<typeof customerDetailsSchema>) => {
    try {
      // Reset payment states
      setIsProcessingPayment(true);
      setPaymentError(null);
      
      // Get attendee details from form
      const { saveToWallet, agreeToTerms, ...customerDetails } = values;
      
      // Prepare customer details for Thawani
      const [firstName, ...lastNameParts] = customerDetails.fullName.split(' ');
      const lastName = lastNameParts.join(' ') || firstName;
      
      const thawaniCustomer: CustomerDetails = {
        firstName,
        lastName,
        email: customerDetails.email,
        phone: customerDetails.phone || '9999999999' // Phone is required by Thawani
      };
      
      // Create quantities object for the payment request
      const quantities: Record<number, number> = {};
      ticketSelections.forEach(selection => {
        quantities[selection.ticketTypeId] = selection.quantity;
      });
      
      // Create payment session with Thawani
      const paymentSession = await PaymentService.createTicketPayment(
        eventId,
        quantities,
        thawaniCustomer
      );
      
      if (!paymentSession) {
        setPaymentError('Failed to create payment session');
        setIsProcessingPayment(false);
        toast({
          title: "Payment Error",
          description: "There was an error setting up the payment. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      // Open the checkout page in a new window
      const checkoutWindow = PaymentService.openCheckoutPage(paymentSession.checkout_url);
      
      // Show success message
      toast({
        title: "Payment Initiated",
        description: "We've opened the payment page in a new window. Complete your payment there.",
        variant: "default",
      });
      
      // Store the purchase data in local storage to be used after payment completes
      localStorage.setItem('pendingPurchase', JSON.stringify({
        eventId,
        customerDetails,
        ticketSelections: ticketSelections
          .filter(ts => ts.quantity > 0)
          .map(ts => ({
            ...ts,
            attendeeDetails: ts.attendeeDetails || Array(ts.quantity).fill(customerDetails)
          })),
        sessionId: paymentSession.session_id
      }));
      
      setIsProcessingPayment(false);
    } catch (error: any) {
      console.error('Payment error:', error);
      setPaymentError(error.message || 'Payment processing error');
      setIsProcessingPayment(false);
      toast({
        title: "Payment Error",
        description: error.message || "There was an error processing your payment.",
        variant: "destructive",
      });
    }
  };
  
  if (eventQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TabsComponent
          tabs={getNavTabs()}
          activeTab="browse"
        />
        
        <div className="animate-pulse mt-6">
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
        <TabsComponent
          tabs={getNavTabs()}
          activeTab="browse"
        />
        
        <div className="text-center py-12 mt-6">
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
    // Make sure startDate is valid before creating a Date object
    if (!startDate || isNaN(Date.parse(startDate))) {
      return "Date not specified";
    }
    
    const start = new Date(startDate);
    
    if (!endDate) {
      return format(start, "MMMM d, yyyy");
    }
    
    // Make sure endDate is valid before creating a Date object
    if (isNaN(Date.parse(endDate))) {
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
      <TabsComponent
        tabs={getNavTabs()}
        activeTab="browse"
      />
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
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
            {category && (
              <div className="flex items-center text-sm text-gray-600">
                <span className="bg-accent text-white text-xs font-bold px-2 py-1 rounded">
                  {category.toUpperCase()}
                </span>
              </div>
            )}
          </div>
        </div>
        
        <div className="md:col-span-2">
          <div className="flex justify-between items-start mb-2">
            <h1 className="text-2xl font-bold font-poppins text-gray-900">
              {title}
            </h1>
            <SocialShare 
              title={title}
              description={description}
              url={window.location.href}
              imageUrl={imageUrl || undefined}
            />
          </div>
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
          
          {showCheckout ? (
            <Card className="mt-6">
              <CardHeader>
                <h2 className="text-xl font-semibold">Customer Details</h2>
                <p className="text-sm text-gray-500">
                  Please provide your details to complete your purchase
                </p>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(handlePurchase)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="fullName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Full Name</FormLabel>
                          <FormControl>
                            <div className="flex items-center border rounded-md pl-2">
                              <User className="h-4 w-4 text-gray-400 mr-2" />
                              <Input 
                                placeholder="John Doe" 
                                {...field} 
                                className="border-0 focus-visible:ring-0"
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <div className="flex items-center border rounded-md pl-2">
                              <Mail className="h-4 w-4 text-gray-400 mr-2" />
                              <Input 
                                placeholder="you@example.com" 
                                type="email" 
                                {...field} 
                                className="border-0 focus-visible:ring-0" 
                              />
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone (optional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="+1 (555) 123-4567" 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="specialRequirements"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Special Requirements (optional)</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="Accessibility requirements, dietary restrictions, etc." 
                              {...field} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="saveToWallet"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 px-1 pb-2">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              Save ticket to Apple/Google Wallet
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="agreeToTerms"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-3 space-y-0 px-1">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <div className="space-y-1 leading-none">
                            <FormLabel>
                              I agree to the terms and conditions
                            </FormLabel>
                          </div>
                        </FormItem>
                      )}
                    />
                    
                    {paymentError && (
                      <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 my-4">
                        <p className="text-sm font-medium">Payment Error: {paymentError}</p>
                        <p className="text-xs mt-1">Please try again or contact support if the problem persists.</p>
                      </div>
                    )}
                    
                    <div className="bg-gray-50 rounded-md p-4 my-6">
                      <h3 className="font-semibold mb-2">Order Summary</h3>
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
                    </div>
                    
                    <div className="flex justify-between pt-4">
                      <Button 
                        type="button" 
                        variant="outline" 
                        onClick={handleBackToSelection}
                      >
                        Back
                      </Button>
                      <Button 
                        type="submit" 
                        disabled={isProcessingPayment || purchaseMutation.isPending}
                        className="bg-primary hover:bg-primary/90"
                      >
                        {isProcessingPayment ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Processing Payment...
                          </>
                        ) : purchaseMutation.isPending ? (
                          "Processing..."
                        ) : (
                          "Pay Now"
                        )}
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          ) : (
            <div className="flex justify-end">
              <Button
                onClick={handleProceedToCheckout}
                disabled={ticketSelections.length === 0}
                className="w-full md:w-auto bg-primary hover:bg-primary/90"
              >
                Proceed to Checkout
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventDetails;
