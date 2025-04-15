import express from 'express';
import { requireRole } from '../auth';
import { successResponse, errorResponse } from '../utils/api-response';
import { optimizedStorage as storage } from '../optimized-storage';

const router = express.Router();

// Get all users (admin only)
router.get('/users', requireRole(['admin']), async (req, res) => {
  try {
    // Ensure user is authenticated and has admin role
    if (!req.isAuthenticated() || !req.user || req.user.role !== 'admin') {
      return res.status(403).json(errorResponse('Admin access required', 403));
    }
    
    console.log('Fetching all users for admin:', req.user.username);
    
    // Get all users from storage
    const users = await storage.getAllUsers();
    
    return res.json(successResponse(
      users,
      200,
      'All users retrieved successfully'
    ));
  } catch (error: any) {
    console.error('Error getting all users:', error);
    return res.status(500).json(errorResponse(
      error.message || 'Error retrieving users',
      500
    ));
  }
});

// Get all events (admin only)
router.get('/events', requireRole(['admin']), async (req, res) => {
  try {
    // Ensure user is authenticated and has admin role
    if (!req.isAuthenticated() || !req.user || req.user.role !== 'admin') {
      return res.status(403).json(errorResponse('Admin access required', 403));
    }
    
    console.log('Fetching all events for admin:', req.user.username);
    
    // Get all events from storage
    const events = await storage.getEvents();
    
    return res.json(successResponse(
      events,
      200,
      'All events retrieved successfully'
    ));
  } catch (error: any) {
    console.error('Error getting all events:', error);
    return res.status(500).json(errorResponse(
      error.message || 'Error retrieving events',
      500
    ));
  }
});

export default router;