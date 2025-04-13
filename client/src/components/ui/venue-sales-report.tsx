import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription 
} from "@/components/ui/card";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, BarChart3, DollarSign, Calendar, PieChart } from "lucide-react";
import { format, subMonths } from "date-fns";
import { Venue } from "@/lib/types";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Pie,
  PieChart as RechartsPieChart,
  Cell
} from "recharts";

// Define the interface for venue sales report data
interface SalesReportData {
  totalRevenue: number;
  completedBookings: number;
  canceledBookings: number;
  pendingPayments: number;
  paidBookings: number;
  refundedBookings: number;
  averageBookingValue: number;
  venueBreakdown?: {
    venueId: number;
    venueName: string;
    revenue: number;
    bookings: number;
  }[];
  timeBreakdown: {
    period: string;
    revenue: number;
    bookings: number;
  }[];
}

// Define props for the component
interface VenueSalesReportProps {
  venues: Venue[];
}

export function VenueSalesReport({ venues }: VenueSalesReportProps) {
  const [selectedVenueId, setSelectedVenueId] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>(subMonths(new Date(), 6));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());
  
  // Convert display period to human-readable format
  const formatPeriod = (period: string) => {
    const [year, month] = period.split('-');
    return format(new Date(parseInt(year), parseInt(month) - 1), 'MMM yyyy');
  };
  
  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2
    }).format(amount);
  };
  
  // Query for the sales report data
  const { 
    data: salesReportResponse, 
    isLoading, 
    error,
    refetch 
  } = useQuery({
    queryKey: ["/api/venues/sales-report", selectedVenueId, startDate, endDate],
    queryFn: async () => {
      // Build query parameters
      let queryParams = new URLSearchParams();
      
      if (selectedVenueId !== "all") {
        queryParams.append("venueId", selectedVenueId);
      }
      
      if (startDate) {
        queryParams.append("startDate", startDate.toISOString());
      }
      
      if (endDate) {
        queryParams.append("endDate", endDate.toISOString());
      }
      
      const response = await fetch(`/api/venues/sales-report?${queryParams.toString()}`);
      
      if (!response.ok) {
        throw new Error("Failed to fetch sales report");
      }
      
      const result = await response.json();
      // Handle the standardized API response format
      if (result.success === false) {
        throw new Error(result.description || "Failed to fetch sales report");
      }
      return result;
    },
    enabled: venues.length > 0
  });
  
  // Extract data from the standardized response format
  const salesReport = salesReportResponse && 'data' in salesReportResponse ? 
    salesReportResponse.data as SalesReportData : undefined;
  
  // Pie chart colors
  const STATUS_COLORS = ['#10B981', '#F97316', '#6366F1', '#EC4899'];
  
  // Prepare data for the payment status pie chart
  const paymentStatusData = salesReport ? [
    { name: 'Paid', value: salesReport.paidBookings },
    { name: 'Unpaid', value: salesReport.pendingPayments },
    { name: 'Refunded', value: salesReport.refundedBookings }
  ].filter(item => item.value > 0) : [];
  
  // Prepare data for the booking status pie chart
  const bookingStatusData = salesReport ? [
    { name: 'Completed', value: salesReport.completedBookings },
    { name: 'Canceled', value: salesReport.canceledBookings },
    { name: 'Active', value: (salesReport.paidBookings + salesReport.pendingPayments) - 
                            (salesReport.completedBookings + salesReport.canceledBookings) }
  ].filter(item => item.value > 0) : [];
  
  // Handle filter updates
  const handleApplyFilters = () => {
    refetch();
  };
  
  if (error) {
    return (
      <Card className="col-span-1 md:col-span-3">
        <CardHeader>
          <CardTitle>Sales Report</CardTitle>
          <CardDescription>Error loading sales report data</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-destructive">
            {error instanceof Error ? error.message : "An unknown error occurred"}
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <>
      <Card className="col-span-1 md:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <BarChart3 className="mr-2 h-5 w-5" />
              Sales Report
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <Select
                value={selectedVenueId}
                onValueChange={setSelectedVenueId}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select venue" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Venues</SelectItem>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.id.toString()}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <div className="flex items-center space-x-2">
                <DatePicker
                  date={startDate}
                  onSelect={setStartDate}
                  placeholder="Start date"
                />
                <span>to</span>
                <DatePicker
                  date={endDate}
                  onSelect={setEndDate}
                  placeholder="End date"
                />
              </div>
              
              <Button onClick={handleApplyFilters}>
                Apply Filters
              </Button>
            </div>
          </CardTitle>
          <CardDescription>
            Financial summary and booking statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-28 w-full" />
              ))}
              <Skeleton className="h-80 w-full col-span-1 md:col-span-4" />
            </div>
          ) : salesReport ? (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                      <DollarSign className="mr-1 h-4 w-4" />
                      Total Revenue
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(salesReport.totalRevenue)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                      <Calendar className="mr-1 h-4 w-4" />
                      Total Bookings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {salesReport.completedBookings + salesReport.canceledBookings + 
                        (salesReport.paidBookings + salesReport.pendingPayments - 
                        (salesReport.completedBookings + salesReport.canceledBookings))}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                      <DollarSign className="mr-1 h-4 w-4" />
                      Average Booking Value
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {formatCurrency(salesReport.averageBookingValue)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                      <PieChart className="mr-1 h-4 w-4" />
                      Payment Rate
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {salesReport.pendingPayments + salesReport.paidBookings > 0 ? 
                        `${Math.round((salesReport.paidBookings / 
                          (salesReport.pendingPayments + salesReport.paidBookings)) * 100)}%` : 
                        'N/A'}
                    </div>
                  </CardContent>
                </Card>
              </div>
              
              {/* Time breakdown chart */}
              <div className="mb-8">
                <h3 className="text-lg font-medium mb-4">Monthly Revenue</h3>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart 
                      data={salesReport.timeBreakdown
                        .sort((a, b) => a.period.localeCompare(b.period))
                        .map(item => ({
                          ...item,
                          period: formatPeriod(item.period)
                        }))}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                      <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                      <Tooltip
                        formatter={(value: number, name: string) => {
                          if (name === "revenue") {
                            return [formatCurrency(value), "Revenue"];
                          }
                          return [value, "Bookings"];
                        }}
                      />
                      <Legend />
                      <Bar yAxisId="left" dataKey="revenue" name="Revenue" fill="#8884d8" />
                      <Bar yAxisId="right" dataKey="bookings" name="Bookings" fill="#82ca9d" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              
              {/* Status breakdowns */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-lg font-medium mb-4">Payment Status</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={paymentStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {paymentStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, "Bookings"]} />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium mb-4">Booking Status</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie
                          data={bookingStatusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={70}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        >
                          {bookingStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={STATUS_COLORS[index % STATUS_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => [value, "Bookings"]} />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
              
              {/* Venue breakdown table - only show if multiple venues or "all" selected */}
              {salesReport.venueBreakdown && salesReport.venueBreakdown.length > 1 && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Venue Breakdown</h3>
                  <div className="border rounded-md">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="py-3 px-4 text-left font-medium">Venue</th>
                          <th className="py-3 px-4 text-right font-medium">Bookings</th>
                          <th className="py-3 px-4 text-right font-medium">Revenue</th>
                          <th className="py-3 px-4 text-right font-medium">Avg. Booking</th>
                        </tr>
                      </thead>
                      <tbody>
                        {salesReport.venueBreakdown.map((venue) => (
                          <tr key={venue.venueId} className="border-b last:border-0">
                            <td className="py-3 px-4">{venue.venueName}</td>
                            <td className="py-3 px-4 text-right">{venue.bookings}</td>
                            <td className="py-3 px-4 text-right">{formatCurrency(venue.revenue)}</td>
                            <td className="py-3 px-4 text-right">
                              {venue.bookings > 0 ? 
                                formatCurrency(venue.revenue / venue.bookings) : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">No data available for the selected filters</div>
          )}
        </CardContent>
      </Card>
    </>
  );
}