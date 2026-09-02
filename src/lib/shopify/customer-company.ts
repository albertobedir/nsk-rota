/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/mongoose/instance";
import prisma from "@/lib/prisma/instance";
import Customer from "@/schemas/mongoose/customer";
import { toCustomerGid } from "@/lib/shopify/ids";
import { shopifyAdminFetch } from "./instance";

export type CustomerCompanyInfo = {
  shopifyCustomerId: string;
  companyId: string;
  companyLocationId: string;
  companyContactId: string;
  companyName: string;
  locationRoleAssigned?: boolean;
};

export type SessionCompanyFields = {
  companyName: string | null;
  shopifyCompanyId: string | null;
  companyId: string | null;
  companyLocationId: string | null;
  companyContactId: string | null;
};

type ContactRole = {
  id: string;
  name: string;
};

type PartialCustomerCompany = {
  shopifyCustomerId: string;
  companyId?: string | null;
  companyLocationId?: string | null;
  companyContactId?: string | null;
  companyName?: string | null;
  email?: string | null;
  locationRoleAssigned?: boolean;
};

const cachedOrderingRoleId: { value: string | null; pending: Promise<string | null> | null } =
  {
    value: null,
    pending: null,
  };

const GET_SHOP_COMPANY_CONTACT_ROLES = `
  query GetShopCompanyContactRoles {
    companyContactRoles(first: 20) {
      nodes {
        id
        name
      }
    }
  }
`;

const GET_COMPANY_CONTACT_ROLES = `
  query GetCompanyContactRoles($companyId: ID!) {
    company(id: $companyId) {
      id
      contactRoles(first: 20) {
        nodes {
          id
          name
        }
      }
    }
  }
`;

const COMPANY_CREATE = `
  mutation companyCreate($input: CompanyCreateInput!) {
    companyCreate(input: $input) {
      company {
        id
        name
        mainContact {
          id
        }
        contacts(first: 1) {
          nodes {
            id
          }
        }
        locations(first: 1) {
          nodes {
            id
          }
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const GET_CUSTOMER_COMPANY = `
  query GetCustomerCompany($customerId: ID!) {
    customer(id: $customerId) {
      id
      email
      companyContactProfiles {
        id
        company {
          id
          name
          contactRoles(first: 20) {
            nodes {
              id
              name
            }
          }
          locations(first: 5) {
            nodes {
              id
            }
          }
        }
        roleAssignments(first: 20) {
          nodes {
            role {
              id
              name
            }
            companyLocation {
              id
            }
          }
        }
      }
    }
  }
`;

const COMPANY_CONTACT_CREATE = `
  mutation companyContactCreate($companyId: ID!, $input: CompanyContactInput!) {
    companyContactCreate(companyId: $companyId, input: $input) {
      companyContact {
        id
        customer { id }
      }
      userErrors { field message }
    }
  }
`;

const COMPANY_LOCATION_ASSIGN_ROLES = `
  mutation companyLocationAssignRoles(
    $companyLocationId: ID!
    $rolesToAssign: [CompanyLocationRoleAssign!]!
  ) {
    companyLocationAssignRoles(
      companyLocationId: $companyLocationId
      rolesToAssign: $rolesToAssign
    ) {
      roleAssignments {
        id
      }
      userErrors { field message }
    }
  }
`;

const COMPANY_CONTACT_ASSIGN_ROLES = `
  mutation companyContactAssignRoles(
    $companyContactId: ID!
    $rolesToAssign: [CompanyContactRoleAssign!]!
  ) {
    companyContactAssignRoles(
      companyContactId: $companyContactId
      rolesToAssign: $rolesToAssign
    ) {
      roleAssignments {
        id
      }
      userErrors { field message }
    }
  }
`;

function asGid(
  resource: "Customer" | "Company" | "CompanyLocation" | "CompanyContact",
  value?: string | number | null,
): string | null {
  if (value == null) return null;
  const raw = String(value).trim().split("?")[0];
  if (!raw) return null;
  if (raw.startsWith(`gid://shopify/${resource}/`)) return raw;
  if (raw.startsWith("gid://")) return raw;
  const numeric = raw.match(/(\d+)\s*$/)?.[1];
  return numeric ? `gid://shopify/${resource}/${numeric}` : null;
}

export function isCompleteCompanyInfo(
  info?: PartialCustomerCompany | null,
): info is CustomerCompanyInfo {
  return Boolean(
    info?.shopifyCustomerId &&
      info?.companyId &&
      info?.companyLocationId &&
      info?.companyContactId,
  );
}

