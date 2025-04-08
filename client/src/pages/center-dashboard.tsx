import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, PlusCircle, X, Check, Edit, Trash, Calendar, Clock, User, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

// UI Components
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";

// Define types
interface Venue {
  id: number;
  name: string;
  description: string | null;
  location: string;
  capacity: number | null;
  hourlyRate: string;
  dailyRate: string | null;
  facilities: string[] | null;
  availabilityHours: Record<string, string> | null;
  ownerId: number;
  images: string[] | null;
  isActive: boolean;
  createdAt: string;
}

interface Rental {
  id: number;
  venueId: number;
  customerId: number;
  startTime: string;
  endTime: string;
  totalPrice: string;
  status: "pending" | "confirmed" | "canceled" | "completed";
  paymentStatus: "unpaid" | "paid" | "refunded";
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  venueName?: string;
}

// Form validation schemas
const venueFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  location: z.string().min(1, "Location is required"),
  capacity: z.coerce.number().optional(),
  hourlyRate: z.coerce.number().min(0.01, "Hourly rate must be greater than 0")
    .transform(val => String(val)), // Convert to string for API compatibility
  dailyRate: z.coerce.number().optional()
    .transform(val => val ? String(val) : undefined), // Convert to string for API compatibility
  facilities: z.string().optional().transform(val => 
    val ? val.split(',').map(item => item.trim()) : []
  ),
  availabilityHours: z.string().optional().transform(val => {
    if (!val) return {};
    try {
      return JSON.parse(val);
    } catch {
      return {};
    }
  }),
  images: z.string().optional().transform(val => 
    val ? val.split(',').map(item => item.trim()) : []
  ),
  isActive: z.boolean().default(true)
});

