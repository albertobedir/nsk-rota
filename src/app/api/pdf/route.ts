/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import prisma from "@/lib/prisma/instance";
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";
import { buildInvoicePdf } from "@/lib/pdf/invoice-document";

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

        const shopifyId = id.startsWith("gid://")
          ? id
          : `gid://shopify/Order/${id}`;

        const dbOrder = await Order.findOne({ shopifyId }).lean();

        if (dbOrder) {
          console.log("✅ Order fetched from MongoDB:", shopifyId);
          const raw = (dbOrder.raw || {}) as any;

          // Adresleri DB'den al (REST format — snake_case)
          const billing = (dbOrder.billingAddress ||
            raw.billing_address) as any;
          const shipping = (dbOrder.shippingAddress ||
            raw.shipping_address) as any;

          const mapAddress = (addr: any) => {
            if (!addr) return null;
            return {
              name:
                addr.name ||
                [addr.first_name, addr.last_name].filter(Boolean).join(" ") ||
                "",
              company: addr.company || "",
              address1: addr.address1 || "",
              address2: addr.address2 || "",
              city: addr.city || "",
              zip: addr.zip || "",
              province: addr.province || "",
              country: addr.country || "",
              countryCode: addr.country_code || addr.countryCode || "",
            };
          };

          order = {
            name: dbOrder.name,
            orderNumber: dbOrder.orderNumber,
            poNumber: dbOrder.poNumber || raw.po_number || null,
            processedAt: raw.created_at || raw.createdAt,
            financialStatus: raw.financial_status || raw.displayFinancialStatus,
            fulfillmentStatus:
              raw.fulfillment_status || raw.displayFulfillmentStatus,
            totalPrice: {
              amount: raw.total_price || raw.totalPriceSet?.shopMoney?.amount,
              currencyCode:
                raw.currency ||
                raw.totalPriceSet?.shopMoney?.currencyCode ||
                "USD",
            },
            shipping:
              raw.total_shipping_price_set?.shop_money?.amount ||
              raw.totalShippingPriceSet?.shopMoney?.amount ||
              0,
            taxes: raw.total_tax || raw.totalTaxSet?.shopMoney?.amount || 0,
            billingAddress: mapAddress(billing),
            shippingAddress: mapAddress(shipping),
            customer: raw.customer || null,
            lineItems: { edges: [] }, // aşağıda doldurulacak
            raw,
          };

          // Line items
          const lineItemsArr: any[] = raw.line_items || [];
          order.lineItems = {
            edges: lineItemsArr.map((li: any) => {
              const originalPrice = Number(li.price || 0);
              const totalDiscount = Number(li.total_discount || 0);
              const qty = Number(li.quantity ?? 1);

              // ✅ İndirimli birim fiyat = (price * qty - total_discount) / qty
              const discountedUnitPrice =
                qty > 0
                  ? (originalPrice * qty - totalDiscount) / qty
                  : originalPrice;

              console.log("📦 LINE ITEM:", {
                title: li.title,
                price: li.price,
                total_discount: li.total_discount,
                qty,
                discountedUnitPrice,
              });

              return {
                node: {
                  title: li.title || li.name,
                  quantity: qty,
                  sku: li.sku || li.variant_title || "",
                  originalUnitPrice: discountedUnitPrice, // ✅ indirimli fiyatı göster
                  discountedUnitPrice: discountedUnitPrice,
                  discountDescription: null,
                  variant: {
                    price: {
                      amount: String(discountedUnitPrice),
                      currencyCode: raw.currency || "USD",
                    },
                  },
                },
              };
            }),
          };
        } else {
          console.log("❌ Order not found in MongoDB:", shopifyId);
        }
      } catch (err) {
        console.error("❌ MongoDB fetch error:", err);
      }
    }

    if (order) {
      const src = order as any;
      const raw = (src.raw || {}) as any;

      const lineItemsEdges = ((): any[] => {
        console.log("\n=== 📦 PDF LINE ITEMS DEBUG ===");
        console.log(
          "PDF src.lineItems:",
          JSON.stringify(src.lineItems, null, 2),
        );
        console.log(
          "PDF raw.lineItems:",
          JSON.stringify(raw.lineItems, null, 2),
        );

        // GraphQL formatı (Shopify'dan direkt)
        if (src.lineItems?.edges) {
          console.log("✅ Using src.lineItems.edges");
          return src.lineItems.edges.map((e: any) => {
            const node = e.node;
            // ✅ Zaten map edilmiş, direkt kullan
            const unitPrice = Number(
              node.discountedUnitPrice ?? node.originalUnitPrice ?? 0,
            );
            const currencyCode = node.variant?.price?.currencyCode || "USD";

            return {
              node: {
                ...node,
                originalUnitPrice: unitPrice,
                discountedUnitPrice: unitPrice,
                discountDescription: null,
                variant: {
                  ...node.variant,
                  price: {
                    amount: String(unitPrice),
                    currencyCode,
                  },
                },
              },
            };
          });
        }

        // raw içinde GraphQL formatı
        if (raw.lineItems?.edges) {
          console.log("✅ Using raw.lineItems.edges");
          return raw.lineItems.edges.map((e: any) => {
            const node = e.node;
            const originalPrice = Number(
              node.originalUnitPriceSet?.shopMoney?.amount || 0,
            );
            const discountedPrice = Number(
              node.discountedUnitPriceSet?.shopMoney?.amount || originalPrice,
            );
            const currencyCode =
              node.originalUnitPriceSet?.shopMoney?.currencyCode ||
              raw.currency ||
              "USD";
            const discountDescription =
              node.discountAllocations?.[0]?.discountApplication?.description ||
              node.discountAllocations?.[0]?.discountApplication?.title ||
              null;

            return {
              node: {
                ...node,
                originalUnitPrice: originalPrice,
                discountedUnitPrice: discountedPrice,
                discountDescription,
                variant: {
                  ...node.variant,
                  price: {
                    amount: String(originalPrice),
                    currencyCode,
                  },
                },
              },
            };
          });
        }

        // REST formatı (eski kayıtlar)
        const arr = Array.isArray(raw.line_items)
          ? raw.line_items
          : Array.isArray(raw.lineItems)
            ? raw.lineItems
            : [];

        console.log("Using REST fallback, arr length:", arr.length);

        const discountApplications: any[] = raw.discount_applications || [];

        // Safety check
        if (!Array.isArray(arr)) {
          console.warn("line_items is not an array, returning empty");
          return [];
        }

        const edges = arr.map((li: any) => {
          // GraphQL formatı
          const originalPrice = Number(
            li.originalUnitPriceSet?.shopMoney?.amount || li.price || 0,
          );
          const discountedPrice = Number(
            li.discountedUnitPriceSet?.shopMoney?.amount || originalPrice,
          );
          const currencyCode =
            li.originalUnitPriceSet?.shopMoney?.currencyCode ||
            raw.currency ||
            "USD";

          // Get discount description from discountAllocations (GraphQL) or discount_applications (REST)
          const discountDescription =
            li.discountAllocations?.[0]?.discountApplication?.description ||
            li.discountAllocations?.[0]?.discountApplication?.title ||
            ((): string | null => {
              const allocation = li.discount_allocations?.[0];
              const appIndex = allocation?.discount_application_index ?? null;
              const discountApp =
                appIndex != null ? discountApplications[appIndex] : null;
              return discountApp?.description ?? discountApp?.title ?? null;
            })() ||
            null;

          return {
            node: {
              title: li.title || li.name,
              quantity: li.quantity ?? 1,
              sku: li.sku || li.variant_title || "",
              originalUnitPrice: originalPrice,
              discountedUnitPrice: discountedPrice,
              discountDescription,
              variant: {
                price: {
                  amount: String(originalPrice),
                  currencyCode,
                },
              },
            },
          };
        });
        console.log("PDF lineItemsEdges length:", edges.length);
        console.log("=== END PDF DEBUG ===\n");
        return edges;
      })();

      order = {
        fulfillmentStatus:
          src.fulfillmentStatus ||
          raw.displayFulfillmentStatus ||
          raw.fulfillment_status,
        financialStatus:
          src.financialStatus ||
          raw.displayFinancialStatus ||
          raw.financial_status,
        processedAt:
          src.processedAt ||
          src.createdAt ||
          raw.createdAt ||
          raw.processed_at ||
          null,
        orderNumber:
          src.orderNumber || src.name || raw.name || raw.order_number || id,
        totalPrice: {
          amount:
            src.totalPriceSet?.shopMoney?.amount ||
            raw.totalPriceSet?.shopMoney?.amount ||
            src.totalPrice?.amount ||
            raw.total_price ||
            raw.current_total_price ||
            null,
          currencyCode:
            src.totalPriceSet?.shopMoney?.currencyCode ||
            raw.totalPriceSet?.shopMoney?.currencyCode ||
            src.totalPrice?.currencyCode ||
            raw.currency ||
            raw.presentment_currency ||
            null,
        },
        shippingAddress:
          src.shippingAddress ||
          (raw.shipping_address
            ? {
                name:
                  raw.shipping_address.name ||
                  raw.shipping_address.full_name ||
                  "",
                company: raw.shipping_address.company || "",
                address1: raw.shipping_address.address1 || "",
                address2: raw.shipping_address.address2 || "",
                city:
                  raw.shipping_address.city ||
                  raw.shipping_address.province ||
                  "",
                zip: raw.shipping_address.zip || "",
                country:
                  raw.shipping_address.country ||
                  raw.shipping_address.country_name ||
                  "",
              }
            : null),
        billingAddress:
          src.billingAddress ||
          (raw.billing_address
            ? {
                name:
                  raw.billing_address.name ||
                  raw.billing_address.full_name ||
                  "",
                company: raw.billing_address.company || "",
                address1: raw.billing_address.address1 || "",
                address2: raw.billing_address.address2 || "",
                city:
                  raw.billing_address.city ||
                  raw.billing_address.province ||
                  "",
                zip: raw.billing_address.zip || "",
                country:
                  raw.billing_address.country ||
                  raw.billing_address.country_name ||
                  "",
              }
            : null),
        lineItems: { edges: lineItemsEdges },
        customer: src.customer || raw.customer || null,
        shipping:
          raw.totalShippingPriceSet?.shopMoney?.amount ||
          raw.shipping_lines?.[0]?.price ||
          0,
        taxes: raw.totalTaxSet?.shopMoney?.amount || raw.total_tax || 0,
        poNumber: src.poNumber || raw.po_number || raw.poNumber || null,
      };
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

    const buildAddrLines = (addr: Record<string, any> | null): string[] => {
      if (!addr) return ["-"];
      return [
        addr.name,
        addr.company,
        addr.address1,
        addr.address2,
        [addr.city, addr.zip].filter(Boolean).join(", "),
        addr.country,
      ].filter(Boolean) as string[];
    };

    const buildBillToLines = (
      customerData: Record<string, any> | null,
      addr: Record<string, any> | null,
    ): string[] => {
      const lines: string[] = [];
      if (addr) {
        if (addr.company) lines.push(addr.company);
        if (addr.city) lines.push(addr.city);
        if (addr.address1) lines.push(addr.address1);
        if (addr.address2) lines.push(addr.address2);
        if (addr.country) lines.push(addr.country);
      }
      if (customerData) {
        const firstName =
          customerData.first_name || customerData.firstName || "";
        const lastName = customerData.last_name || customerData.lastName || "";
        const fullName = [firstName, lastName].filter(Boolean).join(" ");
        if (fullName) lines.push(fullName);
        if (customerData.email) lines.push(customerData.email);
      }
      return lines.length > 0 ? lines : ["-"];
    };

    const itemsList =
      (order?.lineItems?.edges as Array<Record<string, any>>) || [];
    let subtotal = 0;
    const items = itemsList.map((e) => {
      const node = (e?.node || e) as Record<string, any>;
      const qty = Number(node?.quantity ?? node?.current_quantity ?? 1);
      const originalPrice = Number(
        node?.originalUnitPrice ?? node?.variant?.price?.amount ?? 0,
      );
      const discountedPrice = Number(
        node?.discountedUnitPrice ?? originalPrice,
      );
      const lineTotal = discountedPrice * qty;
      subtotal += lineTotal;
      return {
        title: String(node?.title || node?.name || "Item"),
        quantity: qty,
        sku: String(node?.sku || ""),
        customerNo: "-",
        unitPrice: discountedPrice,
        lineTotal,
      };
    });
    const grandTotal = Number(order?.totalPrice?.amount) || subtotal;

    const pdfBuffer = await buildInvoicePdf({
      orderNumber: String(orderNum),
      dateLabel: dateStr,
      status: String(statusStr),
      terms: "Net 30",
      currency,
      poNumber: String(order?.poNumber || "").trim() || "—",
      billTo: buildBillToLines(
        customer || order?.customer || null,
        order?.billingAddress || order?.shippingAddress || null,
      ),
      shipTo: buildAddrLines(order?.shippingAddress || null),
      items,
      subtotal,
      taxes: Number(order?.taxes || 0) || 0,
      shipping: Number(order?.shipping || 0) || 0,
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
