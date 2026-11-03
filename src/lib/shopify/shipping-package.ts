/* eslint-disable @typescript-eslint/no-explicit-any */

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN!;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;
const PRODUCT_API_VERSION = "2024-10";
const PACKAGE_API_VERSION = "2026-07";
const API_VERSIONS = [PACKAGE_API_VERSION, "2026-10", PRODUCT_API_VERSION, "unstable"];

export type AssignedPackage = {
  code: string;
  name: string;
  assigned: true;
};

type ShopifyPackage = {
  id: string;
  name: string;
};

type ShopIdentity = {
  name: string;
  domain: string;
};

type ListAttempt = {
  source: string;
  ok: boolean;
  readable: boolean;
  status?: number;
  error?: string;
  count?: number;
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

function graphqlErrorMessages(json: any): string[] {
  const errors = json?.errors;
  if (!errors) return [];
  if (typeof errors === "string") return [errors];
  if (Array.isArray(errors)) {
    return errors.map((err) =>
      String(err?.message || err?.extensions?.code || JSON.stringify(err)),
    );
  }
  return [String(errors)];
}

async function shopifyGraphQL(
  query: string,
  variables?: Record<string, unknown>,
  apiVersion = PACKAGE_API_VERSION,
) {
  const res = await fetch(
    `https://${SHOPIFY_STORE}/admin/api/${apiVersion}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": ACCESS_TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    },
  );
  let json: any = null;
  try {
    json = await res.json();
  } catch {
    json = { errors: `GraphQL HTTP ${res.status}: JSON parse edilemedi` };
  }
  return { status: res.status, ok: res.ok, json };
}

function toPackage(raw: any): ShopifyPackage | null {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name ?? raw.title ?? raw.code ?? "").trim();
  const numericId = raw.id ?? raw.legacyResourceId;
  const id = String(
    raw.admin_graphql_api_id ||
      raw.adminGraphqlApiId ||
      (typeof numericId === "string" && String(numericId).startsWith("gid://")
        ? numericId
        : numericId
          ? `gid://shopify/DeliveryPackage/${numericId}`
          : ""),
  ).trim();
  if (!id || !name) return null;
  if (/shop|product|variant|deliveryprofile|deliveryzone/i.test(id) &&
      !/package/i.test(id)) {
    return null;
  }
  return { id, name };
}

function collectPackages(root: any): ShopifyPackage[] {
  const found: ShopifyPackage[] = [];
  const seen = new Set<string>();
  const visit = (value: any, depth = 0) => {
    if (!value || depth > 8) return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    const pkg = toPackage(value);
    if (pkg) {
      const key = `${pkg.id}:${normalizePackageName(pkg.name)}`;
      if (!seen.has(key)) {
        seen.add(key);
        found.push(pkg);
      }
    }
    for (const child of Object.values(value)) visit(child, depth + 1);
  };
  visit(root);
  return found;
}

function matchPackageByName(name: string, packages: ShopifyPackage[]) {
  const exact = name.trim();
  const needle = normalizePackageName(name);
  return (
    packages.find((pkg) => pkg.name.trim() === exact) ||
    packages.find((pkg) => normalizePackageName(pkg.name) === needle) ||
    null
  );
}

async function getShopIdentity(): Promise<{ shop: ShopIdentity; error?: string }> {
  const { status, json } = await shopifyGraphQL(
    `query { shop { name myshopifyDomain } }`,
    undefined,
    PRODUCT_API_VERSION,
  );
  const messages = graphqlErrorMessages(json);
  if (messages.length > 0 || !json?.data?.shop) {
    return {
      shop: { name: "", domain: SHOPIFY_STORE },
      error:
        messages.join("; ") ||
        `Shopify shop sorgusu başarısız (HTTP ${status})`,
    };
  }
  return {
    shop: {
      name: String(json.data.shop.name || ""),
      domain: String(json.data.shop.myshopifyDomain || SHOPIFY_STORE),
    },
  };
}