export default function CenterDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<string>("venues");
  const [isCreateVenueDialogOpen, setIsCreateVenueDialogOpen] = useState(false);
  const [isEditVenueDialogOpen, setIsEditVenueDialogOpen] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [isRentalDetailsDialogOpen, setIsRentalDetailsDialogOpen] = useState(false);
  
  // Form for creating/editing venues
  const venueForm = useForm<z.infer<typeof venueFormSchema>>({
    resolver: zodResolver(venueFormSchema),
    defaultValues: {
      name: "",
      description: "",
      location: "",
      capacity: undefined,
      hourlyRate: "0", // String for API compatibility
      dailyRate: undefined,
      facilities: "{}",
      availabilityHours: "{}",
      images: "",
      isActive: true
    }
  });
  
  // Load venues
  const { 
    data: venues = [], 
    isLoading: venuesLoading, 
    error: venuesError 
  } = useQuery<Venue[]>({
    queryKey: ["/api/venues"],
    enabled: user?.role === "center"
  });
  
  // Load rentals
  const { 
    data: rentals = [], 
    isLoading: rentalsLoading, 
    error: rentalsError 
  } = useQuery<Rental[]>({
    queryKey: ["/api/rentals"],
    enabled: user?.role === "center"
  });
  
  // Create venue mutation
  const createVenueMutation = useMutation({
    mutationFn: async (data: z.infer<typeof venueFormSchema>) => {
      const res = await apiRequest("POST", "/api/venues", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Venue created",
        description: "Your venue has been created successfully.",
      });
      setIsCreateVenueDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] });
      venueForm.reset();
    },
    onError: (error) => {
      console.error("Error creating venue:", error);
      toast({
        title: "Error",
        description: "Failed to create venue. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Update venue mutation
  const updateVenueMutation = useMutation({
    mutationFn: async ({ venueId, data }: { venueId: number, data: z.infer<typeof venueFormSchema> }) => {
      const res = await apiRequest("PUT", `/api/venues/${venueId}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Venue updated",
        description: "Your venue has been updated successfully.",
      });
      setIsEditVenueDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] });
    },
    onError: (error) => {
      console.error("Error updating venue:", error);
      toast({
        title: "Error",
        description: "Failed to update venue. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Delete venue mutation
  const deleteVenueMutation = useMutation({
    mutationFn: async (venueId: number) => {
      await apiRequest("DELETE", `/api/venues/${venueId}`);
    },
    onSuccess: () => {
      toast({
        title: "Venue deleted",
        description: "The venue has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/venues"] });
    },
    onError: (error) => {
      console.error("Error deleting venue:", error);
      toast({
        title: "Error",
        description: "Failed to delete venue. It might have active rentals.",
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
        title: "Rental updated",
        description: "The rental status has been updated successfully.",
      });
      setIsRentalDetailsDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/rentals"] });
    },
    onError: (error) => {
      console.error("Error updating rental status:", error);
      toast({
        title: "Error",
        description: "Failed to update rental status. Please try again.",
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
  
  // Handle form submission for creating a venue
  const onCreateVenue = (data: z.infer<typeof venueFormSchema>) => {
    createVenueMutation.mutate(data);
  };
  
  // Handle form submission for editing a venue
  const onEditVenue = (data: z.infer<typeof venueFormSchema>) => {
    if (!selectedVenue) return;
    updateVenueMutation.mutate({ venueId: selectedVenue.id, data });
  };
  
  // Open the edit venue dialog and populate form
  const handleEditVenue = (venue: Venue) => {
    setSelectedVenue(venue);
    
    // Transform data for the form
    const facilitiesString = venue.facilities ? venue.facilities.join(", ") : "";
    const availabilityHoursString = venue.availabilityHours 
      ? JSON.stringify(venue.availabilityHours) 
      : "";
    const imagesString = venue.images ? venue.images.join(", ") : "";
    
    venueForm.reset({
      name: venue.name,
      description: venue.description || "",
      location: venue.location,
      capacity: venue.capacity || undefined,
      hourlyRate: venue.hourlyRate, // Already a string from the API
      dailyRate: venue.dailyRate,
      facilities: facilitiesString,
      availabilityHours: availabilityHoursString,
      images: imagesString,
      isActive: venue.isActive
    } as any);
    
    setIsEditVenueDialogOpen(true);
  };
  
  // Handle confirming deletion of a venue
  const handleDeleteVenue = (venue: Venue) => {
    if (confirm(`Are you sure you want to delete "${venue.name}"? This cannot be undone.`)) {
      deleteVenueMutation.mutate(venue.id);
    }
  };
  
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
  
  // Handle opening create venue dialog and reset form
  const handleOpenCreateVenueDialog = () => {
    venueForm.reset({
      name: "",
      description: "",
      location: "",
      capacity: undefined,
      hourlyRate: "0", // String for API compatibility
      dailyRate: undefined,
      facilities: "{}",
      availabilityHours: "{}",
      images: "",
      isActive: true
    } as any);
    setIsCreateVenueDialogOpen(true);
  };
  
  // Redirect if not a center role
  if (!authLoading && user?.role !== "center") {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Access Denied</h1>
          <p className="mt-2 text-muted-foreground">
            You need to have a center role to access this page.
          </p>
        </div>
      </div>
    );
  }
  
  // Loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Center Dashboard</h1>
          <p className="text-muted-foreground">
            Manage your venues and rentals
          </p>
        </div>
        
        {activeTab === "venues" && (
          <Button onClick={handleOpenCreateVenueDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Venue
          </Button>
        )}
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-[400px] grid-cols-2">
          <TabsTrigger value="venues">Venues</TabsTrigger>
          <TabsTrigger value="rentals">Rentals</TabsTrigger>
        </TabsList>
        
        <div className="mt-6">
          {/* Venues Tab */}
          <TabsContent value="venues">
            {venuesLoading ? (
              <div className="flex justify-center my-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : venuesError ? (
              <div className="text-center my-8 text-destructive">
                Error loading venues
              </div>
            ) : venues && venues.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {venues.map((venue: Venue) => (
                  <Card key={venue.id} className={venue.isActive ? "" : "opacity-60"}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg font-bold">{venue.name}</CardTitle>
                        <div className="flex space-x-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEditVenue(venue)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDeleteVenue(venue)}
                          >
                            <Trash className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <CardDescription className="flex items-center">
                        <span className="truncate">{venue.location}</span>
                        {!venue.isActive && (
                          <Badge variant="outline" className="ml-2">Inactive</Badge>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {venue.description && <p className="text-sm mb-2 line-clamp-2">{venue.description}</p>}
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="font-medium">Hourly Rate:</span>
                          <span>${Number(venue.hourlyRate).toFixed(2)}</span>
                        </div>
                        {venue.capacity && (
                          <div className="flex justify-between">
                            <span className="font-medium">Capacity:</span>
                            <span>{venue.capacity} people</span>
                          </div>
                        )}
                        {venue.facilities && venue.facilities.length > 0 && (
                          <div className="pt-2">
                            <span className="font-medium">Facilities:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {venue.facilities.slice(0, 3).map((facility, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {facility}
                                </Badge>
                              ))}
                              {venue.facilities.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{venue.facilities.length - 3} more
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="text-center my-8">
                <p className="text-muted-foreground">No venues found</p>
                <Button 
                  variant="outline" 
                  className="mt-2"
                  onClick={handleOpenCreateVenueDialog}
                >
                  Create your first venue
                </Button>
              </div>
            )}
          </TabsContent>
          
          {/* Rentals Tab */}
          <TabsContent value="rentals">
            {rentalsLoading ? (
              <div className="flex justify-center my-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : rentalsError ? (
              <div className="text-center my-8 text-destructive">
                Error loading rentals
              </div>
            ) : rentals && rentals.length > 0 ? (
              <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left py-3 px-4 font-medium">Venue</th>
                        <th className="text-left py-3 px-4 font-medium">Date & Time</th>
                        <th className="text-left py-3 px-4 font-medium">Amount</th>
                        <th className="text-left py-3 px-4 font-medium">Status</th>
                        <th className="text-left py-3 px-4 font-medium">Payment</th>
                        <th className="text-left py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rentals.map((rental: Rental) => (
                        <tr 
                          key={rental.id}
                          className="border-t hover:bg-muted/50 cursor-pointer"
                          onClick={() => handleViewRental(rental)}
                        >
                          <td className="py-3 px-4">
                            {rental.venueName || `Venue #${rental.venueId}`}
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-sm">
                              {format(new Date(rental.startTime), "MMMM dd, yyyy")}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {format(new Date(rental.startTime), "h:mm a")} - {format(new Date(rental.endTime), "h:mm a")}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            ${Number(rental.totalPrice).toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <StatusBadge status={rental.status} />
                          </td>
                          <td className="py-3 px-4">
                            <PaymentStatusBadge status={rental.paymentStatus} />
                          </td>
                          <td className="py-3 px-4">
                            <Button variant="ghost" size="sm">
                              View Details
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center my-8">
                <p className="text-muted-foreground">No rentals found</p>
              </div>
            )}
          </TabsContent>
        </div>
      </Tabs>
      
      {/* Create Venue Dialog */}
      <Dialog open={isCreateVenueDialogOpen} onOpenChange={setIsCreateVenueDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Create New Venue</DialogTitle>
            <DialogDescription>
              Add details about your venue. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...venueForm}>
            <form onSubmit={venueForm.handleSubmit(onCreateVenue)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={venueForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Room 1, Conference Hall, etc." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={venueForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Building A, Floor 2, etc." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={venueForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Brief description of the venue"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={venueForm.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          value={field.value || ""}
                          placeholder="Max people"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={venueForm.control}
                  name="hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hourly Rate ($) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          {...field} 
                          placeholder="0.00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={venueForm.control}
                  name="dailyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Daily Rate ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          {...field} 
                          value={field.value || ""}
                          placeholder="0.00" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={venueForm.control}
                name="facilities"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facilities</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Projector, Wi-Fi, AC, etc. (comma separated)"
                      />
                    </FormControl>
                    <FormDescription>
                      Enter facilities separated by commas
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={venueForm.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Images</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Image URLs (comma separated)"
                      />
                    </FormControl>
                    <FormDescription>
                      Enter image URLs separated by commas
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={venueForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer">Venue is active and available for rentals</FormLabel>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateVenueDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createVenueMutation.isPending}
                >
                  {createVenueMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Venue
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Venue Dialog */}
      <Dialog open={isEditVenueDialogOpen} onOpenChange={setIsEditVenueDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Venue</DialogTitle>
            <DialogDescription>
              Update details about your venue. Fields marked with * are required.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...venueForm}>
            <form onSubmit={venueForm.handleSubmit(onEditVenue)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField
                  control={venueForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Room 1, Conference Hall, etc." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={venueForm.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Location *</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Building A, Floor 2, etc." />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={venueForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Brief description of the venue"
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField
                  control={venueForm.control}
                  name="capacity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Capacity</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          {...field} 
                          value={field.value || ""}
                          placeholder="Max people"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={venueForm.control}
                  name="hourlyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hourly Rate ($) *</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          {...field} 
                          placeholder="0.00"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={venueForm.control}
                  name="dailyRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Daily Rate ($)</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          step="0.01"
                          {...field} 
                          value={field.value || ""}
                          placeholder="0.00" 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={venueForm.control}
                name="facilities"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facilities</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Projector, Wi-Fi, AC, etc. (comma separated)"
                      />
                    </FormControl>
                    <FormDescription>
                      Enter facilities separated by commas
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={venueForm.control}
                name="images"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Images</FormLabel>
                    <FormControl>
                      <Input 
                        {...field} 
                        placeholder="Image URLs (comma separated)"
                      />
                    </FormControl>
                    <FormDescription>
                      Enter image URLs separated by commas
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={venueForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center space-x-2 space-y-0">
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </FormControl>
                    <FormLabel className="cursor-pointer">Venue is active and available for rentals</FormLabel>
                  </FormItem>
                )}
              />
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditVenueDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={updateVenueMutation.isPending}
                >
                  {updateVenueMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Update Venue
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Rental Details Dialog */}
      <Dialog open={isRentalDetailsDialogOpen} onOpenChange={setIsRentalDetailsDialogOpen}>
        {selectedRental && (
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Rental Details</DialogTitle>
              <DialogDescription>
                Manage booking information and status
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Venue</h3>
                  <p className="font-medium">{selectedRental.venueName || `Venue #${selectedRental.venueId}`}</p>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Amount</h3>
                  <p className="font-medium">${Number(selectedRental.totalPrice).toFixed(2)}</p>
                </div>
              </div>
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Date</h3>
                  </div>
                  <p>
                    {format(new Date(selectedRental.startTime), "MMMM dd, yyyy")}
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <h3 className="text-sm font-medium">Time</h3>
                  </div>
                  <p>
                    {format(new Date(selectedRental.startTime), "h:mm a")} - {format(new Date(selectedRental.endTime), "h:mm a")}
                  </p>
                </div>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-medium">Customer ID</h3>
                </div>
                <p>{selectedRental.customerId}</p>
              </div>
              
              {selectedRental.notes && (
                <>
                  <Separator />
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Notes</h3>
                    <p className="text-sm">{selectedRental.notes}</p>
                  </div>
                </>
              )}
              
              <Separator />
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Booking Status</h3>
                  <div className="flex items-center">
                    <StatusBadge status={selectedRental.status} />
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      size="sm" 
                      variant={selectedRental.status === "pending" ? "default" : "outline"}
                      onClick={() => handleUpdateRentalStatus("pending")}
                      disabled={updateRentalStatusMutation.isPending}
                    >
                      Pending
                    </Button>
                    <Button 
                      size="sm" 
                      variant={selectedRental.status === "confirmed" ? "default" : "outline"}
                      onClick={() => handleUpdateRentalStatus("confirmed")}
                      disabled={updateRentalStatusMutation.isPending}
                    >
                      Confirm
                    </Button>
                    <Button 
                      size="sm" 
                      variant={selectedRental.status === "completed" ? "default" : "outline"}
                      onClick={() => handleUpdateRentalStatus("completed")}
                      disabled={updateRentalStatusMutation.isPending}
                    >
                      Complete
                    </Button>
                    <Button 
                      size="sm" 
                      variant={selectedRental.status === "canceled" ? "destructive" : "outline"}
                      onClick={() => handleUpdateRentalStatus("canceled")}
                      disabled={updateRentalStatusMutation.isPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Payment Status</h3>
                  <div className="flex items-center">
                    <PaymentStatusBadge status={selectedRental.paymentStatus} />
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    <Button 
                      size="sm" 
                      variant={selectedRental.paymentStatus === "unpaid" ? "default" : "outline"}
                      onClick={() => handleUpdatePaymentStatus("unpaid")}
                      disabled={updatePaymentStatusMutation.isPending}
                    >
                      Unpaid
                    </Button>
                    <Button 
                      size="sm" 
                      variant={selectedRental.paymentStatus === "paid" ? "default" : "outline"}
                      onClick={() => handleUpdatePaymentStatus("paid")}
                      disabled={updatePaymentStatusMutation.isPending}
                    >
                      <DollarSign className="h-4 w-4 mr-1" />
                      Mark Paid
                    </Button>
                    <Button 
                      size="sm" 
                      variant={selectedRental.paymentStatus === "refunded" ? "destructive" : "outline"}
                      onClick={() => handleUpdatePaymentStatus("refunded")}
                      disabled={updatePaymentStatusMutation.isPending}
                    >
                      Refund
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setIsRentalDetailsDialogOpen(false)}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

// Helper Components for Status Badges
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "pending":
      return <Badge variant="outline">Pending</Badge>;
    case "confirmed":
      return <Badge className="bg-blue-500">Confirmed</Badge>;
    case "completed":
      return <Badge className="bg-green-500">Completed</Badge>;
    case "canceled":
      return <Badge variant="destructive">Canceled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function PaymentStatusBadge({ status }: { status: string }) {
  switch (status) {
    case "unpaid":
      return <Badge variant="outline" className="text-amber-500 border-amber-500">Unpaid</Badge>;
    case "paid":
      return <Badge className="bg-green-500">Paid</Badge>;
    case "refunded":
      return <Badge variant="secondary">Refunded</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}