import { Request, Response, NextFunction } from 'express';
import { User, Role } from '@shared/schema';

/**
 * Middleware to check if user is logged in
 */
export const requireLogin = (req: Request, res: Response, next: NextFunction) => {
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

/**
 * Middleware to check if user has the required role
 */
export const requireRole = (roles: Role | Role[] | string | string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({
        code: 401,
        success: false,
        data: null,
        description: 'Authentication required'
      });
    }

    const user = req.user as User;
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!user || !allowedRoles.includes(user.role)) {
      return res.status(403).json({
        code: 403,
        success: false,
        data: null,
        description: 'Permission denied'
      });
    }

    next();
  };
};

/**
 * Middleware to check if user has an active subscription
 */
export const requireSubscription = (type: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({
        code: 401,
        success: false,
        data: null,
        description: 'Authentication required'
      });
    }

    try {
      const user = req.user as User;
      
      // Check for admin role - they can always access
      if (user.role === 'admin') {
        return next();
      }

      // Check if user has an active subscription or is already the right role
      if ((type === 'eventManager' && user.role === 'eventManager') || 
          (type === 'center' && user.role === 'center')) {
        return next();
      }

      // Import dynamically to avoid circular dependencies
      const subscriptionService = await import('../subscription-service');
      const hasActiveSubscription = await subscriptionService.hasUserActiveSubscriptionByType(user.id, type);

      if (!hasActiveSubscription) {
        return res.status(403).json({
          code: 403,
          success: false,
          data: null,
          description: `Active ${type} subscription required`
        });
      }

      next();
    } catch (error) {
      console.error('Error checking subscription:', error);
      return res.status(500).json({
        code: 500,
        success: false,
        data: null,
        description: 'Error checking subscription status'
      });
    }
  };
};