/* eslint-disable @typescript-eslint/no-explicit-any */
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";
import Customer from "@/schemas/mongoose/customer";
import { buildInvoicePdf } from "@/lib/pdf/invoice-document";
import { formatInvoiceAddressLines } from "@/lib/pdf/invoice-address";
import { extractNumericId, toCustomerGid, toOrderGid } from "@/lib/shopify/ids";
import { normalizeLineItemEdges } from "@/lib/orders/line-items";
import { fetchShopifyRestOrder } from "@/lib/shopify/order-rest";

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

function isManualDiscountApp(app: any): boolean {
  if (!app || typeof app !== "object") return false;
  const type = String(app.type || app.discountType || "").toLowerCase();
  const typename = String(app.__typename || "").toLowerCase();
  return type === "manual" || typename.includes("manualdiscount");
}

function discountAppList(raw: Record<string, any>): any[] {
  if (Array.isArray(raw.discount_applications)) return raw.discount_applications;
  if (Array.isArray(raw.discountApplications?.nodes)) {
    return raw.discountApplications.nodes;
  }
  if (Array.isArray(raw.discountApplications)) return raw.discountApplications;
  return [];
}

function allocationList(item: any): any[] {
  const src =
    item?.discount_allocations ||
    item?.discountAllocations ||
    item?.node?.discountAllocations ||
    item?.node?.discount_allocations ||
    [];
  if (Array.isArray(src)) return src;
  if (Array.isArray(src?.nodes)) return src.nodes;
  return [];
}

function allocationAmount(alloc: any): number {
  return money(
    alloc?.amount ??
      alloc?.allocatedAmountSet?.shopMoney?.amount ??
      alloc?.allocatedAmount?.amount ??
      alloc?.allocated_amount,
  );
}

function lineManualDiscountAmount(
  item: any,
  manualIndexes: Set<number>,
  apps: any[],
): number {
  let total = 0;
  for (const alloc of allocationList(item)) {
    const idx = alloc?.discount_application_index ?? alloc?.discountApplicationIndex;
    const app =
      alloc?.discountApplication ||
      alloc?.discount_application ||
      (idx != null ? apps[Number(idx)] : null);
    const matchedByIndex = idx != null && manualIndexes.has(Number(idx));
    if (matchedByIndex || isManualDiscountApp(app)) {
      total += allocationAmount(alloc);
    }
  }
  return total;
}

function manualDiscountFromApps(apps: any[], subtotal: number): number {
  let total = 0;
  for (const app of apps) {
    if (!isManualDiscountApp(app)) continue;
    const valueType = String(
      app.value_type || app.valueType || app.value?.__typename || "",
    ).toLowerCase();
    if (app.value?.percentage != null || valueType.includes("percentage")) {
      const pct = money(app.value?.percentage ?? app.value);
      total += subtotal * (pct / 100);
      continue;
    }
    total += money(
      app.value?.amount ??
        app.value?.shopMoney?.amount ??
        app.value,
    );
  }
  return total;
}

function resolveManualDiscount(raw: Record<string, any>, lineItems: any[]) {
  const apps = discountAppList(raw);
  const manualIndexes = new Set<number>();
  apps.forEach((app, i) => {
    if (isManualDiscountApp(app)) manualIndexes.add(i);
  });

  const restItems = Array.isArray(raw.line_items) ? raw.line_items : [];
  const perLine = new Map<number, number>();
  let allocated = 0;

  const take = (item: any, index: number) => {
    const amount = lineManualDiscountAmount(item, manualIndexes, apps);
    if (amount > 0) {
      perLine.set(index, (perLine.get(index) || 0) + amount);
      allocated += amount;
    }
  };

  restItems.forEach(take);
  if (allocated < 0.005) {
    lineItems.forEach((edge, i) => take(edge?.node || edge, i));
  }

  return { allocated, perLine, apps };
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
  if (!addr || typeof addr !== "object") return null;
  const mapped = {
    name:
      addr.name ||
      [addr.firstName || addr.first_name, addr.lastName || addr.last_name]
        .filter(Boolean)
        .join(" ") ||
      "",
    company: addr.company || addr.companyName || "",
    address1:
      addr.address1 || addr.addressLine1 || addr.line1 || addr.street || "",
    address2: addr.address2 || addr.addressLine2 || addr.line2 || "",
    city: addr.city || "",
    zip: addr.zip || addr.zipCode || addr.postalCode || "",
    province:
      addr.province ||
      addr.provinceCode ||
      addr.province_code ||
      addr.zoneCode ||
      addr.state ||
      "",
    country: addr.country || addr.country_name || addr.countryName || "",
    countryCode:
      addr.country_code || addr.countryCode || addr.countryCodeV2 || "",
  };
  if (
    !mapped.address1 &&
    !mapped.city &&
    !mapped.zip &&
    !mapped.company &&
    !mapped.name
  ) {
    return null;
  }
  return mapped;
}