export function toSessionCompanyFields(
  info?: PartialCustomerCompany | null,
): SessionCompanyFields {
  return {
    companyName: info?.companyName ?? null,
    shopifyCompanyId: info?.companyId ?? null,
    companyId: info?.companyId ?? null,
    companyLocationId: info?.companyLocationId ?? null,
    companyContactId: info?.companyContactId ?? null,
  };
}

export function toPurchasingCompany(info?: PartialCustomerCompany | null) {
  if (!isCompleteCompanyInfo(info)) return undefined;
  return {
    companyId: info.companyId,
    companyLocationId: info.companyLocationId,
    companyContactId: info.companyContactId,
  };
}

function fromMongoDoc(doc: any): PartialCustomerCompany | null {
  if (!doc) return null;
  return {
    shopifyCustomerId: String(doc.shopifyCustomerId),
    companyId: doc.companyId ?? null,
    companyLocationId: doc.companyLocationId ?? null,
    companyContactId: doc.companyContactId ?? null,
    companyName: doc.companyName ?? null,
    email: doc.email ?? null,
    locationRoleAssigned: Boolean(doc.locationRoleAssigned),
  };
}

function toContactRoles(nodes: any[] | undefined): ContactRole[] {
  if (!Array.isArray(nodes)) return [];
  return nodes
    .map((node) => ({
      id: String(node?.id ?? ""),
      name: String(node?.name ?? ""),
    }))
    .filter((role) => role.id);
}

function pickOrderingRoleId(roles: ContactRole[]): string | null {
  if (roles.length === 0) return null;
  const ordering =
    roles.find(
      (role) => role.name.trim().toLowerCase() === "ordering only",
    ) ??
    roles.find((role) => /order/i.test(role.name)) ??
    roles.find((role) => /buyer|purchas/i.test(role.name));
  return ordering?.id ?? null;
}

function mutationSucceeded(
  payload: { userErrors?: any[] } | null | undefined,
  response?: any,
) {
  if (Array.isArray(response?.errors) && response.errors.length > 0) {
    return false;
  }
  if (!payload) return false;
  const userErrors = payload.userErrors;
  if (!Array.isArray(userErrors) || userErrors.length === 0) return true;
  return userErrors.every((err) =>
    /already|exists|assigned/i.test(String(err?.message ?? "")),
  );
}

async function fetchOrderingRoleIdFromShopify(
  companyId?: string,
): Promise<string | null> {
  const shopRoles = await shopifyAdminFetch({
    query: GET_SHOP_COMPANY_CONTACT_ROLES,
  });
  if (!shopRoles.errors?.length) {
    const fromShop = pickOrderingRoleId(
      toContactRoles(shopRoles.data?.companyContactRoles?.nodes),
    );
    if (fromShop) return fromShop;
  } else {
    console.warn(
      "[customer-company] companyContactRoles query failed:",
      shopRoles.errors,
    );
  }

  if (!companyId) return null;

  const companyRoles = await shopifyAdminFetch({
    query: GET_COMPANY_CONTACT_ROLES,
    variables: { companyId },
  });
  return pickOrderingRoleId(
    toContactRoles(companyRoles.data?.company?.contactRoles?.nodes),
  );
}

export async function getOrderingRoleId(companyId?: string): Promise<string | null> {
  if (cachedOrderingRoleId.value) return cachedOrderingRoleId.value;
  if (cachedOrderingRoleId.pending) return cachedOrderingRoleId.pending;

  cachedOrderingRoleId.pending = fetchOrderingRoleIdFromShopify(companyId)
    .then((roleId) => {
      if (roleId) cachedOrderingRoleId.value = roleId;
      return roleId;
    })
    .finally(() => {
      cachedOrderingRoleId.pending = null;
    });

  return cachedOrderingRoleId.pending;
}

