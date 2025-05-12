import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { CenterLayout } from "@/components/ui/center-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Venue, Rental } from "@/lib/types";

export default function CenterHomePage() {
  const { user, isLoading: authLoading } = useAuth();
  
  // Load venues
  const { 
    data: venuesResponse, 
    isLoading: venuesLoading
  } = useQuery<{data: Venue[]}>({
    queryKey: ["/api/venues"],
    enabled: !!user && user.role === "center"
  });
  
  // Load rentals
  const { 
    data: rentalsResponse, 
    isLoading: rentalsLoading
  } = useQuery<{data: Rental[]}>({
    queryKey: ["/api/rentals"],
    enabled: !!user && user.role === "center"
  });
  
  // Extract data from the standardized response format
  const venues = venuesResponse?.data || [];
  const rentals = rentalsResponse?.data || [];
  
  // Calculate summary data using useMemo to avoid re-renders
  const summaryData = useMemo(() => {
    if (!venues || !rentals) {
      return {
        totalVenues: 0,
        activeRentals: 0,
        upcomingRentals: 0,
        todayRevenue: "0.00"
      };
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    const activeRentals = rentals.filter(
      (rental) => rental.status === "confirmed" && new Date(rental.startTime) <= now && new Date(rental.endTime) >= now
    );
    
    const upcomingRentals = rentals.filter(
      (rental) => rental.status === "confirmed" && new Date(rental.startTime) > now
    );
    
    const todayRentals = rentals.filter(
      (rental) => {
        const rentalDate = new Date(rental.startTime);
        return rentalDate.getDate() === today.getDate() &&
          rentalDate.getMonth() === today.getMonth() &&
          rentalDate.getFullYear() === today.getFullYear();
      }
    );
    
    const todayRevenue = todayRentals.reduce((acc, rental) => acc + Number(rental.totalPrice || 0), 0);
    
    return {
      totalVenues: venues.length,
      activeRentals: activeRentals.length,
      upcomingRentals: upcomingRentals.length,
      todayRevenue: todayRevenue.toFixed(2)
    };
  }, [venues, rentals]);

  // Loading state
  if (authLoading || venuesLoading || rentalsLoading) {
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
        <div className="flex flex-col md:flex-row justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold">Welcome, {user.name || user.username}</h1>
            <p className="text-muted-foreground">
              {format(new Date(), "EEEE, MMMM d, yyyy")}
            </p>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Venues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summaryData.totalVenues}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Active Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summaryData.activeRentals}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Upcoming Bookings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{summaryData.upcomingRentals}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${summaryData.todayRevenue}</div>
            </CardContent>
          </Card>
        </div>
        
        {/* Active Bookings */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Active Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {summaryData.activeRentals === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No active bookings at this time
                </p>
              ) : (
                <div>
                  {/* Active bookings would go here */}
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* Upcoming Bookings */}
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {summaryData.upcomingRentals === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No upcoming bookings
                </p>
              ) : (
                <div>
                  {/* Upcoming bookings would go here */}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CenterLayout>
  );
}