import { useQuery } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell } from "recharts";
import { Calendar, MapPin, DollarSign, Users, Ticket, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import TabsComponent from "@/components/ui/tabs-component";
import { format } from "date-fns";
import { Event } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";
import { useState } from "react";

interface SalesData {
  event: Event;
  totalSales: number;
  ticketsSold: number;
  salesByTicketType: {
    name: string;
    sold: number;
    revenue: number;
  }[];
}

const SalesReports = () => {
  const { user } = useAuth();
  const [match, params] = useRoute<{ id: string }>("/sales-reports/:id");
  const eventId = match ? parseInt(params.id) : -1;
  
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
        { id: "sales", label: "Sales Reports", href: "/managed-events" }
      );
    }
    
    return tabs;
  };
  
  // Fetch sales data
  const salesQuery = useQuery<SalesData>({
    queryKey: [`/api/events/${eventId}/sales`],
    enabled: eventId > 0,
    // Use the default query function from queryClient
  });
  
  if (salesQuery.isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TabsComponent
          tabs={getNavTabs()}
          activeTab="sales"
        />
        
        <div className="animate-pulse mt-6">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 bg-white rounded-lg shadow-md p-6">
                <div className="h-6 bg-gray-200 rounded w-1/3 mb-3"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="h-80 bg-white rounded-lg shadow-md p-6">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
            <div className="h-80 bg-white rounded-lg shadow-md p-6">
              <div className="h-6 bg-gray-200 rounded w-1/4 mb-6"></div>
              <div className="h-64 bg-gray-200 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (salesQuery.error || !salesQuery.data) {
    console.error('Sales query error:', salesQuery.error);
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <TabsComponent
          tabs={getNavTabs()}
          activeTab="sales"
        />
        
        <div className="text-center py-12 bg-white rounded-lg shadow-md mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Error Loading Sales Data</h2>
          <p className="text-gray-600 mb-6">
            {salesQuery.error 
              ? `Error: ${salesQuery.error.message}` 
              : "We couldn't retrieve the sales information for this event."}
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/managed-events">
              <Button>Back to Managed Events</Button>
            </Link>
            <Button 
              variant="outline" 
              onClick={() => salesQuery.refetch()}
            >
              Try Again
            </Button>
          </div>
        </div>
      </div>
    );
  }
  
  const { event, totalSales, ticketsSold, salesByTicketType } = salesQuery.data;
  
  // Prepare data for charts
  const barChartData = salesByTicketType.map(item => ({
    name: item.name,
    Sold: item.sold,
    Revenue: Number(Number(item.revenue).toFixed(2))
  }));
  
  const pieChartData = salesByTicketType.map(item => ({
    name: item.name,
    value: Number(item.revenue)
  }));
  
  const COLORS = ['#6366F1', '#EC4899', '#F59E0B', '#34D399', '#3B82F6', '#A855F7'];
  
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <TabsComponent
        tabs={getNavTabs()}
        activeTab="sales"
      />
      
      <div className="mb-6 mt-6">
        <Link href="/managed-events">
          <Button variant="ghost" className="mb-4">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Managed Events
          </Button>
        </Link>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.title} - Sales Report</h1>
        <div className="flex flex-wrap gap-4 text-sm text-gray-600">
          <div className="flex items-center">
            <Calendar className="h-4 w-4 mr-1" />
            {format(new Date(event.startDate), "MMMM d, yyyy")}
          </div>
          <div className="flex items-center">
            <MapPin className="h-4 w-4 mr-1" />
            {event.location}
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <DollarSign className="h-5 w-5 text-primary mr-2" />
              <div className="text-2xl font-bold">${Number(totalSales).toFixed(2)}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Tickets Sold</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Ticket className="h-5 w-5 text-secondary mr-2" />
              <div className="text-2xl font-bold">{ticketsSold}</div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">Ticket Types</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Users className="h-5 w-5 text-accent mr-2" />
              <div className="text-2xl font-bold">{salesByTicketType.length}</div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>Ticket Sales Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={barChartData}
                  margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                >
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value, name) => {
                    if (name === 'Revenue') {
                      return [`$${value}`, name];
                    }
                    return [value.toString(), name];
                  }} />
                  <Legend />
                  <Bar dataKey="Sold" fill="#6366F1" />
                  <Bar dataKey="Revenue" fill="#EC4899" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Revenue Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => {
                    return [`$${Number(value).toFixed(2)} revenue`, ''];
                  }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Ticket Type Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="grid grid-cols-12 p-4 font-medium bg-muted">
              <div className="col-span-4">Ticket Type</div>
              <div className="col-span-2 text-center">Price</div>
              <div className="col-span-2 text-center">Available</div>
              <div className="col-span-2 text-center">Sold</div>
              <div className="col-span-2 text-right">Revenue</div>
            </div>
            
            {salesByTicketType.map((type, index) => (
              <div key={index} className="grid grid-cols-12 p-4 border-t">
                <div className="col-span-4 font-medium">{type.name}</div>
                <div className="col-span-2 text-center">
                  ${type.sold > 0 ? Number(Number(type.revenue) / type.sold).toFixed(2) : '0.00'}
                </div>
                <div className="col-span-2 text-center">
                  {/* This is an estimate as we don't have the total available in this response */}
                  {type.sold === 0 ? '-' : 'Limited'}
                </div>
                <div className="col-span-2 text-center">{type.sold}</div>
                <div className="col-span-2 text-right">${Number(type.revenue).toFixed(2)}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SalesReports;
