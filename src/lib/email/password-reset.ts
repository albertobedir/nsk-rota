import nodemailer from "nodemailer";

// Determine secure flag based on port
const port = Number(process.env.SMTP_PORT || 587);
const secure = port === 465; // Only 465 uses TLS, others use STARTTLS

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false, // port 25 için false
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS || "",
  },
  tls: {
    rejectUnauthorized: false, // self-signed sertifika için
  },
});

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  firstName,
}: {
  to: string;
  resetUrl: string;
  firstName: string;
}) {
  try {
    await transporter.sendMail({
      from: `"Rota USA" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      to,
      subject: "Password Reset Request",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Password Reset Request</h2>
          <p>Hello ${firstName},</p>
          <p>We received a request to reset your password. Click the button below to create a new password:</p>
          <a href="${resetUrl}" style="
            display: inline-block;
            background-color: #000000;
            color: #ffffff;
            padding: 12px 24px;
            text-decoration: none;
            border-radius: 4px;
            margin: 20px 0;
            font-weight: bold;
          ">
            Reset Password
          </a>
          <p>Or copy and paste this link in your browser:</p>
          <p style="word-break: break-all; color: #666;">${resetUrl}</p>
          <p>This link will expire in 1 hour.</p>
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            If you did not request a password reset, please ignore this email. Your account remains secure.
          </p>
        </div>
      `,
      text: `
Hello ${firstName},

We received a request to reset your password. Click the link below to create a new password:

${resetUrl}

This link will expire in 1 hour.

If you did not request a password reset, please ignore this email. Your account remains secure.
      `,
    });
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
}
