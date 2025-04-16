import nodemailer from 'nodemailer';
import { Event, Ticket, TicketType } from '@shared/schema';
import { generateAppleWalletPassUrl, generateGooglePayPassUrl } from './wallet';

// Create a more robust transporter for Gmail
const createTransporter = () => {
  // Check if we have the required credentials
  if (!process.env.GMAIL_EMAIL || !process.env.GMAIL_APP_PASSWORD) {
    console.error('Missing email credentials. Set GMAIL_EMAIL and GMAIL_APP_PASSWORD environment variables.');
    return null;
  }

  // Create a Gmail transporter with additional options
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Use SSL
    auth: {
      user: process.env.GMAIL_EMAIL,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
    debug: true, // Enable debug output
    tls: {
      rejectUnauthorized: false // Don't fail on self-signed certificates
    }
  });
};

// Create the transporter
const transporter = createTransporter();

// Verify transporter configuration
if (transporter) {
  transporter.verify((error, success) => {
    if (error) {
      console.error('SMTP connection error:', error);
    } else {
      console.log('SMTP server is ready to take our messages');
      console.log(`Using email account: ${process.env.GMAIL_EMAIL}`);
    }
  });
} else {
  console.error('Failed to create email transporter due to missing credentials');
}

interface TicketDetails {
  ticket: Ticket;
  event: Event;
  ticketType: TicketType;
  attendeeEmail: string;
  attendeeName: string;
  qrCodeDataUrl: string;
}

/**
 * Interface for gift ticket email data
 */
interface GiftTicketDetails extends TicketDetails {
  senderName: string;
  giftMessage?: string;
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
  if (!transporter) {
    console.error('Email transporter not initialized. Check email credentials.');
    return false;
  }
  
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
    console.log(`Attempting to send verification email to ${email} using ${process.env.GMAIL_EMAIL}`);
    const info = await transporter.sendMail(emailContent);
    console.log(`Verification email sent to ${email}`);
    console.log('Email response:', info.response);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send verification email:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Email configuration:', {
      from: emailContent.from,
      to: emailContent.to,
      subject: emailContent.subject,
      emailProvider: process.env.GMAIL_EMAIL ? 'Gmail' : 'Not configured',
      hasCredentials: !!process.env.GMAIL_APP_PASSWORD
    });
    return false;
  }
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(details: PasswordResetEmailDetails): Promise<boolean> {
  if (!transporter) {
    console.error('Email transporter not initialized. Check email credentials.');
    return false;
  }
  
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
    console.log(`Attempting to send password reset email to ${email} using ${process.env.GMAIL_EMAIL}`);
    const info = await transporter.sendMail(emailContent);
    console.log(`Password reset email sent to ${email}`);
    console.log('Email response:', info.response);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Email configuration:', {
      from: emailContent.from,
      to: emailContent.to,
      subject: emailContent.subject,
      emailProvider: process.env.GMAIL_EMAIL ? 'Gmail' : 'Not configured',
      hasCredentials: !!process.env.GMAIL_APP_PASSWORD
    });
    return false;
  }
}

/**
 * Interface for cashier invitation email data
 */
interface CashierInvitationDetails {
  email: string;
  name?: string;
  tempPassword: string;
  centerName: string;
}

/**
 * Send a cashier invitation email
 */
export async function sendCashierInvitationEmail(details: CashierInvitationDetails): Promise<boolean> {
  if (!transporter) {
    console.error('Email transporter not initialized. Check email credentials.');
    return false;
  }
  
  const { email, name, tempPassword, centerName } = details;
  const displayName = name || email.split('@')[0];
  
  // Create login URL
  const baseUrl = process.env.APP_URL || 'https://eventtix.replit.app';
  const loginUrl = `${baseUrl}/auth`;
  
  // Email content
  const emailContent = {
    from: `"Event Ticketing" <${process.env.GMAIL_EMAIL}>`,
    to: email,
    subject: "You've Been Added as a Cashier",
    text: `
      Hello ${displayName},
      
      You've been added as a cashier for ${centerName} on our Event Ticketing platform.
      
      Login Information:
      - Username: ${email}
      - Temporary Password: ${tempPassword}
      
      Please login using the link below and change your password as soon as possible:
      ${loginUrl}
      
      If you have any questions, please contact your center manager.
    `,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
        <div style="text-align: center; margin-bottom: 20px;">
          <h1 style="color: #6366F1; margin-bottom: 5px;">Welcome to Our Team!</h1>
          <p style="color: #4b5563; font-size: 16px;">Hello ${displayName}!</p>
        </div>
        
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p>You've been added as a cashier for <strong>${centerName}</strong> on our Event Ticketing platform.</p>
          
          <div style="border: 1px solid #e1e1e1; border-radius: 8px; padding: 15px; margin: 20px 0; background-color: white;">
            <h3 style="margin-top: 0; color: #111827;">Your Login Information</h3>
            <p><strong>Username:</strong> ${email}</p>
            <p><strong>Temporary Password:</strong> ${tempPassword}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${loginUrl}" style="background-color: #6366F1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold;">Login Now</a>
          </div>
          
          <p style="font-size: 14px;">Please login and change your password as soon as possible.</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e1e1e1; text-align: center; color: #6b7280; font-size: 14px;">
          <p>If you have any questions, please contact your center manager.</p>
        </div>
      </div>
    `,
  };

  try {
    console.log(`Attempting to send cashier invitation email to ${email}`);
    const info = await transporter.sendMail(emailContent);
    console.log(`Cashier invitation email sent to ${email}`);
    console.log('Email response:', info.response);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send cashier invitation email:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Email configuration:', {
      from: emailContent.from,
      to: emailContent.to,
      subject: emailContent.subject,
      emailProvider: process.env.GMAIL_EMAIL ? 'Gmail' : 'Not configured',
      hasCredentials: !!process.env.GMAIL_APP_PASSWORD
    });
    return false;
  }
}

/**
 * Send a ticket confirmation email
 */
export async function sendTicketConfirmationEmail(details: TicketDetails): Promise<boolean> {
  if (!transporter) {
    console.error('Email transporter not initialized. Check email credentials.');
    return false;
  }
  
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
    console.log(`Attempting to send ticket confirmation email to ${attendeeEmail} using ${process.env.GMAIL_EMAIL}`);
    const info = await transporter.sendMail(emailContent);
    console.log(`Ticket confirmation email sent to ${attendeeEmail}`);
    console.log('Email response:', info.response);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send ticket confirmation email:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Email configuration:', {
      from: emailContent.from,
      to: emailContent.to,
      subject: emailContent.subject,
      emailProvider: process.env.GMAIL_EMAIL ? 'Gmail' : 'Not configured',
      hasCredentials: !!process.env.GMAIL_APP_PASSWORD
    });
    return false;
  }
}

/**
 * Send a gift ticket email to a recipient
 */
export async function sendGiftTicketEmail(details: GiftTicketDetails): Promise<boolean> {
  if (!transporter) {
    console.error('Email transporter not initialized. Check email credentials.');
    return false;
  }
  
  const { ticket, event, ticketType, attendeeEmail, attendeeName, qrCodeDataUrl, senderName, giftMessage } = details;
  
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

  // Generate a ticket number for display purposes
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
    subject: `You've Been Gifted a Ticket for ${event.title}`,
    text: `
      Hello ${attendeeName},
      
      You've received a ticket for ${event.title} as a gift from ${senderName}!
      
      ${giftMessage ? `Message from ${senderName}: "${giftMessage}"` : ''}
      
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
          <h1 style="color: #6366F1; margin-bottom: 5px;">You've Been Gifted a Ticket!</h1>
          <p style="color: #4b5563; font-size: 16px;">Hello ${attendeeName}!</p>
        </div>
        
        <div style="background-color: #f9f9f9; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
          <p>You've received a ticket for <strong>${event.title}</strong> as a gift from <strong>${senderName}</strong>!</p>
          
          ${giftMessage ? `
          <div style="background-color: #f0f4ff; border-radius: 8px; padding: 15px; margin: 15px 0; border-left: 4px solid #6366F1;">
            <p style="margin: 0; font-style: italic;">Message from ${senderName}:</p>
            <p style="margin: 10px 0 0 0;">"${giftMessage}"</p>
          </div>
          ` : ''}
          
          <h2 style="color: #111827; margin-top: 20px;">${event.title}</h2>
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
    console.log(`Attempting to send gift ticket email to ${attendeeEmail}`);
    const info = await transporter.sendMail(emailContent);
    console.log(`Gift ticket email sent to ${attendeeEmail}`);
    console.log('Email response:', info.response);
    console.log('Message ID:', info.messageId);
    return true;
  } catch (error) {
    console.error('Failed to send gift ticket email:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    console.error('Email configuration:', {
      from: emailContent.from,
      to: emailContent.to,
      subject: emailContent.subject,
      emailProvider: process.env.GMAIL_EMAIL ? 'Gmail' : 'Not configured',
      hasCredentials: !!process.env.GMAIL_APP_PASSWORD
    });
    return false;
  }
}