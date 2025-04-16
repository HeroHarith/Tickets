import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { subscriptions, users, subscriptionPlans } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import { errorResponse } from '../utils/api-response';
import * as subscriptionService from '../subscription-service';

// Extend Express Request type to include eventLimitCheck property
declare global {
  namespace Express {
    interface Request {
      eventLimitCheck?: {
        canCreate: boolean;
        currentCount: number;
        maxAllowed: number | 'unlimited';
        reason?: string;
        subscription?: any;
      };
    }
  }
}

/**
 * Middleware to check if a user has an active subscription
 * Can be configured to check for specific roles or plan types
 * Can also check for event limits for event creation routes
 */
export function requireSubscription(options: {
  roles?: string[];
  planTypes?: string[];
  checkEventLimit?: boolean;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip if not authenticated
      if (!req.isAuthenticated || !req.isAuthenticated()) {
        return res.status(401).json(errorResponse('Authentication required', 401));
      }

      const user = req.user;
      
      // Skip check if user role doesn't match specified roles (if provided)
      if (options.roles && !options.roles.includes(user.role)) {
        return next();
      }
      
      // Get user's active subscription
      const userSubscription = await db.select()
        .from(subscriptions)
        .where(
          and(
            eq(subscriptions.userId, user.id),
            eq(subscriptions.status, 'active'),
            gt(subscriptions.endDate, new Date())
          )
        )
        .limit(1);
      
      // If no active subscription found
      if (!userSubscription || userSubscription.length === 0) {
        return res.status(402).json(errorResponse(
          'A subscription is required for this feature. Please subscribe to a plan.',
          402
        ));
      }
      
      // If plan type is specified, check if user's plan matches
      if (options.planTypes && options.planTypes.length > 0) {
        // Get the plan details
        const subscription = userSubscription[0];
        
        // Check if metadata has planType
        // Handle the case where metadata is stored as JSON string or as an object
        let planType: string | undefined;
        
        if (subscription.metadata) {
          if (typeof subscription.metadata === 'string') {
            try {
              const parsedMetadata = JSON.parse(subscription.metadata);
              planType = parsedMetadata.planType;
            } catch (e) {
              console.error('Error parsing subscription metadata:', e);
            }
          } else if (typeof subscription.metadata === 'object') {
            planType = (subscription.metadata as any).planType;
          }
        }
        
        if (!planType || !options.planTypes.includes(planType)) {
          return res.status(403).json(errorResponse(
            `You need a specific subscription plan for this feature. Required: ${options.planTypes.join(', ')}`,
            403
          ));
        }
      }
      
      // If event limit check is enabled (for event creation routes)
      if (options.checkEventLimit && req.method === 'POST') {
        // Check if user can create more events
        const eventLimitCheck = await subscriptionService.canCreateMoreEvents(user.id);
        
        if (!eventLimitCheck.canCreate) {
          return res.status(403).json(errorResponse(
            eventLimitCheck.reason || 'You have reached your event creation limit',
            403,
            {
              currentCount: eventLimitCheck.currentCount,
              maxAllowed: eventLimitCheck.maxAllowed,
              upgradeSuggested: true
            }
          ));
        }
        
        // Store the event limit check result in the request for later use
        // This allows the route handler to increment the count after successful creation
        req.eventLimitCheck = eventLimitCheck;
      }
      
      // All checks passed, proceed
      next();
    } catch (error) {
      console.error('Error checking subscription:', error);
      return res.status(500).json(errorResponse('Error checking subscription status', 500));
    }
  };
}