function pickAddress(...candidates: unknown[]) {
  for (const candidate of candidates) {
    const mapped = mapAddress(candidate);
    if (mapped) return mapped;
  }
  return null;
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
    billingAddress: pickAddress(
      raw.billing_address,
      raw.billingAddress,
      dbOrder.billingAddress,
    ),
    shippingAddress: pickAddress(
      raw.shipping_address,
      raw.shippingAddress,
      dbOrder.shippingAddress,
    ),
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

  let liveOrder: any = null;
  try {
    liveOrder = await fetchShopifyRestOrder(
      raw.id || raw.admin_graphql_api_id || orderId,
    );
  } catch (err) {
    console.warn("[invoice-pdf] live Shopify address fetch failed:", err);
  }

  const billingAddr = pickAddress(
    liveOrder?.billing_address,
    raw.billing_address,
    raw.billingAddress,
    order.billingAddress,
  );
  const shippingAddr = pickAddress(
    liveOrder?.shipping_address,
    raw.shipping_address,
    raw.shippingAddress,
    order.shippingAddress,
  );

  const itemsList =
    (order.lineItems?.edges as Array<Record<string, any>>) || [];
  const { allocated: allocatedManual, perLine, apps } =
    resolveManualDiscount(raw, itemsList);

  let discountedSubtotal = 0;
  const items = itemsList.map((e, idx) => {
    const node = (e?.node || e) as Record<string, any>;
    const qty = Number(node?.quantity ?? node?.current_quantity ?? 1) || 1;
    const originalPrice = money(
      node?.originalUnitPrice ?? node?.variant?.price?.amount,
    );
    const discountedPrice = money(node?.discountedUnitPrice ?? originalPrice);
    const sellingPrice = discountedPrice > 0 ? discountedPrice : originalPrice;
    const manualOnLine = perLine.get(idx) || 0;
    const unitPrice =
      qty > 0 ? sellingPrice + manualOnLine / qty : sellingPrice;
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

  // Only extra discounts added from Shopify admin appear here.
  // Tier / catalog / checkout-code discounts stay inside the line prices.
  let discountAmount = allocatedManual;
  if (discountAmount < 0.005) {
    discountAmount = manualDiscountFromApps(apps, discountedSubtotal);
  }
  const discountLabel = "Discount";

  const taxes = money(order.taxes);
  const shipping = money(order.shipping);
  let subtotal = discountedSubtotal;
  const impliedTotal = discountedSubtotal + taxes + shipping;
  const shopifyTotal = money(order.totalPrice?.amount);

  if (
    discountAmount > 0.004 &&
    allocatedManual < 0.005 &&
    shopifyTotal > 0 &&
    Math.abs(impliedTotal - shopifyTotal) < 0.05
  ) {
    subtotal = discountedSubtotal + discountAmount;
  }

  const grandTotal =
    shopifyTotal || Math.max(0, subtotal - discountAmount) + taxes + shipping;

  const withCompany = (addr: Record<string, any> | null) =>
    formatInvoiceAddressLines({
      ...(addr || {}),
      company:
        firstNonEmpty(addr?.company, customerCompanyName) || undefined,
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
