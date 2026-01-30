"use server";

import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma/instance";
import { Resend } from "resend";
import bcrypt from "bcrypt";
import { shopifyFetch } from "@/lib/shopify/instance";
import nodemailer from "nodemailer";

const resend = new Resend(process.env.RESEND_API_KEY!);

type CreateUserBody = {
  email: string;
  firstName: string;
  lastName: string;
};

const generateRandomPassword = (length: number = 12) =>
  crypto.randomBytes(length).toString("base64").slice(0, length);

export async function POST(req: Request) {
  try {
    console.log("Step 1: Reading request body");
    const body: CreateUserBody = await req.json();
    const { email, firstName, lastName } = body;

    if (!email || !firstName || !lastName) {
      console.error("Step 1 Error: Missing required fields", body);
      return NextResponse.json(
        { message: "Missing required fields", received: body },
        { status: 400 },
      );
    }

    const password = generateRandomPassword();
    const hashedPassword = await bcrypt.hash(password, 10);
    console.log("Step 2: Generated and hashed password");

    // -------------------------------
    // Shopify Storefront API çağrısı
    // -------------------------------
    const mutation = `
      mutation customerCreate($input: CustomerCreateInput!) {
        customerCreate(input: $input) {
          customer {
            id
            email
            firstName
            lastName
          }
          customerUserErrors {
            code
            field
            message
          }
        }
      }
    `;
    const variables = { input: { email, firstName, lastName, password } };

    console.log("Step 3: Sending request to Shopify Storefront API");
    const response = await shopifyFetch({ query: mutation, variables });
    console.log("Step 4: Shopify response", JSON.stringify(response));

    const payload = response.data.customerCreate;
    const shopifyCustomer = payload.customer;
    const errors = payload.customerUserErrors;

    if (!shopifyCustomer || (errors && errors.length > 0)) {
      console.error("Step 4 Error: Shopify customer creation failed", errors);
      return NextResponse.json(
        { message: "Failed to create customer in Shopify", errors },
        { status: 400 },
      );
    }

    // -------------------------------
    // DB kaydı
    // -------------------------------
    console.log("Step 5: Saving user to DB");
    const user = await prisma.user.create({
      data: {
        id: shopifyCustomer.id,
        email: shopifyCustomer.email,
        firstName: shopifyCustomer.firstName || "",
        lastName: shopifyCustomer.lastName || "",
        role: "user",
        password: hashedPassword,
      },
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST!,
      port: Number(process.env.SMTP_PORT!),
      secure: false,
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS || "",
      },
    });

    // -------------------------------
    // Mail gönderimi
    // -------------------------------
    console.log("Step 6: Sending email via Resend");
    const html = `
      <div style="font-family:Arial; max-width:600px; margin:auto;">
        <h2>Hesabınız Oluşturuldu</h2>
        <p>Merhaba ${user.firstName},</p>
        <p>Portal hesabınız oluşturuldu.</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Şifre:</strong> ${password}</p>
        <p style="margin-top:20px;">
          <a href="https://your-portal.com/auth/login"
             style="display:inline-block; background:#0a66c2; color:white; padding:10px 20px; text-decoration:none; border-radius:5px; font-weight:bold;">
            Giriş Yap
          </a>
        </p>
        <p style="margin-top:20px; font-size:12px; color:#666;">Bu e-posta otomatik olarak gönderildi.</p>
      </div>
    `;

    // await resend.emails.send({
    //   from: "Acme <onboarding@resend.dev>",
    //   // to: user.email,
    //   to: "phontemalberto@gmail.com",
    //   subject: "Yeni Hesap Bilgileriniz",
    //   html,
    // });

    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: user.email,
      subject: "Yeni Hesap Bilgileriniz",
      html,
    });

    console.log("Step 7: All steps completed successfully");

    return NextResponse.json(
      { message: "User created & email sent", user },
      { status: 201 },
    );
  } catch (err) {
    console.error("Step 0 Error: Unexpected server error", err);
    return NextResponse.json(
      {
        message: "Server error",
        details: err instanceof Error ? err.message : JSON.stringify(err),
      },
      { status: 500 },
    );
  }
}
