import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { CenterLayout } from "@/components/ui/center-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { Venue, Rental } from "@/lib/types";

interface SummaryData {
  totalVenues: number;
  activeRentals: number;
  upcomingRentals: number;
  todayRevenue: string;
}

export default function CenterHomePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [summaryData, setSummaryData] = useState<SummaryData>({
    totalVenues: 0,
    activeRentals: 0,
    upcomingRentals: 0,
    todayRevenue: "0.00"
  });
  
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
  
  // Load rentals
  const { 
    data: rentalsResponse, 
    isLoading: rentalsLoading
  } = useQuery<{data: Rental[]}>({
    queryKey: ["/api/rentals"],
    enabled: user?.role === "center"
  });
  
  // Extract rentals from the standardized response format
  const rentals = rentalsResponse?.data || [];

  useEffect(() => {
    if (venues && rentals) {
      // Calculate summary data
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const activeRentals = rentals.filter(
        (rental) => rental.status === "confirmed" && new Date(rental.startTime) <= now && new Date(rental.endTime) >= now
      );
      
      const upcomingRentals = rentals.filter(
        (rental) => rental.status === "confirmed" && new Date(rental.startTime) > now
      );
      
      const todayRentals = rentals.filter(
        (rental) => new Date(rental.startTime).getDate() === today.getDate() &&
        new Date(rental.startTime).getMonth() === today.getMonth() &&
        new Date(rental.startTime).getFullYear() === today.getFullYear()
      );
      
      const todayRevenue = todayRentals.reduce((acc, rental) => acc + Number(rental.totalPrice), 0);
      
      setSummaryData({
        totalVenues: venues.length,
        activeRentals: activeRentals.length,
        upcomingRentals: upcomingRentals.length,
        todayRevenue: todayRevenue.toFixed(2)
      });
    }
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

  // We don't need redirect here since ProtectedRoute handles role access
  // This was causing the maximum update depth error

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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Active Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {rentals
                .filter(rental => rental.status === "confirmed" && 
                  new Date(rental.startTime) <= new Date() && 
                  new Date(rental.endTime) >= new Date())
                .slice(0, 5)
                .map((rental) => (
                  <div key={rental.id} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div>
                      <div className="font-medium">
                        {rental.venueName || `Venue #${rental.venueId}`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Until {format(new Date(rental.endTime), "h:mm a")}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      ${Number(rental.totalPrice).toFixed(2)}
                    </div>
                  </div>
                ))}
              
              {rentals.filter(rental => 
                rental.status === "confirmed" && 
                new Date(rental.startTime) <= new Date() && 
                new Date(rental.endTime) >= new Date()
              ).length === 0 && (
                <div className="py-3 text-center text-muted-foreground">
                  No active bookings at this time
                </div>
              )}
            </CardContent>
          </Card>
          
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle>Upcoming Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              {rentals
                .filter(rental => 
                  rental.status === "confirmed" && 
                  new Date(rental.startTime) > new Date())
                .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                .slice(0, 5)
                .map((rental) => (
                  <div key={rental.id} className="flex items-center justify-between py-3 border-b last:border-0">
                    <div>
                      <div className="font-medium">
                        {rental.venueName || `Venue #${rental.venueId}`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(rental.startTime), "MMM d, h:mm a")}
                      </div>
                    </div>
                    <div className="text-sm font-semibold">
                      ${Number(rental.totalPrice).toFixed(2)}
                    </div>
                  </div>
                ))}
              
              {rentals.filter(rental => 
                rental.status === "confirmed" && 
                new Date(rental.startTime) > new Date()
              ).length === 0 && (
                <div className="py-3 text-center text-muted-foreground">
                  No upcoming bookings
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CenterLayout>
  );
}