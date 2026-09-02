/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma/instance";
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";
import { buildInvoicePdf } from "@/lib/pdf/invoice-document";
import { formatInvoiceAddressLines } from "@/lib/pdf/invoice-address";
import { extractNumericId, toOrderGid } from "@/lib/shopify/ids";
import { normalizeLineItemEdges } from "@/lib/orders/line-items";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const customerId = url.searchParams.get("customerId");
    const discountParam = url.searchParams.get("discount");
    const userDiscount = discountParam ? Number(discountParam) : null;
    const origin = url.origin;

    // Fetch customer data from database if customerId provided
    let customer: Record<string, any> | null = null;
    if (customerId) {
      try {
        customer = await prisma.user.findFirst({
          where: {
            OR: [
              { id: customerId }, // cuid ile dene
              { shopifyCustomerId: customerId }, // GID ile dene
            ],
          },
        });
      } catch (_err) {
        customer = null;
      }
    }

    // Fetch and normalise order data (from MongoDB)
    let order: Record<string, any> | null = null;
    if (id) {
      try {
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

        if (dbOrder) {
          console.log("✅ Order fetched from MongoDB:", dbOrder.shopifyId);
          const raw = (dbOrder.raw || {}) as any;
          const billing = (dbOrder.billingAddress ||
            raw.billing_address ||
            raw.billingAddress) as any;
          const shipping = (dbOrder.shippingAddress ||
            raw.shipping_address ||
            raw.shippingAddress) as any;

          const mapAddress = (addr: any) => {
            if (!addr) return null;
            return {
              name:
                addr.name ||
                [
                  addr.firstName || addr.first_name,
                  addr.lastName || addr.last_name,
                ]
                  .filter(Boolean)
                  .join(" ") ||
                "",
              company: addr.company || "",
              address1: addr.address1 || "",
              address2: addr.address2 || "",
              city: addr.city || "",
              zip: addr.zip || "",
              province:
                addr.province || addr.provinceCode || addr.province_code || "",
              country:
                addr.country || addr.country_name || addr.countryName || "",
              countryCode:
                addr.country_code ||
                addr.countryCode ||
                addr.countryCodeV2 ||
                "",
            };
          };

          const orderName = String(
            dbOrder.name || raw.name || "",
          ).trim();
          const orderNumber =
            dbOrder.orderNumber ||
            raw.order_number ||
            String(orderName).replace(/^#/, "") ||
            id;

          order = {
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
        } else {
          console.log("❌ Order not found in MongoDB:", id);
        }
      } catch (err) {
        console.error("❌ MongoDB fetch error:", err);
      }
    }

    if (!order) {
      return new Response(
        JSON.stringify({ ok: false, error: "Order not found or invalid" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const formatDate = (val: any): string => {
      if (!val) return "-";
      const s = String(val).slice(0, 10);
      const [y, m, d2] = s.split("-");
      if (!y || !m || !d2) return s;
      return `${d2}/${m}/${y}`;
    };

    const orderNum = order?.name || `#${order?.orderNumber}` || id || "-";
    const dateStr = formatDate(order?.processedAt);
    const statusStr = order?.financialStatus || order?.fulfillmentStatus || "-";
    const currency = order?.totalPrice?.currencyCode || "USD";
    const raw = (order?.raw || {}) as Record<string, any>;

    const billingAddr =
      order?.billingAddress || order?.shippingAddress || null;
    const shippingAddr =
      order?.shippingAddress || order?.billingAddress || null;

    const money = (value: unknown): number => {
      const n = Number(value ?? 0);
      return Number.isFinite(n) ? n : 0;
    };

    const itemsList =
      (order?.lineItems?.edges as Array<Record<string, any>>) || [];
    let originalSubtotal = 0;
    let discountedSubtotal = 0;
    let discountDescription = "";
    const items = itemsList.map((e) => {
      const node = (e?.node || e) as Record<string, any>;
      const qty = Number(node?.quantity ?? node?.current_quantity ?? 1) || 1;
      const originalPrice = money(
        node?.originalUnitPrice ?? node?.variant?.price?.amount,
      );
      const discountedPrice = money(
        node?.discountedUnitPrice ?? originalPrice,
      );
      const unitPrice = originalPrice > 0 ? originalPrice : discountedPrice;
      const lineTotal = unitPrice * qty;
      originalSubtotal += lineTotal;
      discountedSubtotal += discountedPrice * qty;
      if (!discountDescription && node?.discountDescription) {
        discountDescription = String(node.discountDescription);
      }
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
    const lineDiscount = Math.max(0, originalSubtotal - discountedSubtotal);
    let discountAmount =
      shopifyDiscount > 0.004 ? shopifyDiscount : lineDiscount;

    if (
      discountAmount < 0.005 &&
      Number.isFinite(userDiscount) &&
      (userDiscount as number) > 0 &&
      originalSubtotal > 0
    ) {
      discountAmount = originalSubtotal * ((userDiscount as number) / 100);
    }

    const discountCodes = [
      ...(Array.isArray(raw.discount_codes) ? raw.discount_codes : []),
      ...(Array.isArray(raw.discountCodes) ? raw.discountCodes : []),
    ]
      .map((c: any) => String(c?.code || c || "").trim())
      .filter(Boolean);
    const uniqueCodes = [...new Set(discountCodes)];

    let discountLabel = "Discount";
    if (uniqueCodes.length) {
      discountLabel = `Discount (${uniqueCodes.join(", ")})`;
    } else if (userDiscount && userDiscount > 0) {
      discountLabel = `Discount (${userDiscount}%)`;
    } else if (discountDescription && discountDescription.length <= 22) {
      discountLabel = `Discount (${discountDescription})`;
    }

    const subtotal = originalSubtotal;
    const grandTotal =
      money(order?.totalPrice?.amount) ||
      Math.max(0, subtotal - discountAmount) +
        money(order?.taxes) +
        money(order?.shipping);

    const pdfBuffer = await buildInvoicePdf({
      orderNumber: String(orderNum),
      dateLabel: dateStr,
      status: String(statusStr),
      terms: "Net 30",
      currency,
      poNumber: String(order?.poNumber || "").trim() || "—",
      billTo: formatInvoiceAddressLines("billing", billingAddr),
      shipTo: formatInvoiceAddressLines("shipping", shippingAddr),
      items,
      subtotal,
      discount: discountAmount,
      discountLabel,
      taxes: money(order?.taxes),
      shipping: money(order?.shipping),
      grandTotal,
      deliveryTerm: "DAP",
      paymentTerm: "Net 30",
    });

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=invoice-${id || "document"}.pdf`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
