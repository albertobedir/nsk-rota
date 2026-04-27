/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getValidAdminEmails } from "@/lib/email/admin-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const query = body?.query ?? "";
    const message = body?.message ?? "";
    const customerName = body?.customerName ?? "";
    const customerEmail = body?.customerEmail ?? "";
    const customerPhone = body?.customerPhone ?? "";
    const customerId = body?.customerId ?? "";

    console.log("📥 [API] Received product request:", {
      query,
      message,
      customerName,
      customerEmail,
      customerPhone,
      customerId,
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
          secure: false, // port 25 için false
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || "",
          },
          tls: {
            rejectUnauthorized: false, // self-signed sertifika için
          },
        });

        // Tüm admin emaillerine gönder
        const smtpPromises = adminEmails.map((adminEmail) =>
          transporter.sendMail({
            from: fromEmail!,
            to: adminEmail,
            subject: `Product request: ${String(query)}`,
            html: `
              <p><strong>Query:</strong> ${escapeHtml(String(query))}</p>
              <p>${escapeHtml(String(message)).replace(/\n/g, "<br />")}</p>
              <hr />
              <h3>Customer Info</h3>
              <p><strong>Name:</strong> <a href="https://admin.shopify.com/store/${storeSlug}/customers/${escapeHtml(String(customerId))}">${escapeHtml(String(customerName))}</a></p>
              <p><strong>Email:</strong> ${escapeHtml(String(customerEmail))}</p>
              <p><strong>Phone:</strong> ${escapeHtml(String(customerPhone))}</p>
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
                <p><strong>Query:</strong> ${escapeHtml(String(query))}</p>
                <p>${escapeHtml(String(message)).replace(/\n/g, "<br />")}</p>
                <hr />
                <h3>Customer Info </h3>
                <p><strong>Name:</strong> <a href="https://admin.shopify.com/store/${storeSlug}/customers/${escapeHtml(String(customerId))}">${escapeHtml(String(customerName))}</a></p>
                <p><strong>Email:</strong> ${escapeHtml(String(customerEmail))}</p>
                <p><strong>Phone:</strong> ${escapeHtml(String(customerPhone))}</p>
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
