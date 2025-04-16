/**
 * Subscription Service
 * Handles subscription-related functionality with Thawani integration
 */
import { db } from './db';
import { 
  subscriptionPlans, 
  subscriptions, 
  subscriptionPayments, 
  users,
  type SubscriptionPlan,
  type Subscription,
  type SubscriptionPayment,
  type InsertSubscription,
  type InsertSubscriptionPayment
} from '@shared/schema';
import { eq, and, desc, or } from 'drizzle-orm';
import { optimizedStorage } from './optimized-storage';
import * as thawani from './thawani';

/**
 * Get all active subscription plans
 */
export async function getSubscriptionPlans(type?: string): Promise<SubscriptionPlan[]> {
  let query = db.select().from(subscriptionPlans);
  
  let conditions = [];
  conditions.push(eq(subscriptionPlans.isActive, true));
  
  if (type) {
    conditions.push(eq(subscriptionPlans.type, type));
  }
  
  return await db.select()
    .from(subscriptionPlans)
    .where(and(...conditions));
}

/**
 * Get all subscriptions with user and plan information
 * For admin dashboard usage
 */
export async function getAllSubscriptions(): Promise<any[]> {
  const subscriptionData = await db.select({
    subscription: subscriptions,
    user: {
      id: users.id,
      username: users.username,
      name: users.name,
      email: users.email,
      role: users.role
    },
    plan: subscriptionPlans
  })
  .from(subscriptions)
  .leftJoin(users, eq(subscriptions.userId, users.id))
  .leftJoin(subscriptionPlans, eq(subscriptions.planId, subscriptionPlans.id))
  .orderBy(desc(subscriptions.createdAt));
  
  return subscriptionData;
}

/**
 * Get a subscription plan by ID
 */
export async function getSubscriptionPlan(id: number): Promise<SubscriptionPlan | undefined> {
  const [plan] = await db.select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, id));
  
  return plan;
}

/**
 * Create a new subscription plan
 */
export async function createSubscriptionPlan(data: {
  name: string;
  description: string;
  type: string;
  price: number;
  billingPeriod: string;
  maxEventsAllowed?: number;
  serviceFeePercentage?: number;
  features: object;
  isActive?: boolean;
}): Promise<SubscriptionPlan> {
  // Validate input
  if (!data.name || !data.description || !data.type || data.price === undefined || !data.billingPeriod) {
    throw new Error('Missing required fields for subscription plan');
  }
  
  // Convert string price to numeric if needed
  const price = typeof data.price === 'string' ? parseFloat(data.price) : data.price;
  
  // Convert string serviceFeePercentage to numeric if needed
  const serviceFeePercentage = data.serviceFeePercentage !== undefined 
    ? (typeof data.serviceFeePercentage === 'string' ? parseFloat(data.serviceFeePercentage) : data.serviceFeePercentage)
    : 0;
  
  // Create the plan
  const [plan] = await db.insert(subscriptionPlans)
    .values({
      name: data.name,
      description: data.description,
      type: data.type,
      price: price.toString(), // Convert to string for numeric field
      billingPeriod: data.billingPeriod,
      maxEventsAllowed: data.maxEventsAllowed || 0, // 0 means unlimited
      serviceFeePercentage: serviceFeePercentage.toString(), // Convert to string for numeric field
      features: data.features,
      isActive: data.isActive ?? true,
    })
    .returning();
  
  return plan;
}

/**
 * Update an existing subscription plan
 */
export async function updateSubscriptionPlan(
  id: number,
  data: Partial<{
    name: string;
    description: string;
    type: string;
    price: number;
    billingPeriod: string;
    maxEventsAllowed: number;
    serviceFeePercentage: number;
    features: object;
    isActive: boolean;
  }>
): Promise<SubscriptionPlan | undefined> {
  // Get the existing plan
  const existingPlan = await getSubscriptionPlan(id);
  if (!existingPlan) {
    return undefined;
  }
  
  // Convert string price to numeric if needed
  let priceStr = undefined;
  if (data.price !== undefined) {
    const price = typeof data.price === 'string' ? parseFloat(data.price) : data.price;
    priceStr = price.toString();
  }
  
  // Convert string serviceFeePercentage to numeric if needed
  let serviceFeePercentageStr = undefined;
  if (data.serviceFeePercentage !== undefined) {
    const serviceFeePercentage = typeof data.serviceFeePercentage === 'string' 
      ? parseFloat(data.serviceFeePercentage) 
      : data.serviceFeePercentage;
    serviceFeePercentageStr = serviceFeePercentage.toString();
  }
  
  // Update the plan
  const [updatedPlan] = await db.update(subscriptionPlans)
    .set({
      name: data.name,
      description: data.description,
      type: data.type,
      price: priceStr,
      billingPeriod: data.billingPeriod,
      maxEventsAllowed: data.maxEventsAllowed,
      serviceFeePercentage: serviceFeePercentageStr,
      features: data.features,
      isActive: data.isActive,
    })
    .where(eq(subscriptionPlans.id, id))
    .returning();
  
  return updatedPlan;
}

/**
 * Toggle a subscription plan's active status
 */
export async function toggleSubscriptionPlanStatus(id: number): Promise<SubscriptionPlan | undefined> {
  // Get the existing plan
  const existingPlan = await getSubscriptionPlan(id);
  if (!existingPlan) {
    return undefined;
  }
  
  // Toggle the status
  const [updatedPlan] = await db.update(subscriptionPlans)
    .set({
      isActive: !existingPlan.isActive,
    })
    .where(eq(subscriptionPlans.id, id))
    .returning();
  
  return updatedPlan;
}

/**
 * Delete a subscription plan (soft delete by setting isActive to false)
 */
export async function deleteSubscriptionPlan(id: number): Promise<boolean> {
  // Check if the plan exists
  const existingPlan = await getSubscriptionPlan(id);
  if (!existingPlan) {
    return false;
  }
  
  // Check if there are any active subscriptions using this plan
  const [activeSubscription] = await db.select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.planId, id),
        eq(subscriptions.status, 'active')
      )
    );
  
  if (activeSubscription) {
    throw new Error('Cannot delete a plan with active subscriptions');
  }
  
  // Soft delete by setting isActive to false
  await db.update(subscriptionPlans)
    .set({
      isActive: false,
    })
    .where(eq(subscriptionPlans.id, id));
  
  return true;
}

/**
 * Get a user's active subscription
 */
export async function getUserSubscription(userId: number): Promise<Subscription | undefined> {
  const [subscription] = await db.select()
    .from(subscriptions)
    .where(and(
      eq(subscriptions.userId, userId),
      eq(subscriptions.status, 'active')
    ))
    .orderBy(desc(subscriptions.createdAt))
    .limit(1);
  
  return subscription;
}

/**
 * Create a new subscription
 */
export async function createSubscription(subscriptionData: InsertSubscription): Promise<Subscription> {
  const [subscription] = await db.insert(subscriptions)
    .values(subscriptionData)
    .returning();
  
  // Update the user's subscription information
  await db.update(users)
    .set({
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionExpiresAt: subscription.endDate
    })
    .where(eq(users.id, subscription.userId));
  
  return subscription;
}

/**
 * Update a subscription's status
 */
export async function updateSubscriptionStatus(
  id: number, 
  status: string, 
  renewalSessionId?: string
): Promise<Subscription> {
  const updateData: Partial<Subscription> = { status };
  
  if (renewalSessionId) {
    updateData.renewalSessionId = renewalSessionId;
  }
  
  const [updatedSubscription] = await db.update(subscriptions)
    .set(updateData)
    .where(eq(subscriptions.id, id))
    .returning();
  
  if (!updatedSubscription) {
    throw new Error(`Subscription with ID ${id} not found`);
  }
  
  // Update the user's subscription status
  await db.update(users)
    .set({
      subscriptionStatus: status
    })
    .where(eq(users.id, updatedSubscription.userId));
  
  return updatedSubscription;
}

/**
 * Record a subscription payment
 */
export async function recordSubscriptionPayment(payment: InsertSubscriptionPayment): Promise<SubscriptionPayment> {
  const [newPayment] = await db.insert(subscriptionPayments)
    .values(payment)
    .returning();
  
  return newPayment;
}

/**
 * Get subscription payments for a subscription
 */
export async function getSubscriptionPayments(subscriptionId: number): Promise<SubscriptionPayment[]> {
  const payments = await db.select()
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.subscriptionId, subscriptionId))
    .orderBy(desc(subscriptionPayments.paymentDate));
  
  return payments;
}

/**
 * Check if a user has an active subscription of a specific type
 */
export async function hasUserActiveSubscriptionByType(userId: number, type: string): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return false;
  }
  
  const plan = await getSubscriptionPlan(subscription.planId);
  
  return Boolean(
    subscription.status === 'active' && 
    new Date() < subscription.endDate &&
    plan?.type === type
  );
}

/**
 * Check if user can create more events under their current subscription
 */
export async function canCreateMoreEvents(userId: number): Promise<{ 
  canCreate: boolean; 
  reason?: string; 
  currentCount?: number; 
  maxAllowed?: number; 
}> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return { 
      canCreate: false, 
      reason: 'No active subscription found' 
    };
  }
  
  if (subscription.status !== 'active') {
    return { 
      canCreate: false, 
      reason: 'Subscription is not active' 
    };
  }
  
  const plan = await getSubscriptionPlan(subscription.planId);
  
  if (!plan) {
    return { 
      canCreate: false, 
      reason: 'Subscription plan not found' 
    };
  }
  
  // If max events is 0, it means unlimited
  if (plan.maxEventsAllowed === 0) {
    return { 
      canCreate: true, 
      currentCount: subscription.eventsCreated,
      maxAllowed: 0 // Unlimited
    };
  }
  
  // Check if the user has reached their event limit
  if (subscription.eventsCreated >= plan.maxEventsAllowed) {
    return { 
      canCreate: false, 
      reason: 'Maximum number of events reached for current subscription',
      currentCount: subscription.eventsCreated,
      maxAllowed: plan.maxEventsAllowed
    };
  }
  
  return { 
    canCreate: true,
    currentCount: subscription.eventsCreated,
    maxAllowed: plan.maxEventsAllowed
  };
}

/**
 * Increment the event count for a user's subscription
 */
export async function incrementEventCount(userId: number): Promise<{
  success: boolean;
  subscription?: Subscription;
  error?: string;
}> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return { 
      success: false, 
      error: 'No active subscription found' 
    };
  }
  
  // Increment the event count
  const [updatedSubscription] = await db.update(subscriptions)
    .set({ 
      eventsCreated: subscription.eventsCreated + 1
    })
    .where(eq(subscriptions.id, subscription.id))
    .returning();
  
  if (!updatedSubscription) {
    return { 
      success: false, 
      error: 'Failed to update subscription' 
    };
  }
  
  return { 
    success: true, 
    subscription: updatedSubscription 
  };
}

/**
 * Check if a subscription payment session is valid
 */
export async function isSubscriptionPaymentSessionValid(paymentSessionId: string): Promise<boolean> {
  // Check if the payment session exists in subscription payments
  const [payment] = await db.select()
    .from(subscriptionPayments)
    .where(eq(subscriptionPayments.paymentSessionId, paymentSessionId));
  
  return Boolean(payment && payment.status === 'paid');
}

/**
 * Cancel a subscription at the end of the current period
 */
export async function cancelSubscriptionAtPeriodEnd(subscriptionId: number): Promise<Subscription> {
  // Get the subscription
  const [subscription] = await db.select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId));
  
  if (!subscription) {
    throw new Error(`Subscription with ID ${subscriptionId} not found`);
  }
  
  // Update subscription status to "cancelled"
  const [updatedSubscription] = await db.update(subscriptions)
    .set({ status: 'cancelled' })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();
  
  // Update the user's subscription status
  await db.update(users)
    .set({ subscriptionStatus: 'cancelled' })
    .where(eq(users.id, subscription.userId));
  
  return updatedSubscription;
}

/**
 * Renew a subscription with a new end date
 */
export async function renewSubscription(
  subscriptionId: number, 
  endDate: Date
): Promise<Subscription> {
  // Get the subscription
  const [subscription] = await db.select()
    .from(subscriptions)
    .where(eq(subscriptions.id, subscriptionId));
  
  if (!subscription) {
    throw new Error(`Subscription with ID ${subscriptionId} not found`);
  }
  
  // Update subscription with new end date and status
  const [updatedSubscription] = await db.update(subscriptions)
    .set({ 
      endDate, 
      status: 'active',
      renewalSessionId: null
    })
    .where(eq(subscriptions.id, subscriptionId))
    .returning();
  
  // Update the user's subscription information
  await db.update(users)
    .set({
      subscriptionStatus: 'active',
      subscriptionExpiresAt: endDate
    })
    .where(eq(users.id, subscription.userId));
  
  return updatedSubscription;
}

/**
 * Create a Thawani payment session for a new subscription
 */
export async function createSubscriptionPaymentSession(
  userId: number,
  planId: number,
  customerDetails: thawani.CustomerDetails
): Promise<{ subscription: Subscription; paymentInfo: { session_id: string; checkout_url: string; } | null }> {
  // Get the plan
  const plan = await getSubscriptionPlan(planId);
  
  if (!plan) {
    throw new Error(`Subscription plan with ID ${planId} not found`);
  }
  
  // Calculate subscription end date based on billing period
  const startDate = new Date();
  const endDate = new Date(startDate);
  if (plan.billingPeriod === 'monthly') {
    endDate.setMonth(endDate.getMonth() + 1);
  } else if (plan.billingPeriod === 'yearly') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  }
  
  // Create a new subscription record
  const [subscription] = await db.insert(subscriptions)
    .values({
      userId,
      planId,
      startDate,
      endDate,
      status: 'pending', // Start with pending until payment is confirmed
      metadata: {
        planName: plan.name,
        planType: plan.type,
        billingPeriod: plan.billingPeriod
      }
    })
    .returning();
  
  // Create a payment session with Thawani
  const paymentInfo = await thawani.createSubscriptionPaymentSession(
    planId,
    plan.name,
    parseFloat(plan.price.toString()),
    plan.billingPeriod,
    customerDetails
  );
  
  if (paymentInfo) {
    // Update the subscription with the payment session ID
    await db.update(subscriptions)
      .set({ paymentSessionId: paymentInfo.session_id })
      .where(eq(subscriptions.id, subscription.id));
    
    subscription.paymentSessionId = paymentInfo.session_id;
  }
  
  return { subscription, paymentInfo };
}

/**
 * Update subscription sales statistics when tickets are sold
 * This tracks the total tickets sold, sales amount, and calculates service fees
 */
