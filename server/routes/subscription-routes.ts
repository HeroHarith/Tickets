import { Router, Request, Response, NextFunction } from 'express';
import * as subscriptionService from '../subscription-service';
import { requireRole } from '../auth';
import { Role, USER_ROLES } from '@shared/schema';
import { z } from 'zod';
import { successResponse, errorResponse } from '../utils/api-response';

const router = Router();

// Middleware to check if user is logged in
const requireLogin = (req: Request, res: Response, next: NextFunction) => {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      code: 401,
      success: false,
      data: null,
      description: 'Authentication required'
    });
  }
  next();
};

// Get all subscription plans
router.get('/plans', async (req, res) => {
  try {
    const type = req.query.type as string | undefined;
    const plans = await subscriptionService.getSubscriptionPlans(type);
    
    return res.json(successResponse(plans, 200, 'Subscription plans retrieved successfully'));
  } catch (error: any) {
    console.error('Error getting subscription plans:', error);
    return res.status(500).json(errorResponse(error.message || 'Error retrieving subscription plans', 500));
  }
});

// Get a specific subscription plan by ID
router.get('/plans/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({
        code: 400,
        success: false,
        data: null,
        description: 'Invalid plan ID'
      });
    }
    
    const plan = await subscriptionService.getSubscriptionPlan(id);
    if (!plan) {
      return res.status(404).json({
        code: 404,
        success: false,
        data: null,
        description: 'Subscription plan not found'
      });
    }
    
    return res.json(successResponse(plan, 200, 'Subscription plan retrieved successfully'));
  } catch (error: any) {
    console.error('Error getting subscription plan:', error);
    return res.status(500).json({
      code: 500,
      success: false,
      data: null,
      description: error.message || 'Error retrieving subscription plan'
    });
  }
});

// Get current user's subscription
router.get('/my-subscription', requireLogin, async (req, res) => {
  try {
    const userId = req.user!.id;
    const subscription = await subscriptionService.getUserSubscription(userId);
    
    if (!subscription) {
      return res.json(successResponse(null, 200, 'User has no active subscription'));
    }
    
    // Get plan details to include with subscription
    const plan = await subscriptionService.getSubscriptionPlan(subscription.planId);
    
    return res.json(successResponse({
      ...subscription,
      plan
    }, 200, 'Subscription retrieved successfully'));
  } catch (error: any) {
    console.error('Error getting user subscription:', error);
    return res.status(500).json(
      errorResponse(error.message || 'Error retrieving user subscription', 500)
    );
  }
});

// Initiate a subscription purchase
router.post('/purchase', requireLogin, async (req, res) => {
  try {
    const purchaseSchema = z.object({
      planId: z.number().positive(),
      customer: z.object({
        firstName: z.string().min(1),
        lastName: z.string().min(1),
        email: z.string().email(),
        phone: z.string().min(8)
      })
    });
    
    const result = purchaseSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json(
        errorResponse('Invalid request data: ' + JSON.stringify(result.error.errors), 400)
      );
    }
    
    const { planId, customer } = result.data;
    const userId = req.user!.id;
    
    // Check if user already has an active subscription
    const existingSubscription = await subscriptionService.getUserSubscription(userId);
    if (existingSubscription && existingSubscription.status === 'active') {
      return res.status(400).json(
        errorResponse('User already has an active subscription', 400)
      );
    }
    
    // Create a subscription payment session
    const result2 = await subscriptionService.createSubscriptionPaymentSession(
      userId,
      planId,
      customer
    );
    
    if (!result2 || !result2.paymentInfo) {
      return res.status(500).json(
        errorResponse('Failed to create payment session', 500)
      );
    }
    
    return res.json(successResponse({
      subscription: result2.subscription,
      paymentUrl: result2.paymentInfo.checkout_url,
      sessionId: result2.paymentInfo.session_id
    }, 200, 'Subscription payment session created successfully'));
  } catch (error: any) {
    console.error('Error purchasing subscription:', error);
    return res.status(500).json(
      errorResponse(error.message || 'Error purchasing subscription', 500)
    );
  }
});

// Process a successful payment
router.post('/payment-success', async (req, res) => {
  try {
    const sessionId = req.query.session_id?.toString();
    if (!sessionId) {
      return res.status(400).json(
        errorResponse('Missing session ID', 400)
      );
    }
    
    // Process the payment
    const updatedSubscription = await subscriptionService.processSuccessfulSubscriptionPayment(sessionId);
    
    if (!updatedSubscription) {
      return res.status(404).json(
        errorResponse('Subscription not found or payment already processed', 404)
      );
    }
    
    return res.json(
      successResponse(updatedSubscription, 200, 'Subscription payment processed successfully')
    );
  } catch (error: any) {
    console.error('Error processing subscription payment:', error);
    return res.status(500).json(
      errorResponse(error.message || 'Error processing subscription payment', 500)
    );
  }
});

