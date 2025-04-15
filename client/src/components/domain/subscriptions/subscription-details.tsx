import { Subscription, SubscriptionPayment } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, DollarSign, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { cancelSubscription, getSubscriptionPayments } from "@/services/SubscriptionService";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";

interface SubscriptionDetailsProps {
  subscription: Subscription;
  onCancelled: () => void;
}

export function SubscriptionDetails({ subscription, onCancelled }: SubscriptionDetailsProps) {
  const [isCancelling, setIsCancelling] = useState(false);
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [showPayments, setShowPayments] = useState(false);
  const [isLoadingPayments, setIsLoadingPayments] = useState(false);
  const { toast } = useToast();
  
  const handleCancelSubscription = async () => {
    setIsCancelling(true);
    try {
      await cancelSubscription();
      toast({
        title: "Subscription cancelled",
        description: "Your subscription will remain active until the end of the current billing period.",
      });
      onCancelled();
    } catch (error) {
      console.error("Error cancelling subscription:", error);
      toast({
        title: "Error",
        description: "There was a problem cancelling your subscription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsCancelling(false);
    }
  };
  
  const loadPaymentHistory = async () => {
    if (payments.length > 0) {
      setShowPayments(!showPayments);
      return;
    }
    
    setIsLoadingPayments(true);
    try {
      const paymentData = await getSubscriptionPayments(subscription.id);
      setPayments(paymentData);
      setShowPayments(true);
    } catch (error) {
      console.error("Error loading payment history:", error);
      toast({
        title: "Error",
        description: "There was a problem loading your payment history. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingPayments(false);
    }
  };
  
  // Convert string dates to Date objects
  const startDate = new Date(subscription.startDate);
  const endDate = new Date(subscription.endDate);
  
  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Current Subscription</CardTitle>
          <Badge variant={subscription.status === 'active' ? 'default' : 'outline'}>
            {subscription.status === 'active' ? 'Active' : 
             subscription.status === 'pending' ? 'Pending' : 
             subscription.status === 'cancelled' ? 'Cancelling' : 
             subscription.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-lg font-medium">{subscription.plan?.name || "Plan"}</h3>
          <p className="text-muted-foreground">{subscription.plan?.description}</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Start Date</p>
              <p>{format(startDate, "PPP")}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">End Date</p>
              <p>{format(endDate, "PPP")}</p>
            </div>
          </div>
        </div>
        
        {subscription.status === 'cancelled' && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 p-3 rounded flex items-start space-x-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              Your subscription has been cancelled but will remain active until {format(endDate, "PPP")}.
            </p>
          </div>
        )}
        
        {showPayments && (
          <div className="mt-6">
            <h4 className="font-medium mb-2">Payment History</h4>
            {payments.length === 0 ? (
              <p className="text-muted-foreground text-sm">No payments found for this subscription.</p>
            ) : (
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex justify-between items-center p-2 border rounded">
                    <div>
                      <p className="font-medium">${parseFloat(payment.amount).toFixed(2)}</p>
                      <p className="text-xs text-muted-foreground">
                        {payment.paymentDate ? format(new Date(payment.paymentDate), "PPP") : "N/A"}
                      </p>
                    </div>
                    <Badge variant={payment.status === 'paid' ? 'default' : 'outline'}>
                      {payment.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={loadPaymentHistory}
          disabled={isLoadingPayments}
        >
          <DollarSign className="h-4 w-4 mr-2" />
          {isLoadingPayments 
            ? "Loading..." 
            : showPayments 
              ? "Hide Payment History" 
              : "View Payment History"}
        </Button>
        
        {subscription.status === 'active' && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive">Cancel Subscription</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Cancel Subscription</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to cancel your subscription? You will still have access until the end of your current billing period on {format(endDate, "PPP")}.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep Subscription</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={handleCancelSubscription}
                  disabled={isCancelling}
                >
                  {isCancelling ? "Cancelling..." : "Yes, Cancel"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </CardFooter>
    </Card>
  );
}