async function packageQueryFields(apiVersion: string): Promise<{
  fields: string[];
  error?: string;
}> {
  const { status, json } = await shopifyGraphQL(
    `{ __type(name: "QueryRoot") { fields { name } } }`,
    undefined,
    apiVersion,
  );
  const messages = graphqlErrorMessages(json);
  if (messages.length > 0 || !json?.data?.__type?.fields) {
    return {
      fields: [],
      error: messages.join("; ") || `Introspection başarısız (HTTP ${status})`,
    };
  }
  const fields = json.data.__type.fields
    .map((field: { name: string }) => field.name)
    .filter((name: string) => /pack/i.test(name));
  return { fields };
}

async function queryPackageConnection(
  apiVersion: string,
  field: string,
): Promise<{ packages: ShopifyPackage[]; readable: boolean; error?: string }> {
  const packages: ShopifyPackage[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 10; page += 1) {
    const query = `
      query ($cursor: String) {
        ${field}(first: 100, after: $cursor) {
          nodes { id name }
          edges { node { id name } }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const { json } = await shopifyGraphQL(
      query,
      { cursor },
      apiVersion,
    );
    const messages = graphqlErrorMessages(json);
    if (messages.length > 0) {
      if (page === 0) {
        const simple = await shopifyGraphQL(
          `query { ${field} { id name } }`,
          undefined,
          apiVersion,
        );
        const simpleErrors = graphqlErrorMessages(simple.json);
        if (simpleErrors.length > 0 || simple.json?.data?.[field] == null) {
          return { packages: [], readable: false, error: messages.join("; ") };
        }
        return {
          packages: collectPackages(simple.json.data[field]),
          readable: true,
        };
      }
      return { packages, readable: true, error: messages.join("; ") };
    }
    const conn = json?.data?.[field];
    if (conn == null) {
      return { packages: [], readable: false, error: `${field} boş döndü` };
    }
    packages.push(...collectPackages(conn));
    const pageInfo = conn.pageInfo;
    if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
    cursor = pageInfo.endCursor;
  }
  return { packages, readable: true };
}

async function listPackagesFromGraphql(attempts: ListAttempt[]) {
  const packages: ShopifyPackage[] = [];
  let readable = false;

  for (const apiVersion of API_VERSIONS) {
    const discovered = await packageQueryFields(apiVersion);
    if (discovered.error) {
      attempts.push({
        source: `graphql:${apiVersion}:introspection`,
        ok: false,
        readable: false,
        error: discovered.error,
      });
      continue;
    }
    if (discovered.fields.length === 0) {
      attempts.push({
        source: `graphql:${apiVersion}:QueryRoot`,
        ok: true,
        readable: false,
        error: "Kutu listesi için QueryRoot alanında package sorgusu yok",
      });
      continue;
    }
    for (const field of discovered.fields) {
      const result = await queryPackageConnection(apiVersion, field);
      attempts.push({
        source: `graphql:${apiVersion}:${field}`,
        ok: !result.error,
        readable: result.readable,
        error: result.error,
        count: result.packages.length,
      });
      if (result.readable) {
        readable = true;
        packages.push(...result.packages);
      }
    }
  }

  return { packages, readable };
}

async function listPackagesFromRest(attempts: ListAttempt[]) {
  const paths = [
    `/admin/api/${PACKAGE_API_VERSION}/shipping_packages.json`,
    `/admin/api/${PRODUCT_API_VERSION}/shipping_packages.json`,
    `/admin/api/unstable/shipping_packages.json`,
    `/admin/shipping_packages.json`,
  ];
  const packages: ShopifyPackage[] = [];
  let readable = false;

  for (const path of paths) {
    try {
      const res = await fetch(`https://${SHOPIFY_STORE}${path}`, {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": ACCESS_TOKEN,
        },
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        attempts.push({
          source: `rest:${path}`,
          ok: false,
          readable: false,
          status: res.status,
          error:
            (typeof json?.errors === "string"
              ? json.errors
              : json?.errors
                ? JSON.stringify(json.errors)
                : `HTTP ${res.status}`),
        });
        continue;
      }
      const found = collectPackages(json);
      readable = true;
      packages.push(...found);
      attempts.push({
        source: `rest:${path}`,
        ok: true,
        readable: true,
        status: res.status,
        count: found.length,
      });
    } catch (err: any) {
      attempts.push({
        source: `rest:${path}`,
        ok: false,
        readable: false,
        error: err?.message || String(err),
      });
    }
  }

  return { packages, readable };
}

