import { Router, Request, Response } from 'express';
import { optimizedStorage as storage } from '../optimized-storage';
import { requireRole } from '../auth';
import { successResponse, errorResponse } from '../utils/api-response';
import { z } from 'zod';

const router = Router();

/**
 * @route GET /api/venues
 * @desc Get all venues
 * @access center, admin
 */
router.get('/', requireRole(["center", "admin"]), async (req: Request, res: Response) => {
  try {
    // Get venues for the center user
    const centerId = req.user?.role === 'center' ? req.user.id : undefined;
    const venues = await storage.getVenues(centerId);
    return res.json(successResponse(venues, 200, 'Venues retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching venues:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route POST /api/venues
 * @desc Create a new venue
 * @access center, admin
 */
router.post('/', requireRole(["center", "admin"]), async (req: Request, res: Response) => {
  try {
    // Validate input
    const venueSchema = z.object({
      name: z.string().min(1, "Name is required"),
      location: z.string().min(1, "Location is required"),
      hourlyRate: z.string().min(1, "Hourly rate is required"),
      description: z.string().optional(),
      capacity: z.number().optional(),
      amenities: z.string().array().optional(),
      images: z.string().array().optional(),
      isActive: z.boolean().optional().default(true),
      openingTime: z.string().optional(),
      closingTime: z.string().optional(),
      centerNotes: z.string().optional()
    });

    const validatedData = venueSchema.parse(req.body);
    
    // Add center ID
    const venue = {
      ...validatedData,
      centerId: req.user.id,
    };

    // Create venue
    const newVenue = await storage.createVenue(venue);
    return res.status(201).json(successResponse(newVenue, 201, 'Venue created successfully'));
  } catch (error: any) {
    console.error('Error creating venue:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse('Validation failed: ' + error.errors[0].message, 400));
    }
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route GET /api/venues/sales-report
 * @desc Get sales report for venues
 * @access center, admin
 */
router.get('/sales-report', requireRole(["center", "admin"]), async (req: Request, res: Response) => {
  try {
    // Parse dates
    let startDate: Date | undefined = undefined;
    let endDate: Date | undefined = undefined;
    
    if (req.query.startDate && typeof req.query.startDate === 'string') {
      startDate = new Date(req.query.startDate);
    }
    
    if (req.query.endDate && typeof req.query.endDate === 'string') {
      endDate = new Date(req.query.endDate);
    }
    
    // Get venue ID, defaulting to undefined to get all venues for the center
    let venueId: number | undefined = undefined;
    if (req.query.venueId && typeof req.query.venueId === 'string') {
      venueId = parseInt(req.query.venueId);
    }
    
    // Get report
    const report = await storage.getVenueSalesReport(
      req.user.id,
      venueId,
      startDate,
      endDate
    );
    
    return res.json(successResponse(report, 200, 'Venue sales report retrieved successfully'));
  } catch (error: any) {
    console.error('Error getting venue sales report:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route GET /api/venues/:id
 * @desc Get venue by ID
 * @access center, admin, customer
 */
router.get('/:id', requireRole(["center", "admin", "customer"]), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const venue = await storage.getVenue(id);
    
    if (!venue) {
      return res.status(404).json(errorResponse('Venue not found', 404));
    }
    
    // Check if user has access to the venue
    if (req.user.role === 'center' && venue.centerId !== req.user.id) {
      return res.status(403).json(errorResponse('You do not have access to this venue', 403));
    }
    
    return res.json(successResponse(venue, 200, 'Venue retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching venue:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route PATCH /api/venues/:id
 * @desc Update venue by ID
 * @access center, admin
 */
router.patch('/:id', requireRole(["center", "admin"]), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const venue = await storage.getVenue(id);
    
    if (!venue) {
      return res.status(404).json(errorResponse('Venue not found', 404));
    }
    
    // Check if user has access to update the venue
    if (req.user.role === 'center' && venue.centerId !== req.user.id) {
      return res.status(403).json(errorResponse('You do not have permission to update this venue', 403));
    }
    
    // Validate input
    const updateSchema = z.object({
      name: z.string().min(1).optional(),
      location: z.string().min(1).optional(),
      hourlyRate: z.string().min(1).optional(),
      description: z.string().optional(),
      capacity: z.number().optional(),
      amenities: z.string().array().optional(),
      images: z.string().array().optional(),
      isActive: z.boolean().optional(),
      openingTime: z.string().optional(),
      closingTime: z.string().optional(),
      centerNotes: z.string().optional()
    });
    
    const validatedData = updateSchema.parse(req.body);
    
    // Update venue
    const updatedVenue = await storage.updateVenue(id, validatedData);
    return res.json(successResponse(updatedVenue, 200, 'Venue updated successfully'));
  } catch (error: any) {
    console.error('Error updating venue:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse('Validation failed: ' + error.errors[0].message, 400));
    }
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route DELETE /api/venues/:id
 * @desc Delete venue by ID
 * @access center, admin
 */
router.delete('/:id', requireRole(["center", "admin"]), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const venue = await storage.getVenue(id);
    
    if (!venue) {
      return res.status(404).json(errorResponse('Venue not found', 404));
    }
    
    // Check if user has access to delete the venue
    if (req.user.role === 'center' && venue.centerId !== req.user.id) {
      return res.status(403).json(errorResponse('You do not have permission to delete this venue', 403));
    }
    
    // Delete venue
    await storage.deleteVenue(id);
    return res.json(successResponse(null, 200, 'Venue deleted successfully'));
  } catch (error: any) {
    console.error('Error deleting venue:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

export default router;