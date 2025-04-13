import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { CenterLayout } from "@/components/ui/center-layout";
import { 
  Card, 
  CardContent, 
  CardFooter, 
  CardHeader,
  CardDescription,
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  CheckCircle, 
  XCircle, 
  Search, 
  Lock, 
  Loader2, 
  MapPin, 
  Users, 
  Clock,
  DollarSign,
  Eye,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Plus,
  Ban
} from "lucide-react";
import { Venue } from "@/lib/types";
import { format } from "date-fns";

export default function CenterAllVenuesPage() {
  const { user, isLoading: authLoading } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  
  // Load venues
  const { 
    data: venuesResponse, 
    isLoading: venuesLoading 
  } = useQuery<{data: Venue[]}>({
    queryKey: ["/api/venues"],
    enabled: user?.role === "center"
  });
  
  // Extract venues from the standardized response format
  const venues = venuesResponse?.data || [];

  // Stats
  const activeVenues = venues.filter(venue => venue.isActive).length;
  const inactiveVenues = venues.length - activeVenues;
  
  // Filter venues based on search query and active tab
  const filteredVenues = venues.filter(venue => {
    const matchesSearch = searchQuery === "" || 
      venue.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      venue.location.toLowerCase().includes(searchQuery.toLowerCase());
      
    if (activeTab === "all") return matchesSearch;
    if (activeTab === "active") return matchesSearch && venue.isActive;
    if (activeTab === "inactive") return matchesSearch && !venue.isActive;
    
    return matchesSearch;
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
            <h1 className="text-3xl font-bold">Venue Overview</h1>
            <p className="text-muted-foreground">
              View and manage all your venue spaces
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
            
            <Button onClick={() => window.location.href = "/center/venues"}>
              <Plus className="mr-2 h-4 w-4" />
              Manage Venues
            </Button>
          </div>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-muted-foreground">Total Venues</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{venues.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-muted-foreground">Active Venues</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center">
              <div className="text-3xl font-bold">{activeVenues}</div>
              <CheckCircle className="ml-3 h-5 w-5 text-green-500" />
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-medium text-muted-foreground">Inactive Venues</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center">
              <div className="text-3xl font-bold">{inactiveVenues}</div>
              <XCircle className="ml-3 h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
        </div>
        
        <Tabs defaultValue="all" value={activeTab} onValueChange={setActiveTab} className="mb-8">
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="all">All Venues</TabsTrigger>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="inactive">Inactive</TabsTrigger>
          </TabsList>
          
          {/* Venue Cards Grid - Alternate Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredVenues.length > 0 ? (
              filteredVenues.map((venue) => (
                <Card 
                  key={venue.id}
                  className={`overflow-hidden transition-all duration-200 group hover:shadow-md ${
                    venue.isActive ? "" : "border-dashed bg-muted/30"
                  }`}
                >
                  <div className="bg-gradient-to-r from-primary/10 to-primary/5 h-2">
                    <div className={`h-full ${venue.isActive ? "bg-primary" : "bg-muted-foreground"}`} style={{ width: venue.isActive ? "100%" : "30%" }}></div>
                  </div>
                  
                  <CardHeader className="pb-2">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg font-bold">{venue.name}</CardTitle>
                        <CardDescription className="flex items-center mt-1">
                          <MapPin className="h-3.5 w-3.5 mr-1" />
                          <span className="truncate">{venue.location}</span>
                        </CardDescription>
                      </div>
                      <Badge 
                        variant={venue.isActive ? "default" : "outline"}
                        className={venue.isActive ? "bg-green-100 text-green-700 hover:bg-green-100" : ""}
                      >
                        {venue.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pb-3">
                    {venue.description && (
                      <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{venue.description}</p>
                    )}
                    
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center p-2 rounded-md bg-background">
                        <DollarSign className="h-4 w-4 mr-2 text-primary" />
                        <div>
                          <div className="font-medium">Hourly Rate</div>
                          <div className="text-muted-foreground">${Number(venue.hourlyRate).toFixed(2)}</div>
                        </div>
                      </div>
                      
                      {venue.capacity ? (
                        <div className="flex items-center p-2 rounded-md bg-background">
                          <Users className="h-4 w-4 mr-2 text-primary" />
                          <div>
                            <div className="font-medium">Capacity</div>
                            <div className="text-muted-foreground">{venue.capacity} people</div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center p-2 rounded-md bg-background">
                          <Calendar className="h-4 w-4 mr-2 text-primary" />
                          <div>
                            <div className="font-medium">Added On</div>
                            <div className="text-muted-foreground">
                              {venue.createdAt ? format(new Date(venue.createdAt), "MMM d, yyyy") : "Unknown date"}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  
                  <CardFooter className="pt-0">
                    {venue.facilities && venue.facilities.length > 0 && (
                      <div className="w-full">
                        <div className="flex flex-wrap gap-1 mt-2">
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
                    <Button variant="outline" size="sm" className="ml-auto mt-2" onClick={() => window.location.href = "/center/venues"}>
                      <Eye className="mr-2 h-3.5 w-3.5" />
                      Manage
                    </Button>
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
                    : activeTab === "active" 
                      ? "You don't have any active venues" 
                      : activeTab === "inactive" 
                        ? "You don't have any inactive venues" 
                        : "Get started by creating your first venue"}
                </p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => window.location.href = "/center/venues"}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add a Venue
                </Button>
              </div>
            )}
          </div>
        </Tabs>
      </div>
    </CenterLayout>
  );
}