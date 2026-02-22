/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

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

    if (!message || !query) {
      return NextResponse.json(
        { ok: false, error: "Missing query or message" },
        { status: 400 },
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
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
          port: Number(process.env.SMTP_PORT || 587),
          secure: String(process.env.SMTP_SECURE || "false") === "true",
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          },
        });

        const info = await transporter.sendMail({
          from: fromEmail,
          to: adminEmail,
          subject: `Product request: ${String(query)}`,
          html: `<p><strong>Query:</strong> ${escapeHtml(
            String(query),
          )}</p><p>${escapeHtml(String(message)).replace(/\n/g, "<br />")}</p>`,
        });

        results.smtp = { ok: true, info: info?.messageId ?? info };
      } catch (e: any) {
        results.smtp = { ok: false, error: String(e?.message ?? e) };
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
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: fromEmail,
            to: adminEmail,
            subject: `Product request: ${String(query)}`,
            html: `<p><strong>Query:</strong> ${escapeHtml(
              String(query),
            )}</p><p>${escapeHtml(String(message)).replace(
              /\n/g,
              "<br />",
            )}</p>`,
          }),
        });

        if (!resp.ok) {
          const t = await resp.text().catch(() => "");
          results.resend = { ok: false, status: resp.status, error: t };
        } else {
          const json = await resp.json().catch(() => null);
          results.resend = { ok: true, data: json };
        }
      } catch (e: any) {
        results.resend = { ok: false, error: String(e?.message ?? e) };
      }
    } else {
      results.resend = {
        ok: false,
        error: "RESEND_API_KEY or FROM_EMAIL not configured/invalid",
      };
    }

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: String(e?.message ?? e) },
      { status: 500 },
    );
  }
}
