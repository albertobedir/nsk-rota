import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma/instance";
import { shopifyFetch } from "@/lib/shopify/instance";
import nodemailer from "nodemailer";
import { getValidAdminEmails } from "@/lib/email/admin-emails";

// Email transporter
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

export async function POST(request: NextRequest) {
  try {
    const { shopifyResetUrl, password } = await request.json();

    console.log("🔄 Reset password request received");

    if (!shopifyResetUrl || !password) {
      return NextResponse.json(
        { message: "Reset URL and password are required." },
        { status: 400 },
      );
    }

    if (password.length < 5) {
      return NextResponse.json(
        { message: "Password must be at least 5 characters." },
        { status: 400 },
      );
    }

    console.log("🔗 Shopify reset URL:", shopifyResetUrl);
    console.log("📋 Password length:", password.length);

    // Step 1: Update password in Shopify using Storefront API
    console.log("📋 Step 1: Updating password in Shopify");

    const resetByUrlMutation = `
      mutation customerResetByUrl($resetUrl: URL!, $password: String!) {
        customerResetByUrl(resetUrl: $resetUrl, password: $password) {
          customerAccessToken {
            accessToken
            expiresAt
          }
          customerUserErrors {
            code
            field
            message
          }
        }
      }
    `;

    const shopifyResetRes = await shopifyFetch({
      query: resetByUrlMutation,
      variables: { resetUrl: shopifyResetUrl, password },
    });

    console.log(
      "📥 Shopify reset response:",
      JSON.stringify(shopifyResetRes, null, 2),
    );

    const resetErrors =
      shopifyResetRes?.data?.customerResetByUrl?.customerUserErrors;
    if (resetErrors && resetErrors.length > 0) {
      console.error("❌ Shopify reset errors:", resetErrors);
      return NextResponse.json(
        { message: "Reset link is invalid or has expired." },
        { status: 400 },
      );
    }

    const shopifyToken =
      shopifyResetRes?.data?.customerResetByUrl?.customerAccessToken;
    if (!shopifyToken) {
      console.error("❌ No access token from Shopify");
      return NextResponse.json(
        { message: "Failed to reset password. Please try again." },
        { status: 500 },
      );
    }

    console.log("✅ Shopify password updated successfully");

    // Step 2: Get customer email using access token
    console.log("📋 Step 2: Fetching customer email from Shopify");

    const customerQuery = `
      query getCustomer($customerAccessToken: String!) {
        customer(customerAccessToken: $customerAccessToken) {
          id
          email
        }
      }
    `;

    const customerRes = await shopifyFetch({
      query: customerQuery,
      variables: { customerAccessToken: shopifyToken.accessToken },
    });

    console.log(
      "📥 Customer query response:",
      JSON.stringify(customerRes, null, 2),
    );

    const shopifyCustomer = customerRes?.data?.customer;
    if (!shopifyCustomer?.email) {
      console.error("❌ Could not fetch customer email");
      return NextResponse.json(
        { message: "Could not update local password. Please contact support." },
        { status: 500 },
      );
    }

    console.log("✅ Customer email fetched:", shopifyCustomer.email);

    // Step 3: Update password in Prisma
    console.log("📋 Step 3: Updating password in Prisma");

    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { email: shopifyCustomer.email },
      data: { password: hashedPassword },
    });

    console.log("✅ Prisma password updated for:", shopifyCustomer.email);

    // Step 4: Send admin notification email to all admins
    console.log("📧 Step 4: Sending admin notification emails");

    try {
      const adminEmails = getValidAdminEmails();
      if (!adminEmails || adminEmails.length === 0) {
        console.warn(
          "⚠️  ADMIN_EMAILS not configured, skipping admin notification",
        );
      } else {
        const emailPromises = adminEmails.map((adminEmail) =>
          transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to: adminEmail,
            subject: "🔐 Customer Password Reset Notification",
            html: `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #333;">Password Reset Notification</h2>
    <p>A customer has successfully reset their password:</p>

    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Email:</strong> ${shopifyCustomer.email}</p>
      <p>
        <strong>New Password:</strong> 
        <code style="background: #fff; padding: 2px 6px; border-radius: 3px; font-family: monospace; font-weight: bold;">
          ${password}
        </code>
      </p>
      <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
    </div>

    <p style="color: #666; font-size: 12px;">
      This is an automated notification. If you suspect any unauthorized access, please review this account immediately.
    </p>
  </div>
`,
            text: `Customer ${shopifyCustomer.email} has successfully reset their password to: ${password}\nDate: ${new Date().toLocaleString()}`,
          }),
        );

        await Promise.all(emailPromises);
        console.log(
          "✅ Admin notification emails sent to:",
          adminEmails.join(", "),
        );
      }
    } catch (emailError) {
      console.error(
        "⚠️  Failed to send admin notification emails:",
        emailError,
      );
      // Don't fail the request if email fails - password is already reset
    }

    return NextResponse.json({
      message: "Password has been successfully reset. You can now log in.",
    });
  } catch (err) {
    console.error("❌ Reset password error:", err);
    return NextResponse.json(
      { message: "An error occurred. Please try again later." },
      { status: 500 },
    );
  }
}
