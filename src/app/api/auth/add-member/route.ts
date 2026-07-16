/* eslint-disable @typescript-eslint/no-unused-vars */
"use server";

import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma/instance";
import { Resend } from "resend";
import bcrypt from "bcrypt";
import { shopifyAdminFetch } from "@/lib/shopify/instance";
import nodemailer from "nodemailer";
import { getValidAdminEmails } from "@/lib/email/admin-emails";

const resend = new Resend(process.env.RESEND_API_KEY!);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS || "",
  },
  pool: true,
  maxConnections: 2,
  maxMessages: 50,
  requireTLS: false,
  tls: {
    rejectUnauthorized: false,
  },
  connectionTimeout: 20000,
  greetingTimeout: 20000,
  socketTimeout: 20000,
});

type CreateUserBody = {
  email: string;
  country?: "US" | "CA";
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export async function POST(req: Request) {
  try {
    console.log("Step 1: Reading request body");
    const body: CreateUserBody = await req.json();
    const {
      email,
      country = "US",
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
      !country ||
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

    const mutation = `
      mutation customerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer {
            id
            email
            firstName
            lastName
            addresses(first: 1) {
              country
              countryCodeV2
            }
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const variables = {
      input: {
        email,
        firstName,
        lastName,
        addresses: [
          {
            address1,
            city,
            countryCode: country,
            provinceCode: `${country}-${state}`,
            zip,
            company: companyName,
          },
        ],
      },
    };

    console.log("Step 3: Sending request to Shopify Admin API");
    const response = await shopifyAdminFetch({ query: mutation, variables });
    console.log("Step 4: Shopify response", JSON.stringify(response));

    const payload = response.data?.customerCreate;
    if (!payload) {
      console.error(
        "Step 4 Error: Shopify customerCreate payload missing",
        response,
      );
      return NextResponse.json(
        {
          message: "Failed to create customer in Shopify",
          errors: response.errors ?? [],
        },
        { status: 400 },
      );
    }

    const shopifyCustomer = payload.customer;
    const errors = payload.userErrors;

    if (!shopifyCustomer || (errors && errors.length > 0)) {
      console.error("Step 4 Error: Shopify customer creation failed", errors);
      return NextResponse.json(
        { message: "Failed to create customer in Shopify", errors },
        { status: 400 },
      );
    }

    console.log("Step 4.5: Setting tax exempt for customer");
    const shopifyCustomerId = shopifyCustomer.id;

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
                taxExempt: true,
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
    }

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
                    address1,
                    city,
                    countryCode: country,
                    zoneCode: state,
                    zip,
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
        }
      }
    } catch (companyErr) {
      console.error("Step 4.6 Error: Failed to create company", companyErr);
    }

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
        companyName,
        shopifyCompanyId,
        companyAddress1: address1,
        companyCity: city,
        companyState: state,
        companyZip: zip,
        addressLine1: address1,
        city,
        state,
        zip,
        billingAddress: {
          address1,
          city,
          state,
          zip,
          country,
        },
        shippingAddress: {
          address1,
          city,
          state,
          zip,
          country,
        },
      },
    });

    console.log("Step 6: Sending email via SMTP");
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <div style="background: linear-gradient(135deg, #0a66c2 0%, #0066a1 100%); padding: 24px; color: #fff;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 600;">👋 Welcome to Rota USA</h2>
          </div>

          <div style="padding: 24px;">
            <p style="margin: 0 0 16px 0; color: #334155; font-size: 14px; line-height: 1.6;">
              Hello <strong>${firstName || "there"}</strong>,
            </p>

            <p style="margin: 0 0 20px 0; color: #334155; font-size: 14px; line-height: 1.6;">
              Your portal account has been created and is ready to use. You can log in with the credentials below.
            </p>

            <div style="margin-bottom: 20px;">
              <p style="margin: 0 0 12px 0; color: #64748b; font-size: 13px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px;">Password</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px 0; border-bottom: 1px solid #e2e8f0;">
                    <span style="color: #64748b; font-size: 12px; font-weight: 600;">EMAIL</span><br>
                    <span style="color: #334155; font-size: 14px;">${email}</span>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 10px 0;">
                    <span style="color: #64748b; font-size: 12px; font-weight: 600;">PASSWORD</span><br>
                    <span style="color: #1e293b; font-size: 14px; font-family: 'Courier New', monospace; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; display: inline-block;">${password}</span>
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
              <a href="mailto:y.cankaya@nskgroup.com.tr" style="color: #0a66c2; text-decoration: none; font-weight: 600;">y.cankaya@nskgroup.com.tr</a>.
            </p>
          </div>

          <div style="background: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0; color: #64748b; font-size: 12px;">Rota USA Portal • <a href="https://rota-usa.com" style="color: #0a66c2; text-decoration: none;">rota-usa.com</a></p>
          </div>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: process.env.FROM_EMAIL,
      to: user.email,
      subject: "Your Account Information",
      html,
    });

    console.log("Step 7: User email sent successfully");

    const adminEmails = getValidAdminEmails();
    if (!adminEmails || adminEmails.length === 0) {
      console.warn("Step 8 Warning: No admin emails configured");
    } else {
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
                      <span style="color: #1e293b; font-weight: 600; font-size: 15px;">${escapeHtml(`${firstName || ""} ${lastName || ""}`.trim())}</span>
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
                      <span style="color: #64748b; font-size: 12px; font-weight: 600;">COMPANY</span><br>
                      <span style="color: #334155; font-size: 14px;">${escapeHtml(companyName || "—")}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 10px 0;">
                      <span style="color: #64748b; font-size: 12px; font-weight: 600;">PASSWORD</span><br>
                      <span style="color: #1e293b; font-size: 14px; font-family: 'Courier New', monospace; background: #f1f5f9; padding: 4px 8px; border-radius: 4px; display: inline-block;">${escapeHtml(password)}</span>
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

      for (const adminEmail of adminEmails) {
        try {
          await transporter.sendMail({
            from: process.env.FROM_EMAIL,
            to: adminEmail,
            subject: `New User Created: ${escapeHtml(`${firstName || ""} ${lastName || ""}`.trim())}`,
            html: adminHtml,
          });
          console.log("Step 8: Admin notification email sent to:", adminEmail);
          await new Promise((r) => setTimeout(r, 200));
        } catch (err) {
          console.error(`Step 8 Error: Failed to send to ${adminEmail}:`, err);
        }
      }

      console.log(
        "Step 8: All admin notification emails sent to:",
        adminEmails,
      );
    }

    console.log("Step 9: All steps completed successfully");

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
