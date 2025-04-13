import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import PaymentService from '@/services/PaymentService';
import { Loader2 } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { queryClient } from '@/lib/queryClient';

/**
 * This component checks the status of a pending payment when a user returns
 * from the payment gateway. It handles the resumption of the ticket purchase
 * process after a successful payment.
 */
const PaymentStatusChecker = () => {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isChecking, setIsChecking] = useState(false);
  
  useEffect(() => {
    // Check for pending payment info in localStorage
    const pendingPaymentJson = localStorage.getItem('pendingPurchase');
    if (!pendingPaymentJson) return;
    
    const checkPaymentStatus = async () => {
      setIsChecking(true);
      try {
        const pendingPurchase = JSON.parse(pendingPaymentJson);
        const { sessionId, eventId, customerDetails, ticketSelections } = pendingPurchase;
        
        if (!sessionId) {
          setIsChecking(false);
          return;
        }
        
        // Check payment status with Thawani
        const status = await PaymentService.checkPaymentStatus(sessionId);
        
        if (status === 'paid') {
          // Payment was successful
          // Now complete the ticket purchase in our system
          toast({
            title: 'Payment Successful!',
            description: 'Processing your ticket purchase...',
          });
          
          try {
            // Submit the ticket purchase to our backend
            await apiRequest('POST', '/api/tickets/purchase', {
              eventId,
              customerDetails,
              ticketSelections,
              paymentSessionId: sessionId
            });
            
            // Clear the pending purchase
            localStorage.removeItem('pendingPurchase');
            
            // Invalidate tickets cache to reflect new tickets
            queryClient.invalidateQueries({ queryKey: ['/api/tickets/user'] });
            
            // Show success message
            toast({
              title: 'Purchase Completed!',
              description: 'Your tickets have been reserved successfully.',
              variant: 'default',
            });
            
            // Redirect to my tickets page
            setLocation('/my-tickets');
          } catch (error: any) {
            console.error('Error completing ticket purchase:', error);
            toast({
              title: 'Purchase Processing Error',
              description: 'Your payment was successful, but we had trouble processing your tickets. Please contact support.',
              variant: 'destructive',
            });
          }
        } else if (status === 'unpaid') {
          // Payment is still pending or was cancelled
          toast({
            title: 'Payment Incomplete',
            description: 'Your payment was not completed. You can try again.',
            variant: 'destructive',
          });
        } else {
          // Error checking payment status
          toast({
            title: 'Payment Status Unknown',
            description: 'We could not verify your payment status. If you completed the payment, please contact support.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error checking payment status:', error);
        toast({
          title: 'Status Check Failed',
          description: 'There was an error checking your payment status.',
          variant: 'destructive',
        });
      } finally {
        setIsChecking(false);
      }
    };
    
    // Check payment status when component mounts
    checkPaymentStatus();
  }, [setLocation, toast]);
  
  if (!isChecking) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Verifying Payment</h3>
          <p className="text-gray-600 mb-4">
            Please wait while we verify your payment status. This will only take a moment...
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentStatusChecker;