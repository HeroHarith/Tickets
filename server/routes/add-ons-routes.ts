import { Router, Request, Response } from 'express';
import { requireRole } from '../auth';
import { addOnsService } from '../services/add-ons-service';
import { insertEventAddOnSchema, insertEventToAddOnSchema } from '@shared/schema';
import { successResponse, errorResponse } from '../utils/response';
import { z } from 'zod';

const router = Router();

/**
 * @route GET /api/add-ons
 * @desc Get all add-ons
 * @access Admin
 */
router.get('/', requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const activeOnly = req.query.activeOnly === 'true';
    const addOns = await addOnsService.getAllAddOns(activeOnly);
    return res.json(successResponse(addOns, 200, 'Add-ons retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching add-ons:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route POST /api/add-ons
 * @desc Create a new add-on
 * @access Admin
 */
router.post('/', requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    // Validate the request body
    const addOnData = insertEventAddOnSchema.parse(req.body);
    
    // Create the add-on
    const addOn = await addOnsService.createAddOn(addOnData);
    
    return res.status(201).json(successResponse(addOn, 201, 'Add-on created successfully'));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse(`Validation error: ${error.errors[0].message}`, 400));
    }
    console.error('Error creating add-on:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route GET /api/add-ons/:id
 * @desc Get add-on by ID
 * @access Admin, EventManager
 */
router.get('/:id', requireRole(['admin', 'eventManager']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json(errorResponse('Invalid add-on ID', 400));
    }
    
    const addOn = await addOnsService.getAddOn(id);
    if (!addOn) {
      return res.status(404).json(errorResponse('Add-on not found', 404));
    }
    
    return res.json(successResponse(addOn, 200, 'Add-on retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching add-on:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route PUT /api/add-ons/:id
 * @desc Update an add-on
 * @access Admin
 */
router.put('/:id', requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json(errorResponse('Invalid add-on ID', 400));
    }
    
    // Validate the request body
    const addOnData = insertEventAddOnSchema.partial().parse(req.body);
    
    // Update the add-on
    const addOn = await addOnsService.updateAddOn(id, addOnData);
    
    return res.json(successResponse(addOn, 200, 'Add-on updated successfully'));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse(`Validation error: ${error.errors[0].message}`, 400));
    }
    console.error('Error updating add-on:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route DELETE /api/add-ons/:id
 * @desc Delete an add-on
 * @access Admin
 */
router.delete('/:id', requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json(errorResponse('Invalid add-on ID', 400));
    }
    
    await addOnsService.deleteAddOn(id);
    
    return res.json(successResponse(null, 200, 'Add-on deleted successfully'));
  } catch (error: any) {
    console.error('Error deleting add-on:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route GET /api/add-ons/event/:eventId
 * @desc Get all add-ons for an event
 * @access Admin, EventManager, Customer
 */
router.get('/event/:eventId', async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.eventId);
    if (isNaN(eventId)) {
      return res.status(400).json(errorResponse('Invalid event ID', 400));
    }
    
    const addOns = await addOnsService.getEventAddOns(eventId);
    
    return res.json(successResponse(addOns, 200, 'Event add-ons retrieved successfully'));
  } catch (error: any) {
    console.error('Error fetching event add-ons:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route POST /api/add-ons/event/:eventId
 * @desc Add add-ons to an event
 * @access Admin, EventManager
 */
router.post('/event/:eventId', requireRole(['admin', 'eventManager']), async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.eventId);
    if (isNaN(eventId)) {
      return res.status(400).json(errorResponse('Invalid event ID', 400));
    }
    
    // Validate the request body
    // Expect an array of { addOnId, isRequired, maximumQuantity } objects
    const schema = z.array(
      insertEventToAddOnSchema.omit({ id: true, eventId: true, createdAt: true })
    );
    
    const addOnRelations = schema.parse(req.body);
    
    // Add add-ons to the event
    const relations = await addOnsService.addAddOnsToEvent(eventId, addOnRelations);
    
    return res.status(201).json(successResponse(relations, 201, 'Add-ons added to event successfully'));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse(`Validation error: ${error.errors[0].message}`, 400));
    }
    console.error('Error adding add-ons to event:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route DELETE /api/add-ons/event/:eventId/:addOnId
 * @desc Remove an add-on from an event
 * @access Admin, EventManager
 */
router.delete('/event/:eventId/:addOnId', requireRole(['admin', 'eventManager']), async (req: Request, res: Response) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const addOnId = parseInt(req.params.addOnId);
    
    if (isNaN(eventId) || isNaN(addOnId)) {
      return res.status(400).json(errorResponse('Invalid event ID or add-on ID', 400));
    }
    
    const success = await addOnsService.removeAddOnFromEvent(eventId, addOnId);
    
    if (!success) {
      return res.status(404).json(errorResponse('Add-on relation not found', 404));
    }
    
    return res.json(successResponse(null, 200, 'Add-on removed from event successfully'));
  } catch (error: any) {
    console.error('Error removing add-on from event:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

/**
 * @route PUT /api/add-ons/event/relation/:relationId
 * @desc Update an event-to-add-on relation
 * @access Admin, EventManager
 */
router.put('/event/relation/:relationId', requireRole(['admin', 'eventManager']), async (req: Request, res: Response) => {
  try {
    const relationId = parseInt(req.params.relationId);
    if (isNaN(relationId)) {
      return res.status(400).json(errorResponse('Invalid relation ID', 400));
    }
    
    // Validate the request body
    const schema = z.object({
      isRequired: z.boolean().optional(),
      maximumQuantity: z.number().int().min(1).optional()
    });
    
    const relationData = schema.parse(req.body);
    
    // Update the relation
    const relation = await addOnsService.updateEventAddOnRelation(relationId, relationData);
    
    return res.json(successResponse(relation, 200, 'Relation updated successfully'));
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json(errorResponse(`Validation error: ${error.errors[0].message}`, 400));
    }
    console.error('Error updating relation:', error);
    return res.status(500).json(errorResponse(error.message, 500));
  }
});

export const addOnsRoutes = router;