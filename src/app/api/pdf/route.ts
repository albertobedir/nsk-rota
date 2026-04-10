/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import prisma from "@/lib/prisma/instance";
import { connectDB } from "@/lib/mongoose/instance";
import Order from "@/schemas/mongoose/order";

export const runtime = "nodejs";

const FONT_REGULAR = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";

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
      };
    }

    // DEBUG logs
    console.log("=== 🧾 ORDER FULL OBJECT ===");
    console.log(JSON.stringify(order, null, 2));
    console.log("=== BILLING ADDRESS ===");
    console.log(JSON.stringify(order?.billingAddress, null, 2));
    console.log("=== SHIPPING ADDRESS ===");
    console.log(JSON.stringify(order?.shippingAddress, null, 2));
    console.log("=== CUSTOMER ===");
    console.log(JSON.stringify(customer, null, 2));
    console.log("=== END ORDER DEBUG ===");

    if (!order) {
      return new Response(
        JSON.stringify({ ok: false, error: "Order not found or invalid" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // ── Document setup ──────────────────────────────────────────────────────
    const doc = new PDFDocument({
      autoFirstPage: true,
      size: "A4",
      margins: { top: 40, bottom: 50, left: 45, right: 45 },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Uint8Array | Buffer) =>
      chunks.push(Buffer.from(chunk)),
    );

    const pageWidth = doc.page.width; // 595
    const margin = 45;
    const contentWidth = pageWidth - margin * 2;

    const formatMoney = (amt: any, cur = "USD") => {
      const n = Number(amt);
      if (Number.isNaN(n) || amt === null || amt === undefined || amt === "")
        return "$-";
      return `$${n.toFixed(2)} ${cur}`.trim();
    };

    const formatDate = (val: any): string => {
      if (!val) return "-";
      const s = String(val).slice(0, 10);
      const [y, m, d2] = s.split("-");
      if (!y || !m || !d2) return s;
      return `${d2}/${m}/${y}`;
    };

    // ── Colours ─────────────────────────────────────────────────────────────
    const ACCENT = "#1a3b6e"; // deep navy (ROTA brand)
    const ACCENT2 = "#2563a8"; // medium blue for rule lines
    const LIGHT_BG = "#f0f4f8";
    const DIVIDER = "#c8d4e0";
    const TEXT_MUTED = "#6b7280";
    const TEXT_DARK = "#1f2937";
    const WHITE = "#ffffff";

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 1 — TOP: Logo + Company info  |  "COMMERCIAL INVOICE" + meta
    // ─────────────────────────────────────────────────────────────────────────
    let curY = 40;

    // Logo
    const logoSvgPath = path.join(process.cwd(), "public", "logo.svg");
    const logoWebpPath = path.join(process.cwd(), "public", "logo.webp");
    let logoInserted = false;
    for (const lp of [logoSvgPath, logoWebpPath]) {
      if (!logoInserted && fs.existsSync(lp)) {
        try {
          const pngBuf = await sharp(lp)
            .resize({ height: 100 })
            .png()
            .toBuffer();
          doc.image(pngBuf, margin, curY, { height: 50, fit: [160, 50] });
          logoInserted = true;
        } catch (_) {
          /* skip */
        }
      }
    }
    if (!logoInserted) {
      doc
        .font(FONT_BOLD)
        .fontSize(20)
        .fillColor(ACCENT)
        .text("ROTA", margin, curY + 10, { width: 160 });
    }

    // "COMMERCIAL INVOICE" title — right aligned
    doc
      .font(FONT_BOLD)
      .fontSize(18)
      .fillColor(ACCENT)
      .text("COMMERCIAL INVOICE", margin + contentWidth - 230, curY + 6, {
        width: 230,
        align: "right",
      });

    curY += 60;

    // Thin accent rule under logo/title
    doc
      .moveTo(margin, curY)
      .lineTo(pageWidth - margin, curY)
      .strokeColor(ACCENT2)
      .lineWidth(1.5)
      .stroke();
    curY += 10;

    // Supplier info (left) | Invoice meta (right)
    const supplierX = margin;
    const metaX = margin + contentWidth - 200;
    const metaLabelW = 80;
    const metaValW = 120;

    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor(ACCENT)
      .text("SUPPLIER:", supplierX, curY);
    const supplierBodyY = curY + 13;
    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor(TEXT_DARK)
      .text("ROTA North America, LLC", supplierX, supplierBodyY);
    doc
      .font(FONT_REGULAR)
      .fontSize(8.5)
      .fillColor(TEXT_DARK)
      .text("10 N Martingale Rd #400", supplierX, supplierBodyY + 12)
      .text("Schaumburg, IL 60173, USA", supplierX, supplierBodyY + 23);

    // Meta block: Date / Invoice No / Page
    const orderNum = order?.name || `#${order?.orderNumber}` || id || "-";
    const dateStr = formatDate(order?.processedAt);

    const metaRow = (label: string, val: string, y: number) => {
      doc
        .font(FONT_BOLD)
        .fontSize(8.5)
        .fillColor(TEXT_DARK)
        .text(label, metaX, y, { width: metaLabelW });
      doc
        .font(FONT_REGULAR)
        .fontSize(8.5)
        .fillColor(TEXT_DARK)
        .text(val, metaX + metaLabelW, y, { width: metaValW });
    };
    metaRow("Date:", dateStr, curY);
    metaRow("Invoice No:", orderNum, curY + 13);
    metaRow("Page:", "1", curY + 26);

    curY += 55;

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 2 — BILL TO / SHIP TO / DETAILS  (grey band)
    // ─────────────────────────────────────────────────────────────────────────
    const addrBandH = 90;
    doc.rect(margin, curY, contentWidth, addrBandH).fill(LIGHT_BG);

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

    // Build BILL TO lines with customer info + address
    const buildBillToLines = (
      customer: Record<string, any> | null,
      addr: Record<string, any> | null,
    ): string[] => {
      const lines: string[] = [];

      // BILL TO sırası: Address → Customer
      if (addr) {
        const company = addr.company || "";
        if (company) lines.push(company);

        const city = addr.city || "";
        if (city) lines.push(city);

        const addr1 = addr.address1 || "[address1 boş]";
        if (addr1) lines.push(addr1);

        const addr2 = addr.address2 || "";
        if (addr2) lines.push(addr2);

        const country = addr.country || "";
        if (country) lines.push(country);
      }

      if (customer) {
        // Handle both snake_case (Shopify) and camelCase (MongoDB)
        const firstName = customer.first_name || customer.firstName || "";
        const lastName = customer.last_name || customer.lastName || "";
        const fullName = [firstName, lastName].filter(Boolean).join(" ");
        if (fullName) lines.push(fullName);

        const email = customer.email || "";
        if (email) lines.push(email);
      }

      return lines.length > 0 ? lines : ["-"];
    };

    const thirdW = (contentWidth - 20) / 3;

    // "Bill To"
    doc
      .font(FONT_BOLD)
      .fontSize(8.5)
      .fillColor(ACCENT)
      .text("BILL TO", margin + 8, curY + 8);
    const billLines = buildBillToLines(
      customer || order?.customer || null,
      order?.billingAddress || order?.shippingAddress || null,
    );
    let lineY = curY + 21;
    doc.font(FONT_REGULAR).fontSize(8.5).fillColor(TEXT_DARK);
    billLines.forEach((l) => {
      doc.text(l, margin + 8, lineY, { width: thirdW - 8 });
      lineY += 12;
    });

    // "Ship To"
    const shipX = margin + thirdW + 10;
    doc
      .font(FONT_BOLD)
      .fontSize(8.5)
      .fillColor(ACCENT)
      .text("SHIP TO", shipX, curY + 8);
    const shipLines = buildAddrLines(order?.shippingAddress || null);
    lineY = curY + 21;
    doc.font(FONT_REGULAR).fontSize(8.5).fillColor(TEXT_DARK);
    shipLines.forEach((l) => {
      doc.text(l, shipX, lineY, { width: thirdW - 8 });
      lineY += 12;
    });

    // "Details"
    const detailX = margin + thirdW * 2 + 20;
    doc
      .font(FONT_BOLD)
      .fontSize(8.5)
      .fillColor(ACCENT)
      .text("DETAILS", detailX, curY + 8);
    const statusStr = order?.financialStatus || order?.fulfillmentStatus || "-";
    const detailRows: [string, string][] = [
      ["Invoice #", `${orderNum}`],
      ["Date", dateStr],
      ["Status", statusStr.toUpperCase()],
      ["Terms", "Net 30"],
    ];
    lineY = curY + 21;
    doc.font(FONT_REGULAR).fontSize(8.5).fillColor(TEXT_DARK);
    detailRows.forEach(([lbl, val]) => {
      doc
        .font(FONT_BOLD)
        .text(lbl, detailX, lineY, { width: 55, continued: false });
      doc
        .font(FONT_REGULAR)
        .text(val, detailX + 57, lineY, { width: thirdW - 65 });
      lineY += 12;
    });

    curY += addrBandH + 14;

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 3 — ITEMS TABLE
    // ─────────────────────────────────────────────────────────────────────────
    // Column widths (total = contentWidth)
    const COL = {
      no: 28,
      orderNo: 60,
      custNo: 55,
      rotaNo: 60,
      desc: 0, // fills remaining
      qty: 38,
      price: 72,
      total: 72,
    };
    COL.desc =
      contentWidth -
      COL.no -
      COL.orderNo -
      COL.custNo -
      COL.rotaNo -
      COL.qty -
      COL.price -
      COL.total;

    const tHeaderH = 30;
    doc.rect(margin, curY, contentWidth, tHeaderH).fill(ACCENT);

    const thY = curY + 10;
    let cx = margin;
    const thCell = (
      label: string,
      w: number,
      align: "left" | "center" | "right" = "center",
    ) => {
      doc
        .font(FONT_BOLD)
        .fontSize(7.5)
        .fillColor(WHITE)
        .text(label, cx + 3, thY, { width: w - 6, align });
      cx += w;
    };
    // Sub-header "UNIT PRICE\nFrom" needs two lines — handle manually
    thCell("ITEM\nNO", COL.no);
    thCell("ORDER\nNO", COL.orderNo);
    thCell("CUSTOMER\nNO", COL.custNo);
    thCell("ROTA NO", COL.rotaNo);
    thCell("DESCRIPTION", COL.desc, "left");
    thCell("LOADED\nQTY.", COL.qty);
    thCell("UNIT PRICE\nFrom", COL.price);
    thCell("TOTAL\nAMOUNT", COL.total);

    curY += tHeaderH;

    const itemsList =
      (order?.lineItems?.edges as Array<Record<string, any>>) || [];
    let subtotal = 0;
    const currency = order?.totalPrice?.currencyCode || "USD";
    const ROW_H = 24;

    if (itemsList.length === 0) {
      doc.rect(margin, curY, contentWidth, ROW_H).fill(LIGHT_BG);
      doc
        .font(FONT_REGULAR)
        .fontSize(9)
        .fillColor(TEXT_MUTED)
        .text("No items found.", margin + 8, curY + 7);
      curY += ROW_H;
    } else {
      itemsList.forEach((e, idx) => {
        const node = (e?.node || e) as Record<string, any>;
        const title = node?.title || node?.name || "Item";
        const qty = Number(node?.quantity ?? node?.current_quantity ?? 1);
        const originalPrice = Number(
          node?.originalUnitPrice ?? node?.variant?.price?.amount ?? 0,
        );
        const discountedPrice = Number(
          node?.discountedUnitPrice ?? originalPrice,
        );
        const unitPrice = discountedPrice;
        const lineTotal = unitPrice * qty;
        subtotal += lineTotal;
        const rotaNo = node?.sku || "";

        if (idx % 2 === 0) {
          doc.rect(margin, curY, contentWidth, ROW_H).fill(LIGHT_BG);
        }

        // Draw thin row border
        doc
          .rect(margin, curY, contentWidth, ROW_H)
          .strokeColor(DIVIDER)
          .lineWidth(0.4)
          .stroke();

        let rx = margin;
        const rowTextY = curY + 7;

        const rCell = (
          txt: string,
          w: number,
          opts: { bold?: boolean; align?: "left" | "center" | "right" } = {},
        ) => {
          doc
            .font(opts.bold ? FONT_BOLD : FONT_REGULAR)
            .fontSize(8.5)
            .fillColor(TEXT_DARK)
            .text(txt, rx + 3, rowTextY, {
              width: w - 6,
              align: opts.align ?? "center",
              ellipsis: true,
            });
          rx += w;
        };

        rCell(String(idx + 1), COL.no);
        rCell(String(orderNum), COL.orderNo);
        rCell("-", COL.custNo);
        rCell(rotaNo, COL.rotaNo);
        rCell(title, COL.desc, { align: "left" });
        rCell(String(qty), COL.qty);

        // Sadece ödenen fiyatı göster
        rCell(formatMoney(unitPrice, currency), COL.price, {
          align: "right",
        });

        rCell(formatMoney(lineTotal, currency), COL.total, {
          bold: true,
          align: "right",
        });

        curY += ROW_H;
      });
    }

    const totalQty = itemsList.reduce(
      (s, e) => s + Number((e?.node || e)?.quantity ?? 1),
      0,
    );

    // Calculate original subtotal and total discount
    const originalSubtotal = itemsList.reduce((s, e) => {
      const node = e?.node || e;
      const orig = Number(
        node?.originalUnitPrice ?? node?.variant?.price?.amount ?? 0,
      );
      const qty = Number(node?.quantity ?? 1);
      return s + orig * qty;
    }, 0);
    const totalDiscountAmount = originalSubtotal - subtotal;
    const grandTotal = Number(order?.totalPrice?.amount) || subtotal;

    // Helper: draw a footer row with pre-computed X offsets for each column
    const footerLabelOffset = COL.no + COL.orderNo + COL.custNo + COL.rotaNo;
    const descStart = margin + footerLabelOffset;
    const qtyStart = descStart + COL.desc;
    const priceStart = qtyStart + COL.qty;
    const totalStart = priceStart + COL.price;

    // TOTAL row
    doc.rect(margin, curY, contentWidth, ROW_H).fill(LIGHT_BG);
    doc
      .rect(margin, curY, contentWidth, ROW_H)
      .strokeColor(DIVIDER)
      .lineWidth(0.4)
      .stroke();
    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor(TEXT_DARK)
      .text("TOTAL", descStart + 3, curY + 7, {
        width: COL.desc - 6,
        align: "right",
      });
    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor(TEXT_DARK)
      .text(String(totalQty), qtyStart + 3, curY + 7, {
        width: COL.qty - 6,
        align: "center",
      });
    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor(TEXT_DARK)
      .text(formatMoney(grandTotal, currency), totalStart + 3, curY + 7, {
        width: COL.total - 6,
        align: "right",
      });
    curY += ROW_H;

    // TOTAL DAP row
    doc
      .rect(margin, curY, contentWidth, ROW_H)
      .strokeColor(DIVIDER)
      .lineWidth(0.4)
      .stroke();
    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor(TEXT_DARK)
      .text("TOTAL DAP", descStart + 3, curY + 7, {
        width: COL.desc - 6,
        align: "right",
      });
    doc
      .font(FONT_REGULAR)
      .fontSize(9)
      .fillColor(TEXT_DARK)
      .text("0", qtyStart + 3, curY + 7, {
        width: COL.qty - 6,
        align: "center",
      });
    curY += ROW_H + 16;

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 4 — Summary fields + Totals block (right side)
    // ─────────────────────────────────────────────────────────────────────────
    const summaryLabelW = 110;
    const summaryValW = 140;
    const summaryX = margin;
    const summaryRows: [string, string][] = [
      ["DELIVERY TERM", "DAP"],
      ["PAYMENT TERM", "Net 30"],
      ["TOTAL WEIGHT", "-"],
      ["TOTAL PALLET", "-"],
    ];

    let sy = curY;
    doc.font(FONT_REGULAR).fontSize(8.5);
    summaryRows.forEach(([lbl, val]) => {
      doc
        .font(FONT_BOLD)
        .fillColor(TEXT_DARK)
        .text(lbl, summaryX, sy, { width: summaryLabelW });
      doc
        .font(FONT_REGULAR)
        .fillColor(TEXT_DARK)
        .text(val, summaryX + summaryLabelW + 4, sy, { width: summaryValW });
      sy += 17;
    });

    // Totals block — right side
    const totW = 220;
    const totX = pageWidth - margin - totW;
    let totY = curY;

    const totRow = (
      label: string,
      val: string,
      bold = false,
      highlight = false,
    ) => {
      if (highlight) {
        doc.rect(totX, totY - 2, totW, 20).fill(ACCENT);
        doc
          .font(FONT_BOLD)
          .fontSize(9.5)
          .fillColor(WHITE)
          .text(label, totX + 6, totY + 2, { width: 120 });
        doc
          .font(FONT_BOLD)
          .fontSize(9.5)
          .fillColor(WHITE)
          .text(val, totX + 126, totY + 2, {
            width: totW - 132,
            align: "right",
          });
      } else {
        doc
          .font(bold ? FONT_BOLD : FONT_REGULAR)
          .fontSize(9)
          .fillColor(bold ? TEXT_DARK : TEXT_MUTED)
          .text(label, totX + 6, totY, { width: 120 });
        doc
          .font(bold ? FONT_BOLD : FONT_REGULAR)
          .fontSize(9)
          .fillColor(TEXT_DARK)
          .text(val, totX + 126, totY, { width: totW - 132, align: "right" });
      }
      totY += 17;
    };

    const shipping = Number(order?.shipping || 0) || 0;
    const taxes = Number(order?.taxes || 0) || 0;
    totRow("Subtotal", formatMoney(subtotal, currency));
    totRow("Sales Tax", formatMoney(taxes, currency));
    totRow("Shipping", formatMoney(shipping, currency));
    // Divider
    doc
      .moveTo(totX, totY - 2)
      .lineTo(totX + totW, totY - 2)
      .strokeColor(ACCENT)
      .lineWidth(1)
      .stroke();
    totY += 8;
    totRow("Total", formatMoney(grandTotal, currency), true, true);

    curY = Math.max(sy, totY) + 15;

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 5 — Payment Information
    // ─────────────────────────────────────────────────────────────────────────
    doc
      .moveTo(margin, curY)
      .lineTo(pageWidth - margin, curY)
      .strokeColor(DIVIDER)
      .lineWidth(0.8)
      .stroke();
    curY += 10;

    const halfW = (contentWidth - 20) / 2;

    // Banking details (left)
    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor(ACCENT)
      .text("BANKING DETAILS", margin, curY);
    curY += 14;
    const bankRows: [string, string][] = [
      ["Name:", "ROTA NORTH AMERICA LLC"],
      ["Bank:", "CHASE BANK"],
      ["Account No:", "610891258"],
      ["Routing No:", "021202337"],
    ];
    bankRows.forEach(([lbl, val]) => {
      doc
        .font(FONT_BOLD)
        .fontSize(8.5)
        .fillColor(TEXT_DARK)
        .text(lbl, margin, curY, { width: 80, continued: false });
      doc
        .font(FONT_REGULAR)
        .fontSize(8.5)
        .fillColor(TEXT_DARK)
        .text(val, margin + 82, curY, { width: halfW - 82 });
      curY += 14;
    });

    // Pay by check / wire (right)
    const payX = margin + halfW + 20;
    let payY = curY - bankRows.length * 14 - 14;
    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor(ACCENT)
      .text("PAYMENT INSTRUCTIONS", payX, payY);
    payY += 14;
    doc
      .font(FONT_BOLD)
      .fontSize(8.5)
      .fillColor(TEXT_DARK)
      .text("PAY BY CHECK", payX, payY);
    payY += 14;
    doc
      .font(FONT_REGULAR)
      .fontSize(8.5)
      .fillColor(TEXT_DARK)
      .text(
        "Check mailing address: 14 Hughes Ste B200, Irvine CA 92618",
        payX,
        payY,
        { width: halfW },
      );
    payY += 16;
    doc
      .font(FONT_BOLD)
      .fontSize(8.5)
      .fillColor(TEXT_DARK)
      .text("FOR WIRE TRANSFERS:", payX, payY);
    payY += 14;
    doc
      .font(FONT_REGULAR)
      .fontSize(8.5)
      .fillColor(TEXT_DARK)
      .text("Please use routing number 021000021", payX, payY, {
        width: halfW,
      });
    payY += 16;
    doc
      .font(FONT_BOLD)
      .fontSize(8.5)
      .fillColor(TEXT_DARK)
      .text("PAY BY ZELLE", payX, payY);
    payY += 14;
    doc
      .font(FONT_REGULAR)
      .fontSize(8.5)
      .fillColor(TEXT_DARK)
      .text("NAME: b.kilic@nskgroup.com.tr", payX, payY, {
        width: halfW,
      });

    curY += 32;

    // ─────────────────────────────────────────────────────────────────────────
    // SECTION 6 — Notes
    // ─────────────────────────────────────────────────────────────────────────
    doc
      .moveTo(margin, curY)
      .lineTo(pageWidth - margin, curY)
      .strokeColor(DIVIDER)
      .lineWidth(0.5)
      .stroke();
    curY += 10;

    const notes = [
      "* Please send back this commercial invoice to us by e-mail with your signature and stamp within 15 days after receiving the shipment complete and correct related to this commercial invoice.",
      "  Or please make an official notice by e-mail within 15 days after receiving the shipment if you have received any damaged / wrong / missing goods.",
      "  The delivered goods will be accepted as complete and correct after 15 days with no feedback.",
      "* The goods are of Turkish origin.",
    ];
    doc.font(FONT_REGULAR).fontSize(7.5).fillColor(TEXT_MUTED);
    notes.forEach((n) => {
      const noteH = doc.heightOfString(n, { width: contentWidth });
      doc.text(n, margin, curY, { width: contentWidth, lineGap: 1 });
      curY += noteH + 4;
    });

    // ── FOOTER ───────────────────────────────────────────────────────────────
    // Sabit footerY yerine curY kullan
    curY += 15;

    doc
      .moveTo(margin, curY)
      .lineTo(pageWidth - margin, curY)
      .strokeColor(DIVIDER)
      .lineWidth(0.5)
      .stroke();

    doc
      .font(FONT_REGULAR)
      .fontSize(7.5)
      .fillColor(TEXT_MUTED)
      .text(
        "ROTA North America, LLC  |  10 N Martingale Rd #400, Schaumburg, IL 60173, USA  |  Thank you for your business.",
        margin,
        curY + 6,
        { width: contentWidth, align: "center" },
      );

    // ── Finalise ─────────────────────────────────────────────────────────────
    doc.end();
    const pdfBuffer: Buffer = await new Promise((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
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
