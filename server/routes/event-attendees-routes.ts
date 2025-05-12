import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ticketingService } from '../services/ticketing-service';
import { requireLogin } from '../middleware/auth-middleware';
import { requireRole } from '../auth';
import { successResponse, errorResponse } from '../utils/api-response';
import QRCode from 'qrcode';
import { 
  eventAttendeeSchema, 
  insertEventAttendeeSchema,
  EventAttendee,
  InsertEventAttendee
} from '@shared/schema';

const router = Router();

/**
 * Get attendees for a private event
 */
router.get('/:eventId/attendees', 
  requireLogin,
  async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId, 10);
      
      // Verify event exists and user has permission
      const event = await ticketingService.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json(errorResponse('Event not found', 404));
      }
      
      const user = req.user as any;
      
      // Only event organizer or admin can see attendees
      if (event.organizer !== user.id && user.role !== 'admin') {
        return res.status(403).json(errorResponse('Not authorized to view attendees', 403));
      }
      
      const attendees = await ticketingService.getEventAttendees(eventId);
      
      return res.json(successResponse(attendees, 200, 'Attendees retrieved successfully'));
    } catch (error: any) {
      return res.status(500).json(errorResponse(`Error fetching attendees: ${error.message}`, 500));
    }
  }
);

/**
 * Add attendees to a private event
 */
router.post('/:eventId/attendees', 
  requireLogin,
  requireRole(['eventManager', 'admin']),
  async (req: Request, res: Response) => {
    try {
      const eventId = parseInt(req.params.eventId, 10);
      
      // Validate request data
      const attendeesSchema = z.array(eventAttendeeSchema);
      const parseResult = attendeesSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return res.status(400).json(errorResponse(`Invalid attendee data: ${parseResult.error.message}`, 400));
      }
      
      // Verify event exists and user has permission
      const event = await ticketingService.getEvent(eventId);
      
      if (!event) {
        return res.status(404).json(errorResponse('Event not found', 404));
      }
      
      const user = req.user as any;
      
      // Only event organizer or admin can add attendees
      if (event.organizer !== user.id && user.role !== 'admin') {
        return res.status(403).json(errorResponse('Not authorized to add attendees', 403));
      }
      
      const attendeeData = parseResult.data.map(attendee => ({
        eventId,
        fullName: attendee.fullName,
        email: attendee.email,
        phone: attendee.phone || null
      }));
      
      const newAttendees = await ticketingService.addEventAttendees(eventId, attendeeData);
      
      return res.status(201).json(successResponse(newAttendees, 201, 'Attendees added successfully'));
    } catch (error: any) {
      return res.status(500).json(errorResponse(`Error adding attendees: ${error.message}`, 500));
    }
  }
);

/**
 * Check in an attendee
 */
router.post('/attendees/:attendeeId/check-in', 
  requireLogin,
  requireRole(['eventManager', 'admin']),
  async (req: Request, res: Response) => {
    try {
      const attendeeId = parseInt(req.params.attendeeId, 10);
      
      // Get attendee to verify permissions
      const attendee = await ticketingService.getAttendee(attendeeId);
      
      if (!attendee) {
        return res.status(404).json(errorResponse('Attendee not found', 404));
      }
      
      // Get event to verify permissions
      const event = await ticketingService.getEvent(attendee.eventId);
      
      if (!event) {
        return res.status(404).json(errorResponse('Event not found', 404));
      }
      
      const user = req.user as any;
      
      // Only event organizer or admin can check in attendees
      if (event.organizer !== user.id && user.role !== 'admin') {
        return res.status(403).json(errorResponse('Not authorized to check in attendees', 403));
      }
      
      const result = await ticketingService.checkInAttendee(attendeeId);
      
      return res.json(successResponse({ success: result }, 200, 'Attendee checked in successfully'));
    } catch (error: any) {
      return res.status(500).json(errorResponse(`Error checking in attendee: ${error.message}`, 500));
    }
  }
);

/**
 * Delete an attendee
 */
router.delete('/attendees/:attendeeId', 
  requireLogin,
  requireRole(['eventManager', 'admin']),
  async (req: Request, res: Response) => {
    try {
      const attendeeId = parseInt(req.params.attendeeId, 10);
      
      // Get attendee to verify permissions
      const attendee = await ticketingService.getAttendee(attendeeId);
      
      if (!attendee) {
        return res.status(404).json(errorResponse('Attendee not found', 404));
      }
      
      // Get event to verify permissions
      const event = await ticketingService.getEvent(attendee.eventId);
      
      if (!event) {
        return res.status(404).json(errorResponse('Event not found', 404));
      }
      
      const user = req.user as any;
      
      // Only event organizer or admin can delete attendees
      if (event.organizer !== user.id && user.role !== 'admin') {
        return res.status(403).json(errorResponse('Not authorized to delete attendees', 403));
      }
      
      const result = await ticketingService.deleteAttendee(attendeeId);
      
      return res.json(successResponse({ success: result }, 200, 'Attendee deleted successfully'));
    } catch (error: any) {
      return res.status(500).json(errorResponse(`Error deleting attendee: ${error.message}`, 500));
    }
  }
);

export const eventAttendeesRoutes = router;