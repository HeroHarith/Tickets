import { useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle } from 'lucide-react';

/**
 * A dedicated page to show payment success or failure status
 * This page is shown after the user returns from the payment gateway
 */
const PaymentStatus = () => {
  const [location] = useLocation();
  const isSuccess = location.includes('success');
  
  // Adds visual feedback based on the payment status
  return (
    <div className="container max-w-4xl mx-auto py-12 px-4">
      <Card className="w-full shadow-md">
        <CardHeader>
          <CardTitle className="text-center text-2xl">
            {isSuccess ? 'Payment Successful' : 'Payment Unsuccessful'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center py-8">
          {isSuccess ? (
            <>
              <CheckCircle className="w-20 h-20 text-green-500 mb-6" />
              <p className="text-center text-gray-600 mb-8">
                Your payment was successful. Your tickets are being processed.
                <br />You will receive a confirmation email shortly.
              </p>
            </>
          ) : (
            <>
              <XCircle className="w-20 h-20 text-red-500 mb-6" />
              <p className="text-center text-gray-600 mb-8">
                Your payment was not completed or was canceled.
                <br />No charges have been made to your account.
              </p>
            </>
          )}
          
          <div className="flex gap-4">
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/'}
            >
              Return to Home
            </Button>
            
            {!isSuccess && (
              <Button 
                variant="default"
                onClick={() => {
                  // Redirect back to the previous event page if available
                  const pendingPaymentInfo = localStorage.getItem('pendingPurchase');
                  if (pendingPaymentInfo) {
                    try {
                      const { eventId } = JSON.parse(pendingPaymentInfo);
                      if (eventId) {
                        window.location.href = `/events/${eventId}`;
                        return;
                      }
                    } catch (e) {
                      console.error('Error parsing pending payment info:', e);
                    }
                  }
                  
                  // Default fallback to tickets page
                  window.location.href = '/my-tickets';
                }}
              >
                Try Again
              </Button>
            )}
            
            {isSuccess && (
              <Button 
                variant="default"
                onClick={() => window.location.href = '/my-tickets'}
              >
                View My Tickets
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentStatus;