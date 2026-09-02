/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/mongoose/instance";
import prisma from "@/lib/prisma/instance";
import {
  findPendingRegistrationByEmail,
  markPendingRegistrationUsed,
} from "@/lib/registrations/pending";
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

type PartialCustomerCompany = {
  shopifyCustomerId: string;
  companyId?: string | null;
  companyLocationId?: string | null;
  companyContactId?: string | null;
  companyName?: string | null;
  email?: string | null;
  locationRoleAssigned?: boolean;
};

const ORDERING_ROLE_ID = "gid://shopify/CompanyContactRole/5304221999";

const COMPANY_CREATE = `
  mutation CompanyCreate($input: CompanyCreateInput!) {
    companyCreate(input: $input) {
      company {
        id
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

const COMPANY_ASSIGN_CUSTOMER = `
  mutation CompanyAssignCustomer($companyId: ID!, $customerId: ID!) {
    companyAssignCustomerAsContact(
      companyId: $companyId
      customerId: $customerId
    ) {
      companyContact {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const COMPANY_LOCATION_ASSIGN_ROLES = `
  mutation AssignRoles($companyLocationId: ID!, $contactId: ID!, $roleId: ID!) {
    companyLocationAssignRoles(
      companyLocationId: $companyLocationId
      rolesToAssign: [{
        companyContactId: $contactId
        companyContactRoleId: $roleId
      }]
    ) {
      roleAssignments {
        id
      }
      userErrors {
        field
        message
      }
    }
  }
`;

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

function graphqlFailed(result: any, payload?: { userErrors?: any[] } | null) {
  if (result?.errors?.length) return true;
  const userErrors = payload?.userErrors;
  if (!Array.isArray(userErrors) || userErrors.length === 0) return false;
  return !userErrors.every((err) =>
    /already|exists|assigned/i.test(String(err?.message ?? "")),
  );
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

export async function createCompanyWithContact({
  companyName,
  customerId,
  address1,
  city,
  country,
  state,
  zip,
}: {
  companyName: string;
  customerId: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  address1: string;
  city: string;
  country: string;
  state: string;
  zip: string;
}): Promise<{
  companyId: string;
  companyLocationId: string;
  companyContactId: string;
  companyName: string;
}> {
  if (!customerId) {
    throw new Error("Customer ID missing before company creation");
  }
  console.log("[DEBUG] Customer created:", customerId);
  const companyResult = await shopifyAdminFetch({
    query: COMPANY_CREATE,
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

  const companyPayload = companyResult.data?.companyCreate;
  if (graphqlFailed(companyResult, companyPayload) || !companyPayload?.company?.id) {
    throw new Error(`companyCreate failed: ${JSON.stringify(companyResult)}`);
  }

  const companyId = String(companyPayload.company.id);
  const locationId = String(
    companyPayload.company.locations?.nodes?.[0]?.id ?? "",
  );
  if (!locationId) {
    throw new Error(`companyCreate failed: ${JSON.stringify(companyResult)}`);
  }

  const contactResult = await shopifyAdminFetch({
    query: COMPANY_ASSIGN_CUSTOMER,
    variables: {
      companyId,
      customerId,
    },
  });

  const contactPayload = contactResult.data?.companyAssignCustomerAsContact;
  if (
    graphqlFailed(contactResult, contactPayload) ||
    !contactPayload?.companyContact?.id
  ) {
    throw new Error(
      `companyAssignCustomerAsContact failed: ${JSON.stringify(contactResult)}`,
    );
  }

  const contactId = String(contactPayload.companyContact.id);
  await assignCompanyLocationOrderingRole({
    companyLocationId: locationId,
    companyContactId: contactId,
  });

  return {
    companyId,
    companyLocationId: locationId,
    companyContactId: contactId,
    companyName,
  };
}

export async function createCompanyWithLocationAndContact(
  input: Parameters<typeof createCompanyWithContact>[0],
) {
  return createCompanyWithContact(input);
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
  const assigned = await shopifyAdminFetch({
    query: COMPANY_ASSIGN_CUSTOMER,
    variables: { companyId, customerId },
  });
  const payload = assigned.data?.companyAssignCustomerAsContact;
  if (payload?.companyContact?.id && mutationSucceeded(payload, assigned)) {
    return String(payload.companyContact.id);
  }
  if (payload?.userErrors?.length || assigned.errors?.length) {
    console.warn(
      "[customer-company] companyAssignCustomerAsContact failed:",
      payload?.userErrors ?? assigned.errors,
    );
  }
  return null;
}

export async function assignCompanyLocationOrderingRole({
  companyLocationId,
  companyContactId,
}: {
  companyLocationId: string;
  companyContactId: string;
  companyId?: string;
}): Promise<boolean> {
  const companyContactRoleId = ORDERING_ROLE_ID;
  const roleResult = await shopifyAdminFetch({
    query: COMPANY_LOCATION_ASSIGN_ROLES,
    variables: {
      companyLocationId,
      contactId: companyContactId,
      roleId: companyContactRoleId,
    },
  });
  const rolePayload = roleResult.data?.companyLocationAssignRoles;
  if (graphqlFailed(roleResult, rolePayload)) {
    throw new Error(`assignRoles failed: ${JSON.stringify(roleResult)}`);
  }
  console.log("[customer-company] Location role assigned", {
    companyLocationId,
    companyContactId,
    companyContactRoleId,
  });
  return true;
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
): Promise<CustomerCompanyInfo | null> {
  const shopifyCustomerId = toCustomerGid(customerId);
  if (!shopifyCustomerId) return null;

  try {
    const stored = await findStoredCompany(shopifyCustomerId);
    return isCompleteCompanyInfo(stored) ? stored : null;
  } catch (err) {
    console.warn("[customer-company] getCustomerCompany failed:", err);
    return null;
  }
}

export async function linkCustomerCompanyFromPending({
  shopifyCustomerId,
  email,
}: {
  shopifyCustomerId?: string | null;
  email?: string | null;
}): Promise<PartialCustomerCompany | null> {
  const customerId = toCustomerGid(shopifyCustomerId);
  const normalizedEmail = String(email ?? "").trim().toLowerCase();
  if (!customerId || !normalizedEmail) return null;

  const stored = await findStoredCompany(customerId);
  if (stored?.companyId) {
    console.log(
      "[customer-company] Company already linked, skipping create:",
      stored.companyId,
    );
    return stored;
  }

  const pending = await findPendingRegistrationByEmail(normalizedEmail);
  if (!pending?.companyName) {
    console.log(
      "[customer-company] No pending companyName for",
      normalizedEmail,
    );
    return null;
  }

  const created = await createCompanyWithContact({
    companyName: pending.companyName,
    customerId,
    email: normalizedEmail,
    firstName: pending.firstName ?? undefined,
    lastName: pending.lastName ?? undefined,
    address1: pending.address1,
    city: pending.city,
    country: pending.country,
    state: pending.state,
    zip: pending.zip,
  });

  const saved = await saveCustomerCompany({
    shopifyCustomerId: customerId,
    email: normalizedEmail,
    companyId: created.companyId,
    companyLocationId: created.companyLocationId,
    companyContactId: created.companyContactId,
    companyName: created.companyName,
    locationRoleAssigned: true,
  });

  try {
    await prisma.user.updateMany({
      where: {
        OR: [{ shopifyCustomerId: customerId }, { email: normalizedEmail }],
      },
      data: {
        companyName: pending.companyName,
        shopifyCompanyId: created.companyId,
        companyAddress1: pending.address1,
        companyCity: pending.city,
        companyState: pending.state,
        companyZip: pending.zip,
      },
    });
  } catch (err) {
    console.warn(
      "[customer-company] Prisma address update from pending failed:",
      err,
    );
  }

  await markPendingRegistrationUsed(normalizedEmail);
  console.log("[customer-company] Linked company from pending registration", {
    customerId,
    companyId: created.companyId,
  });
  return saved;
}
