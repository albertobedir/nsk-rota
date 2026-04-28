import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcrypt";
import nodemailer from "nodemailer";
import prisma from "@/lib/prisma/instance";
import { getValidAdminEmails } from "@/lib/email/admin-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyShopifyWebhook(req: NextRequest, rawBody: string): boolean {
  const hmacHeader = req.headers.get("X-Shopify-Hmac-Sha256");
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;
  if (!hmacHeader || !secret) return false;

  const hash = crypto
    .createHmac("sha256", secret)
    .update(rawBody, "utf8")
    .digest("base64");

  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hmacHeader));
}

const generateRandomPassword = (length = 12): string =>
  crypto.randomBytes(length).toString("base64").slice(0, length);

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    if (!verifyShopifyWebhook(req, rawBody)) {
      console.warn("[🔗 Customer Create Webhook] Invalid HMAC signature");
      return NextResponse.json({ error: "Invalid HMAC" }, { status: 401 });
    }

    const customer = JSON.parse(rawBody);
    console.log("[🔗 Customer Create Webhook] Received customer:", customer.id);

    const { email, first_name, last_name, phone, admin_graphql_api_id } =
      customer;
    const defaultAddress = customer.addresses?.[0];

    // ────────────────────────────────────────────────────────────────
    // 1. Check if user already exists (prevent duplicates)
    // ────────────────────────────────────────────────────────────────
    const existing = await prisma.user.findFirst({
      where: { shopifyCustomerId: admin_graphql_api_id },
    });

    if (existing) {
      console.log(
        "[🔗 Customer Create Webhook] User already exists, skipping:",
        email,
      );
      return NextResponse.json(
        { status: "already_exists", message: "User already in database" },
        { status: 200 },
      );
    }

    // ────────────────────────────────────────────────────────────────
    // 2. Generate password
    // ────────────────────────────────────────────────────────────────
    const plainPassword = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(plainPassword, 10);
    console.log("[🔗 Customer Create Webhook] Password generated");

    // ────────────────────────────────────────────────────────────────
    // 3. Set tax exempt via Admin API
    // ────────────────────────────────────────────────────────────────
    try {
      const taxRes = await fetch(
        `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!,
          },
          body: JSON.stringify({
            query: `mutation customerUpdate($input: CustomerInput!) {
              customerUpdate(input: $input) {
                customer { id taxExempt }
                userErrors { field message }
              }
            }`,
            variables: {
              input: { id: admin_graphql_api_id, taxExempt: true },
            },
          }),
        },
      );
      const taxData = await taxRes.json();
      if (taxData?.data?.customerUpdate?.userErrors?.length > 0) {
        console.warn(
          "[🔗 Customer Create Webhook] Tax exempt errors:",
          taxData.data.customerUpdate.userErrors,
        );
      } else {
        console.log("[🔗 Customer Create Webhook] Tax exempt set successfully");
      }
    } catch (err) {
      console.error("[🔗 Customer Create Webhook] Tax exempt error:", err);
      // non-blocking — continue even if tax exempt fails
    }

    // ────────────────────────────────────────────────────────────────
    // 4. Save user to Prisma
    // ────────────────────────────────────────────────────────────────
    const user = await prisma.user.create({
      data: {
        email,
        firstName: first_name || "",
        lastName: last_name || "",
        password: hashedPassword,
        role: "user",
        phone: phone || null,
        shopifyCustomerId: admin_graphql_api_id,

        // Address from webhook
        addressLine1: defaultAddress?.address1 || null,
        city: defaultAddress?.city || null,
        state: defaultAddress?.province_code || null,
        zip: defaultAddress?.zip || null,

        // Company fields (will be populated from update webhook)
        companyName: null,
        shopifyCompanyId: null,
      },
    });

    console.log("[🔗 Customer Create Webhook] User saved to DB:", user.id);

    // ────────────────────────────────────────────────────────────────
    // 5. Send welcome email
    // ────────────────────────────────────────────────────────────────
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),

      secure: false, // port 25 için doğru

      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || "",
      },

      requireTLS: false, // 🔥 EKLE (çok önemli)

      tls: {
        rejectUnauthorized: false,
      },

      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 20000,
    });

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #0a66c2 0%, #0066a1 100%); padding: 24px; color: #fff;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 600;">👋 Welcome to Rota USA</h2>
          </div>
          
          <div style="padding: 24px;">
            <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px; line-height: 1.6;">
              Hello <strong>${escapeHtml(first_name || "there")}</strong>,
            </p>

            <p style="margin: 0 0 20px 0; color: #334155; font-size: 14px; line-height: 1.6;">
              Your portal account has been created and is ready to use. You can log in with the credentials below.
            </p>

            <div style="margin-bottom: 20px;">
              <p style="margin: 0 0 12px 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Login Credentials</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 12px; font-weight: 600;">EMAIL</span><br>
                    <span style="color: #334155; font-size: 14px;">${escapeHtml(email)}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #64748b; font-size: 12px; font-weight: 600;">PASSWORD</span><br>
                    <span style="color: #1e293b; font-size: 14px; font-family: 'Courier New', monospace; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; display: inline-block;">${escapeHtml(plainPassword)}</span>
                  </td>
                </tr>
              </table>
            </div>

            <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin-bottom: 20px;">
              <p style="margin: 0; color: #92400e; font-size: 13px; line-height: 1.5;">
                <strong>⚠️ Security Notice:</strong> Please save your password securely. We recommend changing it on your first login.
              </p>
            </div>

            <p style="text-align: center; margin-bottom: 20px;">
              <a href="https://rota-usa.com/auth/login" style="display: inline-block; padding: 12px 28px; background: #0a66c2; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Log In Now</a>
            </p>

            <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.6;">
              If you have any questions or need assistance, please contact our support team at 
              <a href="mailto:support@rota-usa.com" style="color: #0a66c2; text-decoration: none; font-weight: 600;">support@rota-usa.com</a>.
            </p>
          </div>

          <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #64748b; font-size: 12px;">Rota USA Portal • <a href="https://rota-usa.com" style="color: #0a66c2; text-decoration: none;">rota-usa.com</a></p>
          </div>
        </div>
      </div>
    `;

    await new Promise((resolve, reject) => {
      transporter.sendMail(
        {
          from: process.env.FROM_EMAIL,
          to: email,
          subject: "Welcome to Rota USA — Your Account is Ready",
          html,
        },
        (err, info) => {
          if (err) {
            console.error(
              "[🔗 Customer Create Webhook] Welcome email error:",
              err,
            );
            reject(err);
          } else {
            console.log(
              "[🔗 Customer Create Webhook] Welcome email sent to:",
              email,
              "MessageID:",
              info?.messageId,
            );
            resolve(info);
          }
        },
      );
    });

    // ────────────────────────────────────────────────────────────────
    // 6. Send admin notification email
    // ────────────────────────────────────────────────────────────────
    const adminEmails = getValidAdminEmails();
    if (adminEmails && adminEmails.length > 0) {
      try {
        const adminHtml = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="background: linear-gradient(135deg, #0a66c2 0%, #0066a1 100%); padding: 24px; color: #fff;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 600;">👤 New User Created</h2>
              </div>
              
              <div style="padding: 24px;">
                <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px; line-height: 1.6;">
                  A new user account has been created in the Rota USA system.
                </p>

                <div style="margin-bottom: 20px;">
                  <p style="margin: 0 0 12px 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">User Information</p>
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                        <span style="color: #64748b; font-size: 12px; font-weight: 600;">NAME</span><br>
                        <span style="color: #1e293b; font-weight: 600; font-size: 15px;">${escapeHtml(`${first_name || ""} ${last_name || ""}`.trim())}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                        <span style="color: #64748b; font-size: 12px; font-weight: 600;">EMAIL</span><br>
                        <span style="color: #334155; font-size: 14px;">${escapeHtml(email)}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                        <span style="color: #64748b; font-size: 12px; font-weight: 600;">PHONE</span><br>
                        <span style="color: #334155; font-size: 14px;">${phone ? escapeHtml(phone) : "—"}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0;">
                        <span style="color: #64748b; font-size: 12px; font-weight: 600;">LOGIN CREDENTIALS</span><br>
                        <span style="color: #1e293b; font-size: 14px; font-family: 'Courier New', monospace; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; display: inline-block;">${escapeHtml(plainPassword)}</span>
                      </td>
                    </tr>
                  </table>
                </div>

                <div style="background: #f0f9ff; border-left: 4px solid #0a66c2; padding: 12px 16px; border-radius: 4px;">
                  <p style="margin: 0; color: #0369a1; font-size: 13px; line-height: 1.5;">
                    <strong>ℹ️ Note:</strong> The user's password has been securely generated. They will be prompted to set a new password on first login.
                  </p>
                </div>
              </div>

              <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #64748b; font-size: 12px;">Rota USA Admin • <a href="https://rota-usa.com/admin" style="color: #0a66c2; text-decoration: none;">admin.rota-usa.com</a></p>
              </div>
            </div>
          </div>
        `;

        const adminPromises = adminEmails.map(
          (adminEmail) =>
            new Promise((resolve, reject) => {
              transporter.sendMail(
                {
                  from: process.env.FROM_EMAIL,
                  to: adminEmail,
                  subject: `New User Created: ${escapeHtml(`${first_name || ""} ${last_name || ""}`.trim())}`,
                  html: adminHtml,
                },
                (err, info) => {
                  if (err) {
                    console.error(
                      `[🔗 Customer Create Webhook] Failed to send admin email to ${adminEmail}:`,
                      err,
                    );
                    reject(err);
                  } else {
                    console.log(
                      `[🔗 Customer Create Webhook] Admin email sent to ${adminEmail}:`,
                      info?.messageId,
                    );
                    resolve(info);
                  }
                },
              );
            }),
        );

        await Promise.all(adminPromises);
        console.log(
          "[🔗 Customer Create Webhook] All admin notification emails sent successfully",
        );
      } catch (adminErr) {
        console.error(
          "[🔗 Customer Create Webhook] Failed to send admin emails:",
          adminErr,
        );
        // Non-blocking — don't fail the entire flow if admin email fails
      }
    }

    return NextResponse.json(
      {
        status: "ok",
        message: "User created and welcome email sent",
        userId: user.id,
        email: user.email,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error(
      "[🔗 Customer Create Webhook] Unexpected error:",
      err instanceof Error ? err.message : String(err),
    );
    return NextResponse.json(
      {
        error: "Internal server error",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
