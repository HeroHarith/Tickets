import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import EventCard from "@/components/ui/event-card";
import TabsComponent from "@/components/ui/tabs-component";
import EventSearch from "@/components/ui/event-search";
import { Button } from "@/components/ui/button";
import { Event, TicketType } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

const Home = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useState({
    search: "",
    category: "",
    date: ""
  });
  
  const [sortBy, setSortBy] = useState("date");
  
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
  
  // Fetch featured events
  const featuredEventsQuery = useQuery<Event[]>({
    queryKey: ["/api/events", { featured: true }],
    queryFn: async () => {
      const res = await fetch(`/api/events?featured=true`);
      if (!res.ok) throw new Error("Failed to fetch featured events");
      return res.json();
    }
  });
  
  // Fetch all events with search parameters
  const eventsQuery = useQuery<Event[]>({
    queryKey: ["/api/events", searchParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchParams.search) params.append("search", searchParams.search);
      if (searchParams.category) params.append("category", searchParams.category);
      
      const res = await fetch(`/api/events?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch events");
      return res.json();
    }
  });
  
  // Fetch ticket types for each event
  const ticketTypesQueries = useQuery<Record<number, TicketType[]>>({
    queryKey: ["/api/events/ticketTypes", eventsQuery.data?.map(e => e.id)],
    enabled: !!eventsQuery.data && eventsQuery.data.length > 0,
    queryFn: async () => {
      const eventIds = eventsQuery.data!.map(e => e.id);
      const promises = eventIds.map(id => 
        fetch(`/api/events/${id}`)
          .then(res => res.json())
          .then(data => ({ id, ticketTypes: data.ticketTypes }))
      );
      
      const results = await Promise.all(promises);
      return results.reduce((acc, { id, ticketTypes }) => {
        acc[id] = ticketTypes;
        return acc;
      }, {} as Record<number, TicketType[]>);
    }
  });
  
  // Sort events
  const sortEvents = (events: Event[]) => {
    if (!events) return [];
    
    return [...events].sort((a, b) => {
      if (sortBy === "date") {
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      } else if (sortBy === "price-low") {
        // Sort by lowest ticket price if we have ticket types
        if (ticketTypesQueries.data) {
          const aTickets = ticketTypesQueries.data[a.id] || [];
          const bTickets = ticketTypesQueries.data[b.id] || [];
          
          const aMinPrice = aTickets.length > 0 
            ? Math.min(...aTickets.map(t => Number(t.price)))
            : Infinity;
          const bMinPrice = bTickets.length > 0
            ? Math.min(...bTickets.map(t => Number(t.price)))
            : Infinity;
            
          return aMinPrice - bMinPrice;
        }
      } else if (sortBy === "price-high") {
        // Sort by highest ticket price if we have ticket types
        if (ticketTypesQueries.data) {
          const aTickets = ticketTypesQueries.data[a.id] || [];
          const bTickets = ticketTypesQueries.data[b.id] || [];
          
          const aMaxPrice = aTickets.length > 0 
            ? Math.max(...aTickets.map(t => Number(t.price)))
            : 0;
          const bMaxPrice = bTickets.length > 0
            ? Math.max(...bTickets.map(t => Number(t.price)))
            : 0;
            
          return bMaxPrice - aMaxPrice;
        }
      }
      
      // Default to date sort
      return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
    });
  };
  
  const handleSearch = (params: typeof searchParams) => {
    setSearchParams(params);
  };
  
  const isLoading = featuredEventsQuery.isLoading || eventsQuery.isLoading || ticketTypesQueries.isLoading;
  
  return (
    <div>
      <TabsComponent
        tabs={getNavTabs()}
        activeTab="browse"
      />
      
      <EventSearch onSearch={handleSearch} />
      
      {/* Featured Events Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <h2 className="text-2xl font-semibold font-poppins text-gray-900 mb-6">Featured Events</h2>
        
        {featuredEventsQuery.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden h-[340px] animate-pulse">
                <div className="h-48 bg-gray-200"></div>
                <div className="p-4 space-y-3">
                  <div className="h-6 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-10 bg-gray-200 rounded w-full mt-4"></div>
                </div>
              </div>
            ))}
          </div>
        ) : featuredEventsQuery.error ? (
          <div className="text-center py-8">
            <p className="text-red-500">Failed to load featured events</p>
          </div>
        ) : featuredEventsQuery.data && featuredEventsQuery.data.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredEventsQuery.data.slice(0, 3).map(event => (
              <EventCard 
                key={event.id} 
                event={event} 
                ticketTypes={ticketTypesQueries.data?.[event.id]}
                featured
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No featured events at the moment</p>
          </div>
        )}
      </div>
      
      {/* Upcoming Events Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-semibold font-poppins text-gray-900">Upcoming Events</h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            <select 
              className="text-sm border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            >
              <option value="date">Date</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
          </div>
        </div>
        
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
              <div key={i} className="bg-white rounded-lg shadow-md overflow-hidden h-[300px] animate-pulse">
                <div className="h-40 bg-gray-200"></div>
                <div className="p-4 space-y-3">
                  <div className="h-5 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                  <div className="h-10 bg-gray-200 rounded w-full mt-2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : eventsQuery.error ? (
          <div className="text-center py-8">
            <p className="text-red-500">Failed to load events</p>
          </div>
        ) : eventsQuery.data && eventsQuery.data.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortEvents(eventsQuery.data).slice(0, 8).map(event => (
                <EventCard 
                  key={event.id} 
                  event={event} 
                  ticketTypes={ticketTypesQueries.data?.[event.id]}
                />
              ))}
            </div>
            
            {eventsQuery.data.length > 8 && (
              <div className="flex justify-center mt-8">
                <Button 
                  variant="outline"
                  className="bg-white border border-gray-300 rounded-md px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Load More Events
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500">No events found matching your criteria</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
