/* eslint-disable @typescript-eslint/no-explicit-any */

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_DOMAIN!;
const ACCESS_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN!;
const PRODUCT_API_VERSION = "2024-10";
const PACKAGE_API_VERSION = "2026-07";

export type AssignedPackage = {
  code: string;
  name: string;
  assigned: true;
};

type ShopifyPackage = {
  id: string;
  name: string;
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
  return res.json();
}

function toPackage(raw: any): ShopifyPackage | null {
  const name = String(raw?.name ?? raw?.title ?? raw?.code ?? "").trim();
  const numericId = raw?.id ?? raw?.legacyResourceId;
  const id = String(
    raw?.admin_graphql_api_id ||
      raw?.adminGraphqlApiId ||
      (typeof numericId === "string" && String(numericId).startsWith("gid://")
        ? numericId
        : numericId
          ? `gid://shopify/DeliveryPackage/${numericId}`
          : ""),
  ).trim();
  if (!id || !name) return null;
  return { id, name };
}

function collectPackages(root: any): ShopifyPackage[] {
  const found: ShopifyPackage[] = [];
  const seen = new Set<string>();
  const visit = (value: any, depth = 0) => {
    if (!value || depth > 6) return;
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1));
      return;
    }
    if (typeof value !== "object") return;
    const pkg = toPackage(value);
    if (pkg && !seen.has(`${pkg.id}:${normalizePackageName(pkg.name)}`)) {
      seen.add(`${pkg.id}:${normalizePackageName(pkg.name)}`);
      found.push(pkg);
    }
    for (const child of Object.values(value)) visit(child, depth + 1);
  };
  visit(root);
  return found;
}

async function listPackagesFromGraphql(): Promise<ShopifyPackage[]> {
  const versions = [PACKAGE_API_VERSION, PRODUCT_API_VERSION, "unstable"];
  const queries = [
    `query {
      shippingPackages(first: 100) {
        nodes { id name }
        edges { node { id name } }
      }
    }`,
    `query {
      deliveryPackages(first: 100) {
        nodes { id name }
        edges { node { id name } }
      }
    }`,
    `query {
      packages(first: 100) {
        nodes { id name }
        edges { node { id name } }
      }
    }`,
    `query {
      shop {
        shippingPackages(first: 100) { nodes { id name } }
        deliveryPackages(first: 100) { nodes { id name } }
        packages(first: 100) { nodes { id name } }
      }
    }`,
    `query {
      deliverySettings {
        shippingPackages { id name }
        packages { id name }
      }
    }`,
  ];

  const packages: ShopifyPackage[] = [];
  for (const apiVersion of versions) {
    for (const query of queries) {
      try {
        const json = await shopifyGraphQL(query, undefined, apiVersion);
        if (json?.errors?.length) continue;
        packages.push(...collectPackages(json?.data));
      } catch {
        /* try next */
      }
    }
  }
  return packages;
}

async function listPackagesFromRest(): Promise<ShopifyPackage[]> {
  const paths = [
    `/admin/api/${PACKAGE_API_VERSION}/shipping_packages.json`,
    `/admin/api/${PRODUCT_API_VERSION}/shipping_packages.json`,
    `/admin/api/unstable/shipping_packages.json`,
    `/admin/shipping_packages.json`,
    `/admin/api/${PACKAGE_API_VERSION}/packages.json`,
    `/admin/api/${PRODUCT_API_VERSION}/packages.json`,
  ];
  const packages: ShopifyPackage[] = [];
  for (const path of paths) {
    try {
      const res = await fetch(`https://${SHOPIFY_STORE}${path}`, {
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": ACCESS_TOKEN,
        },
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json = await res.json();
      packages.push(...collectPackages(json));
    } catch {
      /* try next */
    }
  }
  return packages;
}

function matchPackageByName(name: string, packages: ShopifyPackage[]) {
  const needle = normalizePackageName(name);
  return (
    packages.find((pkg) => pkg.name.trim() === name.trim()) ||
    packages.find((pkg) => normalizePackageName(pkg.name) === needle) ||
    null
  );
}

export async function resolveShippingPackage(packageCode: string) {
  const code = String(packageCode ?? "").trim();
  if (!code) {
    throw new PackageCodeError("PackageCode boş olamaz");
  }

  const [gqlPackages, restPackages] = await Promise.all([
    listPackagesFromGraphql(),
    listPackagesFromRest(),
  ]);
  const packages = [...gqlPackages, ...restPackages];
  const found = matchPackageByName(code, packages);

  if (!found?.id) {
    const known = [
      ...new Set(packages.map((pkg) => pkg.name).filter(Boolean)),
    ];
    const knownSuffix =
      known.length > 0
        ? ` Kayıtlı kutu adları: ${known.join(", ")}.`
        : "";
    throw new PackageCodeError(
      `PackageCode "${code}" Shopify Packages altındaki kutu adıyla eşleşmedi. Settings > Shipping and delivery > Packages ekranındaki Package name birebir aynı olmalı (ör. Pack001).${knownSuffix}`,
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

  const json = await shopifyGraphQL(mutation, {
    id,
    input: {
      measurement: {
        shippingPackageId: packageId,
      },
    },
  });

  const payload = json?.data?.inventoryItemUpdate;
  const userErrors = payload?.userErrors ?? json?.errors ?? [];
  if (userErrors.length > 0) {
    throw new PackageCodeError(
      `Kutu varyanta atanamadı: ${JSON.stringify(userErrors)}`,
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
