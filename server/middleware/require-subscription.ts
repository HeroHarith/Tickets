import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { subscriptions, users } from '@shared/schema';
import { eq, and, gt } from 'drizzle-orm';
import { errorResponse } from '../utils/api-response';

/**
 * Middleware to check if a user has an active subscription
 * Can be configured to only check for specific roles or plan types
 */
export function requireSubscription(options: {
  roles?: string[];
  planTypes?: string[];
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
      
      // All checks passed, proceed
      next();
    } catch (error) {
      console.error('Error checking subscription:', error);
      return res.status(500).json(errorResponse('Error checking subscription status', 500));
    }
  };
}