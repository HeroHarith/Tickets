import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { Subscription } from "@shared/schema";

// Define ApiResponse type for our standardized API responses
interface ApiResponse<T> {
  code: number;
  success: boolean;
  data: T | null;
  description?: string;
}

export function SubscriptionStatusChecker() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(false);
  
  useEffect(() => {
    // Check if we're returning from a payment
    const query = new URLSearchParams(window.location.search);
    const sessionId = query.get("session_id");
    const status = query.get("status");
    
    if (sessionId && status && !isChecking) {
      checkSubscriptionStatus(sessionId, status);
    }
  }, [window.location.search, isChecking]);
  
  const checkSubscriptionStatus = async (sessionId: string, status: string) => {
    setIsChecking(true);
    
    try {
      const response = await fetch(`/api/subscriptions/status/${sessionId}`);
      const data: ApiResponse<{ subscription: Subscription & { plan?: { name: string } } }> = await response.json();
      
      if (response.ok && data.success) {
        // Show success toast and redirect to subscription page
        toast({
          title: "Subscription Successful!",
          description: `Your subscription${data.data?.subscription.plan?.name ? ` to ${data.data.subscription.plan.name}` : ''} is now active.`,
        });
        
        // Remove query params from URL without causing a reload
        window.history.replaceState({}, document.title, window.location.pathname);
        
        // Redirect to subscription management page
        setLocation("/subscriptions");
      } else {
        // Show error toast
        toast({
          title: "Subscription Issue",
          description: data.description || "There was an issue with your subscription. Please contact support.",
          variant: "destructive",
        });
        
        // Remove query params but stay on current page
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    } catch (error) {
      console.error("Error checking subscription status:", error);
      toast({
        title: "Error",
        description: "Unable to verify subscription status. Please check your account.",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };
  
  // This component doesn't render anything
  return null;
}