/* eslint-disable @typescript-eslint/no-explicit-any */
import { shopifyAdminFetch } from "./instance";
import { GET_CUSTOMER_PRICING_METAOBJECTS } from "./queries/customerPricing";

interface RawField {
  key: string;
  value: string | null;
  reference?: any | null;
}

interface MetaobjectNode {
  id: string;
  updatedAt?: string;
  fields: RawField[];
}

export async function getAllCustomerPricing() {
  const results: Array<{
    id: string;
    customerId?: string;
    productId?: string;
    price?: number;
    updatedAt?: string;
  }> = [];

  let hasNext = true;
  let after: string | null = null;

  while (hasNext) {
    const resp: any = await shopifyAdminFetch({
      query: GET_CUSTOMER_PRICING_METAOBJECTS,
      variables: { first: 250, after },
    });

    const edges = resp?.data?.metaobjects?.edges ?? [];
    const pageInfo = resp?.data?.metaobjects?.pageInfo ?? {
      hasNextPage: false,
      endCursor: null,
    };

    for (const edge of edges) {
      const node: MetaobjectNode = edge.node;
      const fields = (node.fields || []).reduce(
        (acc: Record<string, any>, f: RawField) => {
          acc[f.key] = f.value;
          if (f.reference && f.reference.__typename === "Customer") {
            acc.customerRef = f.reference;
          }
          if (f.reference && f.reference.__typename === "Product") {
            acc.productRef = f.reference;
          }
          return acc;
        },
        {} as Record<string, any>,
      );

      const customerId = fields.customerRef?.id || fields.customer || null;
      const productId = fields.productRef?.id || fields.product || null;
      const price = parseFloat(fields.price || "0");

      results.push({
        id: node.id,
        customerId: customerId ?? undefined,
        productId: productId ?? undefined,
        price: isNaN(price) ? undefined : price,
        updatedAt: node.updatedAt,
      });
    }

    hasNext = pageInfo.hasNextPage;
    after = pageInfo.endCursor ?? null;
  }

  return results;
}

export default getAllCustomerPricing;
