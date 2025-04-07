import nodemailer from 'nodemailer';
import { Event, Ticket, TicketType } from '@shared/schema';
import { generateAppleWalletPassUrl, generateGooglePayPassUrl } from './wallet';

// Create a transporter for Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

interface TicketDetails {
  ticket: Ticket;
  event: Event;
  ticketType: TicketType;
  attendeeEmail: string;
  attendeeName: string;
  qrCodeDataUrl: string;
}

/**
 * Send a ticket confirmation email
 */
export async function sendTicketConfirmationEmail(details: TicketDetails): Promise<boolean> {
  const { ticket, event, ticketType, attendeeEmail, attendeeName, qrCodeDataUrl } = details;
  
  // Format date for display
  const eventDate = new Date(event.startDate);
  const formattedDate = eventDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  const formattedTime = eventDate.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  // Generate a random ticket number for display purposes
  const ticketNumber = `T-${ticket.id}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
  
  // Generate wallet pass URLs
  const appleWalletUrl = generateAppleWalletPassUrl({
    event,
    ticket,
    ticketType,
    attendeeName,
    qrCodeDataUrl
  });
  
  const googlePayUrl = generateGooglePayPassUrl({
    event,
    ticket,
    ticketType,
    attendeeName,
    qrCodeDataUrl
  });
  
  // Email content with both HTML and plain text versions
  const emailContent = {
    from: `"Event Ticketing" <${process.env.GMAIL_EMAIL}>`,
    to: attendeeEmail,
    subject: `Your Ticket for ${event.title}`,
    text: `
      Thank you for your purchase, ${attendeeName}!
      
      EVENT: ${event.title}
      DATE: ${formattedDate}
      TIME: ${formattedTime}
      LOCATION: ${event.location}
      TICKET TYPE: ${ticketType.name}
      TICKET #: ${ticketNumber}
      
      Please show the QR code when you arrive at the event.
      
      You can add this ticket to your mobile wallet:
      - Apple Wallet: ${appleWalletUrl}
      - Google Pay: ${googlePayUrl}
      
      We look forward to seeing you!
    `,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #6366F1; margin-bottom: 5px;">Your Ticket is Confirmed!</h1>
          <p style="color: #4b5563; font-size: 16px;">Thank you for your purchase, ${attendeeName}!</p>
        </div>
        
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <h2 style="color: #111827; margin-top: 0;">${event.title}</h2>
          <p style="margin: 8px 0;"><strong>Date:</strong> ${formattedDate}</p>
          <p style="margin: 8px 0;"><strong>Time:</strong> ${formattedTime}</p>
          <p style="margin: 8px 0;"><strong>Location:</strong> ${event.location}</p>
          <p style="margin: 8px 0;"><strong>Ticket Type:</strong> ${ticketType.name}</p>
          <p style="margin: 8px 0;"><strong>Ticket #:</strong> ${ticketNumber}</p>
        </div>
        
        <div style="text-align: center; margin-bottom: 20px;">
          <p style="margin-bottom: 10px; font-weight: bold;">Your Ticket QR Code</p>
          <img src="${qrCodeDataUrl}" alt="Ticket QR Code" style="max-width: 200px; border: 1px solid #e1e1e1; padding: 10px; border-radius: 4px;"/>
          <p style="font-size: 14px; color: #6b7280; margin-top: 10px;">Please show this QR code when you arrive at the event</p>
        </div>
        
        <div style="text-align: center; margin-bottom: 20px;">
          <p style="margin-bottom: 10px; font-weight: bold;">Add to Your Mobile Wallet</p>
          <div>
            <a href="${appleWalletUrl}" style="display: inline-block; margin: 10px; text-decoration: none;">
              <img src="https://developer.apple.com/wallet/add-to-apple-wallet-guidelines/images/add-to-apple-wallet-badge.svg" alt="Add to Apple Wallet" style="height: 44px;">
            </a>
          </div>
          <div>
            <a href="${googlePayUrl}" style="display: inline-block; margin: 10px; text-decoration: none;">
              <img src="https://developers.google.com/static/pay/api/images/brand-guidelines/google-pay-mark.svg" alt="Add to Google Pay" style="height: 36px; background-color: #000; padding: 8px; border-radius: 4px;">
            </a>
          </div>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e1e1; text-align: center; color: #6b7280; font-size: 14px;">
          <p>If you have any questions, please contact us at ${process.env.GMAIL_EMAIL}</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(emailContent);
    console.log(`Ticket confirmation email sent to ${attendeeEmail}`);
    return true;
  } catch (error) {
    console.error('Failed to send ticket confirmation email:', error);
    return false;
  }
}