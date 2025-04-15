import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ChevronRight, DollarSign, Calendar, MapPin, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TabsComponent from "@/components/ui/tabs-component";
import { format } from "date-fns";
import { Event } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

interface EventWithSales extends Event {
  totalSales: number;
  ticketsSold: number;
}

const SalesReportList = () => {
  const { user } = useAuth();
  
  // Get navigation tabs based on user role
  const getNavTabs = () => {
    const tabs = [
      { id: "browse", label: "Browse Events", href: "/" },
      { id: "tickets", label: "My Tickets", href: "/my-tickets" }
    ];
    
    // Add manager-specific tabs if user has appropriate role
    if (user && ['eventManager', 'admin'].includes(user.role)) {
      tabs.push(
        { id: "managed", label: "Managed Events", href: "/managed-events" },
        { id: "sales", label: "Sales Reports", href: "/sales-reports" }
      );
    }
    
    return tabs;
  };
  
  // Fetch user's events with sales data
  const eventsQuery = useQuery<{data: EventWithSales[]}>({
    queryKey: [`/api/events/managed-with-sales`],
    enabled: !!user && ['eventManager', 'admin'].includes(user.role),
  });
  
  if (eventsQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TabsComponent
          tabs={getNavTabs()}
          activeTab="sales"
        />
        
        <div className="animate-pulse mt-6">
          <div className="h-10 bg-gray-200 rounded w-1/4 mb-6"></div>
          
          <div className="space-y-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-white rounded-lg shadow-md p-6">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }
  
  if (eventsQuery.error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TabsComponent
          tabs={getNavTabs()}
          activeTab="sales"
        />
        
        <div className="text-center py-12 bg-white rounded-lg shadow-md mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Error Loading Events</h2>
          <p className="text-gray-600 mb-6">
            {eventsQuery.error instanceof Error 
              ? `Error: ${eventsQuery.error.message}` 
              : "We couldn't retrieve your events information."}
          </p>
          <Button 
            variant="outline" 
            onClick={() => eventsQuery.refetch()}
          >
            Try Again
          </Button>
        </div>
      </div>
    );
  }
  
  // If no events are found
  if (!eventsQuery.data?.data || !Array.isArray(eventsQuery.data.data) || eventsQuery.data.data.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TabsComponent
          tabs={getNavTabs()}
          activeTab="sales"
        />
        
        <div className="text-center py-12 bg-white rounded-lg shadow-md mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">No Events Found</h2>
          <p className="text-gray-600 mb-6">
            You don't have any events to view sales reports for.
          </p>
          <Link href="/create-event">
            <Button>Create an Event</Button>
          </Link>
        </div>
      </div>
    );
  }
  
  // Extract data from the API response
  const events = eventsQuery.data?.data ? Array.isArray(eventsQuery.data.data) ? eventsQuery.data.data : [] : [];
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <TabsComponent
        tabs={getNavTabs()}
        activeTab="sales"
      />
      
      <div className="mt-6 mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sales Reports</h1>
        <p className="text-gray-600">View sales performance for all your events</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <DollarSign className="h-5 w-5 text-primary mr-2" />
              <div className="text-2xl font-bold">
                ${events.reduce((sum, event) => sum + (event.totalSales || 0), 0).toFixed(2)}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Tickets Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Ticket className="h-5 w-5 text-secondary mr-2" />
              <div className="text-2xl font-bold">
                {events.reduce((sum, event) => sum + (event.ticketsSold || 0), 0)}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Events</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Calendar className="h-5 w-5 text-accent mr-2" />
              <div className="text-2xl font-bold">{events.length}</div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="space-y-6">
        <h2 className="text-xl font-semibold mb-4">Event Performance</h2>
        
        {events.map(event => (
          <Link href={`/sales-reports/${event.id}`} key={event.id}>
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">{event.title}</h3>
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600 mb-2">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {event.startDate && !isNaN(new Date(event.startDate).getTime())
                          ? format(new Date(event.startDate), "MMMM d, yyyy")
                          : 'Date not available'}
                      </div>
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {event.location || 'Location not available'}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-4">
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 text-primary mr-1" />
                        <span className="font-medium">${(event.totalSales || 0).toFixed(2)}</span>
                      </div>
                      <div className="flex items-center">
                        <Ticket className="h-4 w-4 text-secondary mr-1" />
                        <span className="font-medium">{event.ticketsSold || 0} sold</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default SalesReportList;