export async function createCompanyWithLocationAndContact({
  companyName,
  customerId,
  email,
  firstName,
  lastName,
  address1,
  city,
  country,
  state,
  zip,
}: {
  companyName: string;
  customerId: string;
  email: string;
  firstName: string;
  lastName: string;
  address1: string;
  city: string;
  country: string;
  state: string;
  zip: string;
}): Promise<{
  companyId: string;
  companyLocationId: string | null;
  companyContactId: string | null;
  companyName: string;
} | null> {
  const locationInput = {
    name: "Main Location",
    billingSameAsShipping: true,
    shippingAddress: {
      address1,
      city,
      countryCode: country,
      zoneCode: state,
      zip,
    },
  };

  const contactInput = {
    customerId,
    email,
    firstName,
    lastName,
    isMainContact: true,
  };

  let response = await shopifyAdminFetch({
    query: COMPANY_CREATE,
    variables: {
      input: {
        company: { name: companyName },
        companyLocation: locationInput,
        companyContact: contactInput,
      },
    },
  });

  const unknownField = JSON.stringify(response.errors ?? []).match(
    /isMainContact|customerId/i,
  );
  if (response.errors?.length && unknownField) {
    const { isMainContact: _ignored, ...contactWithoutFlag } = contactInput;
    response = await shopifyAdminFetch({
      query: COMPANY_CREATE,
      variables: {
        input: {
          company: { name: companyName },
          companyLocation: locationInput,
          companyContact: contactWithoutFlag,
        },
      },
    });
  }

  let payload = response.data?.companyCreate;
  if (!payload?.company?.id || !mutationSucceeded(payload, response)) {
    console.warn(
      "[customer-company] companyCreate with contact failed:",
      payload?.userErrors ?? response.errors,
    );
    response = await shopifyAdminFetch({
      query: COMPANY_CREATE,
      variables: {
        input: {
          company: { name: companyName },
          companyLocation: locationInput,
        },
      },
    });
    payload = response.data?.companyCreate;
  }

  const company = payload?.company;
  if (!company?.id || !mutationSucceeded(payload, response)) {
    console.warn(
      "[customer-company] companyCreate userErrors:",
      payload?.userErrors ?? response.errors,
    );
    return null;
  }

  const companyLocationId =
    company.locations?.nodes?.[0]?.id ??
    company.locations?.edges?.[0]?.node?.id ??
    null;
  let companyContactId =
    company.mainContact?.id ?? company.contacts?.nodes?.[0]?.id ?? null;

  if (!companyContactId) {
    companyContactId = await createCompanyContact({
      companyId: company.id,
      customerId,
    });
  }

  return {
    companyId: String(company.id),
    companyLocationId: companyLocationId ? String(companyLocationId) : null,
    companyContactId: companyContactId ? String(companyContactId) : null,
    companyName: String(company.name ?? companyName),
  };
}

export async function createCompanyContact({
  companyId,
  customerId,
}: {
  companyId: string;
  customerId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
}): Promise<string | null> {
  const created = await shopifyAdminFetch({
    query: COMPANY_CONTACT_CREATE,
    variables: {
      companyId,
      input: { customerId },
    },
  });

  const payload = created.data?.companyContactCreate;
  if (payload?.companyContact?.id && mutationSucceeded(payload, created)) {
    return String(payload.companyContact.id);
  }

  if (payload?.userErrors?.length) {
    console.warn(
      "[customer-company] companyContactCreate userErrors:",
      payload.userErrors,
    );
  }

  const fallback = await shopifyAdminFetch({
    query: `
      mutation companyAssignCustomerAsContact($companyId: ID!, $customerId: ID!) {
        companyAssignCustomerAsContact(companyId: $companyId, customerId: $customerId) {
          companyContact { id }
          userErrors { field message }
        }
      }
    `,
    variables: { companyId, customerId },
  });
  const assigned = fallback.data?.companyAssignCustomerAsContact;
  if (assigned?.userErrors?.length) {
    console.warn(
      "[customer-company] companyAssignCustomerAsContact userErrors:",
      assigned.userErrors,
    );
  }
  return assigned?.companyContact?.id
    ? String(assigned.companyContact.id)
    : null;
}

