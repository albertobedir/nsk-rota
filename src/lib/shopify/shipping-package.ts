/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Shopify Admin GraphQL does not expose a query to list saved packages.
 * Documented assignment (2026-10):
 * inventoryItemUpdate → input.measurement.shippingPackageId
 * https://shopify.dev/docs/api/admin-graphql/2026-10/input-objects/InventoryItemMeasurementInput
 *
 * PackageCode is the Shopify package name. The GID must already be verified
 * in SHOPIFY_SHIPPING_PACKAGES. Name matching against a live Shopify list
 * is not supported.
 */
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN!;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;
const PACKAGE_API_VERSION = "2026-10";

export type AssignedPackage = {
  code: string;
  name: string;
  assigned: true;
};

type VerifiedPackage = {
  name: string;
  id: string;
};

export class PackageCodeError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "PackageCodeError";
    this.status = status;
  }
}

function normalizePackageName(value: string) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function isPackageGid(id: string) {
  return /^gid:\/\/shopify\/[A-Za-z]*Package\/\d+$/.test(id);
}

function verifiedPackagesByName(): VerifiedPackage[] {
  const raw = process.env.SHOPIFY_SHIPPING_PACKAGES?.trim();
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new PackageCodeError(
      "SHOPIFY_SHIPPING_PACKAGES geçerli JSON değil. Beklenen biçim: {\"Pack001\":\"gid://shopify/DeliveryPackage/123\"}",
      500,
    );
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new PackageCodeError(
      "SHOPIFY_SHIPPING_PACKAGES bir JSON nesnesi olmalı: {\"Pack001\":\"gid://shopify/DeliveryPackage/123\"}",
      500,
    );
  }

  return Object.entries(parsed as Record<string, unknown>)
    .map(([name, id]) => ({
      name: String(name).trim(),
      id: String(id ?? "").trim(),
    }))
    .filter((row) => row.name && row.id);
}

function resolveVerifiedPackage(packageCode: string): VerifiedPackage {
  const code = String(packageCode ?? "").trim();
  if (!code) {
    throw new PackageCodeError("PackageCode boş olamaz");
  }

  const packages = verifiedPackagesByName();
  const needle = normalizePackageName(code);
  const found =
    packages.find((pkg) => pkg.name.trim() === code) ||
    packages.find((pkg) => normalizePackageName(pkg.name) === needle);

  if (!found) {
    const known = packages.map((pkg) => pkg.name);
    const knownSuffix =
      known.length > 0
        ? ` Tanımlı kutu adları: ${known.join(", ")}.`
        : " Sunucuda doğrulanmış kutu kaydı yok.";
    throw new PackageCodeError(
      `PackageCode "${code}" için doğrulanmış kutu ID'si yok. Shopify Admin API kayıtlı kutuları listelemez; isimden otomatik eşleştirme desteklenmiyor.${knownSuffix}`,
      409,
    );
  }

  if (!isPackageGid(found.id)) {
    throw new PackageCodeError(
      `PackageCode "${code}" için tanımlı kutu ID geçersiz: "${found.id}". Beklenen: gid://shopify/DeliveryPackage/{sayı}`,
      500,
    );
  }

  return found;
}

async function shopifyGraphQL(
  query: string,
  variables?: Record<string, unknown>,
) {
  const res = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/${PACKAGE_API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message =
      typeof json?.errors === "string"
        ? json.errors
        : json?.errors
          ? JSON.stringify(json.errors)
          : `HTTP ${res.status}`;
    throw new PackageCodeError(
      `Shopify inventoryItemUpdate çağrısı başarısız (${PACKAGE_API_VERSION}): ${message}`,
      502,
    );
  }
  return json;
}

export async function resolveShippingPackage(packageCode: string) {
  const pkg = resolveVerifiedPackage(packageCode);
  return {
    code: pkg.name,
    id: pkg.id,
    name: pkg.name,
  };
}

export async function assignShippingPackageToInventoryItem(
  inventoryItemGid: string,
  packageId: string,
) {
  const id = inventoryItemGid.startsWith("gid://")
    ? inventoryItemGid
    : `gid://shopify/InventoryItem/${inventoryItemGid}`;

  const mutation = `
    mutation inventoryItemUpdate($id: ID!, $input: InventoryItemInput!) {
      inventoryItemUpdate(id: $id, input: $input) {
        inventoryItem { id }
        userErrors { field message }
      }
    }
  `;

  const json = await shopifyGraphQL(mutation, {
    id,
    input: {
      measurement: {
        shippingPackageId: packageId,
      },
    },
  });

  if (json?.errors?.length) {
    const messages = Array.isArray(json.errors)
      ? json.errors.map((err: any) => err?.message || JSON.stringify(err)).join("; ")
      : String(json.errors);
    throw new PackageCodeError(
      `Kutu varyanta atanamadı: ${messages}`,
      502,
    );
  }

  const payload = json?.data?.inventoryItemUpdate;
  const userErrors = payload?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new PackageCodeError(
      `Kutu varyanta atanamadı: ${userErrors
        .map((err: any) => err?.message || JSON.stringify(err))
        .join("; ")}`,
      502,
    );
  }
  if (!payload?.inventoryItem?.id) {
    throw new PackageCodeError(
      "Kutu varyanta atanamadı: inventoryItemUpdate boş döndü",
      502,
    );
  }

  return payload.inventoryItem.id as string;
}

export async function assignPackageByCode(
  inventoryItemGid: string | number,
  packageCode: string,
): Promise<AssignedPackage> {
  const pkg = resolveVerifiedPackage(packageCode);
  await assignShippingPackageToInventoryItem(
    String(inventoryItemGid),
    pkg.id,
  );
  return {
    code: pkg.name,
    name: pkg.name,
    assigned: true,
  };
}
