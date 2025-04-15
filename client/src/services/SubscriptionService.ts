import { apiRequest } from "@/lib/queryClient";
import { SubscriptionPlan, Subscription, SubscriptionPayment } from "@shared/schema";

/**
 * Get all available subscription plans
 * @param type Optional type filter (eventManager or center)
 */
export async function getSubscriptionPlans(type?: string): Promise<SubscriptionPlan[]> {
  const url = type ? `/api/subscriptions/plans?type=${type}` : '/api/subscriptions/plans';
  const response = await apiRequest('GET', url);
  const data = await response.json();
  return data.data;
}

/**
 * Get a specific subscription plan by ID
 * @param id Plan ID
 */
export async function getSubscriptionPlan(id: number): Promise<SubscriptionPlan> {
  const response = await apiRequest('GET', `/api/subscriptions/plans/${id}`);
  const data = await response.json();
  return data.data;
}

/**
 * Get current user's subscription
 */
export async function getCurrentSubscription(): Promise<Subscription | null> {
  const response = await apiRequest('GET', '/api/subscriptions/my-subscription');
  const data = await response.json();
  return data.data;
}

/**
 * Check if user has an active subscription of a specific type
 * @param type Subscription type (eventManager or center)
 */
export async function hasActiveSubscription(type: string): Promise<boolean> {
  const response = await apiRequest('GET', `/api/subscriptions/check-active/${type}`);
  const data = await response.json();
  return data.data?.hasActiveSubscription || false;
}

/**
 * Purchase a subscription
 * @param planId Plan ID to purchase
 * @param customerDetails Customer details for payment
 */
export async function purchaseSubscription(
  planId: number, 
  customerDetails: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  }
): Promise<{
  subscription: Subscription;
  paymentUrl: string;
  sessionId: string;
}> {
  const response = await apiRequest('POST', '/api/subscriptions/purchase', {
    planId,
    customer: customerDetails
  });
  const data = await response.json();
  return data.data;
}

/**
 * Cancel current subscription (will continue until end of billing period)
 */
export async function cancelSubscription(): Promise<Subscription> {
  const response = await apiRequest('POST', '/api/subscriptions/cancel');
  const data = await response.json();
  return data.data;
}

/**
 * Get payment history for a subscription
 * @param subscriptionId Subscription ID
 */
export async function getSubscriptionPayments(subscriptionId: number): Promise<SubscriptionPayment[]> {
  const response = await apiRequest('GET', `/api/subscriptions/payments/${subscriptionId}`);
  const data = await response.json();
  return data.data;
}

/**
 * ADMIN FUNCTIONS
 */

/**
 * Create a new subscription plan (admin only)
 */
export async function createSubscriptionPlan(planData: {
  name: string;
  description: string;
  type: string;
  price: number;
  billingPeriod: string;
  features: string[] | Record<string, any>;
  isActive?: boolean;
}): Promise<SubscriptionPlan> {
  const response = await apiRequest('POST', '/api/subscriptions/admin/plans', planData);
  const data = await response.json();
  return data.data;
}

/**
 * Update an existing subscription plan (admin only)
 */
export async function updateSubscriptionPlan(
  planId: number,
  planData: Partial<{
    name: string;
    description: string;
    type: string;
    price: number;
    billingPeriod: string;
    features: string[] | Record<string, any>;
    isActive: boolean;
  }>
): Promise<SubscriptionPlan> {
  const response = await apiRequest('PUT', `/api/subscriptions/admin/plans/${planId}`, planData);
  const data = await response.json();
  return data.data;
}

/**
 * Toggle a subscription plan's active status (admin only)
 */
export async function toggleSubscriptionPlanStatus(planId: number): Promise<SubscriptionPlan> {
  const response = await apiRequest('PATCH', `/api/subscriptions/admin/plans/${planId}/toggle`);
  const data = await response.json();
  return data.data;
}

/**
 * Delete a subscription plan (admin only)
 * Will fail if there are active subscriptions using this plan
 */
export async function deleteSubscriptionPlan(planId: number): Promise<void> {
  const response = await apiRequest('DELETE', `/api/subscriptions/admin/plans/${planId}`);
  const data = await response.json();
  return data.data;
}

/**
 * Get all subscriptions with user details (admin only)
 */
export async function getAllSubscriptions(): Promise<any[]> {
  const response = await apiRequest('GET', '/api/subscriptions/admin/all');
  const data = await response.json();
  return data.data;
}