export async function assignCompanyLocationOrderingRole({
  companyLocationId,
  companyContactId,
  companyId,
}: {
  companyLocationId: string;
  companyContactId: string;
  companyId?: string;
}): Promise<boolean> {
  const companyContactRoleId = await getOrderingRoleId(companyId);
  if (!companyContactRoleId) {
    console.warn("[customer-company] No Ordering only role found at runtime");
    return false;
  }

  const locationAssign = await shopifyAdminFetch({
    query: COMPANY_LOCATION_ASSIGN_ROLES,
    variables: {
      companyLocationId,
      rolesToAssign: [{ companyContactId, companyContactRoleId }],
    },
  });
  const locationPayload = locationAssign.data?.companyLocationAssignRoles;
  if (mutationSucceeded(locationPayload, locationAssign)) {
    console.log("[customer-company] Location role assigned", {
      companyLocationId,
      companyContactId,
      companyContactRoleId,
    });
    return true;
  }

  console.warn(
    "[customer-company] companyLocationAssignRoles userErrors:",
    locationPayload?.userErrors ?? locationAssign.errors,
  );

  const contactAssign = await shopifyAdminFetch({
    query: COMPANY_CONTACT_ASSIGN_ROLES,
    variables: {
      companyContactId,
      rolesToAssign: [{ companyContactRoleId, companyLocationId }],
    },
  });
  const contactPayload = contactAssign.data?.companyContactAssignRoles;
  if (mutationSucceeded(contactPayload, contactAssign)) {
    console.log("[customer-company] Contact role assigned via fallback", {
      companyLocationId,
      companyContactId,
      companyContactRoleId,
    });
    return true;
  }

  console.warn(
    "[customer-company] companyContactAssignRoles userErrors:",
    contactPayload?.userErrors ?? contactAssign.errors,
  );
  return false;
}

async function ensureCompanyLocationRole(
  info: PartialCustomerCompany,
): Promise<PartialCustomerCompany> {
  if (
    info.locationRoleAssigned ||
    !info.companyId ||
    !info.companyLocationId ||
    !info.companyContactId
  ) {
    return info;
  }

  const assigned = await assignCompanyLocationOrderingRole({
    companyId: info.companyId,
    companyLocationId: info.companyLocationId,
    companyContactId: info.companyContactId,
  });
  return { ...info, locationRoleAssigned: assigned };
}

function pickCompanyFromProfiles(profiles: any[] | undefined) {
  if (!Array.isArray(profiles) || profiles.length === 0) return null;

  const profile =
    profiles.find((p) =>
      p?.roleAssignments?.nodes?.some((n: any) => n?.companyLocation?.id),
    ) ?? profiles[0];

  const companyId = asGid("Company", profile?.company?.id);
  const companyContactId = asGid("CompanyContact", profile?.id);
  const assignedLocationId = asGid(
    "CompanyLocation",
    profile?.roleAssignments?.nodes?.find((n: any) => n?.companyLocation?.id)
      ?.companyLocation?.id,
  );
  const fallbackLocationId = asGid(
    "CompanyLocation",
    profile?.company?.locations?.nodes?.[0]?.id,
  );
  const companyLocationId = assignedLocationId ?? fallbackLocationId;

  return {
    companyId,
    companyContactId,
    companyLocationId,
    companyName: profile?.company?.name ? String(profile.company.name) : null,
    locationRoleAssigned: Boolean(assignedLocationId),
    roles: toContactRoles(profile?.company?.contactRoles?.nodes),
  };
}

export async function fetchCustomerCompanyFromShopify(
  customerId: string,
): Promise<PartialCustomerCompany | null> {
  const shopifyCustomerId = toCustomerGid(customerId);
  if (!shopifyCustomerId) return null;

  const response = await shopifyAdminFetch({
    query: GET_CUSTOMER_COMPANY,
    variables: { customerId: shopifyCustomerId },
  });

  const customer = response.data?.customer;
  if (!customer?.id) {
    console.warn(
      "[customer-company] Shopify customer not found:",
      shopifyCustomerId,
    );
    return null;
  }

  const picked = pickCompanyFromProfiles(customer.companyContactProfiles);
  if (!picked?.companyId) {
    console.log(
      "[customer-company] No company contact profile for",
      shopifyCustomerId,
    );
    return {
      shopifyCustomerId,
      email: customer.email ?? null,
    };
  }

  return ensureCompanyLocationRole({
    shopifyCustomerId,
    email: customer.email ?? null,
    companyId: picked.companyId,
    companyLocationId: picked.companyLocationId,
    companyContactId: picked.companyContactId,
    companyName: picked.companyName,
    locationRoleAssigned: picked.locationRoleAssigned,
  });
}

