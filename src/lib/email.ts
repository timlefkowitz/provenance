import nodemailer from 'nodemailer';

/**
 * Check if email is configured
 */
export function isEmailConfigured(): boolean {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  return !!(host && user && password);
}

// Email configuration from environment variables
const getEmailConfig = () => {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;
  const user = process.env.SMTP_USER;
  const password = process.env.SMTP_PASSWORD;
  const from = process.env.SMTP_FROM || process.env.SMTP_USER || 'noreply@provenance.app';

  if (!host || !user || !password) {
    throw new Error('SMTP configuration is missing. Please set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD environment variables.');
  }

  return {
    host,
    port,
    secure,
    auth: {
      user,
      pass: password,
    },
    from,
  };
};

// Create reusable transporter
let transporter: nodemailer.Transporter | null = null;

const getTransporter = () => {
  if (!transporter) {
    const config = getEmailConfig();
    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }
  return transporter;
};

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

/**
 * Send an email using SMTP
 * Returns silently if SMTP is not configured (email is optional)
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  // Check if email is configured before attempting to send
  if (!isEmailConfigured()) {
    console.log('Email not configured. Skipping email send. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD to enable emails.');
    return;
  }

  try {
    const config = getEmailConfig();
    const mailTransporter = getTransporter();

    const mailOptions = {
      from: config.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || stripHtml(options.html),
    };

    const info = await mailTransporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
  } catch (error) {
    console.error('Error sending email:', error);
    // Don't throw - email sending is optional and shouldn't break the app
    // throw error;
  }
}

/**
 * Send welcome email to new users
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const subject = 'Welcome to Provenance!';
  const html = getWelcomeEmailTemplate(name);

  await sendEmail({
    to: email,
    subject,
    html,
  });
}

/**
 * Send certification email when artwork is created
 */
export async function sendCertificationEmail(
  email: string,
  name: string,
  artworkTitle: string,
  certificateNumber: string,
  artworkUrl: string,
): Promise<void> {
  const subject = `Your artwork "${artworkTitle}" has been certified`;
  const html = getCertificationEmailTemplate(name, artworkTitle, certificateNumber, artworkUrl);

  await sendEmail({
    to: email,
    subject,
    html,
  });
}

/**
 * Welcome email template
 */
function getWelcomeEmailTemplate(name: string): string {
  const displayName = name || 'there';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.app';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Provenance</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; border: 1px solid #e5e7eb;">
    <h1 style="color: #7f1d1d; font-size: 28px; margin-bottom: 20px; font-weight: 600;">
      Welcome to Provenance!
    </h1>
    
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      Hi ${displayName},
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      Thank you for joining Provenance! We're excited to have you as part of our community of artists and collectors.
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      With Provenance, you can:
    </p>
    
    <ul style="font-size: 16px; margin-bottom: 30px; color: #4b5563; padding-left: 20px;">
      <li style="margin-bottom: 10px;">Create and manage your artwork portfolio</li>
      <li style="margin-bottom: 10px;">Generate digital certificates of authenticity</li>
      <li style="margin-bottom: 10px;">Track the provenance of your pieces</li>
      <li style="margin-bottom: 10px;">Connect with collectors and other artists</li>
    </ul>
    
    <div style="text-align: center; margin: 40px 0;">
      <a href="${siteUrl}/artworks/add" style="display: inline-block; background-color: #7f1d1d; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Get Started
      </a>
    </div>
    
    <p style="font-size: 14px; margin-top: 40px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px;">
      If you have any questions, feel free to reach out to us. We're here to help!
    </p>
    
    <p style="font-size: 14px; margin-top: 10px; color: #6b7280;">
      Best regards,<br>
      The Provenance Team
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Certification email template
 */
function getCertificationEmailTemplate(
  name: string,
  artworkTitle: string,
  certificateNumber: string,
  artworkUrl: string,
): string {
  const displayName = name || 'there';
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://provenance.app';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Artwork Has Been Certified</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; border: 1px solid #e5e7eb;">
    <h1 style="color: #7f1d1d; font-size: 28px; margin-bottom: 20px; font-weight: 600;">
      Your Artwork Has Been Certified! 🎨
    </h1>
    
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      Hi ${displayName},
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px; color: #4b5563;">
      Great news! Your artwork <strong>"${artworkTitle}"</strong> has been successfully uploaded and certified on Provenance.
    </p>
    
    <div style="background-color: #f9fafb; border-left: 4px solid #7f1d1d; padding: 20px; margin: 30px 0; border-radius: 4px;">
      <p style="margin: 0; font-size: 14px; color: #6b7280; margin-bottom: 8px;">
        <strong>Certificate Number:</strong>
      </p>
      <p style="margin: 0; font-size: 20px; color: #7f1d1d; font-weight: 600; font-family: monospace;">
        ${certificateNumber}
      </p>
    </div>
    
    <p style="font-size: 16px; margin-bottom: 30px; color: #4b5563;">
      Your digital certificate of authenticity has been generated and is now part of the permanent record on Provenance. This certificate helps establish the provenance and authenticity of your artwork.
    </p>
    
    <div style="text-align: center; margin: 40px 0;">
      <a href="${artworkUrl}" style="display: inline-block; background-color: #7f1d1d; color: #ffffff; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        View Your Artwork
      </a>
    </div>
    
    <p style="font-size: 14px; margin-top: 40px; color: #6b7280; border-top: 1px solid #e5e7eb; padding-top: 20px;">
      You can share this certificate with collectors, galleries, or anyone interested in verifying the authenticity of your work.
    </p>
    
    <p style="font-size: 14px; margin-top: 10px; color: #6b7280;">
      Best regards,<br>
      The Provenance Team
    </p>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Strip HTML tags to create plain text version
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

