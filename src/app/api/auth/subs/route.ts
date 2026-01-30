"use server";

import prisma from "@/lib/prisma/instance";
import { subscribeSchema } from "@/schemas/subscribe.schema";
import { NextResponse } from "next/server";
import { Resend } from "resend";
// import nodemailer from "nodemailer";
import nodemailer from "nodemailer";

const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = subscribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VALIDATION_ERROR",
          details: parsed.error.format(),
        },
        { status: 400 },
      );
    }

    const { email, firstName, lastName } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "EMAIL_EXISTS", message: "Bu e-posta zaten kayıtlı." },
        { status: 409 },
      );
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (!adminEmail) {
      return NextResponse.json(
        { error: "CONFIG_ERROR", message: "ADMIN_EMAIL eksik." },
        { status: 500 },
      );
    }

    // HTML mail + button ekleme
    const html = `
      <div style="font-family:Arial, sans-serif; max-width:600px; margin:0 auto; padding:20px;">
        <h2 style="color:#0a66c2; margin-bottom:8px;">Yeni Üyelik Başvurusu</h2>
        <p style="margin:0 0 12px 0;">
          Portale yeni bir üyelik başvurusu yapıldı. İlgili kullanıcı Shopify Dashboard üzerinden eklenmelidir.
        </p>

        <table style="width:100%; border-collapse:collapse; margin-top:10px;">
          <tr>
            <td style="padding:6px 0; font-weight:600;">Ad:</td>
            <td>${firstName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; font-weight:600;">Soyad:</td>
            <td>${lastName}</td>
          </tr>
          <tr>
            <td style="padding:6px 0; font-weight:600;">E-posta:</td>
            <td>${normalizedEmail}</td>
          </tr>
        </table>

        <p style="margin-top:20px;">
          <a href="https://rota-usa.com/add-member?email=${encodeURIComponent(
            normalizedEmail,
          )}&firstName=${encodeURIComponent(
            firstName,
          )}&lastName=${encodeURIComponent(lastName)}"
             style="
               display:inline-block;
               padding:10px 20px;
               background-color:#0a66c2;
               color:white;
               text-decoration:none;
               border-radius:6px;
               font-weight:bold;
             ">
            Kullanıcıyı Kaydet
          </a>
        </p>

        <p style="font-size:12px; color:#666; margin-top:20px;">
          Bu e-posta otomatik olarak gönderilmiştir.
        </p>
      </div>
    `;

    // await resend.emails.send({
    //   from: "Acme <onboarding@resend.dev>",
    //   to: adminEmail,
    //   subject: "Yeni Üyelik Başvurusu",
    //   html,
    // });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: false, // 587 için false olacak
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS || "",
      },
    });

    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: adminEmail,
      subject: "Yeni Üyelik Başvurusu",
      html,
    });

    return NextResponse.json(
      { message: "Üyelik isteğiniz başarıyla iletildi." },
      { status: 200 },
    );
  } catch (error) {
    console.error("Subscribe API Error:", error);

    return NextResponse.json(
      { error: "SERVER_ERROR", message: "Bir hata oluştu." },
      { status: 500 },
    );
  }
}
