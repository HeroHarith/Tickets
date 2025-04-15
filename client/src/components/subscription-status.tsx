import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, CheckCircle } from 'lucide-react';
import { Link } from 'wouter';
import { apiRequest } from '@/lib/queryClient';

interface Subscription {
  id: number;
  userId: number;
  planType: string;
  status: string;
  startDate: string;
  endDate: string;
  metadata: any;
}

export function SubscriptionStatus() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!user || (user.role !== 'eventManager' && user.role !== 'center')) return;
      
      try {
        setLoading(true);
        const response = await apiRequest('GET', '/api/subscriptions/current');
        const data = await response.json();
        
        if (data.success) {
          setSubscription(data.data);
        } else {
          // No error, just no subscription found
          setSubscription(null);
        }
      } catch (err) {
        console.error('Error fetching subscription:', err);
        setError('Failed to load subscription information');
      } finally {
        setLoading(false);
      }
    };

    fetchSubscription();
  }, [user]);

  if (!user || (user.role !== 'eventManager' && user.role !== 'center')) {
    return null;
  }

  if (loading) {
    return (
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!subscription) {
    const isCenter = user.role === 'center';
    
    return (
      <Card className="mb-6 border-orange-200 bg-orange-50">
        <CardHeader>
          <CardTitle className="text-orange-700">Subscription Required</CardTitle>
          <CardDescription>
            {isCenter 
              ? "You need a subscription to manage venues and view bookings" 
              : "You need a subscription to create events and view sales reports"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-orange-800 mb-4">
            {isCenter 
              ? "As a venue owner, you need an active subscription to access all features:" 
              : "As an event manager, you need an active subscription to access all features:"}
          </p>
          <ul className="list-disc pl-5 text-sm text-orange-800 space-y-1">
            {isCenter ? (
              <>
                <li>Manage venues and availability</li>
                <li>Access booking reports and analytics</li>
                <li>Manage cashiers and staff accounts</li>
              </>
            ) : (
              <>
                <li>Create and manage events</li>
                <li>Access sales reports and analytics</li>
                <li>Track attendance and ticket validation</li>
              </>
            )}
          </ul>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link to="/subscriptions">Subscribe Now</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const isActive = subscription.status === 'active' && new Date(subscription.endDate) > new Date();
  const expiryDate = new Date(subscription.endDate).toLocaleDateString();
  const isCenter = user.role === 'center';

  return (
    <Card className={`mb-6 ${isActive ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className={isActive ? 'text-green-700' : 'text-red-700'}>
            {isActive ? 'Active Subscription' : 'Expired Subscription'}
          </CardTitle>
          {isActive && (
            <CheckCircle className="h-5 w-5 text-green-600" />
          )}
        </div>
        <CardDescription>
          {isActive 
            ? `Your subscription is active until ${expiryDate}` 
            : 'Your subscription has expired'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">Plan:</span>
            <span>{subscription.planType.charAt(0).toUpperCase() + subscription.planType.slice(1)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="font-medium">Status:</span>
            <span className={isActive ? 'text-green-600' : 'text-red-600'}>
              {isActive ? 'Active' : 'Expired'}
            </span>
          </div>
          {isActive && (
            <div className="text-xs text-green-700 mt-2 pt-2 border-t border-green-200">
              {isCenter 
                ? "Your subscription grants you access to venue management, booking analytics, and all venue owner features."
                : "Your subscription grants you access to event creation, sales analytics, and all event manager features."}
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter>
        {!isActive ? (
          <Button asChild className="w-full">
            <Link to="/subscriptions">Renew Subscription</Link>
          </Button>
        ) : (
          <Button asChild variant="outline" className="w-full">
            <Link to="/subscriptions">Manage Subscription</Link>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}