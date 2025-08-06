import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

class EmailService {
  private static instance: EmailService;
  private transporter;
  private htmlTemplate;

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
    const templatePath = path.join(process.cwd(), "src", "assets", "emails", "verification_email.html");


    this.htmlTemplate = fs.readFileSync(templatePath, "utf-8");
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
const cPart1 = code.slice(0, 2);
const cPart2 = code.slice(2, 4);
const cPart3 = code.slice(4, 6);
const cPart4 = code.slice(6, 8);


    let htmlDocument = this.htmlTemplate.replace("{{code}}", code)
    .replace("{{code1}}", cPart1)
    .replace("{{code2}}", cPart2)
    .replace("{{code3}}", cPart3)
    .replace("{{code4}}", cPart4)
    const mailOptions = {
      from: `no-reply@patinka.xyz`,
      to: toEmail,
      subject: "Verify your email",
      text: `Your verification code is: ${code}`,
      html: htmlDocument,
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
