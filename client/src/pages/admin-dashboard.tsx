import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { User, Event, USER_ROLES } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { Loader2, UserPlus, Pencil, Trash2, Package, Users, CreditCard, Settings } from "lucide-react";
import { SubscriptionPlanManagement } from "@/components/domain/admin/subscription-plan-management";

// Define types for the forms
interface UserFormData {
  username: string;
  name: string;
  email: string;
  password?: string;
  role: string;
}

const AdminDashboard = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState("users");
  const [isCreateUserDialogOpen, setIsCreateUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isDeleteUserDialogOpen, setIsDeleteUserDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userFormData, setUserFormData] = useState<UserFormData>({
    username: "",
    name: "",
    email: "",
    password: "",
    role: "customer",
  });

  // Fetch users
  const usersQuery = useQuery<{ data: User[] }>({
    queryKey: ["/api/admin/users"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/users");
      if (!res.ok) throw new Error("Failed to fetch users");
      return res.json();
    },
  });

  // Fetch events (for event management tab)
  const eventsQuery = useQuery<{ data: Event[] }>({
    queryKey: ["/api/admin/events"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/events");
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    },
  });
  
  // Fetch all subscriptions (for subscription management tab)
  const subscriptionsQuery = useQuery({
    queryKey: ["/api/subscriptions/admin/all"],
    queryFn: async () => {
      try {
        const res = await apiRequest("GET", "/api/subscriptions/admin/all");
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.description || "Failed to fetch subscriptions");
        }
        return res.json();
      } catch (error: any) {
        console.error("Subscription fetch error:", error);
        throw error;
      }
    },
    retry: 1,
  });

  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormData) => {
      const res = await apiRequest("POST", "/api/admin/users", data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "User created",
        description: "User has been created successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsCreateUserDialogOpen(false);
      resetUserForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async (data: UserFormData & { id: number }) => {
      const res = await apiRequest("PUT", `/api/admin/users/${data.id}`, data);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "User updated",
        description: "User has been updated successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsEditUserDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("DELETE", `/api/admin/users/${userId}`);
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete user");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "User deleted",
        description: "User has been deleted successfully.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setIsDeleteUserDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handlers for user forms
  const handleUserFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setUserFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRoleChange = (value: string) => {
    setUserFormData((prev) => ({ ...prev, role: value }));
  };

  const resetUserForm = () => {
    setUserFormData({
      username: "",
      name: "",
      email: "",
      password: "",
      role: "customer",
    });
  };

  const openEditUserDialog = (user: User) => {
    setSelectedUser(user);
    setUserFormData({
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
    });
    setIsEditUserDialogOpen(true);
  };

  const openDeleteUserDialog = (user: User) => {
    setSelectedUser(user);
    setIsDeleteUserDialogOpen(true);
  };

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate(userFormData);
  };

  const handleUpdateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    // Only include password if it's been changed
    const updateData = { ...userFormData, id: selectedUser.id };
    if (!updateData.password) delete updateData.password;
    
    updateUserMutation.mutate(updateData);
  };

  const handleDeleteUser = () => {
    if (!selectedUser) return;
    deleteUserMutation.mutate(selectedUser.id);
  };

  // We don't need redirect here since ProtectedRoute handles role access
  // This can cause infinite loops or maximum update depth exceeded errors

  // Loading state for all tabs
  if (
    (selectedTab === "users" && usersQuery.isLoading) || 
    (selectedTab === "events" && eventsQuery.isLoading) ||
    (selectedTab === "subscriptions" && subscriptionsQuery.isLoading && !subscriptionsQuery.data)
  ) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Error state for all tabs
  if (
    (selectedTab === "users" && usersQuery.error) || 
    (selectedTab === "events" && eventsQuery.error) || 
    (selectedTab === "subscriptions" && subscriptionsQuery.error && !subscriptionsQuery.data)
  ) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
          <p className="text-gray-600 mb-4">
            {selectedTab === "users" && usersQuery.error?.message || 
             selectedTab === "events" && eventsQuery.error?.message || 
             selectedTab === "subscriptions" && subscriptionsQuery.error?.message || 
             "An error occurred loading dashboard data"}
          </p>
          <Button onClick={() => {
            if (selectedTab === "users") usersQuery.refetch();
            if (selectedTab === "events") eventsQuery.refetch();
            if (selectedTab === "subscriptions") subscriptionsQuery.refetch();
          }}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>
      
      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Management
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Event Management
          </TabsTrigger>
          <TabsTrigger value="subscriptions" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription Management
          </TabsTrigger>
        </TabsList>
        
        {/* User Management Tab */}
        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>All Users</CardTitle>
              <Button 
                onClick={() => setIsCreateUserDialogOpen(true)}
                className="bg-primary text-white"
              >
                <UserPlus className="h-4 w-4 mr-2" /> Add User
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!usersQuery.data?.data || usersQuery.data.data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      usersQuery.data.data.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell>{user.id}</TableCell>
                          <TableCell>{user.username}</TableCell>
                          <TableCell>{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              user.role === "admin" 
                                ? "bg-red-100 text-red-800" 
                                : user.role === "eventManager" 
                                ? "bg-blue-100 text-blue-800" 
                                : "bg-green-100 text-green-800"
                            }`}>
                              {user.role}
                            </span>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => openEditUserDialog(user)}
                                className="h-8 px-2"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                onClick={() => openDeleteUserDialog(user)}
                                className="h-8 px-2 text-red-500 hover:text-red-700"
                                disabled={user.id === 5} // Prevent deleting the admin user
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Event Management Tab */}
        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Events</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ID</TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Organizer</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {!eventsQuery.data?.data || eventsQuery.data.data.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                          No events found
                        </TableCell>
                      </TableRow>
                    ) : (
                      eventsQuery.data.data.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>{event.id}</TableCell>
                          <TableCell>{event.title}</TableCell>
                          <TableCell>{event.location}</TableCell>
                          <TableCell>
                            {new Date(event.startDate).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{event.organizer}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Link href={`/ticket-management/${event.id}`}>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="h-8 px-2"
                                >
                                  Manage Tickets
                                </Button>
                              </Link>
                              <Link href={`/sales-reports/${event.id}`}>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="h-8 px-2"
                                >
                                  Sales Report
                                </Button>
                              </Link>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Subscription Management Tab */}
        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>All Subscriptions</CardTitle>
            </CardHeader>
            <CardContent>
              {subscriptionsQuery.isLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : subscriptionsQuery.error ? (
                <div className="text-center py-8">
                  <p className="text-red-500 mb-2">Error loading subscriptions</p>
                  <Button onClick={() => subscriptionsQuery.refetch()}>Try Again</Button>
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Plan</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!subscriptionsQuery.data?.data || subscriptionsQuery.data.data.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                            No subscriptions found
                          </TableCell>
                        </TableRow>
                      ) : (
                        subscriptionsQuery.data.data.map((item: any) => (
                          <TableRow key={item.subscription.id}>
                            <TableCell>{item.subscription.id}</TableCell>
                            <TableCell>
                              <div className="font-medium">{item.user.name}</div>
                              <div className="text-sm text-muted-foreground">{item.user.email}</div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium">{item.plan.name}</div>
                              <div className="text-xs">{item.plan.type} / {item.plan.billingPeriod}</div>
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                item.subscription.status === "active" 
                                  ? "bg-green-100 text-green-800" 
                                  : item.subscription.status === "pending"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {item.subscription.status}
                              </span>
                            </TableCell>
                            <TableCell>
                              {new Date(item.subscription.startDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              {new Date(item.subscription.endDate).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              ${parseFloat(item.plan.price).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Create User Dialog */}
      <Dialog 
        open={isCreateUserDialogOpen} 
        onOpenChange={setIsCreateUserDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New User</DialogTitle>
            <DialogDescription>
              Add a new user to the system. Fill out the form below.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateUser}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  name="username"
                  value={userFormData.username}
                  onChange={handleUserFormChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Full Name</Label>
                <Input
                  id="name"
                  name="name"
                  value={userFormData.name}
                  onChange={handleUserFormChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={userFormData.email}
                  onChange={handleUserFormChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  value={userFormData.password}
                  onChange={handleUserFormChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="role">Role</Label>
                <Select
                  value={userFormData.role}
                  onValueChange={handleRoleChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsCreateUserDialogOpen(false);
                  resetUserForm();
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={createUserMutation.isPending}
              >
                {createUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create User"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog 
        open={isEditUserDialogOpen} 
        onOpenChange={setIsEditUserDialogOpen}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update the user's information. Leave password blank to keep it unchanged.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdateUser}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-username">Username</Label>
                <Input
                  id="edit-username"
                  name="username"
                  value={userFormData.username}
                  onChange={handleUserFormChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Full Name</Label>
                <Input
                  id="edit-name"
                  name="name"
                  value={userFormData.name}
                  onChange={handleUserFormChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  name="email"
                  type="email"
                  value={userFormData.email}
                  onChange={handleUserFormChange}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-password">
                  Password <span className="text-sm text-muted-foreground">(Leave blank to keep unchanged)</span>
                </Label>
                <Input
                  id="edit-password"
                  name="password"
                  type="password"
                  value={userFormData.password || ""}
                  onChange={handleUserFormChange}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-role">Role</Label>
                <Select
                  value={userFormData.role}
                  onValueChange={handleRoleChange}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setIsEditUserDialogOpen(false);
                  setSelectedUser(null);
                }}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  "Update User"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog
        open={isDeleteUserDialogOpen}
        onOpenChange={setIsDeleteUserDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the user "{selectedUser?.username}" and all associated data.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setSelectedUser(null)}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              className="bg-red-500 hover:bg-red-600"
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete User"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminDashboard;