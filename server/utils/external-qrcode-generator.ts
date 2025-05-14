import QRCode from 'qrcode';

/**
 * Generate a QR code for a ticket
 * This is a separate utility for the external API to avoid dependencies on internal systems
 */
export async function generateTicketQRCode(ticketId: number): Promise<string> {
  try {
    // Create a unique identifier for the ticket
    const ticketData = `TICKET:${ticketId}:${Date.now()}`;
    
    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(ticketData, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 300,
    });
    
    return qrDataUrl;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw new Error('Failed to generate QR code for ticket');
  }
}