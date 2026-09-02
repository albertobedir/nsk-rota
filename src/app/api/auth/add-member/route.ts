/* eslint-disable @typescript-eslint/no-unused-vars */
"use server";

import { NextResponse } from "next/server";
import prisma from "@/lib/prisma/instance";
import { shopifyAdminFetch } from "@/lib/shopify/instance";
import {
  assignCompanyLocationOrderingRole,
  createCompanyContact,
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

    console.log("Step 4.6: Creating company for customer");
    let shopifyCompanyId: string | null = null;
    let companyLocationId: string | null = null;
    let companyContactId: string | null = null;
    let locationRoleAssigned = false;
    let companyRoles: { id: string; name: string }[] = [];
    try {
      const companyData = await shopifyAdminFetch({
        query: `mutation companyCreate($input: CompanyCreateInput!) {
          companyCreate(input: $input) {
            company {
              id
              name
              contactRoles(first: 20) { nodes { id name } }
              locations(first: 1) {
                nodes { id }
                edges { node { id } }
              }
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
      });

      const company = companyData?.data?.companyCreate?.company;
      companyRoles = (company?.contactRoles?.nodes ?? []).map(
        (role: { id?: string; name?: string }) => ({
          id: String(role?.id ?? ""),
          name: String(role?.name ?? ""),
        }),
      );
      console.log("Step 4.6: Company created", company);

      if (companyData.data?.companyCreate?.userErrors?.length > 0) {
        console.warn(
          "Step 4.6 Warning: Company creation had errors",
          companyData.data.companyCreate.userErrors,
        );
      } else {
        shopifyCompanyId = company?.id || null;
        companyLocationId =
          company?.locations?.nodes?.[0]?.id ||
          company?.locations?.edges?.[0]?.node?.id ||
          null;
      }

      if (company?.id) {
        console.log("Step 4.7: Creating company contact");
        try {
          companyContactId = await createCompanyContact({
            companyId: company.id,
            customerId: shopifyCustomer.id,
            email,
            firstName,
            lastName,
          });
          if (companyContactId) {
            console.log("Step 4.7: Company contact created", companyContactId);
          } else {
            console.warn("Step 4.7 Warning: Company contact was not created");
          }
        } catch (contactErr) {
          console.error("Step 4.7 Error: Failed to create contact", contactErr);
        }
      }

      if (company?.id && companyLocationId && companyContactId) {
        console.log("Step 4.8: Assigning ordering role to company location");
        try {
          locationRoleAssigned = await assignCompanyLocationOrderingRole({
            companyId: company.id,
            companyLocationId,
            companyContactId,
            roles: companyRoles,
          });
          if (!locationRoleAssigned) {
            console.warn(
              "Step 4.8 Warning: Location role assignment did not succeed",
            );
          }
        } catch (roleErr) {
          console.error(
            "Step 4.8 Error: Failed to assign location role",
            roleErr,
          );
        }
      }
    } catch (companyErr) {
      console.error("Step 4.6 Error: Failed to create company", companyErr);
    }

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
