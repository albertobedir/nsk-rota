import prisma from "@/lib/prisma/instance";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface MetaobjectField {
  key: string;
  value: string;
}

interface MetaobjectNode {
  id: string;
  handle: string;
  displayName: string;
  fields: MetaobjectField[];
}

interface MetaobjectEdge {
  node: MetaobjectNode;
}

interface MetaobjectsResponse {
  data: {
    metaobjects: {
      edges: MetaobjectEdge[];
      pageInfo: {
        hasNextPage: boolean;
        endCursor: string | null;
      };
    };
  };
}

interface CustomerPricingData {
  id: string;
  customerId: string;
  price: number;
}

interface SyncMetaobjectsRequest {
  metaobjects: CustomerPricingData[];
}

function parseMetaobjectFields(node: MetaobjectNode): Record<string, string> {
  return node.fields.reduce((acc, field) => {
    acc[field.key] = field.value;
    return acc;
  }, {} as Record<string, string>);
}

function transformToCustomerPricing(node: MetaobjectNode): CustomerPricingData {
  const fields = parseMetaobjectFields(node);

  const customerGid = fields.customer || "";

  return {
    id: node.id,
    customerId: customerGid,
    price: parseFloat(fields.price || "0"),
  };
}

async function fetchAllMetaobjects(): Promise<CustomerPricingData[]> {
  const SHOPIFY_ADMIN_API_URL = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/graphql.json`;
  const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;

  const query = `
    query GetMetaobjects($type: String!, $first: Int!, $after: String) {
      metaobjects(type: $type, first: $first, after: $after) {
        edges {
          node {
            id
            handle
            displayName
            fields {
              key
              value
            }
          }
        }
        pageInfo {
          hasNextPage
          endCursor
        }
      }
    }
  `;

  let allMetaobjects: CustomerPricingData[] = [];
  let hasNextPage = true;
  let cursor: string | null = null;

  while (hasNextPage) {
    const response = await fetch(SHOPIFY_ADMIN_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": SHOPIFY_ACCESS_TOKEN || "",
      },
      body: JSON.stringify({
        query,
        variables: {
          type: "customer_pricing",
          first: 250,
          after: cursor,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Shopify API error: ${response.status}`);
    }

    const data = (await response.json()) as MetaobjectsResponse;

    const { edges, pageInfo } = data.data.metaobjects;

    const metaobjects = edges.map((edge) =>
      transformToCustomerPricing(edge.node)
    );

    allMetaobjects = [...allMetaobjects, ...metaobjects];

    hasNextPage = pageInfo.hasNextPage;
    cursor = pageInfo.endCursor;
  }

  return allMetaobjects;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SyncMetaobjectsRequest;

    if (!body.metaobjects || !Array.isArray(body.metaobjects)) {
      return NextResponse.json(
        { error: "Invalid request body" },
        { status: 400 }
      );
    }

    const results = await Promise.all(
      body.metaobjects.map(async (item) => {
        return prisma.customerPricing.upsert({
          where: {
            metaobjectId: item.id,
          },
          update: {
            customerId: item.customerId,
            price: item.price,
            updatedAt: new Date(),
          },
          create: {
            metaobjectId: item.id,
            customerId: item.customerId,
            price: item.price,
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
      synced: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Metaobject sync error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { error: "Sync failed", details: errorMessage },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

export async function GET(req: NextRequest) {
  try {
    console.log("🔄 Fetching metaobjects from Shopify...");

    const metaobjects = await fetchAllMetaobjects();

    if (metaobjects.length === 0) {
      return NextResponse.json({
        success: true,
        synced: 0,
        message: "No metaobjects found",
      });
    }

    const results = await Promise.all(
      metaobjects.map(async (item) => {
        return prisma.customerPricing.upsert({
          where: {
            metaobjectId: item.id,
          },
          update: {
            customerId: item.customerId,
            price: item.price,
            updatedAt: new Date(),
          },
          create: {
            metaobjectId: item.id,
            customerId: item.customerId,
            price: item.price,
          },
        });
      })
    );

    return NextResponse.json({
      success: true,
      synced: results.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Metaobject sync error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    return NextResponse.json(
      { error: "Sync failed", details: errorMessage },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
