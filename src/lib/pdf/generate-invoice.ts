/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";
import Customer from "@/schemas/mongoose/customer";
import { buildInvoicePdf } from "@/lib/pdf/invoice-document";
import { formatInvoiceAddressLines } from "@/lib/pdf/invoice-address";
import { extractNumericId, toCustomerGid, toOrderGid } from "@/lib/shopify/ids";
import { normalizeLineItemEdges } from "@/lib/orders/line-items";

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

function mapAddress(addr: any) {
  if (!addr) return null;
  return {
    name:
      addr.name ||
      [addr.firstName || addr.first_name, addr.lastName || addr.last_name]
        .filter(Boolean)
        .join(" ") ||
      "",
    company: addr.company || "",
    address1: addr.address1 || "",
    address2: addr.address2 || "",
    city: addr.city || "",
    zip: addr.zip || "",
    province: addr.province || addr.provinceCode || addr.province_code || "",
    country: addr.country || addr.country_name || addr.countryName || "",
    countryCode:
      addr.country_code || addr.countryCode || addr.countryCodeV2 || "",
  };
}

async function findCustomerCompanyName(
  customerId?: string | null,
): Promise<string> {
  if (!customerId) return "";

  try {
    const { default: prisma } = await import("@/lib/prisma/instance");
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ id: customerId }, { shopifyCustomerId: customerId }],
      },
      select: { companyName: true },
    });
    const fromPrisma = firstNonEmpty(user?.companyName);
    if (fromPrisma) return fromPrisma;
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
    return firstNonEmpty((doc as { companyName?: string } | null)?.companyName);
  } catch {
    return "";
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
    billingAddress: mapAddress(billing),
    shippingAddress: mapAddress(shipping),
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

  const customerCompanyName = await findCustomerCompanyName(
    customerId || order.customer?.id || order.customer?.admin_graphql_api_id,
  );

  const orderNum = order.name || `#${order.orderNumber}` || orderId || "-";
  const dateStr = formatDate(order.processedAt);
  const statusStr = order.financialStatus || order.fulfillmentStatus || "-";
  const currency = order.totalPrice?.currencyCode || "USD";
  const raw = (order.raw || {}) as Record<string, any>;

  const billingAddr = order.billingAddress || order.shippingAddress || null;
  const shippingAddr = order.shippingAddress || order.billingAddress || null;

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
    firstNonEmpty(
      order.billingAddress?.company,
      order.shippingAddress?.company,
      customerCompanyName,
    ) || "";

  const withCompany = (addr: Record<string, any> | null) =>
    formatInvoiceAddressLines({
      ...(addr || {}),
      company: firstNonEmpty(addr?.company, companyName) || undefined,
    });

  const buffer = await buildInvoicePdf({
    orderNumber: String(orderNum),
    dateLabel: dateStr,
    status: String(statusStr),
    terms: "Net 30",
    currency,
    poNumber: String(order.poNumber || "").trim() || "—",
    billTo: withCompany(billingAddr),
    shipTo: withCompany(shippingAddr),
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
