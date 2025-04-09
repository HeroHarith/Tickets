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
 * Interface for verification email data
 */
interface VerificationEmailDetails {
  username: string;
  email: string;
  name: string;
  verificationToken: string;
}

/**
 * Interface for password reset email data
 */
interface PasswordResetEmailDetails {
  username: string;
  email: string;
  name: string;
  resetToken: string;
}

/**
 * Send an email verification email
 */
export async function sendVerificationEmail(details: VerificationEmailDetails): Promise<boolean> {
  const { username, email, name, verificationToken } = details;
  
  // Create verification URL - using /auth page with token parameter
  const baseUrl = process.env.APP_URL || 'https://eventtix.replit.app';
  const verificationUrl = `${baseUrl}/auth?token=${verificationToken}`;
  
  // Email content
  const emailContent = {
    from: `"Event Ticketing" <${process.env.GMAIL_EMAIL}>`,
    to: email,
    subject: "Verify Your Email Address",
    text: `
      Hello ${name},
      
      Thank you for registering! Please verify your email address by clicking the link below:
      
      ${verificationUrl}
      
      This link will expire in 24 hours.
      
      If you did not create an account, you can safely ignore this email.
    `,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #6366F1; margin-bottom: 5px;">Verify Your Email Address</h1>
          <p style="color: #4b5563; font-size: 16px;">Hello ${name}!</p>
        </div>
        
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p>Thank you for registering with our service. To complete your registration, please verify your email address.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Verify Email Address</a>
          </div>
          <p style="font-size: 14px;">If the button doesn't work, you can copy and paste this link in your browser:</p>
          <p style="font-size: 14px; word-break: break-all; background-color: #e5e7eb; padding: 10px; border-radius: 4px;">${verificationUrl}</p>
          <p style="font-size: 14px;">This link will expire in 24 hours.</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e1e1; text-align: center; color: #6b7280; font-size: 14px;">
          <p>If you did not create an account, you can safely ignore this email.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(emailContent);
    console.log(`Verification email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    return false;
  }
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(details: PasswordResetEmailDetails): Promise<boolean> {
  const { username, email, name, resetToken } = details;
  
  // Create reset URL
  const baseUrl = process.env.APP_URL || 'https://eventtix.replit.app';
  const resetUrl = `${baseUrl}/auth?reset_token=${resetToken}`;
  
  // Email content
  const emailContent = {
    from: `"Event Ticketing" <${process.env.GMAIL_EMAIL}>`,
    to: email,
    subject: "Reset Your Password",
    text: `
      Hello ${name},
      
      We received a request to reset your password. Click the link below to create a new password:
      
      ${resetUrl}
      
      This link will expire in 1 hour.
      
      If you did not request a password reset, you can safely ignore this email.
    `,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #6366F1; margin-bottom: 5px;">Reset Your Password</h1>
          <p style="color: #4b5563; font-size: 16px;">Hello ${name}!</p>
        </div>
        
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Reset Password</a>
          </div>
          <p style="font-size: 14px;">If the button doesn't work, you can copy and paste this link in your browser:</p>
          <p style="font-size: 14px; word-break: break-all; background-color: #e5e7eb; padding: 10px; border-radius: 4px;">${resetUrl}</p>
          <p style="font-size: 14px;">This link will expire in 1 hour.</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e1e1; text-align: center; color: #6b7280; font-size: 14px;">
          <p>If you did not request a password reset, you can safely ignore this email.</p>
        </div>
      </div>
    `,
  };

  try {
    await transporter.sendMail(emailContent);
    console.log(`Password reset email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
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