// src/services/email.service.ts
// Email Service using Nodemailer

import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config';
import { logger } from '../utils/logger';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Email Service
 * Handles all email sending functionality
 */
class EmailService {
  private transporter: Transporter | null = null;
  private transporterInit: Promise<void> | null = null;
  private fromName: string;
  private fromEmail: string;

  constructor() {
    this.fromName = process.env.SMTP_FROM_NAME || config.smtp.from.name;
    this.fromEmail = process.env.SMTP_FROM_EMAIL || config.smtp.from.email;
    // Lazy init to avoid startup crashes and to allow async dev fallback (Ethereal)
  }

  /**
   * Initialize the nodemailer transporter
   */
  /**
   * Initialize the email service
   * (Previously initialized Nodemailer)
   */
  private async initTransporter(): Promise<void> {
    if (!process.env.BREVO_API_KEY) {
      logger.warn('BREVO_API_KEY not found in environment variables. Email sending might fail.');
    } else {
      logger.info('Email service initialized using Brevo HTTP API');
    }
  }

  private async getTransporter(): Promise<Transporter | null> {
    if (this.transporter) return this.transporter;

    if (!this.transporterInit) {
      this.transporterInit = this.initTransporter();
    }

    await this.transporterInit;
    return this.transporter;
  }

  /**
   * Send an email
   */
  /**
   * Send an email using Brevo HTTP API
   */
  async sendEmail(options: EmailOptions): Promise<EmailResult> {
    const apiKey = process.env.BREVO_API_KEY;

    if (!apiKey) {
      logger.error('BREVO_API_KEY is missing');
      return { success: false, error: 'Email service configuration error: Missing BREVO_API_KEY' };
    }

    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: this.fromName,
            email: this.fromEmail,
          },
          to: [{ email: options.to }],
          subject: options.subject,
          htmlContent: options.html,
          textContent: options.text || this.htmlToText(options.html),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        logger.error('Brevo API error', { status: response.status, data: errorData });
        throw new Error(`Brevo API returned ${response.status}: ${JSON.stringify(errorData)}`);
      }

      const data = await response.json() as any;
      logger.debug(`Email sent via Brevo API: ${data.messageId} to ${options.to}`);

      return {
        success: true,
        messageId: data.messageId,
      };
    } catch (error) {
      const err = error as any;
      const errorMessage = err?.message ? String(err.message) : 'Unknown error';

      logger.error(`Failed to send email to ${options.to}: ${errorMessage}`, { error: err });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Send OTP email for email verification
   */
  async sendVerificationOtp(email: string, otp: string, name: string): Promise<EmailResult> {
    const html = this.getOtpEmailTemplate({
      title: 'Verify Your Email',
      greeting: `Hello ${name}`,
      message: 'Thank you for registering with CareChain. Please use the following OTP to verify your email address:',
      otp,
      expiryMinutes: config.otp.expiryMinutes,
      footer: 'If you did not create an account, please ignore this email.',
    });

    return this.sendEmail({
      to: email,
      subject: `${otp} is your CareChain verification code`,
      html,
    });
  }

  /**
   * Send OTP email for password reset
   */
  async sendPasswordResetOtp(email: string, otp: string, name: string): Promise<EmailResult> {
    const html = this.getOtpEmailTemplate({
      title: 'Reset Your Password',
      greeting: `Hello ${name}`,
      message: 'We received a request to reset your password. Use the following OTP to proceed:',
      otp,
      expiryMinutes: config.otp.expiryMinutes,
      footer: 'If you did not request a password reset, please ignore this email or contact support if you have concerns.',
    });

    return this.sendEmail({
      to: email,
      subject: `${otp} is your CareChain password reset code`,
      html,
    });
  }

  /**
   * Send welcome email after registration complete
   */
  async sendWelcomeEmail(email: string, name: string, role: string): Promise<EmailResult> {
    const roleDisplay = role === 'doctor' ? 'Healthcare Professional' : 'Healthcare Facility';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to CareChain</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">Welcome to CareChain!</h1>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px; font-size: 16px; color: #333;">Hello ${name},</p>
                    <p style="margin: 0 0 20px; font-size: 16px; color: #555; line-height: 1.6;">
                      Welcome to CareChain! Your account as a <strong>${roleDisplay}</strong> has been successfully created.
                    </p>
                    <p style="margin: 0 0 20px; font-size: 16px; color: #555; line-height: 1.6;">
                      You can now access all the features of our healthcare job matching platform. Here's what you can do next:
                    </p>
                    <ul style="margin: 0 0 20px; padding-left: 20px; color: #555; line-height: 1.8;">
                      ${role === 'doctor' ? `
                        <li>Complete your professional profile</li>
                        <li>Browse available job opportunities</li>
                        <li>Apply to positions that match your skills</li>
                      ` : `
                        <li>Complete your hospital profile</li>
                        <li>Post job openings</li>
                        <li>Search for qualified healthcare professionals</li>
                      `}
                    </ul>
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${config.app.publicWebUrl}" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Get Started</a>
                    </div>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #666;">
                      Need help? Contact us at support@carechain.com
                    </p>
                    <p style="margin: 10px 0 0; font-size: 12px; color: #999;">
                      © ${new Date().getFullYear()} CareChain. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Welcome to CareChain - Your Account is Ready!',
      html,
    });
  }

  /**
   * Send application status update email
   */
  async sendApplicationStatusEmail(
    email: string,
    name: string,
    jobTitle: string,
    hospitalName: string,
    status: string,
    additionalInfo?: string
  ): Promise<EmailResult> {
    const statusMessages: Record<string, { title: string; message: string; color: string }> = {
      shortlisted: {
        title: 'Congratulations! You\'ve Been Shortlisted',
        message: `Great news! Your application for <strong>${jobTitle}</strong> at <strong>${hospitalName}</strong> has been shortlisted.`,
        color: '#28a745',
      },
      interview_scheduled: {
        title: 'Interview Scheduled',
        message: `Your interview for <strong>${jobTitle}</strong> at <strong>${hospitalName}</strong> has been scheduled.`,
        color: '#17a2b8',
      },
      offer_made: {
        title: 'Job Offer Received!',
        message: `Congratulations! You\'ve received a job offer for <strong>${jobTitle}</strong> at <strong>${hospitalName}</strong>.`,
        color: '#28a745',
      },
      hired: {
        title: 'Welcome Aboard!',
        message: `You have been officially hired for <strong>${jobTitle}</strong> at <strong>${hospitalName}</strong>.`,
        color: '#28a745',
      },
      rejected: {
        title: 'Application Update',
        message: `We regret to inform you that your application for <strong>${jobTitle}</strong> at <strong>${hospitalName}</strong> was not selected at this time.`,
        color: '#dc3545',
      },
    };

    const statusInfo = statusMessages[status] || {
      title: 'Application Update',
      message: `Your application status for <strong>${jobTitle}</strong> at <strong>${hospitalName}</strong> has been updated to: ${status}.`,
      color: '#6c757d',
    };

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${statusInfo.title}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background-color: ${statusInfo.color}; border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 600;">${statusInfo.title}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px; font-size: 16px; color: #333;">Hello ${name},</p>
                    <p style="margin: 0 0 20px; font-size: 16px; color: #555; line-height: 1.6;">
                      ${statusInfo.message}
                    </p>
                    ${additionalInfo ? `
                      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px; color: #555; line-height: 1.6;">${additionalInfo}</p>
                      </div>
                    ` : ''}
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${config.app.publicWebUrl}/applications" style="display: inline-block; padding: 14px 40px; background-color: ${statusInfo.color}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Application</a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #999;">
                      © ${new Date().getFullYear()} CareChain. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `CareChain: ${statusInfo.title} - ${jobTitle}`,
      html,
    });
  }

  /**
   * Get OTP email template
   */
  private getOtpEmailTemplate(params: {
    title: string;
    greeting: string;
    message: string;
    otp: string;
    expiryMinutes: number;
    footer: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${params.title}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">CareChain</h1>
                    <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">${params.title}</p>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px; font-size: 16px; color: #333;">${params.greeting},</p>
                    <p style="margin: 0 0 30px; font-size: 16px; color: #555; line-height: 1.6;">
                      ${params.message}
                    </p>
                    <!-- OTP Box -->
                    <div style="text-align: center; margin: 30px 0;">
                      <div style="display: inline-block; padding: 20px 50px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px;">
                        <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #ffffff;">${params.otp}</span>
                      </div>
                    </div>
                    <p style="margin: 30px 0 20px; font-size: 14px; color: #888; text-align: center;">
                      This code will expire in <strong>${params.expiryMinutes} minutes</strong>
                    </p>
                    <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                    <p style="margin: 0; font-size: 14px; color: #888; line-height: 1.6;">
                      ${params.footer}
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #999;">
                      © ${new Date().getFullYear()} CareChain. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
  }

  /**
   * Send job offer email to candidate
   */
  async sendOfferEmail(
    email: string,
    name: string,
    jobTitle: string,
    hospitalName: string,
    offer: {
      amount?: number;
      currency?: string;
      salaryType?: string;
      startDate?: string;
      reportingDate?: string;
      expiresAt?: string;
      notes?: string;
      terms?: string;
    }
  ): Promise<EmailResult> {
    const salaryFormatted = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: offer.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(offer.amount || 0);

    const joiningDate = offer.startDate ? new Date(offer.startDate).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) : 'To be confirmed';

    const reportingDate = offer.reportingDate ? new Date(offer.reportingDate).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) : 'To be confirmed';

    const deadline = offer.expiresAt ? new Date(offer.expiresAt).toLocaleDateString('en-IN', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }) : 'No deadline specified';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Offer from ${hospitalName}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <!-- Header -->
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">🎉 Congratulations!</h1>
                    <p style="margin: 10px 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">You've Received a Job Offer</p>
                  </td>
                </tr>
                <!-- Content -->
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px; font-size: 16px; color: #333;">Dear ${name},</p>
                    <p style="margin: 0 0 20px; font-size: 16px; color: #555; line-height: 1.6;">
                      We are pleased to inform you that <strong>${hospitalName}</strong> has extended a job offer to you for the position of <strong>${jobTitle}</strong>.
                    </p>

                    <!-- Offer Details Card -->
                    <div style="background-color: #f8f9fa; padding: 25px; border-radius: 12px; margin: 25px 0; border-left: 4px solid #28a745;">
                      <h3 style="margin: 0 0 20px; color: #333; font-size: 18px;">📋 Offer Details</h3>
                      
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">
                            <span style="color: #6c757d; font-size: 14px;">Position</span>
                          </td>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef; text-align: right;">
                            <strong style="color: #333;">${jobTitle}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">
                            <span style="color: #6c757d; font-size: 14px;">Salary</span>
                          </td>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef; text-align: right;">
                            <strong style="color: #28a745;">${salaryFormatted}</strong>
                            <span style="color: #6c757d; font-size: 12px;"> (${offer.salaryType || 'monthly'})</span>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">
                            <span style="color: #6c757d; font-size: 14px;">Joining Date</span>
                          </td>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef; text-align: right;">
                            <strong style="color: #333;">${joiningDate}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef;">
                            <span style="color: #6c757d; font-size: 14px;">Reporting Date</span>
                          </td>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e9ecef; text-align: right;">
                            <strong style="color: #333;">${reportingDate}</strong>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 0;">
                            <span style="color: #6c757d; font-size: 14px;">Response Deadline</span>
                          </td>
                          <td style="padding: 10px 0; text-align: right;">
                            <strong style="color: #dc3545;">${deadline}</strong>
                          </td>
                        </tr>
                      </table>
                    </div>

                    ${offer.notes ? `
                      <div style="background-color: #fff3cd; padding: 15px 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px; color: #856404;">
                          <strong>📝 Additional Notes:</strong><br>
                          ${offer.notes}
                        </p>
                      </div>
                    ` : ''}

                    ${offer.terms ? `
                      <div style="background-color: #e7f1ff; padding: 15px 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px; color: #004085;">
                          <strong>📄 Terms & Conditions:</strong><br>
                          ${offer.terms}
                        </p>
                      </div>
                    ` : ''}

                    <p style="margin: 25px 0; font-size: 16px; color: #555; line-height: 1.6;">
                      Please review this offer carefully and respond before the deadline. You can accept or decline this offer directly from the CareChain app.
                    </p>

                    <!-- Action Buttons -->
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${config.app.publicWebUrl}/applications" style="display: inline-block; padding: 14px 40px; background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; margin: 0 10px;">View Offer</a>
                    </div>

                    <p style="margin: 20px 0 0; font-size: 14px; color: #888; line-height: 1.6;">
                      If you have any questions about this offer, please feel free to reach out to ${hospitalName} through the messaging feature in the app.
                    </p>
                  </td>
                </tr>
                <!-- Footer -->
                <tr>
                  <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="margin: 0; font-size: 14px; color: #666;">
                      Best regards,<br>
                      <strong>${hospitalName}</strong>
                    </p>
                    <p style="margin: 15px 0 0; font-size: 12px; color: #999;">
                      This email was sent via CareChain - Healthcare Job Platform<br>
                      © ${new Date().getFullYear()} CareChain. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `🎉 Job Offer: ${jobTitle} at ${hospitalName}`,
      html,
    });
  }

  /**
   * Send offer response notification email to hospital
   */
  async sendOfferResponseEmail(
    email: string,
    hospitalName: string,
    candidateName: string,
    jobTitle: string,
    response: 'accepted' | 'declined',
    reason?: string
  ): Promise<EmailResult> {
    const isAccepted = response === 'accepted';
    const statusColor = isAccepted ? '#28a745' : '#dc3545';
    const statusIcon = isAccepted ? '✅' : '❌';
    const statusText = isAccepted ? 'Accepted' : 'Declined';

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Offer ${statusText} - ${candidateName}</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7fa;">
        <table role="presentation" style="width: 100%; border-collapse: collapse;">
          <tr>
            <td align="center" style="padding: 40px 0;">
              <table role="presentation" style="width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                <tr>
                  <td style="padding: 40px 40px 20px; text-align: center; background-color: ${statusColor}; border-radius: 12px 12px 0 0;">
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">${statusIcon} Offer ${statusText}</h1>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 40px;">
                    <p style="margin: 0 0 20px; font-size: 16px; color: #333;">Hello ${hospitalName},</p>
                    <p style="margin: 0 0 20px; font-size: 16px; color: #555; line-height: 1.6;">
                      <strong>${candidateName}</strong> has <strong style="color: ${statusColor};">${response}</strong> your job offer for the position of <strong>${jobTitle}</strong>.
                    </p>
                    ${reason ? `
                      <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; font-size: 14px; color: #555;">
                          <strong>Reason provided:</strong><br>
                          ${reason}
                        </p>
                      </div>
                    ` : ''}
                    ${isAccepted ? `
                      <p style="margin: 20px 0; font-size: 16px; color: #555; line-height: 1.6;">
                        🎉 Great news! You can now proceed with the hiring process and prepare for the candidate's joining.
                      </p>
                    ` : `
                      <p style="margin: 20px 0; font-size: 16px; color: #555; line-height: 1.6;">
                        Don't worry! There are many other qualified candidates available on CareChain.
                      </p>
                    `}
                    <div style="text-align: center; margin: 30px 0;">
                      <a href="${config.app.publicWebUrl}/applications" style="display: inline-block; padding: 14px 40px; background-color: ${statusColor}; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Applications</a>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 20px 40px; background-color: #f8f9fa; border-radius: 0 0 12px 12px; text-align: center;">
                    <p style="margin: 0; font-size: 12px; color: #999;">
                      © ${new Date().getFullYear()} CareChain. All rights reserved.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: `${statusIcon} Offer ${statusText}: ${candidateName} - ${jobTitle}`,
      html,
    });
  }

  /**
   * Convert HTML to plain text (basic conversion)
   */
  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>.*<\/style>/gi, '')
      .replace(/<script[^>]*>.*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Close the transporter connection
   */
  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      logger.info('Email transporter closed');
    }
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
