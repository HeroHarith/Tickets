import { useAuth } from "@/hooks/use-auth";
import { CenterLayout } from "@/components/ui/center-layout";
import { Loader2, BarChart3 } from "lucide-react";
import { VenueSalesReport } from "@/components/ui/venue-sales-report";
import { useQuery } from "@tanstack/react-query";

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

export default function CenterReportsPage() {
  const { user, isLoading: authLoading } = useAuth();
  
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
  if (authLoading || venuesLoading) {
    return (
      <CenterLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
              <BarChart3 className="mr-2 h-6 w-6" />
              Sales Reports
            </h1>
            <p className="text-muted-foreground">
              View financial performance and booking statistics
            </p>
          </div>
        </div>
        
        <VenueSalesReport venues={venues} />
      </div>
    </CenterLayout>
  );
}