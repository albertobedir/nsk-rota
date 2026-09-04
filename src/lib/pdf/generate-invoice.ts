/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";
import Customer from "@/schemas/mongoose/customer";
import { buildInvoicePdf } from "@/lib/pdf/invoice-document";
import {
  firstCustomerAddress,
  formatInvoiceAddressLines,
  isSupplierAddress,
  isSupplierCompanyName,
  normalizeInvoiceAddress,
  withCustomerCompany,
} from "@/lib/pdf/invoice-address";
import { extractNumericId, toCustomerGid, toOrderGid } from "@/lib/shopify/ids";
import { normalizeLineItemEdges } from "@/lib/orders/line-items";
import { shopifyAdminFetch } from "@/lib/shopify/instance";

export class InvoicePdfError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "InvoicePdfError";
    this.status = status;
  }
}

function money(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function firstNonEmpty(...vals: unknown[]): string {
  for (const v of vals) {
    const s = String(v ?? "").trim();
    if (s && s !== "null" && s !== "undefined") return s;
  }
  return "";
}

function formatDate(val: any): string {
  if (!val) return "-";
  const s = String(val).slice(0, 10);
  const [y, m, d2] = s.split("-");
  if (!y || !m || !d2) return s;
  return `${d2}/${m}/${y}`;
}

type CustomerAddressProfile = {
  companyName: string;
  billing: ReturnType<typeof normalizeInvoiceAddress>;
  shipping: ReturnType<typeof normalizeInvoiceAddress>;
};

const INVOICE_ORDER_ADDRESSES_QUERY = `
  query InvoiceOrderAddresses($id: ID!) {
    order(id: $id) {
      billingAddress {
        firstName lastName company address1 address2 city province provinceCode country countryCodeV2 zip
      }
      shippingAddress {
        firstName lastName company address1 address2 city province provinceCode country countryCodeV2 zip
      }
      customer {
        displayName
        defaultAddress {
          firstName lastName company address1 address2 city province provinceCode country countryCodeV2 zip
        }
        companyContactProfiles {
          company {
            name
            locations(first: 10) {
              nodes {
                name
                billingAddress { address1 address2 city zoneCode countryCode zip }
                shippingAddress { address1 address2 city zoneCode countryCode zip }
              }
            }
          }
        }
      }
      purchasingEntity {
        ... on PurchasingCompany {
          company { name }
          location {
            name
            billingAddress { address1 address2 city zoneCode countryCode zip }
            shippingAddress { address1 address2 city zoneCode countryCode zip }
          }
        }
      }
    }
  }
`;

function companyLocationToAddress(loc: any, companyName?: string) {
  if (!loc) return null;
  const src = loc.shippingAddress || loc.billingAddress || loc;
  return normalizeInvoiceAddress({
    ...src,
    company: firstNonEmpty(loc.name, companyName, src?.company),
  });
}

async function fetchShopifyCustomerAddresses(orderId: string) {
  const gid = toOrderGid(orderId);
  if (!gid) return null;
  try {
    const response = await shopifyAdminFetch({
      query: INVOICE_ORDER_ADDRESSES_QUERY,
      variables: { id: gid },
    });
    const node = response?.data?.order;
    if (!node) return null;

    const purchasing = node.purchasingEntity || {};
    const companyName = firstNonEmpty(
      purchasing.company?.name,
      node.customer?.companyContactProfiles?.[0]?.company?.name,
    );
    const location =
      purchasing.location ||
      node.customer?.companyContactProfiles?.[0]?.company?.locations?.nodes?.[0];

    return {
      companyName,
      billing: firstCustomerAddress(
        node.billingAddress,
        companyLocationToAddress(location, companyName),
        node.customer?.defaultAddress,
      ),
      shipping: firstCustomerAddress(
        node.shippingAddress,
        companyLocationToAddress(location, companyName),
        node.customer?.defaultAddress,
        node.billingAddress,
      ),
    };
  } catch (err) {
    console.warn("[invoice-pdf] Shopify address fetch failed:", err);
    return null;
  }
}

async function findCustomerAddressProfile(
  customerId?: string | null,
): Promise<CustomerAddressProfile> {
  const empty: CustomerAddressProfile = {
    companyName: "",
    billing: null,
    shipping: null,
  };
  if (!customerId) return empty;

  try {
    const { default: prisma } = await import("@/lib/prisma/instance");
    const gid = toCustomerGid(customerId) || customerId;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { id: customerId },
          { shopifyCustomerId: customerId },
          { shopifyCustomerId: gid },
        ],
      },
      select: {
        companyName: true,
        firstName: true,
        lastName: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        zip: true,
        billingAddress: true,
        shippingAddress: true,
        companyAddress1: true,
        companyCity: true,
        companyState: true,
        companyZip: true,
      },
    });
    if (user) {
      const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
      const companyAddr = normalizeInvoiceAddress({
        company: user.companyName,
        name,
        address1: user.companyAddress1,
        city: user.companyCity,
        province: user.companyState,
        zip: user.companyZip,
        country: "United States",
        countryCode: "US",
      });
      const profileAddr = normalizeInvoiceAddress({
        company: user.companyName,
        name,
        address1: user.addressLine1,
        address2: user.addressLine2,
        city: user.city,
        province: user.state,
        zip: user.zip,
        country: "United States",
        countryCode: "US",
      });
      return {
        companyName: firstNonEmpty(user.companyName),
        billing: firstCustomerAddress(
          user.billingAddress,
          companyAddr,
          profileAddr,
          user.shippingAddress,
        ),
        shipping: firstCustomerAddress(
          user.shippingAddress,
          companyAddr,
          profileAddr,
          user.billingAddress,
        ),
      };
    }
  } catch {
    /* prisma unavailable */
  }

  try {
    await connectDB();
    const gid = toCustomerGid(customerId) || customerId;
    const doc = await Customer.findOne({
      $or: [{ shopifyCustomerId: customerId }, { shopifyCustomerId: gid }],
    })
      .select("companyName")
      .lean();
    return {
      ...empty,
      companyName: firstNonEmpty(
        (doc as { companyName?: string } | null)?.companyName,
      ),
    };
  } catch {
    return empty;
  }
}