export function extractPurchasingCompanyFromOrder(
  orderData: any,
  customerGid?: string | null,
): PartialCustomerCompany | null {
  const shopifyCustomerId = toCustomerGid(
    customerGid ||
      orderData?.customer?.admin_graphql_api_id ||
      orderData?.customer?.id,
  );
  if (!shopifyCustomerId) return null;

  const purchasingEntity =
    orderData?.purchasing_entity ?? orderData?.purchasingEntity ?? null;
  const purchasingCompany =
    purchasingEntity?.purchasing_company ??
    purchasingEntity?.purchasingCompany ??
    null;
  const company = orderData?.company ?? purchasingCompany?.company ?? null;

  const companyId = asGid(
    "Company",
    purchasingCompany?.company_id ??
      purchasingCompany?.companyId ??
      company?.id,
  );
  const companyLocationId = asGid(
    "CompanyLocation",
    purchasingCompany?.company_location_id ??
      purchasingCompany?.companyLocationId ??
      company?.location_id ??
      company?.locationId,
  );
  const companyContactId = asGid(
    "CompanyContact",
    purchasingCompany?.company_contact_id ??
      purchasingCompany?.companyContactId ??
      purchasingCompany?.contact_id,
  );
  const companyName =
    purchasingCompany?.company?.name ??
    company?.name ??
    orderData?.shipping_address?.company ??
    orderData?.billing_address?.company ??
    null;

  return {
    shopifyCustomerId,
    companyId,
    companyLocationId,
    companyContactId,
    companyName: companyName ? String(companyName) : null,
    email: orderData?.email ?? orderData?.customer?.email ?? null,
  };
}

export async function saveCustomerCompany(
  info: PartialCustomerCompany,
): Promise<PartialCustomerCompany> {
  const shopifyCustomerId = toCustomerGid(info.shopifyCustomerId);
  if (!shopifyCustomerId) {
    throw new Error("shopifyCustomerId is required to save customer company");
  }

  await connectDB();

  const set: Record<string, unknown> = { shopifyCustomerId };
  if (info.companyId != null) set.companyId = info.companyId;
  if (info.companyLocationId != null)
    set.companyLocationId = info.companyLocationId;
  if (info.companyContactId != null)
    set.companyContactId = info.companyContactId;
  if (info.companyName != null) set.companyName = info.companyName;
  if (info.email != null) set.email = info.email;
  if (info.locationRoleAssigned != null)
    set.locationRoleAssigned = info.locationRoleAssigned;

  const saved = await Customer.findOneAndUpdate(
    { shopifyCustomerId },
    { $set: set },
    { upsert: true, new: true },
  );

  try {
    await prisma.user.updateMany({
      where: { shopifyCustomerId },
      data: {
        ...(info.companyName != null ? { companyName: info.companyName } : {}),
        ...(info.companyId != null ? { shopifyCompanyId: info.companyId } : {}),
      },
    });
  } catch (err) {
    console.warn("[customer-company] Prisma user company update failed:", err);
  }

  return fromMongoDoc(saved) ?? { ...info, shopifyCustomerId };
}

async function findStoredCompany(
  shopifyCustomerId: string,
): Promise<PartialCustomerCompany | null> {
  await connectDB();
  const doc = await Customer.findOne({ shopifyCustomerId }).lean();
  return fromMongoDoc(doc);
}

export async function getCustomerCompany(
  customerId?: string | null,
  {
    refresh = false,
    staleOk = false,
  }: { refresh?: boolean; staleOk?: boolean } = {},
): Promise<CustomerCompanyInfo | null> {
  const shopifyCustomerId = toCustomerGid(customerId);
  if (!shopifyCustomerId) return null;

  try {
    const stored = refresh
      ? null
      : await findStoredCompany(shopifyCustomerId);

    if (isCompleteCompanyInfo(stored) && stored.locationRoleAssigned) {
      return stored;
    }
    if (isCompleteCompanyInfo(stored) && !staleOk) {
      const ensured = await ensureCompanyLocationRole(stored);
      await saveCustomerCompany(ensured);
      if (isCompleteCompanyInfo(ensured) && ensured.locationRoleAssigned) {
        return ensured;
      }
    }
    if (!refresh && staleOk && stored) return null;

    const fetched = await fetchCustomerCompanyFromShopify(shopifyCustomerId);
    if (fetched) {
      const saved = await saveCustomerCompany(fetched);
      return isCompleteCompanyInfo(saved) ? saved : null;
    }

    const fallback = stored ?? (await findStoredCompany(shopifyCustomerId));
    return isCompleteCompanyInfo(fallback) ? fallback : null;
  } catch (err) {
    console.warn("[customer-company] getCustomerCompany failed:", err);
    try {
      const stored = await findStoredCompany(shopifyCustomerId);
      return isCompleteCompanyInfo(stored) ? stored : null;
    } catch {
      return null;
    }
  }
}
