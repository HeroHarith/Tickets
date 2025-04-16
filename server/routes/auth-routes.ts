import { Router, Request, Response, NextFunction } from 'express';
import { optimizedStorage as storage } from '../optimized-storage';
import { successResponse, errorResponse } from '../utils/api-response';
import passport from 'passport';
import { hashPassword } from '../auth';
import { insertUserSchema } from '@shared/schema';
import { z } from 'zod';
import { sendVerificationEmail, sendPasswordResetEmail } from '../email';

const router = Router();

/**
 * @route POST /api/register
 * @desc Register a new user
 * @access public
 */
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check if username already exists
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).json(errorResponse('Username already exists', 400));
    }

    // Check if email already exists
    if (req.body.email) {
      const userWithEmail = await storage.getUserByEmail(req.body.email);
      if (userWithEmail) {
        return res.status(400).json(errorResponse('Email already in use', 400));
      }
    }

    // Validate user data
    const userData = insertUserSchema.parse({
      ...req.body,
      role: 'customer', // Default role is customer
      password: await hashPassword(req.body.password)
    });

    // Create user
    const user = await storage.createUser(userData);

    // Create and send verification token if email provided
    if (user.email) {
      const token = await storage.createVerificationToken(user.id);
      await sendVerificationEmail({
        username: user.username,
        email: user.email,
        name: user.name || user.username,
        verificationToken: token
      });
    }

    // Log the user in
    req.login(user, (err) => {
      if (err) return next(err);
      return res.status(201).json(successResponse(user, 201, 'User registered successfully'));
    });
  } catch (error: any) {
    console.error('Error registering user:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse('Validation failed: ' + error.errors[0].message, 400));
    }
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route POST /api/login
 * @desc Login a user
 * @access public
 */
router.post('/login', (req: Request, res: Response, next: NextFunction) => {
  passport.authenticate('local', (err: Error, user: Express.User, info: any) => {
    if (err) {
      return next(err);
    }
    
    if (!user) {
      return res.status(401).json(errorResponse('Invalid username or password', 401));
    }
    
    req.login(user, (err) => {
      if (err) return next(err);
      return res.json(successResponse(user, 200, 'Login successful'));
    });
  })(req, res, next);
});

/**
 * @route POST /api/logout
 * @desc Logout a user
 * @access private
 */
router.post('/logout', (req: Request, res: Response) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json(errorResponse('Error during logout', 500));
    }
    return res.json(successResponse(null, 200, 'Logout successful'));
  });
});

/**
 * @route GET /api/user
 * @desc Get current user
 * @access private
 */
router.get('/user', (req: Request, res: Response) => {
  if (!req.isAuthenticated()) {
    return res.status(401).json(errorResponse('Not authenticated', 401));
  }
  return res.json(successResponse(req.user, 200, 'User data retrieved successfully'));
});

/**
 * @route POST /api/verify-email/:token
 * @desc Verify email with token
 * @access public
 */
router.post('/verify-email/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    if (!token) {
      return res.status(400).json(errorResponse('Verification token is required', 400));
    }
    
    const success = await storage.verifyEmail(token);
    if (!success) {
      return res.status(400).json(errorResponse('Invalid or expired verification token', 400));
    }
    
    return res.json(successResponse(null, 200, 'Email verified successfully'));
  } catch (error: any) {
    console.error('Error verifying email:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route POST /api/reset-password/request
 * @desc Request password reset
 * @access public
 */
router.post('/reset-password/request', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json(errorResponse('Email is required', 400));
    }
    
    const token = await storage.createPasswordResetToken(email);
    if (!token) {
      // Don't reveal if the email exists or not for security
      return res.json(successResponse(null, 200, 'If the email exists, a reset link has been sent'));
    }
    
    const user = await storage.getUserByEmail(email);
    await sendPasswordResetEmail({
      username: user!.username,
      email: user!.email,
      name: user!.name || user!.username,
      resetToken: token
    });
    
    return res.json(successResponse(null, 200, 'Password reset email sent'));
  } catch (error: any) {
    console.error('Error requesting password reset:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route POST /api/reset-password/:token
 * @desc Reset password with token
 * @access public
 */
router.post('/reset-password/:token', async (req: Request, res: Response) => {
  try {
    const token = req.params.token;
    const { password } = req.body;
    
    if (!token || !password) {
      return res.status(400).json(errorResponse('Token and new password are required', 400));
    }
    
    const success = await storage.resetPassword(token, password);
    if (!success) {
      return res.status(400).json(errorResponse('Invalid or expired reset token', 400));
    }
    
    return res.json(successResponse(null, 200, 'Password reset successfully'));
  } catch (error: any) {
    console.error('Error resetting password:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

export default router;