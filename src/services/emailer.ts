import nodemailer from "nodemailer";

class EmailService {
  private static instance: EmailService;
  private transporter;

  // Make constructor private to prevent direct instantiation
  private constructor() {
    this.transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.BREVO_EMAIL,
        pass: process.env.BREVO_SMTP_KEY,
      },
    });
  }

  // Public method to get the singleton instance
  public static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  // Send verification email method remains the same
  async sendVerificationEmail(toEmail: string, code: string) {
    const mailOptions = {
      from: `no-reply@patinka.xyz`,
      to: toEmail,
      subject: "Verify your email",
      text: `Your verification code is: ${code}`,
      html: `<p>Your verification code is: <strong>${code}</strong></p>`,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      console.log("Verification email sent:", info.messageId);
    } catch (error) {
      console.error("Error sending verification email:", error);
      throw error;
    }
  }
}

export default EmailService;
