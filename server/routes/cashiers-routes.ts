import { Router, Request, Response } from 'express';
import { optimizedStorage as storage } from '../optimized-storage';
import { requireRole } from '../auth';
import { successResponse, errorResponse } from '../utils/api-response';
import { z } from 'zod';
import { sendCashierInvitationEmail } from '../email';

const router = Router();

/**
 * @route GET /api/cashiers
 * @desc Get all cashiers for a center
 * @access center, admin
 */
router.get('/', requireRole(["center", "admin"]), async (req: Request, res: Response) => {
  try {
    const cashiers = await storage.getCashiers(req.user.id);
    return res.json(successResponse(cashiers, 200, 'Cashiers retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching cashiers:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route POST /api/cashiers
 * @desc Create a new cashier account
 * @access center, admin
 */
router.post('/', requireRole(["center", "admin"]), async (req: Request, res: Response) => {
  try {
    // Validate input
    const createCashierSchema = z.object({
      email: z.string().email('Valid email is required'),
      name: z.string().min(1, 'Name is required'),
      permissions: z.object({
        canManageBookings: z.boolean().default(true),
        canAccessReports: z.boolean().default(false),
        canModifyVenues: z.boolean().default(false)
      }).optional().default({}),
      venueIds: z.array(z.number()).optional().default([])
    });
    
    const validatedData = createCashierSchema.parse(req.body);
    
    // Create cashier
    const { cashier, user, tempPassword } = await storage.createCashier(
      req.user.id, 
      validatedData.email,
      validatedData.name, 
      validatedData.permissions,
      validatedData.venueIds
    );
    
    // Send invitation email
    const centerName = req.user.name || 'Center Owner';
    await sendCashierInvitationEmail({
      email: validatedData.email,
      name: validatedData.name,
      tempPassword,
      centerName
    });
    
    return res.status(201).json(successResponse(
      { cashier, user },
      201,
      'Cashier created successfully'
    ));
  } catch (error: any) {
    console.error('Error creating cashier:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse('Validation failed: ' + error.errors[0].message, 400));
    }
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route DELETE /api/cashiers/:id
 * @desc Delete a cashier account
 * @access center, admin
 */
router.delete('/:id', requireRole(["center", "admin"]), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    // Get cashier
    const cashiers = await storage.getCashiers(req.user.id);
    const cashier = cashiers.find(c => c.id === id);
    
    // Check if cashier exists and belongs to this center
    if (!cashier) {
      return res.status(404).json(errorResponse('Cashier not found or you do not have permission to delete it', 404));
    }
    
    // Delete cashier
    await storage.deleteCashier(id);
    return res.json(successResponse(null, 200, 'Cashier deleted successfully'));
  } catch (error: any) {
    console.error('Error deleting cashier:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route PATCH /api/cashiers/:id/permissions
 * @desc Update cashier permissions
 * @access center, admin
 */
router.patch('/:id/permissions', requireRole(["center", "admin"]), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    // Get cashier
    const cashiers = await storage.getCashiers(req.user.id);
    const cashier = cashiers.find(c => c.id === id);
    
    // Check if cashier exists and belongs to this center
    if (!cashier) {
      return res.status(404).json(errorResponse('Cashier not found or you do not have permission to modify it', 404));
    }
    
    // Validate permissions
    const permissionsSchema = z.object({
      canManageBookings: z.boolean().optional(),
      canAccessReports: z.boolean().optional(),
      canModifyVenues: z.boolean().optional()
    });
    
    const validatedPermissions = permissionsSchema.parse(req.body);
    
    // Update permissions
    const updatedCashier = await storage.updateCashierPermissions(id, validatedPermissions);
    return res.json(successResponse(updatedCashier, 200, 'Cashier permissions updated successfully'));
  } catch (error: any) {
    console.error('Error updating cashier permissions:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse('Validation failed: ' + error.errors[0].message, 400));
    }
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route PATCH /api/cashiers/:id/venues
 * @desc Update cashier venue access
 * @access center, admin
 */
router.patch('/:id/venues', requireRole(["center", "admin"]), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    // Get cashier
    const cashiers = await storage.getCashiers(req.user.id);
    const cashier = cashiers.find(c => c.id === id);
    
    // Check if cashier exists and belongs to this center
    if (!cashier) {
      return res.status(404).json(errorResponse('Cashier not found or you do not have permission to modify it', 404));
    }
    
    // Validate venue IDs
    const venuesSchema = z.array(z.number());
    const venueIds = venuesSchema.parse(req.body);
    
    // Get all center venues
    const centerVenues = await storage.getVenues(req.user.id);
    const centerVenueIds = new Set(centerVenues.map(v => v.id));
    
    // Ensure all venue IDs belong to this center
    for (const venueId of venueIds) {
      if (!centerVenueIds.has(venueId)) {
        return res.status(403).json(errorResponse(`Venue with ID ${venueId} does not belong to you`, 403));
      }
    }
    
    // Update cashier venue access
    const updatedCashier = await storage.updateCashierVenues(id, venueIds);
    return res.json(successResponse(updatedCashier, 200, 'Cashier venue access updated successfully'));
  } catch (error: any) {
    console.error('Error updating cashier venue access:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse('Validation failed: ' + error.errors[0].message, 400));
    }
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

export default router;