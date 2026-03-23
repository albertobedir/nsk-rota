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

    // -------------------------------
    // Mail gönderimi
    // -------------------------------
    console.log("Step 6: Sending email via Resend");
    const html = `
      <div style="font-family:Arial, sans-serif; background:#f4f6f8; padding:28px;">
        <div style="max-width:600px; margin:0 auto; background:#fff; border-radius:8px; overflow:hidden; box-shadow:0 6px 18px rgba(15,23,42,0.06);">
          <div style="display:flex; align-items:center; gap:12px; padding:16px 18px; background:linear-gradient(90deg,#0a66c2,#0066a1);">
            <!-- Inline logo from src/components/logo.tsx -->
            <svg viewBox="0 0 160 60" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="48" height="18" aria-hidden>
               <path d="M37.9896 44.2709L37.8045 44.0359C38.7035 43.857 39.575 43.5601 40.3963 43.153C40.8917 42.9069 41.3677 42.6237 41.8203 42.3057C43.1302 41.3618 44.1969 40.1199 44.9323 38.6825C45.6677 37.2452 46.0507 35.6536 46.0498 34.039V33.327C46.0507 31.9855 45.7873 30.657 45.2746 29.4174C44.7619 28.1778 44.0099 27.0514 43.0617 26.1025C42.1135 25.1536 40.9876 24.4008 39.7483 23.8873C38.509 23.3737 37.1807 23.1094 35.8393 23.1094H18.5156V58.9315H28.2206V44.9117L37.6193 58.8888H49.6384L38.1249 44.4417L37.9896 44.2709ZM35.6613 35.342C35.6475 35.476 35.6261 35.6092 35.5972 35.7408C35.5972 35.7408 35.5972 35.8048 35.5972 35.8333C35.4648 36.4395 35.2135 37.0134 34.8579 37.5219C34.5022 38.0303 34.0492 38.4632 33.5252 38.7954C32.7811 39.2635 31.9193 39.5105 31.0402 39.5074H28.2206V30.1798H31.026C31.5272 30.1797 32.025 30.2614 32.4999 30.4219L32.5995 30.4575L32.8701 30.5643C32.9613 30.5998 33.0494 30.6427 33.1336 30.6925L33.3614 30.8135H33.4113C34.0779 31.2128 34.6343 31.7724 35.0297 32.4414C35.4251 33.1104 35.6471 33.8676 35.6755 34.6442V34.7012C35.6788 34.7391 35.6788 34.7772 35.6755 34.8151C35.6826 35.0216 35.6755 35.1854 35.6613 35.342Z" fill="currentColor"/>
               <path d="M156.122 26.5906C156.396 26.4944 156.641 26.3302 156.834 26.1135C157.021 25.9023 157.118 25.6263 157.105 25.3445C157.11 25.1439 157.064 24.9452 156.97 24.7678C156.865 24.5973 156.714 24.4592 156.535 24.3691C156.367 24.273 156.18 24.2124 155.987 24.1911C155.751 24.1622 155.513 24.1503 155.275 24.1555H153.645V28.4276H154.705V26.8469H155.126L156.429 28.4276H157.781L156.122 26.5906ZM155.852 25.729C155.808 25.8081 155.75 25.8781 155.681 25.9355C155.588 25.9977 155.484 26.0412 155.375 26.0637C155.223 26.0799 155.071 26.0799 154.919 26.0637H154.663V24.896H154.997C155.121 24.8845 155.244 24.8845 155.368 24.896C155.468 24.9041 155.565 24.9332 155.652 24.9814C155.734 25.0146 155.802 25.075 155.845 25.1523C155.883 25.2302 155.904 25.315 155.909 25.4015C155.909 25.5132 155.89 25.6241 155.852 25.729Z" fill="currentColor"/>
               <path d="M158.36 23.3596C157.757 22.7594 156.991 22.351 156.157 22.1857C155.323 22.0204 154.458 22.1057 153.673 22.4308C152.887 22.7559 152.215 23.3063 151.741 24.0126C151.268 24.7189 151.014 25.5496 151.012 26.3999C151.012 27.5424 151.466 28.6381 152.273 29.446C153.081 30.2538 154.177 30.7077 155.319 30.7077C156.462 30.7077 157.558 30.2538 158.366 29.446C159.173 28.6381 159.627 27.5424 159.627 26.3999C159.637 25.8332 159.529 25.2706 159.311 24.7474C159.093 24.2242 158.769 23.7517 158.36 23.3596ZM157.691 28.7852C157.383 29.1026 157.014 29.3549 156.607 29.5272C156.199 29.6995 155.762 29.7883 155.319 29.7883C154.877 29.7883 154.44 29.6995 154.032 29.5272C153.625 29.3549 153.256 29.1026 152.948 28.7852C152.32 28.1505 151.967 27.2933 151.967 26.3999C151.967 25.5065 152.32 24.6493 152.948 24.0146C153.256 23.6973 153.625 23.4449 154.032 23.2726C154.44 23.1003 154.877 23.0115 155.319 23.0115C155.762 23.0115 156.199 23.1003 156.607 23.2726C157.014 23.4449 157.383 23.6973 157.691 24.0146C158.004 24.3275 158.253 24.6993 158.423 25.1086C158.593 25.5179 158.681 25.9567 158.681 26.3999C158.681 26.8431 158.593 27.2819 158.423 27.6913C158.253 28.1006 158.004 28.4723 157.691 28.7852Z" fill="currentColor"/>
               <path d="M69.9446 22.2617C59.2642 22.2617 50.5703 30.7206 50.5703 41.1661C50.5703 51.6115 59.2428 59.9992 69.9446 59.9992C80.6464 59.9992 89.326 51.5403 89.326 41.1091C89.326 30.6779 80.6464 22.2617 69.9446 22.2617ZM69.9446 50.9422C68.0121 50.938 66.1241 50.3615 64.5189 49.2855C62.9136 48.2095 61.663 46.6822 60.9247 44.8962C60.1865 43.1103 59.9937 41.1457 60.3708 39.2503C60.7478 37.3549 61.6777 35.6137 63.0432 34.2462C64.4087 32.8787 66.1486 31.9463 68.0435 31.5665C69.9383 31.1867 71.9032 31.3766 73.6902 32.1123C75.4772 32.8479 77.0063 34.0963 78.0847 35.7C79.163 37.3037 79.7422 39.1908 79.7492 41.1234C79.7455 43.7206 78.7106 46.21 76.8721 48.0446C75.0335 49.8791 72.5418 50.9085 69.9446 50.9066V50.9422Z" fill="currentColor"/>
               <path d="M145.649 52.8005L147.785 58.8456H158.508L144.453 23.0234H133.43L119.375 58.8456H130.098L132.234 52.8005H145.62H145.649ZM139.063 34.0171L142.915 45.196H134.997L138.963 34.0171H139.063Z" fill="currentColor"/>
               <path d="M118.476 23.0664H117.6H91.8673H90.9844V31.4327H99.9915V58.7889H109.725V31.4327H118.476V23.0664Z" fill="currentColor"/>
               <path d="M18.1159 9.6664C18.0694 9.7042 18.0159 9.73246 17.9585 9.74957C17.9011 9.76667 17.8408 9.77228 17.7812 9.76608V9.84441H18.8137V9.76608H18.7425C18.6479 9.7661 18.5556 9.7362 18.479 9.68064C18.4382 9.63298 18.4076 9.57738 18.3892 9.51735C18.3708 9.45731 18.365 9.39412 18.3722 9.33174V7.47335L20.3232 9.90848H20.3944V7.47335C20.3775 7.37677 20.3775 7.278 20.3944 7.18143C20.4133 7.12928 20.4482 7.08442 20.4941 7.05326C20.5736 7.02003 20.6576 6.99845 20.7433 6.98918V6.91797H19.8177V6.98918C19.8817 6.98288 19.9464 6.99114 20.0068 7.01333C20.0672 7.03552 20.1218 7.07107 20.1665 7.11734C20.2226 7.22718 20.2473 7.35038 20.2377 7.47335V8.73364L18.8137 6.9251H17.8026V6.99629C17.8744 6.99641 17.9452 7.01349 18.0091 7.04614C18.0741 7.08621 18.1299 7.1396 18.1729 7.20279L18.2298 7.27398V9.33887C18.2365 9.4588 18.1956 9.5765 18.1159 9.6664Z" fill="currentColor"/>
               <path d="M7.91404 36.83L10.4773 34.9644C12.4427 36.4627 14.7687 37.4157 17.2202 37.7271L17.6617 37.7841V22.2191H32.9845L32.9062 21.7634C32.4369 19.0826 31.1774 16.6031 29.2891 14.6432L30.6206 12.0087L30.0439 11.5245L27.7013 13.2262C25.1273 11.2639 21.9617 10.237 18.7259 10.3146C15.4902 10.3923 12.3775 11.5699 9.9006 13.6534L7.41562 12.0585L6.86735 12.5783L8.35549 15.1843C6.41379 17.4243 5.25628 20.2368 5.0588 23.1946L2.16797 24.3196L2.26765 25.0673L5.11577 25.409C5.41492 28.4199 6.70752 31.2456 8.78983 33.4407L7.36577 36.3387L7.91404 36.83ZM9.72971 33.2698L9.53746 33.0704C7.39636 30.9011 6.09443 28.0424 5.86339 25.0032V24.6828L3.94804 24.4549L5.85628 23.7073V23.4581C6.00014 20.4923 7.1648 17.6674 9.15296 15.462L9.33809 15.2555L8.36973 13.5466L10.0074 14.6004L10.2281 14.4011C12.5974 12.3255 15.6199 11.1473 18.7688 11.0718C21.9177 10.9964 24.9932 12.0284 27.4592 13.9881L27.6871 14.1732L29.1966 13.0909L28.3421 14.8069L28.5344 14.9992C30.2992 16.7512 31.5184 18.977 32.0447 21.4074H23.9204L27.8081 14.9992L20.8872 20.2682L19.0858 11.6455L17.6119 20.1899L10.0074 15.3979L15.2123 22.5182L6.81039 24.3979L15.6182 25.7579L10.6838 32.9423L16.8571 28.7698V36.8727C14.6098 36.5069 12.494 35.5704 10.7123 34.1527L10.4773 33.9676L8.72575 35.2421L9.72971 33.2698Z" fill="currentColor"/>
               <path d="M22.332 4.9671C21.7482 4.88166 21.1501 4.81758 20.552 4.78909V3.15143H22.4531V1.61344C22.4541 1.51646 22.4242 1.42167 22.3676 1.34287C22.0272 0.916401 21.5933 0.573891 21.0995 0.341787C20.6057 0.109683 20.0651 -0.00579741 19.5195 0.00426459C18.9607 -0.0235572 18.4036 0.0850703 17.8962 0.320775C17.3888 0.556479 16.9465 0.912169 16.6073 1.35711C16.5583 1.43081 16.5335 1.51789 16.5361 1.60633V3.16566H18.5155V4.80333C17.9388 4.80333 17.3763 4.88878 16.8138 4.9671C12.0837 5.59777 7.75267 7.95193 4.65092 11.5784C1.54918 15.2048 -0.105092 19.8484 0.00517797 24.6191C0.115448 29.3899 1.9825 33.9521 5.24849 37.4313C8.51447 40.9106 12.9496 43.0621 17.7038 43.4736V41.9427C8.44747 41.0456 1.16342 33.3984 1.16342 24.142C1.16342 14.2804 9.38735 6.27723 19.5337 6.27723C29.018 6.27723 36.8147 13.2693 37.7973 22.2409H38.9935C38.5455 17.914 36.6613 13.8619 33.6414 10.731C30.6215 7.60007 26.6399 5.57086 22.332 4.9671Z" fill="currentColor"/>
            </svg>
            <div style="color:#fff; font-weight:700; font-size:16px;">Rota USA</div>
          </div>

          <div style="padding:20px; color:#1f2937;">
            <h2 style="color:#0a66c2; margin:0 0 8px; font-size:20px;">Hesabınız Oluşturuldu</h2>
            <p style="margin:0 0 8px;">Merhaba ${user.firstName},</p>
            <p style="margin:0 0 12px; line-height:1.4;">Portal hesabınız başarıyla oluşturuldu. Aşağıda giriş bilgilerinizi bulabilirsiniz.</p>

            <table style="width:100%; border-collapse:collapse; margin-top:8px;">
              <tr>
                <td style="padding:8px 0; font-weight:700; width:120px; color:#111827;">Email</td>
                <td style="color:#374151;">${email}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; font-weight:700; color:#111827;">Şifre</td>
                <td style="color:#374151;">${password}</td>
              </tr>
            </table>

            <p style="margin-top:20px;">
              <a href="https://rota-usa.com/auth/login" style="display:inline-block; padding:12px 20px; background:#0a66c2; color:#fff; text-decoration:none; border-radius:8px; font-weight:700;">Giriş Yap</a>
            </p>

            <p style="margin-top:18px; font-size:13px; color:#6b7280;">Bu e‑posta otomatik olarak gönderilmiştir. Şifrenizi güvenli bir yerde saklayın. Yardım için <a href="mailto:support@rota-usa.com" style="color:#0a66c2; text-decoration:none;">support@rota-usa.com</a>.</p>
          </div>

          <div style="background:#f7fafc; padding:12px 18px; font-size:12px; color:#6b7280; text-align:center;">
            Rota USA • <a href="https://rota-usa.com" style="color:#0a66c2; text-decoration:none;">rota-usa.com</a>
          </div>
        </div>
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