// Cancel subscription
router.post('/cancel', requireLogin, async (req, res) => {
  try {
    const userId = req.user!.id;
    
    // Get user's active subscription
    const subscription = await subscriptionService.getUserSubscription(userId);
    
    if (!subscription) {
      return res.status(404).json(
        errorResponse('No active subscription found', 404)
      );
    }
    
    // Cancel the subscription
    const updatedSubscription = await subscriptionService.cancelSubscriptionAtPeriodEnd(subscription.id);
    
    return res.json(
      successResponse(
        updatedSubscription, 
        200, 
        'Subscription cancelled successfully. Access will remain until the end of the current billing period.'
      )
    );
  } catch (error: any) {
    console.error('Error cancelling subscription:', error);
    return res.status(500).json({
      code: 500,
      success: false,
      data: null,
      description: error.message || 'Error cancelling subscription'
    });
  }
});

// Check subscription status
router.get('/check-active/:type', requireLogin, async (req, res) => {
  try {
    const userId = req.user!.id;
    const type = req.params.type;
    
    if (!type || !['eventManager', 'center'].includes(type)) {
      return res.status(400).json({
        code: 400,
        success: false,
        data: null,
        description: 'Invalid subscription type'
      });
    }
    
    const hasActiveSubscription = await subscriptionService.hasUserActiveSubscriptionByType(userId, type);
    
    return res.json({
      code: 200,
      success: true,
      data: { hasActiveSubscription },
      description: 'Subscription status checked successfully'
    });
  } catch (error: any) {
    console.error('Error checking subscription status:', error);
    return res.status(500).json({
      code: 500,
      success: false,
      data: null,
      description: error.message || 'Error checking subscription status'
    });
  }
});

// Get subscription payment history
router.get('/payments/:subscriptionId', requireLogin, async (req, res) => {
  try {
    const subscriptionId = parseInt(req.params.subscriptionId);
    if (isNaN(subscriptionId)) {
      return res.status(400).json({
        code: 400,
        success: false,
        data: null,
        description: 'Invalid subscription ID'
      });
    }
    
    // Get the subscription to verify access
    const userId = req.user!.id;
    const subscription = await subscriptionService.getUserSubscription(userId);
    
    if (!subscription || subscription.id !== subscriptionId) {
      return res.status(403).json({
        code: 403,
        success: false,
        data: null,
        description: 'Access denied'
      });
    }
    
    const payments = await subscriptionService.getSubscriptionPayments(subscriptionId);
    
    return res.json({
      code: 200,
      success: true,
      data: payments,
      description: 'Subscription payments retrieved successfully'
    });
  } catch (error: any) {
    console.error('Error getting subscription payments:', error);
    return res.status(500).json({
      code: 500,
      success: false,
      data: null,
      description: error.message || 'Error retrieving subscription payments'
    });
  }
});

// Get all subscriptions (admin only)
router.get('/admin/all', requireRole(['admin']), async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json(errorResponse('Authentication required', 401));
    }
    
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json(errorResponse('Admin access required', 403));
    }
    
    console.log('Fetching all subscriptions for admin:', req.user?.username);
    const subscriptions = await subscriptionService.getAllSubscriptions();
    
    return res.json(successResponse(
      subscriptions, 
      200, 
      'All subscriptions retrieved successfully'
    ));
  } catch (error: any) {
    console.error('Error getting all subscriptions:', error);
    return res.status(500).json(errorResponse(
      error.message || 'Error retrieving subscriptions', 
      500
    ));
  }
});

// ADMIN ENDPOINTS FOR PLAN MANAGEMENT

// Create a new subscription plan (admin only)
router.post('/admin/plans', requireRole(['admin']), async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json(errorResponse('Authentication required', 401));
    }
    
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json(errorResponse('Admin access required', 403));
    }
    
    // Validate input with zod
    const planSchema = z.object({
      name: z.string().min(3, 'Name must be at least 3 characters'),
      description: z.string().min(10, 'Description must be at least 10 characters'),
      type: z.enum(['eventManager', 'center'], {
        errorMap: () => ({ message: 'Type must be eventManager or center' }),
      }),
      price: z.number().positive('Price must be positive'),
      billingPeriod: z.enum(['monthly', 'yearly'], {
        errorMap: () => ({ message: 'Billing period must be monthly or yearly' }),
      }),
      features: z.record(z.any()).or(z.array(z.any())),
      isActive: z.boolean().optional()
    });

    // Parse the request body
    try {
      const validatedData = planSchema.parse(req.body);
      const newPlan = await subscriptionService.createSubscriptionPlan(validatedData);
      
      return res.status(201).json(successResponse(
        newPlan, 
        201, 
        'Subscription plan created successfully'
      ));
    } catch (validationError: any) {
      if (validationError.errors) {
        return res.status(400).json(errorResponse(
          'Validation error', 
          400, 
          validationError.errors
        ));
      }
      throw validationError;
    }
  } catch (error: any) {
    console.error('Error creating subscription plan:', error);
    return res.status(500).json(errorResponse(
      error.message || 'Error creating subscription plan', 
      500
    ));
  }
});

