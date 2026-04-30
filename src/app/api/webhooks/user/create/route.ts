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

async function createVerifiedTransporter() {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS || "",
    },
    requireTLS: true,
    tls: { rejectUnauthorized: false },
    connectionTimeout: 20000,
    greetingTimeout: 20000,
    socketTimeout: 20000,
  });

  console.log("[🔗 SMTP Config]", {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER ? "***" : "NOT SET",
    from: process.env.FROM_EMAIL,
  });

  try {
    await transporter.verify();
    console.log("[✅ SMTP Connection] Verified successfully");
  } catch (err) {
    console.error("[❌ SMTP Connection] Failed:", err);
  }

  return transporter;
}

async function sendEmailSafely(
  transporter: nodemailer.Transporter,
  mailOptions: nodemailer.SendMailOptions,
) {
  return new Promise<string>((resolve, reject) => {
    transporter.sendMail(mailOptions, (err, info) => {
      if (err) reject(err);
      else resolve(info?.messageId || "unknown");
    });
  });
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─────────────────────────────────────────
// Admin API helper
// ─────────────────────────────────────────
async function shopifyAdminFetch(query: string, variables: object) {
  const res = await fetch(
    `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  return res.json();
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
    // 1. Duplicate check
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
    // 3. taxExempt + password set
    // ────────────────────────────────────────────────────────────────
    try {
      const updateData = await shopifyAdminFetch(
        `mutation customerUpdate($input: CustomerInput!) {
          customerUpdate(input: $input) {
            customer { id taxExempt }
            userErrors { field message }
          }
        }`,
        {
          input: {
            id: admin_graphql_api_id,
            taxExempt: true,
            password: plainPassword,
            passwordConfirmation: plainPassword,
          },
        },
      );

      if (updateData?.data?.customerUpdate?.userErrors?.length > 0) {
        console.warn(
          "[🔗 Webhook] Update errors:",
          updateData.data.customerUpdate.userErrors,
        );
      } else {
        console.log("[🔗 Webhook] Password + taxExempt set successfully");
      }
    } catch (err) {
      console.error("[🔗 Webhook] customerUpdate error:", err);
      // non-blocking
    }

    // ────────────────────────────────────────────────────────────────
    // 4. Activate account (state: ENABLED)
    // ────────────────────────────────────────────────────────────────
    try {
      const activateData = await shopifyAdminFetch(
        `mutation customerUpdate($input: CustomerInput!) {
          customerUpdate(input: $input) {
            customer { id state }
            userErrors { field message }
          }
        }`,
        {
          input: {
            id: admin_graphql_api_id,
            state: "ENABLED",
          },
        },
      );

      const state = activateData?.data?.customerUpdate?.customer?.state;
      const errors = activateData?.data?.customerUpdate?.userErrors;

      if (errors?.length > 0) {
        console.warn("[🔗 Webhook] Activation errors:", errors);
      } else {
        console.log(
          "[🔗 Webhook] Account activated successfully ✅ State:",
          state,
        );
      }
    } catch (err) {
      console.error("[🔗 Webhook] Activation error:", err);
      // non-blocking
    }

    // ────────────────────────────────────────────────────────────────
    // 5. Save to DB
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
        addressLine1: defaultAddress?.address1 || null,
        city: defaultAddress?.city || null,
        state: defaultAddress?.province_code || null,
        zip: defaultAddress?.zip || null,
        companyName: null,
        shopifyCompanyId: null,
      },
    });

    console.log("[🔗 Customer Create Webhook] User saved to DB:", user.id);

    // ────────────────────────────────────────────────────────────────
    // 6. Early response (Shopify 5sn timeout)
    // ────────────────────────────────────────────────────────────────
    const response = NextResponse.json(
      { status: "ok", userId: user.id, email: user.email },
      { status: 200 },
    );

    // ────────────────────────────────────────────────────────────────
    // 7. Background emails
    // ────────────────────────────────────────────────────────────────
    (async () => {
      try {
        const transporter = await createVerifiedTransporter();

        const html = `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 20px;">
            <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
              <div style="background: linear-gradient(135deg, #0a66c2 0%, #0066a1 100%); padding: 24px; color: #fff;">
                <h2 style="margin: 0; font-size: 20px; font-weight: 600;">👋 Welcome to Rota USA</h2>
              </div>
              <div style="padding: 24px;">
                <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px;">Hello <strong>${escapeHtml(first_name || "there")}</strong>,</p>
                <p style="margin: 0 0 20px 0; color: #334155; font-size: 14px;">Your portal account has been created and is ready to use.</p>
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
                      <span style="color: #1e293b; font-size: 14px; font-family: monospace; background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">${escapeHtml(plainPassword)}</span>
                    </td>
                  </tr>
                </table>
                <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 4px; margin: 20px 0;">
                  <p style="margin: 0; color: #92400e; font-size: 13px;"><strong>⚠️ Security Notice:</strong> Please save your password securely.</p>
                </div>
                <p style="text-align: center;">
                  <a href="https://rota-usa.com/auth/login" style="display: inline-block; padding: 12px 28px; background: #0a66c2; color: #fff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">Log In Now</a>
                </p>
              </div>
              <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                <p style="margin: 0; color: #64748b; font-size: 12px;">Rota USA Portal • <a href="https://rota-usa.com" style="color: #0a66c2;">rota-usa.com</a></p>
              </div>
            </div>
          </div>
        `;

        // Welcome email
        try {
          const messageId = await sendEmailSafely(transporter, {
            from: process.env.FROM_EMAIL,
            to: email,
            subject: "Welcome to Rota USA — Your Account is Ready",
            html,
          });
          console.log(
            "[✅ Welcome Email] Sent to:",
            email,
            "MessageID:",
            messageId,
          );
        } catch (err) {
          console.error("[❌ Welcome Email] Failed:", err);
        }

        // Admin emails
        const adminEmails = getValidAdminEmails();
        if (adminEmails?.length > 0) {
          const adminHtml = `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 20px;">
              <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                <div style="background: linear-gradient(135deg, #0a66c2 0%, #0066a1 100%); padding: 24px; color: #fff;">
                  <h2 style="margin: 0; font-size: 20px; font-weight: 600;">👤 New User Created</h2>
                </div>
                <div style="padding: 24px;">
                  <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                        <span style="color: #64748b; font-size: 12px; font-weight: 600;">NAME</span><br>
                        <span style="color: #1e293b; font-weight: 600;">${escapeHtml(`${first_name || ""} ${last_name || ""}`.trim())}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                        <span style="color: #64748b; font-size: 12px; font-weight: 600;">EMAIL</span><br>
                        <span style="color: #334155;">${escapeHtml(email)}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                        <span style="color: #64748b; font-size: 12px; font-weight: 600;">PHONE</span><br>
                        <span style="color: #334155;">${phone ? escapeHtml(phone) : "—"}</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding: 10px 0;">
                        <span style="color: #64748b; font-size: 12px; font-weight: 600;">PASSWORD</span><br>
                        <span style="font-family: monospace; background: #f1f5f9; padding: 4px 8px; border-radius: 4px;">${escapeHtml(plainPassword)}</span>
                      </td>
                    </tr>
                  </table>
                </div>
                <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                  <p style="margin: 0; color: #64748b; font-size: 12px;">Rota USA Admin</p>
                </div>
              </div>
            </div>
          `;

          await Promise.all(
            adminEmails.map(async (adminEmail) => {
              try {
                const messageId = await sendEmailSafely(transporter, {
                  from: process.env.FROM_EMAIL,
                  to: adminEmail,
                  subject: `New User Created: ${escapeHtml(`${first_name || ""} ${last_name || ""}`.trim())}`,
                  html: adminHtml,
                });
                console.log(
                  "[✅ Admin Email] Sent to:",
                  adminEmail,
                  "MessageID:",
                  messageId,
                );
              } catch (err) {
                console.error(
                  `[❌ Admin Email] Failed to send to ${adminEmail}:`,
                  err,
                );
              }
            }),
          );
        }
      } catch (err) {
        console.error("[❌ Background Email] Critical error:", err);
      }
    })();

    return response;
  } catch (err) {
    console.error(
      "[🔗 Customer Create Webhook] Critical error:",
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
