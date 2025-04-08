import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { CenterLayout } from "@/components/ui/center-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addDays, subDays, addWeeks, subWeeks } from "date-fns";
import { Venue, Rental } from "@/lib/types";

export default function CenterSchedulePage() {
  const { user, isLoading: authLoading } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedVenueId, setSelectedVenueId] = useState<string>("all");
  
  // Generate week dates
  const weekStartDate = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEndDate = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDates = eachDayOfInterval({ start: weekStartDate, end: weekEndDate });
  
  // Calculate week range text
  const weekRangeText = `${format(weekStartDate, "MMM d")} - ${format(weekEndDate, "MMM d, yyyy")}`;
  
  // Load venues
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
  
  // Navigation functions
  const goToPreviousWeek = () => {
    setSelectedDate(subWeeks(selectedDate, 1));
  };
  
  const goToNextWeek = () => {
    setSelectedDate(addWeeks(selectedDate, 1));
  };
  
  const goToToday = () => {
    setSelectedDate(new Date());
  };
  
  // Filter rentals for schedule display
  const getFilteredRentals = (date: Date) => {
    return rentals.filter(rental => {
      const rentalDate = new Date(rental.startTime);
      
      // Check if the rental is on the same day
      const sameDay = 
        rentalDate.getDate() === date.getDate() && 
        rentalDate.getMonth() === date.getMonth() && 
        rentalDate.getFullYear() === date.getFullYear();
      
      // Apply venue filter if selected
      const matchesVenue = selectedVenueId === "all" || rental.venueId.toString() === selectedVenueId;
      
      // Only show confirmed rentals for schedule view
      const isConfirmed = rental.status === "confirmed";
      
      return sameDay && matchesVenue && isConfirmed;
    });
  };
  
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
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-bold">Schedule</h1>
            <p className="text-muted-foreground">
              View venue bookings by week
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <Select
              value={selectedVenueId}
              onValueChange={setSelectedVenueId}
            >
              <SelectTrigger className="w-full md:w-[200px]">
                <SelectValue placeholder="All Venues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Venues</SelectItem>
                {venues.map(venue => (
                  <SelectItem key={venue.id} value={venue.id.toString()}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button variant="outline" onClick={goToToday}>
              Today
            </Button>
          </div>
        </div>
        
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={goToPreviousWeek}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <CardTitle>{weekRangeText}</CardTitle>
              <Button variant="ghost" size="sm" onClick={goToNextWeek}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {weekDates.map((date, index) => (
                <div key={index} className="border rounded-lg">
                  <div className={`p-2 text-center font-medium ${
                    date.getDate() === new Date().getDate() && 
                    date.getMonth() === new Date().getMonth() && 
                    date.getFullYear() === new Date().getFullYear() 
                      ? 'bg-primary text-primary-foreground rounded-t-lg' 
                      : 'bg-muted'
                  }`}>
                    <div className="text-xs uppercase">
                      {format(date, "EEE")}
                    </div>
                    <div>
                      {format(date, "d")}
                    </div>
                  </div>
                  <div className="p-2 min-h-[200px] space-y-1">
                    {getFilteredRentals(date).map((rental) => (
                      <div 
                        key={rental.id} 
                        className="bg-primary/10 p-2 rounded text-xs mb-1 border-l-4 border-primary"
                      >
                        <div className="font-medium truncate">
                          {rental.venueName || `Venue #${rental.venueId}`}
                        </div>
                        <div className="flex justify-between items-center">
                          <span>{format(new Date(rental.startTime), "h:mm a")}</span>
                          <Badge variant="outline" className="text-[10px]">
                            {rental.customerName || `Customer #${rental.customerId}`}
                          </Badge>
                        </div>
                      </div>
                    ))}
                    
                    {getFilteredRentals(date).length === 0 && (
                      <div className="text-center text-xs text-muted-foreground pt-4">
                        No bookings
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Today's Bookings Summary</CardTitle>
          </CardHeader>
          <CardContent>
            {rentals.filter(rental => {
              const rentalDate = new Date(rental.startTime);
              const today = new Date();
              
              return rentalDate.getDate() === today.getDate() && 
                rentalDate.getMonth() === today.getMonth() && 
                rentalDate.getFullYear() === today.getFullYear() &&
                (selectedVenueId === "all" || rental.venueId.toString() === selectedVenueId);
            }).length > 0 ? (
              <div className="space-y-3">
                {rentals.filter(rental => {
                  const rentalDate = new Date(rental.startTime);
                  const today = new Date();
                  
                  return rentalDate.getDate() === today.getDate() && 
                    rentalDate.getMonth() === today.getMonth() && 
                    rentalDate.getFullYear() === today.getFullYear() &&
                    (selectedVenueId === "all" || rental.venueId.toString() === selectedVenueId);
                }).map(rental => (
                  <div key={rental.id} className="flex justify-between items-center border-b pb-3 last:border-0">
                    <div>
                      <div className="font-medium">
                        {rental.venueName || `Venue #${rental.venueId}`}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {format(new Date(rental.startTime), "h:mm a")} - {format(new Date(rental.endTime), "h:mm a")}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant={rental.status === "confirmed" ? "default" : "outline"}>
                        {rental.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4 text-muted-foreground">
                No bookings scheduled for today
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </CenterLayout>
  );
}