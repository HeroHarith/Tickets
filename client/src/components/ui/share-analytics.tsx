import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from "lucide-react";

interface ShareAnalyticsProps {
  eventId: number;
}

interface ShareData {
  total: number;
  platforms: {
    facebook: number;
    twitter: number;
    linkedin: number;
    whatsapp: number;
    copy_link?: number;
  };
}

export function ShareAnalytics({ eventId }: ShareAnalyticsProps) {
  const [activeTab, setActiveTab] = useState("overview");
  
  // Fetch share data
  const shareQuery = useQuery<ShareData>({
    queryKey: [`/api/events/${eventId}/shares`],
    enabled: eventId > 0,
  });
  
  if (shareQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  
  if (shareQuery.error || !shareQuery.data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Share Analytics</CardTitle>
          <CardDescription>Error loading share analytics</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {shareQuery.error instanceof Error 
              ? shareQuery.error.message 
              : "Unable to load share data. Please try again later."}
          </p>
        </CardContent>
      </Card>
    );
  }
  
  const data = shareQuery.data;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Share Analytics</CardTitle>
        <CardDescription>See how your event is being shared on social media</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="platforms">By Platform</TabsTrigger>
          </TabsList>
          <TabsContent value="overview" className="space-y-4">
            <div className="mt-4 grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col items-center justify-center rounded-md border p-4">
                  <div className="text-2xl font-bold">{data.total}</div>
                  <p className="text-xs text-muted-foreground">Total Shares</p>
                </div>
                <div className="flex flex-col items-center justify-center rounded-md border p-4">
                  <div className="text-2xl font-bold">
                    {Object.keys(data.platforms).length}
                  </div>
                  <p className="text-xs text-muted-foreground">Platforms Used</p>
                </div>
              </div>
              
              <div className="rounded-md border p-4">
                <h3 className="mb-2 font-medium">Top Platform</h3>
                <div className="flex items-center">
                  <div className="h-4 w-4 rounded-full mr-2" style={{ 
                    backgroundColor: getPlatformColor(getTopPlatform(data.platforms)) 
                  }} />
                  <span className="capitalize">
                    {formatPlatformName(getTopPlatform(data.platforms))}
                  </span>
                  <span className="ml-auto font-medium">
                    {data.platforms[getTopPlatform(data.platforms) as keyof typeof data.platforms]} shares
                  </span>
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="platforms">
            <div className="space-y-4 mt-4">
              {Object.entries(data.platforms).map(([platform, count]) => (
                <div key={platform} className="flex items-center">
                  <div className="h-4 w-4 rounded-full mr-2" style={{ 
                    backgroundColor: getPlatformColor(platform) 
                  }} />
                  <span className="capitalize">{formatPlatformName(platform)}</span>
                  <div className="ml-auto flex items-center gap-2">
                    <div className="h-2 bg-primary rounded-full" style={{ 
                      width: `${(count / data.total) * 100}px`,
                      backgroundColor: getPlatformColor(platform)
                    }} />
                    <span className="text-muted-foreground text-sm w-10 text-right">
                      {((count / data.total) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

// Get top platform by share count
function getTopPlatform(platforms: ShareData['platforms']): keyof ShareData['platforms'] {
  const keys = Object.keys(platforms);
  if (keys.length === 0) return 'facebook'; // Default fallback
  
  return Object.entries(platforms).reduce((top, [platform, count]) => {
    // Safely check if the current value is larger than the tracked top
    const topCount = platforms[top as keyof typeof platforms] || 0;
    return count > topCount ? platform : top;
  }, keys[0]) as keyof ShareData['platforms'];
}

// Format platform name for display
function formatPlatformName(platform: string): string {
  return platform === 'copy_link' ? 'Copy Link' : platform.charAt(0).toUpperCase() + platform.slice(1);
}

// Get color for platform
function getPlatformColor(platform: string): string {
  switch (platform) {
    case 'facebook':
      return '#3b5998';
    case 'twitter':
      return '#1DA1F2';
    case 'linkedin':
      return '#0077B5';
    case 'whatsapp':
      return '#25D366';
    case 'copy_link':
      return '#6c757d';
    default:
      return '#6366F1'; // Default primary color
  }
}

export default ShareAnalytics;