import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";
import { CenterLayout } from "@/components/ui/center-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { 
  MoreHorizontal, 
  Loader2, 
  UserPlus, 
  Search, 
  Calendar, 
  Check, 
  X,
  Clock,
  CreditCard
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, parse, isValid, parseISO } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Venue, Rental } from "@/lib/types";

function StatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
    confirmed: "bg-green-100 text-green-700 border-green-200",
    canceled: "bg-red-100 text-red-700 border-red-200",
    completed: "bg-blue-100 text-blue-700 border-blue-200",
  };

  return (
    <Badge variant="outline" className={`${colorMap[status] || ""}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

function PaymentStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    unpaid: "bg-red-100 text-red-700 border-red-200",
    paid: "bg-green-100 text-green-700 border-green-200",
    refunded: "bg-gray-100 text-gray-700 border-gray-200",
  };

  return (
    <Badge variant="outline" className={`${colorMap[status] || ""}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

// Form validation schema for bookings
const bookingFormSchema = z.object({
  venueId: z.string().min(1, "Venue is required"),
  customerName: z.string().min(1, "Customer name is required"),
  startDate: z.string().min(1, "Start date is required"),
  startTime: z.string().min(1, "Start time is required"),
  endDate: z.string().min(1, "End date is required"),
  endTime: z.string().min(1, "End time is required"),
  notes: z.string().optional(),
  status: z.enum(["pending", "confirmed"]).default("pending"),
  paymentStatus: z.enum(["unpaid", "paid"]).default("unpaid"),
}).refine(data => {
  const startDateTime = new Date(`${data.startDate}T${data.startTime}`);
  const endDateTime = new Date(`${data.endDate}T${data.endTime}`);
  return endDateTime > startDateTime;
}, {
  message: "End time must be after start time",
  path: ["endTime"], 
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;

export default function CenterBookingsPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [isRentalDetailsDialogOpen, setIsRentalDetailsDialogOpen] = useState(false);
  const [isNewBookingDialogOpen, setIsNewBookingDialogOpen] = useState(false);
  
  // Form setup for creating a new booking
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      venueId: "",
      customerName: "",
      startDate: format(new Date(), "yyyy-MM-dd"),
      startTime: "09:00",
      endDate: format(new Date(), "yyyy-MM-dd"),
      endTime: "10:00",
      notes: "",
      status: "pending",
      paymentStatus: "unpaid",
    },
  });
  
  // Load venues for the dropdown
  const { 
    data: venues = [], 
    isLoading: venuesLoading 
  } = useQuery<Venue[]>({
    queryKey: ["/api/venues"],
    enabled: user?.role === "center"
  });
  
  // Load rentals
  const { 
    data: rentals = [], 
    isLoading: rentalsLoading 
  } = useQuery<Rental[]>({
    queryKey: ["/api/rentals"],
    enabled: user?.role === "center"
  });
  
  // Create booking mutation
  const createBookingMutation = useMutation({
    mutationFn: async (formData: BookingFormValues) => {
      // Format the dates and times correctly
      const startDateTime = new Date(`${formData.startDate}T${formData.startTime}`);
      const endDateTime = new Date(`${formData.endDate}T${formData.endTime}`);
      
      // Calculate total price based on venue rate and duration
      const selectedVenue = venues.find(v => v.id === parseInt(formData.venueId));
      const hourlyRate = selectedVenue?.hourlyRate ? parseFloat(selectedVenue.hourlyRate) : 0;
      
      // Calculate duration in hours
      const durationMs = endDateTime.getTime() - startDateTime.getTime();
      const durationHours = durationMs / (1000 * 60 * 60);
      const totalPrice = hourlyRate * durationHours;
      
      const rentalData = {
        venueId: parseInt(formData.venueId),
        customerId: user?.id,
        customerName: formData.customerName,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        totalPrice: totalPrice.toFixed(2),
        status: formData.status,
        paymentStatus: formData.paymentStatus,
        notes: formData.notes || undefined,
      };
      
      const res = await apiRequest("POST", "/api/rentals", rentalData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Booking created",
        description: "The booking has been created successfully.",
      });
      // Reset form and close dialog
      form.reset();
      setIsNewBookingDialogOpen(false);
      // Refresh rentals list
      queryClient.invalidateQueries({ queryKey: ["/api/rentals"] });
    },
    onError: (error) => {
      console.error("Error creating booking:", error);
      toast({
        title: "Error",
        description: "Failed to create booking. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Update rental status mutation
  const updateRentalStatusMutation = useMutation({
    mutationFn: async ({ rentalId, status }: { rentalId: number; status: string }) => {
      const res = await apiRequest("PATCH", `/api/rentals/${rentalId}/status`, { status });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Booking updated",
        description: "The booking status has been updated successfully.",
      });
      setIsRentalDetailsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/rentals"] });
    },
    onError: (error) => {
      console.error("Error updating rental status:", error);
      toast({
        title: "Error",
        description: "Failed to update booking status. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Update payment status mutation
  const updatePaymentStatusMutation = useMutation({
    mutationFn: async ({ rentalId, paymentStatus }: { rentalId: number; paymentStatus: string }) => {
      const res = await apiRequest("PATCH", `/api/rentals/${rentalId}/payment`, { paymentStatus });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Payment updated",
        description: "The payment status has been updated successfully.",
      });
      setIsRentalDetailsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/rentals"] });
    },
    onError: (error) => {
      console.error("Error updating payment status:", error);
      toast({
        title: "Error",
        description: "Failed to update payment status. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Handle viewing rental details
  const handleViewRental = (rental: Rental) => {
    setSelectedRental(rental);
    setIsRentalDetailsDialogOpen(true);
  };
  
  // Function to update rental status
  const handleUpdateRentalStatus = (status: string) => {
    if (!selectedRental) return;
    updateRentalStatusMutation.mutate({ rentalId: selectedRental.id, status });
  };
  
  // Function to update payment status
  const handleUpdatePaymentStatus = (paymentStatus: string) => {
    if (!selectedRental) return;
    updatePaymentStatusMutation.mutate({ rentalId: selectedRental.id, paymentStatus });
  };
  
  // Filter rentals based on active tab and search query
  const filteredRentals = rentals.filter(rental => {
    const matchesSearch = searchQuery === "" || 
      (rental.venueName && rental.venueName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (rental.customerName && rental.customerName.toLowerCase().includes(searchQuery.toLowerCase()));
      
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "today") {
      const today = new Date();
      const rentalDate = new Date(rental.startTime);
      return matchesSearch && 
        rentalDate.getDate() === today.getDate() &&
        rentalDate.getMonth() === today.getMonth() &&
        rentalDate.getFullYear() === today.getFullYear();
    }
    if (activeTab === "upcoming") {
      return matchesSearch && 
        new Date(rental.startTime) > new Date() && 
        rental.status !== "canceled";
    }
    if (activeTab === "active") {
      const now = new Date();
      return matchesSearch && 
        rental.status === "confirmed" && 
        new Date(rental.startTime) <= now && 
        new Date(rental.endTime) >= now;
    }
    if (activeTab === "pending") {
      return matchesSearch && rental.status === "pending";
    }
    return matchesSearch;
  });
  
  // Sort rentals by start time
  const sortedRentals = [...filteredRentals].sort((a, b) => {
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });
  
  // Loading state
  if (authLoading || rentalsLoading || venuesLoading) {
    return (
      <CenterLayout>
        <div className="h-full flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </CenterLayout>
    );
  }
  
  // Redirect if not a center role
  if (user?.role !== "center") {
    return (
      <CenterLayout>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Access Denied</h1>
            <p className="mt-2 text-muted-foreground">
              You need to have a center role to access this page.
            </p>
          </div>
        </div>
      </CenterLayout>
    );
  }

  return (
    <CenterLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Booking Management</h1>
            <p className="text-muted-foreground">
              Manage all bookings for your venues
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search bookings..."
                className="pl-8 w-full md:w-[250px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Button onClick={() => setIsNewBookingDialogOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              New Booking
            </Button>
          </div>
        </div>
        
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid grid-cols-2 md:grid-cols-5 mb-6">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
          </TabsList>
          
          <Card>
            <CardHeader className="px-6 py-4">
              <CardTitle>Bookings</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left py-3 px-6 font-medium">Venue</th>
                      <th className="text-left py-3 px-6 font-medium">Customer</th>
                      <th className="text-left py-3 px-6 font-medium">Date & Time</th>
                      <th className="text-left py-3 px-6 font-medium">Price</th>
                      <th className="text-left py-3 px-6 font-medium">Status</th>
                      <th className="text-left py-3 px-6 font-medium">Payment</th>
                      <th className="text-left py-3 px-6 font-medium">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRentals.length > 0 ? (
                      sortedRentals.map((rental) => (
                        <tr 
                          key={rental.id}
                          className="border-t hover:bg-muted/50"
                        >
                          <td className="py-4 px-6">
                            {rental.venueName || `Venue #${rental.venueId}`}
                          </td>
                          <td className="py-4 px-6">
                            {rental.customerName || `Customer #${rental.customerId}`}
                          </td>
                          <td className="py-4 px-6">
                            <div className="text-sm">
                              {format(new Date(rental.startTime), "MMMM dd, yyyy")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(rental.startTime), "h:mm a")} - {format(new Date(rental.endTime), "h:mm a")}
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            ${Number(rental.totalPrice).toFixed(2)}
                          </td>
                          <td className="py-4 px-6">
                            <StatusBadge status={rental.status} />
                          </td>
                          <td className="py-4 px-6">
                            <PaymentStatusBadge status={rental.paymentStatus} />
                          </td>
                          <td className="py-4 px-6">
                            <Button variant="ghost" size="sm" onClick={() => handleViewRental(rental)}>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="py-6 text-center text-muted-foreground">
                          No bookings found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </Tabs>
        
        {/* Booking Details Dialog */}
        <Dialog open={isRentalDetailsDialogOpen} onOpenChange={setIsRentalDetailsDialogOpen}>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Booking Details</DialogTitle>
              <DialogDescription>
                View and manage booking information
              </DialogDescription>
            </DialogHeader>
            
            {selectedRental && (
              <div className="space-y-6">
                <div className="flex flex-col space-y-1.5">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {selectedRental.venueName || `Venue #${selectedRental.venueId}`}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Booking #{selectedRental.id}
                      </p>
                    </div>
                    <div className="flex flex-col items-end">
                      <StatusBadge status={selectedRental.status} />
                      <span className="text-sm mt-1">
                        <PaymentStatusBadge status={selectedRental.paymentStatus} />
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Start Time</Label>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{format(new Date(selectedRental.startTime), "MMM dd, yyyy")}</span>
                    </div>
                    <div className="flex items-center pl-6">
                      <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{format(new Date(selectedRental.startTime), "h:mm a")}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">End Time</Label>
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{format(new Date(selectedRental.endTime), "MMM dd, yyyy")}</span>
                    </div>
                    <div className="flex items-center pl-6">
                      <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                      <span>{format(new Date(selectedRental.endTime), "h:mm a")}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Customer</Label>
                  <div className="font-medium">
                    {selectedRental.customerName || `Customer #${selectedRental.customerId}`}
                  </div>
                </div>
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Payment Information</Label>
                  <div className="bg-muted p-3 rounded-md">
                    <div className="flex justify-between">
                      <span>Total Amount:</span>
                      <span className="font-semibold">${Number(selectedRental.totalPrice).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
                {selectedRental.notes && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Notes</Label>
                    <div className="bg-muted p-3 rounded-md text-sm">
                      {selectedRental.notes}
                    </div>
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Created At</Label>
                  <div className="text-sm">
                    {format(new Date(selectedRental.createdAt), "MMM dd, yyyy h:mm a")}
                  </div>
                </div>
                
                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Label className="pt-2 sm:pt-0 sm:mr-2">Status:</Label>
                    <div className="flex gap-2 flex-wrap">
                      <Button 
                        size="sm" 
                        variant={selectedRental.status === "pending" ? "default" : "outline"}
                        disabled={selectedRental.status === "pending"}
                        onClick={() => handleUpdateRentalStatus("pending")}
                      >
                        Pending
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedRental.status === "confirmed" ? "default" : "outline"}
                        disabled={selectedRental.status === "confirmed"}
                        onClick={() => handleUpdateRentalStatus("confirmed")}
                      >
                        <Check className="mr-1 h-3 w-3" />
                        Confirm
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedRental.status === "canceled" ? "destructive" : "outline"}
                        disabled={selectedRental.status === "canceled"}
                        onClick={() => handleUpdateRentalStatus("canceled")}
                      >
                        <X className="mr-1 h-3 w-3" />
                        Cancel
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedRental.status === "completed" ? "default" : "outline"}
                        disabled={selectedRental.status === "completed"}
                        onClick={() => handleUpdateRentalStatus("completed")}
                      >
                        Complete
                      </Button>
                    </div>
                  </div>
                </DialogFooter>
                
                <DialogFooter className="flex flex-col sm:flex-row gap-2">
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <Label className="pt-2 sm:pt-0 sm:mr-2">Payment:</Label>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        variant={selectedRental.paymentStatus === "unpaid" ? "default" : "outline"}
                        disabled={selectedRental.paymentStatus === "unpaid"}
                        onClick={() => handleUpdatePaymentStatus("unpaid")}
                      >
                        Unpaid
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedRental.paymentStatus === "paid" ? "default" : "outline"}
                        disabled={selectedRental.paymentStatus === "paid"}
                        onClick={() => handleUpdatePaymentStatus("paid")}
                      >
                        <CreditCard className="mr-1 h-3 w-3" />
                        Mark Paid
                      </Button>
                      <Button 
                        size="sm" 
                        variant={selectedRental.paymentStatus === "refunded" ? "default" : "outline"}
                        disabled={selectedRental.paymentStatus === "refunded"}
                        onClick={() => handleUpdatePaymentStatus("refunded")}
                      >
                        Refunded
                      </Button>
                    </div>
                  </div>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
        
        {/* New Booking Dialog */}
        <Dialog open={isNewBookingDialogOpen} onOpenChange={setIsNewBookingDialogOpen}>
          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle>Create New Booking</DialogTitle>
              <DialogDescription>
                Add a new booking for a customer
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(data => createBookingMutation.mutate(data))} className="space-y-4 py-2">
                <FormField
                  control={form.control}
                  name="venueId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Venue</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a venue" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {venues.map(venue => (
                            <SelectItem key={venue.id} value={venue.id.toString()}>
                              {venue.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Customer Name</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Enter customer name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <Input type="date" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea 
                          {...field} 
                          placeholder="Any special requirements or notes"
                          className="min-h-[80px]"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Booking Status</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="paymentStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Payment Status</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select payment status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="unpaid">Unpaid</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <DialogFooter className="pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsNewBookingDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={createBookingMutation.isPending}
                  >
                    {createBookingMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Booking"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </CenterLayout>
  );
}