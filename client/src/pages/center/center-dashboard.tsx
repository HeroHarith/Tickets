import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { 
  Loader2, PlusCircle, X, Check, Edit, Trash, Calendar, Clock, User, DollarSign, 
  BarChart3, Users, CheckSquare, ShieldCheck, Building, Mail, Key, Shield
} from "lucide-react";
import { VenueSalesReport } from "@/components/ui/venue-sales-report";
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

interface CashierUser {
  id: number;
  username: string;
  email: string;
  name: string;
}

interface Cashier {
  id: number;
  userId: number;
  ownerId: number;
  permissions: Record<string, boolean>;
  venueIds: number[];
  createdAt: string;
  updatedAt: string;
  user?: CashierUser;
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

// Define the cashier form schema
const cashierFormSchema = z.object({
  email: z.string().email("Please provide a valid email address"),
  permissions: z.object({
    can_manage_bookings: z.boolean().default(true),
    can_manage_payments: z.boolean().default(false),
    can_view_reports: z.boolean().default(false)
  }).default({
    can_manage_bookings: true,
    can_manage_payments: false,
    can_view_reports: false
  }),
  venueIds: z.array(z.number()).default([])
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
  
  // Cashier management state
  const [isCreateCashierDialogOpen, setIsCreateCashierDialogOpen] = useState(false);
  const [isEditCashierDialogOpen, setIsEditCashierDialogOpen] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState<Cashier | null>(null);
  
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
  
  // Form for creating/editing cashiers
  const cashierForm = useForm<z.infer<typeof cashierFormSchema>>({
    resolver: zodResolver(cashierFormSchema),
    defaultValues: {
      email: "",
      permissions: {
        can_manage_bookings: true,
        can_manage_payments: false,
        can_view_reports: false
      },
      venueIds: []
    }
  });
  
  // Load venues
  const { 
    data: venuesResponse, 
    isLoading: venuesLoading, 
    error: venuesError 
  } = useQuery<{data: Venue[]}>({
    queryKey: ["/api/venues"],
    enabled: user?.role === "center"
  });
  
  // Extract venues from the standardized response format
  const venues = venuesResponse?.data || [];
  
  // Load rentals
  const { 
    data: rentalsResponse, 
    isLoading: rentalsLoading, 
    error: rentalsError 
  } = useQuery<{data: Rental[]}>({
    queryKey: ["/api/rentals"],
    enabled: user?.role === "center"
  });
  
  // Extract rentals from the standardized response format
  const rentals = rentalsResponse?.data || [];
  
  // Load cashiers
  const {
    data: cashiersResponse,
    isLoading: cashiersLoading,
    error: cashiersError
  } = useQuery<{data: Cashier[]}>({
    queryKey: ["/api/cashiers"],
    enabled: user?.role === "center"
  });
  
  // Extract cashiers from the standardized response format
  const cashiers = cashiersResponse?.data || [];
  
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
      const res = await apiRequest("PATCH", `/api/venues/${venueId}`, data);
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
  
  // Create cashier mutation
  const createCashierMutation = useMutation({
    mutationFn: async (data: z.infer<typeof cashierFormSchema>) => {
      const res = await apiRequest("POST", "/api/cashiers", data);
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Cashier added",
        description: "A new cashier has been added successfully.",
      });
      setIsCreateCashierDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/cashiers"] });
      cashierForm.reset();
    },
    onError: (error) => {
      console.error("Error creating cashier:", error);
      toast({
        title: "Error",
        description: "Failed to add cashier. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Update cashier permissions mutation
  const updateCashierPermissionsMutation = useMutation({
    mutationFn: async ({ cashierId, permissions }: { cashierId: number, permissions: Record<string, boolean> }) => {
      const res = await apiRequest("PATCH", `/api/cashiers/${cashierId}/permissions`, { permissions });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Permissions updated",
        description: "Cashier permissions have been updated successfully.",
      });
      setIsEditCashierDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/cashiers"] });
    },
    onError: (error) => {
      console.error("Error updating cashier permissions:", error);
      toast({
        title: "Error",
        description: "Failed to update permissions. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Update cashier venues mutation
  const updateCashierVenuesMutation = useMutation({
    mutationFn: async ({ cashierId, venueIds }: { cashierId: number, venueIds: number[] }) => {
      const res = await apiRequest("PATCH", `/api/cashiers/${cashierId}/venues`, { venueIds });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Venues updated",
        description: "Cashier venue access has been updated successfully.",
      });
      setIsEditCashierDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["/api/cashiers"] });
    },
    onError: (error) => {
      console.error("Error updating cashier venues:", error);
      toast({
        title: "Error",
        description: "Failed to update venue access. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Delete cashier mutation
  const deleteCashierMutation = useMutation({
    mutationFn: async (cashierId: number) => {
      await apiRequest("DELETE", `/api/cashiers/${cashierId}`);
    },
    onSuccess: () => {
      toast({
        title: "Cashier removed",
        description: "The cashier has been removed successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/cashiers"] });
    },
    onError: (error) => {
      console.error("Error deleting cashier:", error);
      toast({
        title: "Error",
        description: "Failed to remove cashier. Please try again.",
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
  
  // Handle form submission for creating a cashier
  const onCreateCashier = (data: z.infer<typeof cashierFormSchema>) => {
    createCashierMutation.mutate(data);
  };
  
  // Handle editing a cashier
  const handleEditCashier = (cashier: Cashier) => {
    setSelectedCashier(cashier);
    
    cashierForm.reset({
      email: cashier.user?.email || "",
      permissions: cashier.permissions,
      venueIds: cashier.venueIds
    });
    
    setIsEditCashierDialogOpen(true);
  };
  
  // Handle updating cashier permissions
  const handleUpdateCashierPermissions = (data: z.infer<typeof cashierFormSchema>) => {
    if (!selectedCashier) return;
    updateCashierPermissionsMutation.mutate({ 
      cashierId: selectedCashier.id, 
      permissions: data.permissions 
    });
  };
  
  // Handle updating cashier venue access
  const handleUpdateCashierVenues = (data: z.infer<typeof cashierFormSchema>) => {
    if (!selectedCashier) return;
    updateCashierVenuesMutation.mutate({ 
      cashierId: selectedCashier.id, 
      venueIds: data.venueIds 
    });
  };
  
  // Handle confirming deletion of a cashier
  const handleDeleteCashier = (cashier: Cashier) => {
    if (confirm(`Are you sure you want to remove this cashier? This action cannot be undone.`)) {
      deleteCashierMutation.mutate(cashier.id);
    }
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
            Manage your venues, rentals, and staff
          </p>
        </div>
        
        {activeTab === "venues" && (
          <Button onClick={handleOpenCreateVenueDialog}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Venue
          </Button>
        )}
        
        {activeTab === "cashiers" && (
          <Button onClick={() => setIsCreateCashierDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Cashier
          </Button>
        )}
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full md:w-[800px] grid-cols-4">
          <TabsTrigger value="venues">Venues</TabsTrigger>
          <TabsTrigger value="rentals">Rentals</TabsTrigger>
          <TabsTrigger value="cashiers" className="flex items-center">
            <Users className="mr-2 h-4 w-4" />
            Cashiers
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center">
            <BarChart3 className="mr-2 h-4 w-4" />
            Sales Reports
          </TabsTrigger>
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
          
          {/* Cashiers Tab */}
          <TabsContent value="cashiers">
            {cashiersLoading ? (
              <div className="flex justify-center my-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : cashiersError ? (
              <div className="text-center my-8 text-destructive">
                Error loading cashiers
              </div>
            ) : cashiers && cashiers.length > 0 ? (
              <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted">
                        <th className="text-left py-3 px-4 font-medium">Name</th>
                        <th className="text-left py-3 px-4 font-medium">Email</th>
                        <th className="text-left py-3 px-4 font-medium">Permissions</th>
                        <th className="text-left py-3 px-4 font-medium">Assigned Venues</th>
                        <th className="text-left py-3 px-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cashiers.map((cashier: Cashier) => (
                        <tr 
                          key={cashier.id}
                          className="border-t hover:bg-muted/50"
                        >
                          <td className="py-3 px-4">
                            {cashier.user?.name || "N/A"}
                          </td>
                          <td className="py-3 px-4">
                            {cashier.user?.email || "N/A"}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {cashier.permissions.can_manage_bookings && (
                                <Badge variant="secondary" className="text-xs">
                                  <CheckSquare className="h-3 w-3 mr-1" />
                                  Bookings
                                </Badge>
                              )}
                              
                              {cashier.permissions.can_manage_payments && (
                                <Badge variant="secondary" className="text-xs">
                                  <DollarSign className="h-3 w-3 mr-1" />
                                  Payments
                                </Badge>
                              )}
                              
                              {cashier.permissions.can_view_reports && (
                                <Badge variant="secondary" className="text-xs">
                                  <BarChart3 className="h-3 w-3 mr-1" />
                                  Reports
                                </Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {cashier.venueIds.length > 0 ? (
                                <>
                                  {cashier.venueIds.slice(0, 2).map(venueId => {
                                    const venue = venues.find(v => v.id === venueId);
                                    return (
                                      <Badge key={venueId} variant="outline" className="text-xs">
                                        {venue?.name || `Venue ${venueId}`}
                                      </Badge>
                                    );
                                  })}
                                  {cashier.venueIds.length > 2 && (
                                    <Badge variant="outline" className="text-xs">
                                      +{cashier.venueIds.length - 2} more
                                    </Badge>
                                  )}
                                </>
                              ) : (
                                <span className="text-muted-foreground text-xs">All venues</span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex space-x-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-8 px-2"
                                onClick={() => handleEditCashier(cashier)}
                              >
                                <Edit className="h-3.5 w-3.5 mr-1" />
                                Edit
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                className="h-8 px-2 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteCashier(cashier)}
                              >
                                <Trash className="h-3.5 w-3.5 mr-1" />
                                Remove
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center my-8">
                <p className="text-muted-foreground">No cashiers found</p>
                <Button 
                  variant="outline" 
                  className="mt-2"
                  onClick={() => setIsCreateCashierDialogOpen(true)}
                >
                  Add your first cashier
                </Button>
              </div>
            )}
          </TabsContent>
          
          {/* Reports Tab */}
          <TabsContent value="reports">
            {venuesLoading ? (
              <div className="flex justify-center my-8">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <VenueSalesReport venues={venues} />
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
      {/* Create Cashier Dialog */}
      <Dialog open={isCreateCashierDialogOpen} onOpenChange={setIsCreateCashierDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add New Cashier</DialogTitle>
            <DialogDescription>
              Enter the email address of the person you want to add as a cashier. They will receive an email with login instructions.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...cashierForm}>
            <form onSubmit={cashierForm.handleSubmit(onCreateCashier)} className="space-y-4">
              <FormField
                control={cashierForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Address</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="cashier@example.com" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <Shield className="h-4 w-4 mr-1" />
                  Permissions
                </h4>
                <div className="space-y-2 border rounded-md p-3">
                  <FormField
                    control={cashierForm.control}
                    name="permissions.can_manage_bookings"
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
                        <FormLabel className="cursor-pointer text-sm">
                          Can manage bookings and rentals
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={cashierForm.control}
                    name="permissions.can_manage_payments"
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
                        <FormLabel className="cursor-pointer text-sm">
                          Can manage and process payments
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={cashierForm.control}
                    name="permissions.can_view_reports"
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
                        <FormLabel className="cursor-pointer text-sm">
                          Can view sales reports and analytics
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {venues && venues.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center">
                    <Building className="h-4 w-4 mr-1" />
                    Venue Access
                  </h4>
                  <div className="space-y-2 border rounded-md p-3">
                    <div className="text-sm text-muted-foreground mb-2">
                      Select which venues this cashier can manage. If none are selected, they can access all venues.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {venues.map(venue => (
                        <FormField
                          key={venue.id}
                          control={cashierForm.control}
                          name="venueIds"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  checked={field.value?.includes(venue.id)}
                                  onChange={e => {
                                    const checked = e.target.checked;
                                    const currentIds = field.value || [];
                                    
                                    field.onChange(
                                      checked
                                        ? [...currentIds, venue.id]
                                        : currentIds.filter(id => id !== venue.id)
                                    );
                                  }}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                              </FormControl>
                              <FormLabel className="cursor-pointer text-sm">
                                {venue.name}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateCashierDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={createCashierMutation.isPending}
                >
                  {createCashierMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Add Cashier
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Edit Cashier Dialog */}
      <Dialog open={isEditCashierDialogOpen} onOpenChange={setIsEditCashierDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit Cashier</DialogTitle>
            <DialogDescription>
              Update permissions and venue access for this cashier.
            </DialogDescription>
          </DialogHeader>
          
          <Form {...cashierForm}>
            <form onSubmit={e => {
              e.preventDefault();
              const data = cashierForm.getValues();
              handleUpdateCashierPermissions(data);
              handleUpdateCashierVenues(data);
            }} className="space-y-4">
              <div>
                <FormField
                  control={cashierForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input {...field} type="email" disabled />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
              
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center">
                  <Shield className="h-4 w-4 mr-1" />
                  Permissions
                </h4>
                <div className="space-y-2 border rounded-md p-3">
                  <FormField
                    control={cashierForm.control}
                    name="permissions.can_manage_bookings"
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
                        <FormLabel className="cursor-pointer text-sm">
                          Can manage bookings and rentals
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={cashierForm.control}
                    name="permissions.can_manage_payments"
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
                        <FormLabel className="cursor-pointer text-sm">
                          Can manage and process payments
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={cashierForm.control}
                    name="permissions.can_view_reports"
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
                        <FormLabel className="cursor-pointer text-sm">
                          Can view sales reports and analytics
                        </FormLabel>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              {venues && venues.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center">
                    <Building className="h-4 w-4 mr-1" />
                    Venue Access
                  </h4>
                  <div className="space-y-2 border rounded-md p-3">
                    <div className="text-sm text-muted-foreground mb-2">
                      Select which venues this cashier can manage. If none are selected, they can access all venues.
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                      {venues.map(venue => (
                        <FormField
                          key={venue.id}
                          control={cashierForm.control}
                          name="venueIds"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <input
                                  type="checkbox"
                                  checked={field.value?.includes(venue.id)}
                                  onChange={e => {
                                    const checked = e.target.checked;
                                    const currentIds = field.value || [];
                                    
                                    field.onChange(
                                      checked
                                        ? [...currentIds, venue.id]
                                        : currentIds.filter(id => id !== venue.id)
                                    );
                                  }}
                                  className="h-4 w-4 rounded border-gray-300"
                                />
                              </FormControl>
                              <FormLabel className="cursor-pointer text-sm">
                                {venue.name}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditCashierDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={updateCashierPermissionsMutation.isPending || updateCashierVenuesMutation.isPending}
                >
                  {(updateCashierPermissionsMutation.isPending || updateCashierVenuesMutation.isPending) && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      
      {/* Rental Details Dialog */}
      <Dialog open={isRentalDetailsDialogOpen} onOpenChange={setIsRentalDetailsDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          {selectedRental && (
            <>
              <DialogHeader>
                <DialogTitle>Rental Details</DialogTitle>
                <DialogDescription>
                  View and manage rental details
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Venue</h3>
                    <p className="text-base">{selectedRental.venueName || `Venue #${selectedRental.venueId}`}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Total Price</h3>
                    <p className="text-base font-medium">${Number(selectedRental.totalPrice).toFixed(2)}</p>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Date & Time</h3>
                  <p className="text-base">
                    {format(new Date(selectedRental.startTime), "MMMM dd, yyyy")}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(selectedRental.startTime), "h:mm a")} - {format(new Date(selectedRental.endTime), "h:mm a")}
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
                    <div className="mt-1">
                      <StatusBadge status={selectedRental.status} />
                    </div>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Payment Status</h3>
                    <div className="mt-1">
                      <PaymentStatusBadge status={selectedRental.paymentStatus} />
                    </div>
                  </div>
                </div>
                
                {selectedRental.notes && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground">Notes</h3>
                    <p className="text-sm mt-1 p-2 bg-muted rounded-md">{selectedRental.notes}</p>
                  </div>
                )}
                
                <Separator />
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Update Status</h3>
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
                
                <div>
                  <h3 className="text-sm font-medium mb-2">Update Payment</h3>
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
                      Mark as Paid
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
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsRentalDetailsDialogOpen(false)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
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