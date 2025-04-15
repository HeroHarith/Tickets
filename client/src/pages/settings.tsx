import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ChevronLeft, CreditCard, User, Settings as SettingsIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getSubscriptionPlans, getCurrentSubscription } from "@/services/SubscriptionService";
import { 
  SubscriptionPlansGrid, 
  SubscriptionDetails
} from "@/components/domain/subscriptions";

export default function SettingsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("profile");

  // Get the appropriate user type for filtering plans
  const userType = user?.role === "eventManager" 
    ? "eventManager" 
    : user?.role === "center" 
      ? "center" 
      : undefined;
  
  // Fetch subscription plans
  const { 
    data: plans, 
    isLoading: isLoadingPlans
  } = useQuery({
    queryKey: ["/api/subscriptions/plans"],
    queryFn: () => getSubscriptionPlans(),
    enabled: activeTab === "subscription" && (user?.role === "eventManager" || user?.role === "center")
  });
  
  // Fetch current subscription
  const { 
    data: currentSubscription, 
    isLoading: isLoadingSubscription
  } = useQuery({
    queryKey: ["/api/subscriptions/my-subscription"],
    queryFn: () => getCurrentSubscription(),
    enabled: activeTab === "subscription" && (user?.role === "eventManager" || user?.role === "center")
  });

  // Check subscription loading state
  const isSubscriptionLoading = isLoadingPlans || isLoadingSubscription;

  // Redirect to subscription page for plan selection
  const handleManageSubscription = () => {
    setLocation("/subscriptions");
  };

  if (!user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center mb-6">
        <Button variant="outline" size="icon" onClick={() => setLocation("/")} className="mr-4">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Settings</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="col-span-1">
          <CardContent className="p-4">
            <nav className="flex flex-col space-y-1">
              <Button 
                variant={activeTab === "profile" ? "default" : "ghost"} 
                className="justify-start" 
                onClick={() => setActiveTab("profile")}
              >
                <User className="mr-2 h-4 w-4" />
                Profile
              </Button>
              
              {(user.role === "eventManager" || user.role === "center") && (
                <Button 
                  variant={activeTab === "subscription" ? "default" : "ghost"} 
                  className="justify-start" 
                  onClick={() => setActiveTab("subscription")}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Subscription
                </Button>
              )}
              
              <Button 
                variant={activeTab === "preferences" ? "default" : "ghost"} 
                className="justify-start" 
                onClick={() => setActiveTab("preferences")}
              >
                <SettingsIcon className="mr-2 h-4 w-4" />
                Preferences
              </Button>
            </nav>
          </CardContent>
        </Card>

        <div className="col-span-1 md:col-span-3">
          <TabsContent value="profile" className="mt-0" hidden={activeTab !== "profile"}>
            <Card>
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>Manage your account details and personal information</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Username</h3>
                      <p className="text-lg">{user.username}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Full Name</h3>
                      <p className="text-lg">{user.name || "Not provided"}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Email</h3>
                      <p className="text-lg">{user.email}</p>
                    </div>
                    <div>
                      <h3 className="text-sm font-medium text-muted-foreground">Account Type</h3>
                      <p className="text-lg capitalize">{user.role}</p>
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <Button>Update Profile</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="subscription" className="mt-0" hidden={activeTab !== "subscription"}>
            <Card>
              <CardHeader>
                <CardTitle>Subscription</CardTitle>
                <CardDescription>Manage your subscription plan and payment details</CardDescription>
              </CardHeader>
              <CardContent>
                {isSubscriptionLoading ? (
                  <div className="flex justify-center items-center py-16">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <div className="space-y-6">
                    {currentSubscription ? (
                      <div className="space-y-4">
                        <SubscriptionDetails 
                          subscription={currentSubscription}
                          compact={true}
                        />
                        <div className="pt-4">
                          <Button onClick={handleManageSubscription}>
                            Manage Subscription
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <h3 className="font-medium text-lg">No Active Subscription</h3>
                          <p className="text-muted-foreground mb-4">
                            You don't have an active subscription plan.
                          </p>
                          <Button onClick={handleManageSubscription}>
                            View Available Plans
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="preferences" className="mt-0" hidden={activeTab !== "preferences"}>
            <Card>
              <CardHeader>
                <CardTitle>Preferences</CardTitle>
                <CardDescription>Customize your application experience</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Preference settings will be available soon.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </div>
    </div>
  );
}