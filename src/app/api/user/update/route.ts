import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const accessToken = request.headers
    .get("Authorization")
    ?.replace("Bearer ", "");

  if (!accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const query = `
    query {
      customer {
        id
        firstName
        lastName
        email
        phone
        defaultAddress {
          id
          address1
          city
          province
          country
          zip
        }
        addresses(first: 10) {
          edges {
            node {
              id
              address1
              address2
              city
              province
              country
              zip
              firstName
              lastName
              phone
            }
          }
        }
        creditLimit: metafield(namespace: "custom", key: "credit_limit") { value type }
        creditUsed: metafield(namespace: "custom", key: "credit_used") { value type }
        creditRemaining: metafield(namespace: "custom", key: "credit_remaining") { value type }
      }
    }
  `;

  const response = await fetch(
    "https://shopify.com/account-api/2024-10/graphql",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query }),
    }
  );

  const data = await response.json();
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const accessToken = request.headers
    .get("Authorization")
    ?.replace("Bearer ", "");
  const body = await request.json();

  return NextResponse.json({ success: true });
}
