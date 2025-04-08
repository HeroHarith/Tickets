import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";
import { CenterLayout } from "@/components/ui/center-layout";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  Edit, 
  Plus, 
  Trash, 
  Loader2,
  Search,
  Ban,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";
import { Venue } from "@/lib/types";

// Form validation schema for venues
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
    val ? val.split(',').map(item => item.trim()) : undefined
  ),
  availabilityHours: z.string().optional().transform(val => {
    if (!val) return undefined;
    try {
      return JSON.parse(val);
    } catch {
      return undefined;
    }
  }),
  images: z.string().optional().transform(val => 
    val ? val.split(',').map(item => item.trim()) : undefined
  ),
  isActive: z.boolean().default(true)
});

export default function CenterVenuesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateVenueDialogOpen, setIsCreateVenueDialogOpen] = useState(false);
  const [isEditVenueDialogOpen, setIsEditVenueDialogOpen] = useState(false);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  
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
      facilities: "",
      availabilityHours: "",
      images: "",
      isActive: true
    }
  });
  
  // Load venues
  const { 
    data: venues = [], 
    isLoading: venuesLoading
  } = useQuery<Venue[]>({
    queryKey: ["/api/venues"],
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
  
  // Handle opening create venue dialog and reset form
  const handleOpenCreateVenueDialog = () => {
    venueForm.reset({
      name: "",
      description: "",
      location: "",
      capacity: undefined,
      hourlyRate: "0", // String for API compatibility
      dailyRate: undefined,
      facilities: "",
      availabilityHours: "",
      images: "",
      isActive: true
    } as any);
    setIsCreateVenueDialogOpen(true);
  };
  
  // Filter venues based on search query
  const filteredVenues = venues.filter(venue => {
    return searchQuery === "" || 
      venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      venue.location.toLowerCase().includes(searchQuery.toLowerCase());
  });
  
  // Loading state
  if (authLoading || venuesLoading) {
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
            <h1 className="text-3xl font-bold">Manage Venues</h1>
            <p className="text-muted-foreground">
              Create and manage your venue spaces
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search venues..."
                className="pl-8 w-full md:w-[250px]"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            <Button onClick={handleOpenCreateVenueDialog}>
              <Plus className="mr-2 h-4 w-4" />
              Add Venue
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVenues.length > 0 ? (
            filteredVenues.map((venue) => (
              <Card 
                key={venue.id} 
                className={venue.isActive ? "" : "opacity-60 border-dashed"}
              >
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg font-bold truncate">{venue.name}</CardTitle>
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
                  {venue.description && <p className="text-sm mb-3 line-clamp-2">{venue.description}</p>}
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">Hourly Rate:</span>
                      <span>${Number(venue.hourlyRate).toFixed(2)}</span>
                    </div>
                    {venue.dailyRate && (
                      <div className="flex justify-between">
                        <span className="font-medium">Daily Rate:</span>
                        <span>${Number(venue.dailyRate).toFixed(2)}</span>
                      </div>
                    )}
                    {venue.capacity && (
                      <div className="flex justify-between">
                        <span className="font-medium">Capacity:</span>
                        <span>{venue.capacity} people</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <CardFooter className="pt-2">
                  {venue.facilities && venue.facilities.length > 0 && (
                    <div className="w-full">
                      <p className="text-xs font-medium mb-1.5">Facilities:</p>
                      <div className="flex flex-wrap gap-1">
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
                </CardFooter>
              </Card>
            ))
          ) : (
            <div className="col-span-full text-center py-12">
              <Ban className="mx-auto h-12 w-12 text-muted-foreground opacity-30" />
              <h3 className="mt-4 text-lg font-semibold">No venues found</h3>
              <p className="mt-2 text-muted-foreground">
                {searchQuery 
                  ? "Try adjusting your search criteria" 
                  : "Get started by creating your first venue"}
              </p>
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={handleOpenCreateVenueDialog}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add a Venue
              </Button>
            </div>
          )}
        </div>
        
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
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Active Status</FormLabel>
                        <FormDescription>
                          Set whether this venue is active and available for booking
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
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
                Update venue details. Fields marked with * are required.
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
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Active Status</FormLabel>
                        <FormDescription>
                          Set whether this venue is active and available for booking
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
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
                    Save Changes
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