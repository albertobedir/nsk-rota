/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import jwt from "jsonwebtoken";
import prisma from "@/lib/prisma/instance";
import { getValidAdminEmails } from "@/lib/email/admin-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET ?? "";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Extract numeric ID from GID format (e.g., "gid://shopify/Customer/9931718623535" -> "9931718623535")
function extractNumericId(gid: string): string {
  if (!gid) return "";
  const match = gid.match(/\/(\d+)$/);
  return match ? match[1] : gid;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const query = body?.query ?? "";
    const message = body?.message ?? "";

    // Extract user from session (via JWT token)
    let authenticatedUser: any = null;
    try {
      const token = request.cookies.get("access_token")?.value;
      if (token) {
        const payload = jwt.verify(token, ACCESS_TOKEN_SECRET) as any;
        const userId = payload?.id;
        if (userId) {
          authenticatedUser = await prisma.user.findUnique({
            where: { id: String(userId) },
          });
        }
      }
    } catch (e) {
      console.debug("[API] Failed to extract authenticated user:", e);
    }

    // Use authenticated user data if available, otherwise fall back to body data
    const customerName =
      authenticatedUser && authenticatedUser.firstName
        ? `${authenticatedUser.firstName}${authenticatedUser.lastName ? ` ${authenticatedUser.lastName}` : ""}`.trim()
        : (body?.customerName ?? "");
    const customerEmail = authenticatedUser?.email ?? body?.customerEmail ?? "";
    const customerPhone = authenticatedUser?.phone ?? body?.customerPhone ?? "";
    const customerId =
      authenticatedUser?.shopifyCustomerId ?? body?.customerId ?? "";

    // Extract company information from authenticated user
    const companyName = authenticatedUser?.companyName ?? null;
    const companyAddress = authenticatedUser?.companyAddress1 ?? null;
    const companyCity = authenticatedUser?.companyCity ?? null;
    const companyState = authenticatedUser?.companyState ?? null;
    const companyZip = authenticatedUser?.companyZip ?? null;

    console.log("📥 [API] Received product request:", {
      query,
      message,
      customerName,
      customerEmail,
      customerPhone,
      customerId,
      companyName,
      companyCity,
      fromAuthenticated: !!authenticatedUser,
    });

    if (!message || !query) {
      console.error("❌ [API] Validation failed: Missing query or message");
      return NextResponse.json(
        { ok: false, error: "Missing query or message" },
        { status: 400 },
      );
    }

    const adminEmails = getValidAdminEmails();
    if (!adminEmails || adminEmails.length === 0) {
      return NextResponse.json(
        { ok: false, error: "ADMIN_EMAILS not configured" },
        { status: 500 },
      );
    }

    const storeSlug = process.env.SHOPIFY_STORE_SLUG ?? "nsk-rota";
    const siteDomain = process.env.NEXT_PUBLIC_SITE_DOMAIN;
    // Prefer explicit FROM_EMAIL; otherwise only use site domain if it's not example.com
    let fromEmail =
      process.env.FROM_EMAIL ??
      (siteDomain ? `no-reply@${siteDomain}` : undefined);
    // Do not attempt to send from example.com placeholder addresses
    if (fromEmail && fromEmail.includes("example.com")) {
      fromEmail = undefined;
    }

    const results: Record<string, any> = {};

    // Send via SMTP (nodemailer) if configured and FROM is valid
    if (process.env.SMTP_HOST && process.env.SMTP_USER && fromEmail) {
      try {
        // lazy import to avoid failing when dependency absent during build

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

        // Tüm admin emaillerine gönder
        const smtpPromises = adminEmails.map((adminEmail) =>
          transporter.sendMail({
            from: fromEmail!,
            to: adminEmail,
            subject: `Product request: ${String(query)}`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                  <div style="background: linear-gradient(135deg, #0a66c2 0%, #0066a1 100%); padding: 24px; color: #fff;">
                    <h2 style="margin: 0; font-size: 20px; font-weight: 600;">📦 New Product Request</h2>
                  </div>
                  
                  <div style="padding: 24px;">
                    <div style="margin-bottom: 20px;">
                      <p style="margin: 0 0 12px 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Product Query</p>
                      <div style="background: #f1f5f9; border-left: 4px solid #0a66c2; padding: 12px 16px; border-radius: 4px;">
                        <p style="margin: 0; color: #1e293b; font-weight: 600; font-size: 16px;">${escapeHtml(String(query))}</p>
                      </div>
                    </div>

                    <div style="margin-bottom: 20px;">
                      <p style="margin: 0 0 12px 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Message</p>
                      <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 4px; color: #334155; line-height: 1.6; white-space: pre-wrap;">
                        ${escapeHtml(String(message)).replace(/\n/g, "<br />")}
                      </div>
                    </div>

                    <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px;">
                      <p style="margin: 0 0 16px 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Customer Information</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            <span style="color: #64748b; font-size: 12px; font-weight: 600;">NAME</span><br>
                            <a href="https://admin.shopify.com/store/${storeSlug}/customers/${extractNumericId(String(customerId))}" style="color: #0a66c2; text-decoration: none; font-weight: 600; font-size: 15px;">${escapeHtml(String(customerName))}</a>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            <span style="color: #64748b; font-size: 12px; font-weight: 600;">EMAIL</span><br>
                            <a href="mailto:${escapeHtml(String(customerEmail))}" style="color: #0a66c2; text-decoration: none; font-size: 14px;">${escapeHtml(String(customerEmail))}</a>
                          </td>
                        </tr>
                        <tr>
                          <td style="padding: 10px 0;">
                            <span style="color: #64748b; font-size: 12px; font-weight: 600;">PHONE</span><br>
                            <span style="color: #334155; font-size: 14px;">${escapeHtml(String(customerPhone)) || "—"}</span>
                          </td>
                        </tr>
                      </table>
                    </div>

                    ${
                      companyName
                        ? `
                    <div style="margin-top: 20px;">
                      <p style="margin: 0 0 16px 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Company Information</p>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            <span style="color: #64748b; font-size: 12px; font-weight: 600;">COMPANY NAME</span><br>
                            <span style="color: #1e293b; font-weight: 600; font-size: 15px;">${escapeHtml(String(companyName))}</span>
                          </td>
                        </tr>
                        ${
                          companyAddress
                            ? `
                        <tr>
                          <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                            <span style="color: #64748b; font-size: 12px; font-weight: 600;">ADDRESS</span><br>
                            <span style="color: #334155; font-size: 14px;">${escapeHtml(String(companyAddress))}${companyCity ? `, ${escapeHtml(String(companyCity))}` : ""}${companyState ? ` ${escapeHtml(String(companyState))}` : ""}${companyZip ? ` ${escapeHtml(String(companyZip))}` : ""}</span>
                          </td>
                        </tr>
                        `
                            : ""
                        }
                      </table>
                    </div>
                    `
                        : ""
                    }
                  </div>

                  <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                    <p style="margin: 0; color: #64748b; font-size: 12px;">This is an automated message from Rota USA Portal</p>
                  </div>
                </div>
              </div>
            `,
          }),
        );

        const infos = await Promise.all(smtpPromises);
        results.smtp = { ok: true, info: infos.map((i) => i?.messageId ?? i) };
        console.log("📧 [API] SMTP emails sent successfully:", results.smtp);
      } catch (e: any) {
        results.smtp = { ok: false, error: String(e?.message ?? e) };
        console.error("📧 [API] SMTP error:", results.smtp);
      }
    } else {
      results.smtp = {
        ok: false,
        error: "SMTP not configured or FROM_EMAIL missing/invalid",
      };
    }

    // Send via Resend if API key provided and FROM is valid
    if (process.env.RESEND_API_KEY && fromEmail) {
      try {
        // Tüm admin emaillerine gönder
        const resendPromises = adminEmails.map((adminEmail) =>
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromEmail,
              to: adminEmail,
              subject: `Product request: ${String(query)}`,
              html: `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 20px;">
                  <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                    <div style="background: linear-gradient(135deg, #0a66c2 0%, #0066a1 100%); padding: 24px; color: #fff;">
                      <h2 style="margin: 0; font-size: 20px; font-weight: 600;">📦 New Product Request</h2>
                    </div>
                    
                    <div style="padding: 24px;">
                      <div style="margin-bottom: 20px;">
                        <p style="margin: 0 0 12px 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Product Query</p>
                        <div style="background: #f1f5f9; border-left: 4px solid #0a66c2; padding: 12px 16px; border-radius: 4px;">
                          <p style="margin: 0; color: #1e293b; font-weight: 600; font-size: 16px;">${escapeHtml(String(query))}</p>
                        </div>
                      </div>

                      <div style="margin-bottom: 20px;">
                        <p style="margin: 0 0 12px 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Message</p>
                        <div style="background: #f1f5f9; padding: 12px 16px; border-radius: 4px; color: #334155; line-height: 1.6; white-space: pre-wrap;">
                          ${escapeHtml(String(message)).replace(/\n/g, "<br />")}
                        </div>
                      </div>

                      <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 20px;">
                        <p style="margin: 0 0 16px 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Customer Information</p>
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                              <span style="color: #64748b; font-size: 12px; font-weight: 600;">NAME</span><br>
                              <a href="https://admin.shopify.com/store/${storeSlug}/customers/${extractNumericId(String(customerId))}" style="color: #0a66c2; text-decoration: none; font-weight: 600; font-size: 15px;">${escapeHtml(String(customerName))}</a>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                              <span style="color: #64748b; font-size: 12px; font-weight: 600;">EMAIL</span><br>
                              <a href="mailto:${escapeHtml(String(customerEmail))}" style="color: #0a66c2; text-decoration: none; font-size: 14px;">${escapeHtml(String(customerEmail))}</a>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding: 10px 0;">
                              <span style="color: #64748b; font-size: 12px; font-weight: 600;">PHONE</span><br>
                              <span style="color: #334155; font-size: 14px;">${escapeHtml(String(customerPhone)) || "—"}</span>
                            </td>
                          </tr>
                        </table>
                      </div>

                      ${
                        companyName
                          ? `
                      <div style="margin-top: 20px;">
                        <p style="margin: 0 0 16px 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Company Information</p>
                        <table style="width: 100%; border-collapse: collapse;">
                          <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                              <span style="color: #64748b; font-size: 12px; font-weight: 600;">COMPANY NAME</span><br>
                              <span style="color: #1e293b; font-weight: 600; font-size: 15px;">${escapeHtml(String(companyName))}</span>
                            </td>
                          </tr>
                          ${
                            companyAddress
                              ? `
                          <tr>
                            <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                              <span style="color: #64748b; font-size: 12px; font-weight: 600;">ADDRESS</span><br>
                              <span style="color: #334155; font-size: 14px;">${escapeHtml(String(companyAddress))}${companyCity ? `, ${escapeHtml(String(companyCity))}` : ""}${companyState ? ` ${escapeHtml(String(companyState))}` : ""}${companyZip ? ` ${escapeHtml(String(companyZip))}` : ""}</span>
                            </td>
                          </tr>
                          `
                              : ""
                          }
                        </table>
                      </div>
                      `
                          : ""
                      }
                    </div>

                    <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
                      <p style="margin: 0; color: #64748b; font-size: 12px;">This is an automated message from Rota USA Portal</p>
                    </div>
                  </div>
                </div>
              `,
            }),
          }),
        );

        const responses = await Promise.all(resendPromises);
        const resendResults = [];

        for (const resp of responses) {
          if (!resp.ok) {
            const t = await resp.text().catch(() => "");
            resendResults.push({ ok: false, status: resp.status, error: t });
          } else {
            const json = await resp.json().catch(() => null);
            resendResults.push({ ok: true, data: json });
          }
        }

        results.resend = { ok: true, results: resendResults };
        console.log(
          "📬 [API] Resend emails sent successfully:",
          results.resend,
        );
      } catch (e: any) {
        results.resend = { ok: false, error: String(e?.message ?? e) };
        console.error("📬 [API] Resend error:", results.resend);
      }
    } else {
      results.resend = {
        ok: false,
        error: "RESEND_API_KEY or FROM_EMAIL not configured/invalid",
      };
    }

    console.log("✅ [API] Email sending results:", results);
    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    console.error("❌ [API] Error during product request:", e);
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 },
    );
  }
}