async function loadOrder(id: string) {
  await connectDB();

  const orderGid = toOrderGid(id);
  const numericId = extractNumericId(id);
  const dbOrder = await Order.findOne({
    $or: [
      { shopifyId: id },
      ...(orderGid ? [{ shopifyId: orderGid }] : []),
      ...(numericId
        ? [
            { shopifyId: numericId },
            { "raw.id": Number(numericId) },
            { "raw.id": numericId },
            { orderNumber: Number(numericId) },
          ]
        : []),
    ],
  }).lean();

  if (!dbOrder) return null;

  const raw = (dbOrder.raw || {}) as any;
  const billing = (dbOrder.billingAddress ||
    raw.billing_address ||
    raw.billingAddress) as any;
  const shipping = (dbOrder.shippingAddress ||
    raw.shipping_address ||
    raw.shippingAddress) as any;
  const orderName = String(dbOrder.name || raw.name || "").trim();
  const orderNumber =
    dbOrder.orderNumber ||
    raw.order_number ||
    String(orderName).replace(/^#/, "") ||
    id;

  return {
    name: orderName || (orderNumber ? `#${orderNumber}` : id),
    orderNumber,
    poNumber: dbOrder.poNumber || raw.po_number || raw.poNumber || null,
    processedAt:
      raw.created_at ||
      raw.createdAt ||
      raw.processed_at ||
      dbOrder.createdAt,
    financialStatus:
      dbOrder.financialStatus ||
      raw.financial_status ||
      raw.displayFinancialStatus,
    fulfillmentStatus:
      dbOrder.fulfillmentStatus ||
      raw.fulfillment_status ||
      raw.displayFulfillmentStatus,
    totalPrice: {
      amount:
        raw.total_price ||
        raw.current_total_price ||
        raw.totalPriceSet?.shopMoney?.amount,
      currencyCode:
        raw.currency ||
        raw.presentment_currency ||
        raw.totalPriceSet?.shopMoney?.currencyCode ||
        "USD",
    },
    shipping:
      raw.total_shipping_price_set?.shop_money?.amount ||
      raw.totalShippingPriceSet?.shopMoney?.amount ||
      raw.shipping_lines?.[0]?.price ||
      0,
    taxes: raw.total_tax || raw.totalTaxSet?.shopMoney?.amount || 0,
    billingAddress: normalizeInvoiceAddress(billing),
    shippingAddress: normalizeInvoiceAddress(shipping),
    customer: raw.customer || null,
    lineItems: { edges: normalizeLineItemEdges(dbOrder) },
    raw,
  };
}

export async function generateInvoicePdf(opts: {
  orderId: string;
  customerId?: string | null;
}): Promise<{ buffer: Buffer; filename: string; orderName: string }> {
  const { orderId, customerId } = opts;
  if (!orderId) {
    throw new InvoicePdfError("Order not found or invalid", 404);
  }

  let order: Awaited<ReturnType<typeof loadOrder>> = null;
  try {
    order = await loadOrder(orderId);
  } catch (err) {
    console.error("❌ MongoDB fetch error:", err);
    throw new InvoicePdfError("Order not found or invalid", 404);
  }

  if (!order) {
    console.log("❌ Order not found in MongoDB:", orderId);
    throw new InvoicePdfError("Order not found or invalid", 404);
  }

  console.log("✅ Order fetched from MongoDB:", order.name);

  const customerProfile = await findCustomerAddressProfile(
    order.customer?.id ||
      order.customer?.admin_graphql_api_id ||
      customerId,
  );

  const orderNum = order.name || `#${order.orderNumber}` || orderId || "-";
  const dateStr = formatDate(order.processedAt);
  const statusStr = order.financialStatus || order.fulfillmentStatus || "-";
  const currency = order.totalPrice?.currencyCode || "USD";
  const raw = (order.raw || {}) as Record<string, any>;

  const customerDefaultAddress =
    order.customer?.default_address ||
    order.customer?.defaultAddress ||
    null;

  const itemsList =
    (order.lineItems?.edges as Array<Record<string, any>>) || [];
  let discountedSubtotal = 0;
  const items = itemsList.map((e) => {
    const node = (e?.node || e) as Record<string, any>;
    const qty = Number(node?.quantity ?? node?.current_quantity ?? 1) || 1;
    const originalPrice = money(
      node?.originalUnitPrice ?? node?.variant?.price?.amount,
    );
    const discountedPrice = money(node?.discountedUnitPrice ?? originalPrice);
    const unitPrice = discountedPrice > 0 ? discountedPrice : originalPrice;
    const lineTotal = unitPrice * qty;
    discountedSubtotal += lineTotal;
    return {
      title: String(node?.title || node?.name || "Item"),
      quantity: qty,
      sku: String(node?.sku || ""),
      customerNo: "-",
      unitPrice,
      lineTotal,
    };
  });

  const shopifyDiscount = money(
    raw.total_discounts ??
      raw.current_total_discounts ??
      raw.total_discounts_set?.shop_money?.amount ??
      raw.current_total_discounts_set?.shop_money?.amount ??
      raw.totalDiscountsSet?.shopMoney?.amount ??
      raw.currentTotalDiscountsSet?.shopMoney?.amount,
  );
  // Catalog / tier markdowns live in unit prices and must not swallow the
  // order-level code (e.g. Pickup%5). Always print Shopify's discount total.
  const discountAmount = shopifyDiscount;
  const discountLabel = "Discount";

  const taxes = money(order.taxes);
  const shipping = money(order.shipping);
  const grandTotal =
    money(order.totalPrice?.amount) ||
    Math.max(0, discountedSubtotal - discountAmount) + taxes + shipping;

  // If line totals already include the Shopify discount, add it back so
  // Subtotal − Discount + tax + shipping still equals the order total.
  let subtotal = discountedSubtotal;
  const impliedTotal = discountedSubtotal + taxes + shipping;
  if (
    discountAmount > 0.004 &&
    Math.abs(impliedTotal - grandTotal) < 0.05
  ) {
    subtotal = discountedSubtotal + discountAmount;
  }

  const companyName =
    [
      customerProfile.companyName,
      order.billingAddress?.company,
      order.shippingAddress?.company,
    ]
      .map((value) => firstNonEmpty(value))
      .find((value) => value && !isSupplierCompanyName(value)) || "";

  let billingAddr = firstCustomerAddress(
    order.billingAddress,
    raw.billing_address,
    raw.billingAddress,
    customerProfile.billing,
    customerDefaultAddress,
    order.shippingAddress,
    raw.shipping_address,
    raw.shippingAddress,
    customerProfile.shipping,
  );
  let shippingAddr = firstCustomerAddress(
    order.shippingAddress,
    raw.shipping_address,
    raw.shippingAddress,
    customerProfile.shipping,
    customerDefaultAddress,
    order.billingAddress,
    raw.billing_address,
    raw.billingAddress,
    customerProfile.billing,
  );

  if (
    !billingAddr?.address1 ||
    !shippingAddr?.address1 ||
    isSupplierAddress(billingAddr) ||
    isSupplierAddress(shippingAddr)
  ) {
    const live = await fetchShopifyCustomerAddresses(
      String(order.raw?.admin_graphql_api_id || orderId),
    );
    if (live) {
      billingAddr =
        firstCustomerAddress(live.billing, billingAddr, live.shipping) ||
        billingAddr;
      shippingAddr =
        firstCustomerAddress(live.shipping, shippingAddr, live.billing) ||
        shippingAddr;
    }
  }

  const buffer = await buildInvoicePdf({
    orderNumber: String(orderNum),
    dateLabel: dateStr,
    status: String(statusStr),
    terms: "Net 30",
    currency,
    poNumber: String(order.poNumber || "").trim() || "—",
    billTo: formatInvoiceAddressLines(
      withCustomerCompany(billingAddr, companyName),
    ),
    shipTo: formatInvoiceAddressLines(
      withCustomerCompany(shippingAddr, companyName),
    ),
    items,
    subtotal,
    discount: discountAmount,
    discountLabel,
    taxes,
    shipping,
    grandTotal,
    deliveryTerm: "DAP",
    paymentTerm: "Net 30",
  });

  const safeName = String(orderNum).replace("#", "") || "document";
  return {
    buffer,
    filename: `invoice-${safeName}.pdf`,
    orderName: String(orderNum),
  };
}
