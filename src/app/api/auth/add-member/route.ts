/* eslint-disable @typescript-eslint/no-unused-vars */
"use server";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma/instance";
import { shopifyAdminFetch } from "@/lib/shopify/instance";
import {
  createCompanyWithContact,
  saveCustomerCompany,
} from "@/lib/shopify/customer-company";

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

async function waitForPersistedUser({
  shopifyCustomerId,
  email,
  timeoutMs = 8000,
}: {
  shopifyCustomerId: string;
  email: string;
  timeoutMs?: number;
}) {
  const started = Date.now();
  const normalizedEmail = email.trim().toLowerCase();

  while (Date.now() - started < timeoutMs) {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ shopifyCustomerId }, { email: normalizedEmail }],
      },
    });
    if (user) return user;
    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return null;
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

    console.log("Step 2: Creating Shopify customer");

    const mutation = `
      mutation customerCreate($input: CustomerInput!) {
        customerCreate(input: $input) {
          customer {
            id
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

    console.log("Step 4.6: Creating company, location, contact, and role");
    const createdCompany = await createCompanyWithContact({
      companyName,
      customerId: shopifyCustomer.id,
      email,
      firstName,
      lastName,
      address1,
      city,
      country,
      state,
      zip,
    });
    console.log("Step 4.6: Company created with location role", createdCompany);

    const shopifyCompanyId = createdCompany.companyId;
    const companyLocationId = createdCompany.companyLocationId;
    const companyContactId = createdCompany.companyContactId;
    const locationRoleAssigned = true;

    console.log("Step 5: Waiting for customer-create webhook to persist user");
    const persistedUser = await waitForPersistedUser({
      shopifyCustomerId,
      email,
    });

    if (persistedUser) {
      await prisma.user.update({
        where: { id: persistedUser.id },
        data: {
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
      console.log(
        "Step 5: Linked Shopify company to persisted user",
        persistedUser.id,
      );
    } else {
      console.warn(
        "Step 5 Warning: Webhook has not persisted the user yet; Shopify customer was created",
        shopifyCustomerId,
      );
    }

    try {
      await saveCustomerCompany({
        shopifyCustomerId,
        email,
        companyId: shopifyCompanyId,
        companyLocationId,
        companyContactId,
        companyName,
        locationRoleAssigned,
      });
      console.log("Step 5.1: Saved customer company to MongoDB");
    } catch (mongoErr) {
      console.warn(
        "Step 5.1 Warning: Failed to save MongoDB customer:",
        mongoErr,
      );
    }

    console.log("Step 9: All steps completed successfully");

    return NextResponse.json(
      { message: "User created & email sent" },
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
