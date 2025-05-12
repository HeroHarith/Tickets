import { Router } from 'express';
import { z } from 'zod';
import { ticketingService } from '../services/ticketing-service';
import { requireAuthentication } from '../middleware/require-auth';
import { requireRole } from '../auth';
import { apiResponse } from '../utils/api-response';
import { 
  eventAttendeeSchema, 
  insertEventAttendeeSchema
} from '@shared/schema';

const router = Router();

/**
 * Get attendees for a private event
 */
router.get('/:eventId/attendees', 
  requireAuthentication,
  async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId, 10);
      
      // Verify event exists and user has permission
      const event = await ticketingService.getEvent(eventId);
      
      if (!event) {
        return apiResponse(res, 404, false, null, 'Event not found');
      }
      
      // Only event organizer or admin can see attendees
      if (event.organizer !== req.user.id && req.user.role !== 'admin') {
        return apiResponse(res, 403, false, null, 'Not authorized to view attendees');
      }
      
      const attendees = await ticketingService.getEventAttendees(eventId);
      
      return apiResponse(res, 200, true, attendees);
    } catch (error: any) {
      return apiResponse(res, 500, false, null, `Error fetching attendees: ${error.message}`);
    }
  }
);

/**
 * Add attendees to a private event
 */
router.post('/:eventId/attendees', 
  requireAuthentication,
  requireRole(['eventManager', 'admin']),
  async (req, res) => {
    try {
      const eventId = parseInt(req.params.eventId, 10);
      
      // Validate request data
      const attendeesSchema = z.array(eventAttendeeSchema);
      const parseResult = attendeesSchema.safeParse(req.body);
      
      if (!parseResult.success) {
        return apiResponse(res, 400, false, null, `Invalid attendee data: ${parseResult.error.message}`);
      }
      
      // Verify event exists and user has permission
      const event = await ticketingService.getEvent(eventId);
      
      if (!event) {
        return apiResponse(res, 404, false, null, 'Event not found');
      }
      
      // Only event organizer or admin can add attendees
      if (event.organizer !== req.user.id && req.user.role !== 'admin') {
        return apiResponse(res, 403, false, null, 'Not authorized to add attendees');
      }
      
      const attendeeData = parseResult.data.map(attendee => ({
        eventId,
        fullName: attendee.fullName,
        email: attendee.email,
        phone: attendee.phone || null
      }));
      
      const newAttendees = await ticketingService.addEventAttendees(eventId, attendeeData);
      
      return apiResponse(res, 201, true, newAttendees);
    } catch (error: any) {
      return apiResponse(res, 500, false, null, `Error adding attendees: ${error.message}`);
    }
  }
);

/**
 * Check in an attendee
 */
router.post('/attendees/:attendeeId/check-in', 
  requireAuthentication,
  requireRole(['eventManager', 'admin']),
  async (req, res) => {
    try {
      const attendeeId = parseInt(req.params.attendeeId, 10);
      
      // Get attendee to verify permissions
      const attendee = await ticketingService.getAttendee(attendeeId);
      
      if (!attendee) {
        return apiResponse(res, 404, false, null, 'Attendee not found');
      }
      
      // Get event to verify permissions
      const event = await ticketingService.getEvent(attendee.eventId);
      
      if (!event) {
        return apiResponse(res, 404, false, null, 'Event not found');
      }
      
      // Only event organizer or admin can check in attendees
      if (event.organizer !== req.user.id && req.user.role !== 'admin') {
        return apiResponse(res, 403, false, null, 'Not authorized to check in attendees');
      }
      
      const result = await ticketingService.checkInAttendee(attendeeId);
      
      return apiResponse(res, 200, true, { success: result });
    } catch (error: any) {
      return apiResponse(res, 500, false, null, `Error checking in attendee: ${error.message}`);
    }
  }
);

export const eventAttendeesRoutes = router;