import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { SubscriptionPlan, Subscription } from "@shared/schema";
import { 
  SubscriptionPlansGrid, 
  SubscriptionDetails, 
  SubscriptionPaymentForm 
} from "@/components/domain/subscriptions";
import { getSubscriptionPlans, getCurrentSubscription } from "@/services/SubscriptionService";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle, DialogHeader } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, ChevronLeft } from "lucide-react";

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [activeTab, setActiveTab] = useState("plans");
  
  // Get the appropriate user type for filtering plans
  const userType = user?.role === "eventManager" 
    ? "eventManager" 
    : user?.role === "center" 
      ? "center" 
      : undefined;
  
  // Fetch subscription plans
  const { 
    data: plans, 
    isLoading: isLoadingPlans, 
    error: plansError 
  } = useQuery({
    queryKey: ["/api/subscriptions/plans"],
    queryFn: () => getSubscriptionPlans(),
  });
  
  // Fetch current subscription
  const { 
    data: currentSubscription, 
    isLoading: isLoadingSubscription, 
    error: subscriptionError 
  } = useQuery({
    queryKey: ["/api/subscriptions/my-subscription"],
    queryFn: () => getCurrentSubscription(),
  });
  
  // Handle plan selection
  const handleSelectPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setShowPaymentForm(true);
  };
  
  // Handle payment success
  const handlePaymentSuccess = (paymentUrl: string) => {
    // Redirect to Thawani payment page
    window.location.href = paymentUrl;
  };
  
  // Handle payment form cancel
  const handlePaymentCancel = () => {
    setShowPaymentForm(false);
    setSelectedPlan(null);
  };
  
  // Handle subscription cancellation
  const handleSubscriptionCancelled = () => {
    // Invalidate the subscription query to reload data
    queryClient.invalidateQueries({ queryKey: ["/api/subscriptions/my-subscription"] });
  };

  // Update the tab based on subscription status
  useEffect(() => {
    if (currentSubscription) {
      setActiveTab("current");
    }
  }, [currentSubscription]);
  
  const isLoading = isLoadingPlans || isLoadingSubscription;
  const hasError = plansError || subscriptionError;
  
  // If user is not authenticated or has no valid role, show error
  if (!user || (user.role !== "eventManager" && user.role !== "center" && user.role !== "admin")) {
    return (
      <Card className="max-w-4xl mx-auto my-12">
        <CardContent className="pt-6">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
            <p className="text-muted-foreground mb-6">
              You need to be a venue owner or event manager to access subscription plans.
            </p>
            <Button onClick={() => setLocation("/")}>Return to Home</Button>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="container py-8">
      <div className="flex items-center mb-6">
        <Button variant="outline" size="icon" onClick={() => setLocation("/")} className="mr-4">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-3xl font-bold">Subscription Management</h1>
      </div>
      
      {isLoading ? (
        <div className="flex justify-center items-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : hasError ? (
        <div className="text-center py-16">
          <p className="text-red-500 mb-4">
            There was an error loading subscription data. Please try again.
          </p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      ) : (
        <div className="max-w-6xl mx-auto">
          {plans && plans.length > 0 && (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-8">
              <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
                <TabsTrigger value="plans">Available Plans</TabsTrigger>
                <TabsTrigger 
                  value="current" 
                  disabled={!currentSubscription}
                >
                  Current Subscription
                </TabsTrigger>
              </TabsList>
              
              <TabsContent value="plans" className="space-y-8">
                <SubscriptionPlansGrid 
                  plans={plans}
                  currentPlanId={currentSubscription?.planId}
                  userType={userType}
                  onSelectPlan={handleSelectPlan}
                />
              </TabsContent>
              
              <TabsContent value="current">
                {currentSubscription ? (
                  <SubscriptionDetails 
                    subscription={currentSubscription} 
                    onCancelled={handleSubscriptionCancelled}
                  />
                ) : (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground mb-4">
                      You don't have any active subscriptions yet.
                    </p>
                    <Button onClick={() => setActiveTab("plans")}>View Available Plans</Button>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </div>
      )}
      
      <Dialog open={showPaymentForm} onOpenChange={setShowPaymentForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Subscribe to {selectedPlan?.name}</DialogTitle>
          </DialogHeader>
          {selectedPlan && (
            <SubscriptionPaymentForm 
              plan={selectedPlan}
              onSuccess={handlePaymentSuccess}
              onCancel={handlePaymentCancel}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}