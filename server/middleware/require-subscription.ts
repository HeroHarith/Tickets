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
 * Currently set to allow all features for all users regardless of subscription status
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

      // All features are open for all plans as requested
      // Simply pass through to the next middleware without any checks
      
      // Store a default eventLimitCheck for compatibility with routes that expect it
      req.eventLimitCheck = {
        canCreate: true,
        currentCount: 0,
        maxAllowed: 'unlimited',
        subscription: null
      };
      
      // Continue to the route handler
      next();
    } catch (error) {
      console.error('Error in subscription middleware:', error);
      return res.status(500).json(errorResponse('Error processing request', 500));
    }
  };
}