// Update a subscription plan (admin only)
router.put('/admin/plans/:id', requireRole(['admin']), async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json(errorResponse('Authentication required', 401));
    }
    
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json(errorResponse('Admin access required', 403));
    }
    
    const planId = parseInt(req.params.id);
    if (isNaN(planId)) {
      return res.status(400).json(errorResponse('Invalid plan ID', 400));
    }
    
    // Validate input with zod
    const planSchema = z.object({
      name: z.string().min(3, 'Name must be at least 3 characters').optional(),
      description: z.string().min(10, 'Description must be at least 10 characters').optional(),
      type: z.enum(['eventManager', 'center'], {
        errorMap: () => ({ message: 'Type must be eventManager or center' }),
      }).optional(),
      price: z.number().positive('Price must be positive').optional(),
      billingPeriod: z.enum(['monthly', 'yearly'], {
        errorMap: () => ({ message: 'Billing period must be monthly or yearly' }),
      }).optional(),
      features: z.record(z.any()).or(z.array(z.any())).optional(),
      isActive: z.boolean().optional()
    });

    // Parse the request body
    try {
      const validatedData = planSchema.parse(req.body);
      const updatedPlan = await subscriptionService.updateSubscriptionPlan(planId, validatedData);
      
      if (!updatedPlan) {
        return res.status(404).json(errorResponse('Subscription plan not found', 404));
      }
      
      return res.json(successResponse(
        updatedPlan, 
        200, 
        'Subscription plan updated successfully'
      ));
    } catch (validationError: any) {
      if (validationError.errors) {
        return res.status(400).json(errorResponse(
          'Validation error', 
          400, 
          validationError.errors
        ));
      }
      throw validationError;
    }
  } catch (error: any) {
    console.error('Error updating subscription plan:', error);
    return res.status(500).json(errorResponse(
      error.message || 'Error updating subscription plan', 
      500
    ));
  }
});

// Toggle a subscription plan's active status (admin only)
router.patch('/admin/plans/:id/toggle', requireRole(['admin']), async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json(errorResponse('Authentication required', 401));
    }
    
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json(errorResponse('Admin access required', 403));
    }
    
    const planId = parseInt(req.params.id);
    if (isNaN(planId)) {
      return res.status(400).json(errorResponse('Invalid plan ID', 400));
    }
    
    const updatedPlan = await subscriptionService.toggleSubscriptionPlanStatus(planId);
    
    if (!updatedPlan) {
      return res.status(404).json(errorResponse('Subscription plan not found', 404));
    }
    
    return res.json(successResponse(
      updatedPlan, 
      200, 
      `Subscription plan ${updatedPlan.isActive ? 'activated' : 'deactivated'} successfully`
    ));
  } catch (error: any) {
    console.error('Error toggling subscription plan status:', error);
    return res.status(500).json(errorResponse(
      error.message || 'Error toggling subscription plan status', 
      500
    ));
  }
});

// Delete a subscription plan (admin only)
router.delete('/admin/plans/:id', requireRole(['admin']), async (req, res) => {
  try {
    // Check if user is authenticated
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json(errorResponse('Authentication required', 401));
    }
    
    // Check if user is admin
    if (req.user?.role !== 'admin') {
      return res.status(403).json(errorResponse('Admin access required', 403));
    }
    
    const planId = parseInt(req.params.id);
    if (isNaN(planId)) {
      return res.status(400).json(errorResponse('Invalid plan ID', 400));
    }
    
    try {
      const success = await subscriptionService.deleteSubscriptionPlan(planId);
      
      if (!success) {
        return res.status(404).json(errorResponse('Subscription plan not found', 404));
      }
      
      return res.json(successResponse(
        null, 
        200, 
        'Subscription plan deleted successfully'
      ));
    } catch (deleteError: any) {
      // Check if error is about active subscriptions
      if (deleteError.message.includes('active subscriptions')) {
        return res.status(400).json(errorResponse(
          deleteError.message, 
          400
        ));
      }
      throw deleteError;
    }
  } catch (error: any) {
    console.error('Error deleting subscription plan:', error);
    return res.status(500).json(errorResponse(
      error.message || 'Error deleting subscription plan', 
      500
    ));
  }
});

export default router;