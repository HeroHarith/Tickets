import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { CenterLayout } from "@/components/ui/center-layout";
import { Loader2, PlusCircle, UserPlus, Mail, Building2, Edit, Trash2, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";

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
  permissions: Record<string, boolean> | number[];
  venueIds: number[];
  createdAt: string;
  updatedAt: string;
  user: CashierUser | null;
}

// Validation schemas
const addCashierSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  permissions: z.record(z.boolean()).optional(),
  venueIds: z.array(z.number()).optional()
});

const editCashierSchema = z.object({
  permissions: z.record(z.boolean()),
  venueIds: z.array(z.number())
});

// Default cashier permissions
const DEFAULT_PERMISSIONS: Record<string, boolean> = {
  viewBookings: true,
  createBookings: true,
  cancelBookings: false,
  viewReports: false,
  processPayments: true,
  manageCustomers: false
};

// Permission labels for display
const PERMISSION_LABELS: Record<string, string> = {
  viewBookings: "View Bookings",
  createBookings: "Create Bookings",
  cancelBookings: "Cancel Bookings",
  viewReports: "View Reports",
  processPayments: "Process Payments",
  manageCustomers: "Manage Customers"
};

export default function CenterCashiersPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isAddCashierDialogOpen, setIsAddCashierDialogOpen] = useState(false);
  const [isEditCashierDialogOpen, setIsEditCashierDialogOpen] = useState(false);
  const [isDeleteCashierDialogOpen, setIsDeleteCashierDialogOpen] = useState(false);
  const [selectedCashier, setSelectedCashier] = useState<Cashier | null>(null);
  
  // Create form
  const addForm = useForm<z.infer<typeof addCashierSchema>>({
    resolver: zodResolver(addCashierSchema),
    defaultValues: {
      email: "",
      name: "",
      permissions: DEFAULT_PERMISSIONS,
      venueIds: []
    }
  });
  
  // Edit form
  const editForm = useForm<z.infer<typeof editCashierSchema>>({
    resolver: zodResolver(editCashierSchema),
    defaultValues: {
      permissions: DEFAULT_PERMISSIONS,
      venueIds: []
    }
  });
  
  // Load cashiers
  const { 
    data: cashiersResponse, 
    isLoading: cashiersLoading,
    error: cashiersError
  } = useQuery({
    queryKey: ["/api/cashiers"],
    enabled: user?.role === "center"
  });
  
  // Load venues for assigning to cashiers
  const { 
    data: venuesResponse, 
    isLoading: venuesLoading
  } = useQuery({
    queryKey: ["/api/venues"],
    enabled: user?.role === "center"
  });
  
  // Extract data from the standardized response format
  const cashiers: Cashier[] = (cashiersResponse && 'data' in cashiersResponse) ? cashiersResponse.data : [];
  console.log('Extracted cashiers:', cashiers);
  
  const venues: Venue[] = (venuesResponse && 'data' in venuesResponse) ? venuesResponse.data : [];
  console.log('Extracted venues:', venues);
  
  // Add cashier mutation
  const addCashierMutation = useMutation({
    mutationFn: async (data: z.infer<typeof addCashierSchema>) => {
      const res = await apiRequest("POST", "/api/cashiers", data);
      const responseData = await res.json();
      // Handle standardized API response format
      console.log('Cashier create response:', responseData);
      if (responseData && responseData.success === true && responseData.data) {
        return responseData.data;
      }
      // If no standardized format, return raw response
      return responseData;
    },
    onSuccess: (data) => {
      // Extract data from the response
      console.log('Add cashier success with data:', data);
      toast({
        title: "Cashier added",
        description: "Cashier has been added successfully",
      });
      setIsAddCashierDialogOpen(false);
      addForm.reset();
      queryClient.invalidateQueries({ queryKey: ["/api/cashiers"] });
    },
    onError: (error) => {
      console.error("Error adding cashier:", error);
      toast({
        title: "Error",
        description: "Failed to add cashier. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Delete cashier mutation
  const deleteCashierMutation = useMutation({
    mutationFn: async (cashierId: number) => {
      const res = await apiRequest("DELETE", `/api/cashiers/${cashierId}`);
      const responseData = await res.json();
      console.log('Delete cashier response:', responseData);
      // Handle standardized API response format
      if (responseData && responseData.success === true && responseData.data) {
        return responseData.data;
      }
      // If no standardized format, return raw response
      return responseData;
    },
    onSuccess: (data) => {
      console.log('Delete cashier success with data:', data);
      toast({
        title: "Cashier deleted",
        description: "Cashier has been deleted successfully.",
      });
      setIsDeleteCashierDialogOpen(false);
      setSelectedCashier(null);
      queryClient.invalidateQueries({ queryKey: ["/api/cashiers"] });
    },
    onError: (error) => {
      console.error("Error deleting cashier:", error);
      toast({
        title: "Error",
        description: "Failed to delete cashier. Please try again.",
        variant: "destructive",
      });
    }
  });
  
  // Update cashier permissions mutation
  const updateCashierPermissionsMutation = useMutation({
    mutationFn: async ({ cashierId, permissions }: { cashierId: number, permissions: Record<string, boolean> }) => {
      const res = await apiRequest("PATCH", `/api/cashiers/${cashierId}/permissions`, { permissions });
      const responseData = await res.json();
      console.log('Permissions update response:', responseData);
      // Handle standardized API response format
      if (responseData && responseData.success === true && responseData.data) {
        return responseData.data;
      }
      // If no standardized format, return raw response
      return responseData;
    },
    onSuccess: (data) => {
      console.log('Permissions update success with data:', data);
      toast({
        title: "Permissions updated",
        description: "Cashier permissions have been updated successfully.",
      });
      setIsEditCashierDialogOpen(false);
      setSelectedCashier(null);
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
      const responseData = await res.json();
      console.log('Venues update response:', responseData);
      // Handle standardized API response format
      if (responseData && responseData.success === true && responseData.data) {
        return responseData.data;
      }
      // If no standardized format, return raw response
      return responseData;
    },
    onSuccess: (data) => {
      console.log('Venues update success with data:', data);
      toast({
        title: "Venues updated",
        description: "Cashier venue access has been updated successfully.",
      });
      setIsEditCashierDialogOpen(false);
      setSelectedCashier(null);
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
  
  // Handle add cashier form submission
  const onAddCashierSubmit = (data: z.infer<typeof addCashierSchema>) => {
    addCashierMutation.mutate(data);
  };
  
  // Handle edit cashier form submission
  const onEditCashierSubmit = (data: z.infer<typeof editCashierSchema>) => {
    if (!selectedCashier) return;
    
    // Update permissions first, then venues
    updateCashierPermissionsMutation.mutate({
      cashierId: selectedCashier.id,
      permissions: data.permissions
    });
    
    updateCashierVenuesMutation.mutate({
      cashierId: selectedCashier.id,
      venueIds: data.venueIds
    });
  };
  
  // Open edit dialog with cashier data
  const handleEditCashier = (cashier: Cashier) => {
    setSelectedCashier(cashier);
    
    // Handle the case where permissions might be an array instead of an object
    let permissionsObj: Record<string, boolean> = { ...DEFAULT_PERMISSIONS };
    if (cashier.permissions) {
      if (Array.isArray(cashier.permissions)) {
        // Convert array to object format using DEFAULT_PERMISSIONS as a template
        
        // Map array values to specific permissions
        const permKeys = Object.keys(DEFAULT_PERMISSIONS);
        cashier.permissions.forEach((value: number) => {
          // If value is 1, 2, 3, etc. use it as an index (starting from 0)
          if (typeof value === 'number' && value > 0 && value <= permKeys.length) {
            const permKey = permKeys[value - 1];
            if (permKey) {
              permissionsObj[permKey] = true;
            }
          }
        });
      } else {
        // Safely convert to Record<string, boolean>
        const permissions = cashier.permissions as Record<string, boolean>;
        permissionsObj = { ...DEFAULT_PERMISSIONS, ...permissions };
      }
    }
    
    editForm.reset({
      permissions: permissionsObj,
      venueIds: cashier.venueIds || []
    });
    setIsEditCashierDialogOpen(true);
  };
  
  // Open delete dialog
  const handleDeleteCashier = (cashier: Cashier) => {
    setSelectedCashier(cashier);
    setIsDeleteCashierDialogOpen(true);
  };
  
  // Confirm delete cashier
  const confirmDeleteCashier = () => {
    if (selectedCashier) {
      deleteCashierMutation.mutate(selectedCashier.id);
    }
  };
  
  // Render venue name from ID
  const getVenueName = (venueId: number) => {
    const venue = venues.find((v: Venue) => v.id === venueId);
    return venue ? venue.name : `Venue ${venueId}`;
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
  if (authLoading || cashiersLoading || venuesLoading) {
    return (
      <CenterLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </CenterLayout>
    );
  }
  
  // Error state
  if (cashiersError) {
    return (
      <CenterLayout>
        <div className="p-6 max-w-7xl mx-auto">
          <Alert variant="destructive" className="my-4">
            <AlertDescription>
              There was an error loading cashiers. Please try again.
            </AlertDescription>
          </Alert>
        </div>
      </CenterLayout>
    );
  }
  
  return (
    <CenterLayout>
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <UserPlus className="mr-2 h-6 w-6" />
              Cashier Management
            </h1>
            <p className="text-muted-foreground">
              Add and manage cashiers for your venues
            </p>
          </div>
          <Button onClick={() => setIsAddCashierDialogOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Cashier
          </Button>
        </div>
        
        {cashiers.length === 0 ? (
          <Card className="mt-6">
            <CardContent className="pt-6">
              <div className="text-center p-6">
                <UserPlus className="mx-auto h-12 w-12 text-muted-foreground" />
                <h3 className="mt-4 text-lg font-medium">No cashiers added yet</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  Cashiers can help you manage bookings and payments for your venues.
                  Add your first cashier to get started.
                </p>
                <Button 
                  className="mt-4"
                  onClick={() => setIsAddCashierDialogOpen(true)}
                >
                  <PlusCircle className="mr-2 h-4 w-4" />
                  Add Cashier
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
            {cashiers.map((cashier: Cashier) => (
              <Card key={cashier.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center">
                    <UserPlus className="mr-2 h-5 w-5" />
                    {cashier.user?.name || 'Unnamed Cashier'}
                  </CardTitle>
                  <CardDescription className="flex items-center">
                    <Mail className="mr-2 h-4 w-4" />
                    {cashier.user?.email || 'No email'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pb-0">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2 flex items-center">
                        <Building2 className="mr-2 h-4 w-4" />
                        Assigned Venues
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {cashier.venueIds && cashier.venueIds.length > 0 ? (
                          cashier.venueIds.map((venueId: number) => (
                            <Badge key={venueId} variant="outline">
                              {getVenueName(venueId)}
                            </Badge>
                          ))
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No venues assigned
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-medium mb-2 flex items-center">
                        <CheckSquare className="mr-2 h-4 w-4" />
                        Permissions
                      </h4>
                      <div className="grid grid-cols-2 gap-1">
                        {cashier.permissions ? (
                          Array.isArray(cashier.permissions) ? (
                            <span className="text-sm text-muted-foreground">
                              {cashier.permissions.length} permission(s) set
                            </span>
                          ) : (
                            Object.entries(cashier.permissions).map(([key, value]) => (
                              <div key={key} className="flex items-center gap-2 text-sm">
                                <div className={`w-2 h-2 rounded-full ${value ? 'bg-green-500' : 'bg-red-500'}`} />
                                <span className={value ? 'text-foreground' : 'text-muted-foreground'}>
                                  {PERMISSION_LABELS[key] || key}
                                </span>
                              </div>
                            ))
                          )
                        ) : (
                          <span className="text-sm text-muted-foreground">
                            No permissions set
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between pt-6">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleEditCashier(cashier)}
                  >
                    <Edit className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm"
                    onClick={() => handleDeleteCashier(cashier)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
        
        {/* Add Cashier Dialog */}
        <Dialog open={isAddCashierDialogOpen} onOpenChange={setIsAddCashierDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New Cashier</DialogTitle>
              <DialogDescription>
                Enter the email address of the person you want to add as a cashier.
                They will receive an email to set up their account.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...addForm}>
              <form onSubmit={addForm.handleSubmit(onAddCashierSubmit)} className="space-y-6">
                <FormField
                  control={addForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="cashier@example.com" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        This email will receive an invitation to join as a cashier.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={addForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cashier Name</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="John Smith" 
                          {...field} 
                        />
                      </FormControl>
                      <FormDescription>
                        The display name for this cashier.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <div className="space-y-3">
                  <div>
                    <Label>Permissions</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {Object.entries(DEFAULT_PERMISSIONS).map(([key, defaultValue]) => (
                        <FormField
                          key={key}
                          control={addForm.control}
                          name={`permissions.${key}`}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value || defaultValue}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {PERMISSION_LABELS[key] || key}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <FormField
                    control={addForm.control}
                    name="venueIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign Venues</FormLabel>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          {venues.map((venue: Venue) => (
                            <div key={venue.id} className="flex items-center space-x-3">
                              <Checkbox 
                                id={`venue-${venue.id}`}
                                checked={field.value?.includes(venue.id)}
                                onCheckedChange={(checked) => {
                                  const updatedVenues = checked
                                    ? [...(field.value || []), venue.id]
                                    : (field.value || []).filter(id => id !== venue.id);
                                  field.onChange(updatedVenues);
                                }}
                              />
                              <Label htmlFor={`venue-${venue.id}`} className="font-normal">
                                {venue.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <DialogFooter>
                  <Button 
                    type="button" 
                    variant="outline"
                    onClick={() => setIsAddCashierDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit"
                    disabled={addCashierMutation.isPending}
                  >
                    {addCashierMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
            
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditCashierSubmit)} className="space-y-6">
                {selectedCashier?.user && (
                  <div className="space-y-1">
                    <Label className="text-muted-foreground">Cashier Email</Label>
                    <div className="font-medium">{selectedCashier.user.email}</div>
                  </div>
                )}
                
                <Separator />
                
                <div className="space-y-3">
                  <div>
                    <Label>Permissions</Label>
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {Object.entries(DEFAULT_PERMISSIONS).map(([key, defaultValue]) => (
                        <FormField
                          key={key}
                          control={editForm.control}
                          name={`permissions.${key}`}
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-center space-x-3 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <FormLabel className="font-normal">
                                {PERMISSION_LABELS[key] || key}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <FormField
                    control={editForm.control}
                    name="venueIds"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assign Venues</FormLabel>
                        <div className="grid grid-cols-2 gap-3 mt-2">
                          {venues.map((venue: Venue) => (
                            <div key={venue.id} className="flex items-center space-x-3">
                              <Checkbox 
                                id={`edit-venue-${venue.id}`}
                                checked={field.value?.includes(venue.id)}
                                onCheckedChange={(checked) => {
                                  const updatedVenues = checked
                                    ? [...(field.value || []), venue.id]
                                    : (field.value || []).filter(id => id !== venue.id);
                                  field.onChange(updatedVenues);
                                }}
                              />
                              <Label htmlFor={`edit-venue-${venue.id}`} className="font-normal">
                                {venue.name}
                              </Label>
                            </div>
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
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
                    {(updateCashierPermissionsMutation.isPending || updateCashierVenuesMutation.isPending) && 
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    }
                    Save Changes
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        
        {/* Delete Confirmation Dialog */}
        <Dialog open={isDeleteCashierDialogOpen} onOpenChange={setIsDeleteCashierDialogOpen}>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Delete Cashier</DialogTitle>
              <DialogDescription>
                Are you sure you want to remove this cashier? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            
            {selectedCashier?.user && (
              <div className="py-4">
                <div className="font-medium">{selectedCashier.user.name || selectedCashier.user.username}</div>
                <div className="text-sm text-muted-foreground">{selectedCashier.user.email}</div>
              </div>
            )}
            
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setIsDeleteCashierDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button 
                variant="destructive"
                onClick={confirmDeleteCashier}
                disabled={deleteCashierMutation.isPending}
              >
                {deleteCashierMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </CenterLayout>
  );
}