function shopLabel(shop: ShopIdentity) {
  return shop.name ? `${shop.domain} (${shop.name})` : shop.domain;
}

function uniqueAttemptErrors(attempts: ListAttempt[]) {
  return [
    ...new Set(
      attempts
        .filter((attempt) => attempt.error)
        .map((attempt) => `${attempt.source}: ${attempt.error}`),
    ),
  ].slice(0, 6);
}

export async function resolveShippingPackage(packageCode: string) {
  const code = String(packageCode ?? "").trim();
  if (!code) {
    throw new PackageCodeError("PackageCode boş olamaz");
  }
  if (!SHOPIFY_STORE || !ACCESS_TOKEN) {
    throw new PackageCodeError(
      "Shopify bağlantısı eksik: SHOPIFY_STORE_DOMAIN veya Admin API token tanımlı değil",
      500,
    );
  }

  const { shop, error: shopError } = await getShopIdentity();
  if (shopError) {
    throw new PackageCodeError(
      `Shopify kutu listesine erişilemedi (mağaza: ${shopLabel(shop)}). Asıl hata: ${shopError}. Bu, PackageCode "${code}" adının yanlış olduğu anlamına gelmez.`,
      502,
    );
  }

  const attempts: ListAttempt[] = [];
  const [gql, rest] = await Promise.all([
    listPackagesFromGraphql(attempts),
    listPackagesFromRest(attempts),
  ]);
  const packages = [...gql.packages, ...rest.packages];
  const listReadable = gql.readable || rest.readable;

  if (!listReadable) {
    const details = uniqueAttemptErrors(attempts).join(" | ");
    console.error("Shipping package list unreadable", {
      shop,
      packageCode: code,
      attempts,
    });
    throw new PackageCodeError(
      `Shopify kutu listesi okunamadı (mağaza: ${shopLabel(shop)}). PackageCode "${code}" ile isim karşılaştırması yapılamadı; bu kutu yok demek değil. Asıl hata: ${details || "Admin API kayıtlı kutuları listelemiyor."}`,
      502,
    );
  }

  const found = matchPackageByName(code, packages);
  if (!found?.id) {
    const known = [
      ...new Set(packages.map((pkg) => pkg.name).filter(Boolean)),
    ];
    const knownSuffix =
      known.length > 0
        ? ` Okunan kutu adları: ${known.join(", ")}.`
        : " Kutu listesi okundu ama hiç kutu dönmedi.";
    throw new PackageCodeError(
      `PackageCode "${code}" mağaza ${shopLabel(shop)} içindeki kutu adlarıyla eşleşmedi.${knownSuffix}`,
    );
  }

  return {
    code,
    id: found.id,
    name: found.name || code,
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

  const { json } = await shopifyGraphQL(mutation, {
    id,
    input: {
      measurement: {
        shippingPackageId: packageId,
      },
    },
  });

  const payload = json?.data?.inventoryItemUpdate;
  const userErrors = payload?.userErrors ?? [];
  const gqlErrors = graphqlErrorMessages(json);
  const allErrors = [
    ...userErrors.map((err: any) => err?.message || JSON.stringify(err)),
    ...gqlErrors,
  ];
  if (allErrors.length > 0) {
    throw new PackageCodeError(
      `Kutu varyanta atanamadı: ${allErrors.join("; ")}`,
      500,
    );
  }
  if (!payload?.inventoryItem?.id) {
    throw new PackageCodeError(
      "Kutu varyanta atanamadı: Shopify inventoryItemUpdate boş döndü",
      500,
    );
  }

  return payload.inventoryItem.id as string;
}

export async function assignPackageByCode(
  inventoryItemGid: string | number,
  packageCode: string,
): Promise<AssignedPackage> {
  const pkg = await resolveShippingPackage(packageCode);
  await assignShippingPackageToInventoryItem(
    String(inventoryItemGid),
    pkg.id,
  );
  return {
    code: pkg.code,
    name: pkg.name,
    assigned: true,
  };
}
