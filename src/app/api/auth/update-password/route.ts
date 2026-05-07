/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import bcrypt from "bcrypt";
import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma/instance";
import { shopifyAdminFetch } from "@/lib/shopify/instance";
import nodemailer from "nodemailer";
import { getValidAdminEmails } from "@/lib/email/admin-emails";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET ?? "";

// 🔥 GLOBAL TRANSPORTER - pool ile connection reuse
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS || "",
  },
  pool: true, // 🔥 KRİTİK - connection reuse
  maxConnections: 1, // 🔥 KRİTİK - Outlook için düşük
  maxMessages: 10,
  requireTLS: false,
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,
});

export async function POST(request: NextRequest) {
  try {
    const { newPassword } = await request.json();

    console.log("🔄 Update password request received");

    if (!newPassword) {
      return NextResponse.json(
        { message: "New password is required." },
        { status: 400 },
      );
    }

    if (newPassword.length < 5) {
      return NextResponse.json(
        { message: "Password must be at least 5 characters." },
        { status: 400 },
      );
    }

    // Step 0: Get user from JWT token
    console.log("📋 Step 0: Verifying user authentication");

    const token = request.cookies.get("access_token")?.value;
    if (!token) {
      return NextResponse.json(
        { message: "User not authenticated." },
        { status: 401 },
      );
    }

    let payload: any = null;
    try {
      payload = jwt.verify(token, ACCESS_TOKEN_SECRET);
    } catch (e) {
      return NextResponse.json(
        { message: "Invalid or expired token." },
        { status: 401 },
      );
    }

    const userId = payload?.id;
    if (!userId) {
      return NextResponse.json(
        { message: "User not authenticated." },
        { status: 401 },
      );
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: String(userId) },
      select: { email: true, shopifyCustomerId: true },
    });

    if (!user) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    const userEmail = user.email;
    console.log("👤 Updating password for:", userEmail);

    // Step 1: Check if Shopify customer ID exists
    console.log("📋 Step 1: Checking Shopify customer ID");

    if (!user.shopifyCustomerId) {
      console.error("❌ Shopify customer ID not found");
      return NextResponse.json(
        { message: "Could not update password. Customer not found." },
        { status: 400 },
      );
    }

    // Step 2: Update password in Shopify using Admin API
    console.log("📋 Step 2: Updating password in Shopify");

    const updateCustomerMutation = `
      mutation updateCustomer($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer {
            id
            email
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const shopifyUpdateRes = await shopifyAdminFetch({
      query: updateCustomerMutation,
      variables: {
        input: {
          id: user.shopifyCustomerId,
          password: newPassword,
        },
      },
    });

    console.log(
      "📥 Shopify update response:",
      JSON.stringify(shopifyUpdateRes, null, 2),
    );

    // Check for top-level GraphQL errors
    const topLevelErrors = shopifyUpdateRes?.errors;
    if (topLevelErrors && topLevelErrors.length > 0) {
      console.error("❌ Shopify GraphQL errors:", topLevelErrors);
      return NextResponse.json(
        { message: "Failed to update password in Shopify." },
        { status: 400 },
      );
    }

    // Check for mutation-level errors (Admin API)
    const updateErrors = shopifyUpdateRes?.data?.customerUpdate?.userErrors;
    if (updateErrors && updateErrors.length > 0) {
      console.error("❌ Shopify update errors:", updateErrors);
      return NextResponse.json(
        { message: "Failed to update password in Shopify." },
        { status: 400 },
      );
    }

    // Step 3: Update password in Prisma
    console.log("📋 Step 3: Updating password in Prisma");

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: String(userId) },
      data: { password: hashedPassword },
    });

    console.log("✅ Prisma password updated for:", userEmail);

    // Step 4: Send admin notification email
    console.log("📧 Step 4: Sending admin notification emails");

    try {
      const adminEmails = getValidAdminEmails();
      if (!adminEmails || adminEmails.length === 0) {
        console.warn(
          "⚠️  ADMIN_EMAILS not configured, skipping admin notification",
        );
      } else {
        // 🔥 Sequential send - concurrent limit aşmamak için
        for (const adminEmail of adminEmails) {
          try {
            await transporter.sendMail({
              from: process.env.SMTP_FROM || process.env.SMTP_USER,
              to: adminEmail,
              subject: "🔐 Customer Password Update Notification",
              html: `
  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
    <h2 style="color: #333;">Password Update Notification</h2>
    <p>A customer has successfully updated their password:</p>

    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Email:</strong> ${userEmail}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleString()}</p>
    </div>

    <p style="color: #666; font-size: 12px;">
      This is an automated notification. If you suspect any unauthorized access, please review this account immediately.
    </p>
  </div>
`,
              text: `Customer ${userEmail} has successfully updated their password.\nDate: ${new Date().toLocaleString()}`,
            });
            console.log(
              "Step 4: Admin notification email sent to:",
              adminEmail,
            );

            // 200ms delay - SMTP stability
            await new Promise((r) => setTimeout(r, 200));
          } catch (err) {
            console.error(
              `Step 4 Error: Failed to send to ${adminEmail}:`,
              err,
            );
          }
        }
        console.log(
          "Step 4: All admin notification emails sent to:",
          adminEmails,
        );
      }
    } catch (emailError) {
      console.error(
        "⚠️  Failed to send admin notification emails:",
        emailError,
      );
      // Don't fail the request if email fails - password is already updated
    }

    return NextResponse.json({
      message: "Password has been successfully updated.",
      success: true,
    });
  } catch (err) {
    console.error("❌ Update password error:", err);
    return NextResponse.json(
      { message: "An error occurred. Please try again later." },
      { status: 500 },
    );
  }
}