export async function updateSubscriptionSalesStats(
  userId: number,
  ticketsCount: number,
  salesAmount: number
): Promise<{ success: boolean; error?: string; serviceFee?: number }> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return { 
      success: false, 
      error: 'No active subscription found' 
    };
  }
  
  // Get the subscription plan to determine service fee percentage
  const plan = await getSubscriptionPlan(subscription.planId);
  
  if (!plan) {
    return { 
      success: false, 
      error: 'Subscription plan not found' 
    };
  }
  
  // Calculate service fee
  const serviceFeePercentage = plan.serviceFeePercentage ? parseFloat(plan.serviceFeePercentage.toString()) : 0;
  const serviceFee = (salesAmount * serviceFeePercentage) / 100;
  
  // Update the subscription stats
  const [updatedSubscription] = await db.update(subscriptions)
    .set({ 
      totalTicketsSold: subscription.totalTicketsSold + ticketsCount,
      totalSalesAmount: (parseFloat(subscription.totalSalesAmount.toString()) + salesAmount).toString(),
      totalServiceFees: (parseFloat(subscription.totalServiceFees.toString()) + serviceFee).toString()
    })
    .where(eq(subscriptions.id, subscription.id))
    .returning();
  
  if (!updatedSubscription) {
    return { 
      success: false, 
      error: 'Failed to update subscription sales statistics' 
    };
  }
  
  return { 
    success: true,
    serviceFee
  };
}

/**
 * Get subscription usage statistics for a user
 */
export async function getSubscriptionUsageStats(userId: number): Promise<{
  subscription?: Subscription;
  plan?: SubscriptionPlan;
  stats?: {
    eventsCreated: number;
    maxEventsAllowed: number | 'unlimited';
    eventUsagePercentage: number;
    ticketsSold: number;
    totalSalesAmount: number;
    totalServiceFees: number;
    serviceFeePercentage: number;
    daysRemaining: number;
    isActive: boolean;
  };
  error?: string;
}> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return { 
      error: 'No active subscription found' 
    };
  }
  
  const plan = await getSubscriptionPlan(subscription.planId);
  
  if (!plan) {
    return { 
      subscription,
      error: 'Subscription plan not found' 
    };
  }
  
  // Calculate days remaining in subscription
  const now = new Date();
  const endDate = new Date(subscription.endDate);
  const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
  
  // Calculate event usage percentage
  let eventUsagePercentage = 0;
  const maxEvents = plan.maxEventsAllowed || 0;
  if (maxEvents > 0) {
    eventUsagePercentage = (subscription.eventsCreated / maxEvents) * 100;
  }
  
  // Prepare the statistics
  const stats = {
    eventsCreated: subscription.eventsCreated,
    maxEventsAllowed: maxEvents === 0 ? 'unlimited' as const : maxEvents,
    eventUsagePercentage,
    ticketsSold: subscription.totalTicketsSold,
    totalSalesAmount: parseFloat(subscription.totalSalesAmount.toString()),
    totalServiceFees: parseFloat(subscription.totalServiceFees.toString()),
    serviceFeePercentage: plan.serviceFeePercentage ? parseFloat(plan.serviceFeePercentage.toString()) : 0,
    daysRemaining,
    isActive: subscription.status === 'active' && daysRemaining > 0
  };
  
  return {
    subscription,
    plan,
    stats
  };
}

/**
 * Process a successful subscription payment
 */
export async function processSuccessfulSubscriptionPayment(
  paymentSessionId: string
): Promise<Subscription | null> {
  // Get the subscription by payment session ID
  const [subscription] = await db.select()
    .from(subscriptions)
    .where(eq(subscriptions.paymentSessionId, paymentSessionId));
  
  if (!subscription) {
    return null;
  }
  
  // Record the payment
  const [plan] = await db.select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, subscription.planId));
  
  if (!plan) {
    return null;
  }
  
  // Record the payment
  await recordSubscriptionPayment({
    subscriptionId: subscription.id,
    amount: plan.price.toString(),
    paymentSessionId,
    status: 'paid',
    metaData: {
      planName: plan.name,
      planType: plan.type,
      billingPeriod: plan.billingPeriod
    }
  });
  
  // Update the subscription status to active
  const updatedSubscription = await updateSubscriptionStatus(subscription.id, 'active');
  
  // Update the user's subscription info
  await db.update(users)
    .set({
      subscriptionId: subscription.id,
      subscriptionStatus: 'active',
      subscriptionExpiresAt: subscription.endDate
    })
    .where(eq(users.id, subscription.userId));
  
  return updatedSubscription;
}