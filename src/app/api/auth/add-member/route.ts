/* eslint-disable @typescript-eslint/no-unused-vars */
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
  companyName: string;
  address1: string;
  city: string;
  state: string;
  zip: string;
};

const generateRandomPassword = (length: number = 12) =>
  crypto.randomBytes(length).toString("base64").slice(0, length);

export async function POST(req: Request) {
  try {
    console.log("Step 1: Reading request body");
    const body: CreateUserBody = await req.json();
    const {
      email,
      firstName,
      lastName,
      companyName,
      address1,
      city,
      state,
      zip,
    } = body;

    if (
      !email ||
      !firstName ||
      !lastName ||
      !companyName ||
      !address1 ||
      !city ||
      !state ||
      !zip
    ) {
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
    // Step 4.5: Set Tax Exempt via Admin API
    // -------------------------------
    console.log("Step 4.5: Setting tax exempt for customer");
    const shopifyCustomerId = shopifyCustomer.id; // gid://shopify/Customer/...

    const adminMutation = `
      mutation customerUpdate($input: CustomerInput!) {
        customerUpdate(input: $input) {
          customer {
            id
            taxExempt
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    try {
      const adminResponse = await fetch(
        `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!,
          },
          body: JSON.stringify({
            query: adminMutation,
            variables: {
              input: {
                id: shopifyCustomerId,
                taxExempt: true, // ✅ Vergi tahsil etme
              },
            },
          }),
        },
      );

      const adminData = await adminResponse.json();
      console.log("Step 4.5: Tax exempt response", JSON.stringify(adminData));

      if (adminData.data?.customerUpdate?.userErrors?.length > 0) {
        console.warn(
          "Step 4.5 Warning: Tax exempt setting had errors",
          adminData.data.customerUpdate.userErrors,
        );
      } else {
        console.log(
          "Step 4.5: Tax exempt set successfully for customer",
          shopifyCustomerId,
        );
      }
    } catch (taxErr) {
      console.error("Step 4.5 Error: Failed to set tax exempt", taxErr);
      // Continue anyway - don't fail the entire flow
    }

    // -------------------------------
    // Step 4.6: Create Company in Shopify
    // -------------------------------
    console.log("Step 4.6: Creating company for customer");
    let shopifyCompanyId: string | null = null;
    try {
      const companyRes = await fetch(
        `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!,
          },
          body: JSON.stringify({
            query: `mutation companyCreate($input: CompanyCreateInput!) {
              companyCreate(input: $input) {
                company { 
                  id 
                  name
                  locations(first: 1) { edges { node { id } } }
                }
                userErrors { field message }
              }
            }`,
            variables: {
              input: {
                company: { name: companyName },
                companyLocation: {
                  name: "Main Location",
                  billingSameAsShipping: true,
                  shippingAddress: {
                    address1: address1,
                    city: city,
                    countryCode: "US",
                    zoneCode: state,
                    zip: zip,
                  },
                },
              },
            },
          }),
        },
      );
      const companyData = await companyRes.json();
      const company = companyData?.data?.companyCreate?.company;
      console.log("Step 4.6: Company created", company);

      if (companyData.data?.companyCreate?.userErrors?.length > 0) {
        console.warn(
          "Step 4.6 Warning: Company creation had errors",
          companyData.data.companyCreate.userErrors,
        );
      } else {
        shopifyCompanyId = company?.id || null;
      }

      // Step 4.7: Assign Customer as Contact
      // -----------------------------------
      if (company?.id) {
        console.log("Step 4.7: Assigning customer as company contact");
        try {
          const contactRes = await fetch(
            `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2025-01/graphql.json`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Shopify-Access-Token":
                  process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!,
              },
              body: JSON.stringify({
                query: `mutation companyAssignCustomerAsContact($companyId: ID!, $customerId: ID!) {
                  companyAssignCustomerAsContact(companyId: $companyId, customerId: $customerId) {
                    companyContact {
                      id
                      customer { id email }
                      isMainContact
                    }
                    userErrors { field message }
                  }
                }`,
                variables: {
                  companyId: company.id,
                  customerId: shopifyCustomer.id,
                },
              }),
            },
          );
          const contactData = await contactRes.json();
          console.log(
            "Step 4.7: Contact assigned",
            JSON.stringify(contactData, null, 2),
          );

          if (
            contactData.data?.companyAssignCustomerAsContact?.userErrors
              ?.length > 0
          ) {
            console.warn(
              "Step 4.7 Warning: Contact assignment had errors",
              contactData.data.companyAssignCustomerAsContact.userErrors,
            );
          } else {
            console.log("Step 4.7: Customer assigned as contact successfully");
          }
        } catch (contactErr) {
          console.error("Step 4.7 Error: Failed to assign contact", contactErr);
          // Continue anyway - don't fail the entire flow
        }
      }
    } catch (companyErr) {
      console.error("Step 4.6 Error: Failed to create company", companyErr);
      // Continue anyway - don't fail the entire flow
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
        shopifyCustomerId: shopifyCustomer.id,
        companyName: companyName,
        shopifyCompanyId: shopifyCompanyId,

        // Company address
        companyAddress1: address1,
        companyCity: city,
        companyState: state,
        companyZip: zip,

        // User address (şirket adresi ile aynı)
        addressLine1: address1,
        city: city,
        state: state,
        zip: zip,
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
            <!-- Inline logo -->
            <svg viewBox="0 0 160 60" fill="currentColor" xmlns="http://www.w3.org/2000/svg" width="48" height="18" aria-hidden>
              <!-- SVG SAME -->
            </svg>
            <div style="color:#fff; font-weight:700; font-size:16px;">Rota USA</div>
          </div>

          <div style="padding:20px; color:#1f2937;">
            <h2 style="color:#0a66c2; margin:0 0 8px; font-size:20px;">Your Account Has Been Created</h2>
            <p style="margin:0 0 8px;">Hello ${user.firstName},</p>
            <p style="margin:0 0 12px; line-height:1.4;">Your portal account has been successfully created. You can find your login details below.</p>

            <table style="width:100%; border-collapse:collapse; margin-top:8px;">
              <tr>
                <td style="padding:8px 0; font-weight:700; width:120px; color:#111827;">Email</td>
                <td style="color:#374151;">${email}</td>
              </tr>
              <tr>
                <td style="padding:8px 0; font-weight:700; color:#111827;">Password</td>
                <td style="color:#374151;">${password}</td>
              </tr>
            </table>

            <p style="margin-top:20px;">
              <a href="https://rota-usa.com/auth/login" style="display:inline-block; padding:12px 20px; background:#0a66c2; color:#fff; text-decoration:none; border-radius:8px; font-weight:700;">Log In</a>
            </p>

            <p style="margin-top:18px; font-size:13px; color:#6b7280;">
              This email was sent automatically. Please store your password securely. For support, contact 
              <a href="mailto:support@rota-usa.com" style="color:#0a66c2; text-decoration:none;">support@rota-usa.com</a>.
            </p>
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
