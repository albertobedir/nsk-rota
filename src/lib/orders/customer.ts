import prisma from "@/lib/prisma/instance";
import { extractNumericId, toCustomerGid } from "@/lib/shopify/ids";

export type CustomerIdentity = {
  raw: string;
  numericId: string | null;
  gid: string | null;
};

function looksLikePrismaId(value: string): boolean {
  if (value.startsWith("gid://")) return false;
  if (/^\d+$/.test(value)) return false;
  return value.length >= 8;
}

export async function resolveCustomerIdentity(
  customerId?: string | null,
): Promise<CustomerIdentity | null> {
  if (!customerId) return null;

  const raw = String(customerId).trim();
  if (!raw) return null;

  let gid = raw.startsWith("gid://shopify/Customer/")
    ? raw.split("?")[0]
    : toCustomerGid(raw);
  let numericId = extractNumericId(gid || raw);

  if (!gid && looksLikePrismaId(raw)) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: raw },
        select: { shopifyCustomerId: true },
      });
      if (dbUser?.shopifyCustomerId) {
        gid = toCustomerGid(dbUser.shopifyCustomerId);
        numericId = extractNumericId(gid);
      }
    } catch {
      // value is not a Prisma user id
    }
  }

  return { raw, numericId, gid };
}

export function buildCustomerOrderMongoQuery(identity: CustomerIdentity) {
  const or: Record<string, unknown>[] = [];

  if (identity.gid) {
    or.push({ customerId: identity.gid });
    or.push({ "raw.customer.admin_graphql_api_id": identity.gid });
    or.push({ "raw.customer.id": identity.gid });
  }

  if (identity.numericId) {
    const n = Number(identity.numericId);
    or.push({ customerId: identity.numericId });
    or.push({ "raw.customer.id": identity.numericId });
    if (Number.isFinite(n)) {
      or.push({ "raw.customer.id": n });
    }
  }

  if (or.length === 0) {
    return { customerId: identity.raw };
  }

  return { $or: or };
}
