/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

// Use built-in PDFKit/Helvetica fonts — no DEMO font artefacts
const FONT_REGULAR = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const origin = url.origin;

    // Fetch and normalise order data
    let order: Record<string, any> | null = null;
    if (id) {
      try {
        const res = await fetch(
          `${origin}/api/orders/${encodeURIComponent(id)}`,
        );
        const d = await res.json().catch(() => null);
        const src = d?.data?.data?.node || d?.data || d || null;
        if (src) {
          const raw = (src.raw || {}) as any;

          const lineItemsEdges = ((): any[] => {
            if (src.lineItems?.edges) return src.lineItems.edges;
            const arr = raw.line_items || raw.lineItems || [];
            return arr.map((li: any) => ({
              node: {
                title: li.title || li.name,
                quantity: li.quantity ?? li.current_quantity ?? 1,
                variant: {
                  image: { url: li.image?.src || li.image?.url || null },
                  price: {
                    amount:
                      li.price || li.price_set?.shop_money?.amount || null,
                    currencyCode:
                      raw.currency || raw.presentment_currency || null,
                  },
                },
              },
            }));
          })();

          order = {
            id: src._id?.toString?.() || src.id || src.shopifyId || raw.id,
            orderNumber:
              src.orderNumber ||
              src.order_number ||
              raw.order_number ||
              src.name,
            processedAt: src.processedAt || raw.processed_at || src.createdAt,
            financialStatus: src.financialStatus || raw.financial_status,
            fulfillmentStatus: src.fulfillmentStatus || raw.fulfillment_status,
            totalPrice: {
              amount:
                src.totalPrice?.amount ||
                raw.total_price ||
                raw.current_total_price ||
                null,
              currencyCode:
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
                    address1: raw.shipping_address.address1 || "",
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
                    address1: raw.billing_address.address1 || "",
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
          } as any;
        }
      } catch (_err) {
        order = null;
      }
    }

    // ── Document setup ──────────────────────────────────────────────────────
    const doc = new PDFDocument({
      autoFirstPage: true,
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Uint8Array | Buffer) =>
      chunks.push(Buffer.from(chunk)),
    );

    const pageWidth = doc.page.width;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    const formatMoney = (amt: any, cur = "") => {
      const n = Number(amt);
      if (Number.isNaN(n) || !amt) return `-`;
      return `${n.toFixed(2)} ${cur}`.trim();
    };

    const formatDate = (val: any): string => {
      if (!val) return "-";
      const s = String(val).slice(0, 10); // "YYYY-MM-DD"
      const [y, m, d2] = s.split("-");
      if (!y || !m || !d2) return s;
      return `${d2}/${m}/${y}`;
    };

    // ── Colours & sizes ─────────────────────────────────────────────────────
    const ACCENT = "#1a3c5e";
    const LIGHT_BG = "#f4f6f9";
    const DIVIDER = "#dde1e8";
    const TEXT_MUTED = "#6b7280";
    const TEXT_DARK = "#1f2937";

    // ── HEADER BAND ─────────────────────────────────────────────────────────
    doc.rect(0, 0, pageWidth, 80).fill(ACCENT);

    // Logo or company name in header
    const logoPath = path.join(process.cwd(), "public", "logo.svg");
    const logoWebp = path.join(process.cwd(), "public", "logo.webp");
    let logoInserted = false;
    for (const lp of [logoPath, logoWebp]) {
      if (!logoInserted && fs.existsSync(lp)) {
        try {
          doc.image(lp, margin, 18, { height: 44, fit: [180, 44] });
          logoInserted = true;
        } catch (_) {
          /* skip */
        }
      }
    }
    if (!logoInserted) {
      doc
        .font(FONT_BOLD)
        .fontSize(22)
        .fillColor("#ffffff")
        .text("NSK Group", margin, 26, { width: 200 });
    }

    // "INVOICE" label on right side of header
    doc
      .font(FONT_BOLD)
      .fontSize(20)
      .fillColor("#ffffff")
      .text("INVOICE", pageWidth - margin - 160, 18, {
        width: 160,
        align: "right",
      });

    const orderNum = order?.orderNumber || order?.id || id || "-";
    doc
      .font(FONT_REGULAR)
      .fontSize(10)
      .fillColor("#c8d8ea")
      .text(`#${orderNum}`, pageWidth - margin - 160, 44, {
        width: 160,
        align: "right",
      });

    // ── META ROW (light bg strip) ────────────────────────────────────────────
    const metaY = 80;
    doc.rect(0, metaY, pageWidth, 40).fill(LIGHT_BG);

    const dateStr = formatDate(order?.processedAt);
    const statusStr =
      order?.financialStatus ||
      order?.fulfillmentStatus ||
      "-";

    doc
      .font(FONT_REGULAR)
      .fontSize(9)
      .fillColor(TEXT_MUTED)
      .text("ORDER ID", margin, metaY + 7)
      .text("DATE", margin + 240, metaY + 7)
      .text("STATUS", margin + 380, metaY + 7);

    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor(TEXT_DARK)
      .text(order?.id || id || "-", margin, metaY + 19)
      .text(dateStr, margin + 240, metaY + 19)
      .text(statusStr.toUpperCase(), margin + 380, metaY + 19);

    // ── ADDRESSES ────────────────────────────────────────────────────────────
    const addrY = metaY + 56;
    const colW = (contentWidth - 20) / 2;

    const renderAddress = (
      label: string,
      addr: Record<string, any> | null,
      x: number,
      y: number,
    ) => {
      doc.font(FONT_BOLD).fontSize(9).fillColor(ACCENT).text(label, x, y);
      doc
        .moveTo(x, y + 13)
        .lineTo(x + colW, y + 13)
        .strokeColor(ACCENT)
        .lineWidth(1)
        .stroke();
      doc.font(FONT_REGULAR).fontSize(10).fillColor(TEXT_DARK);
      if (!addr) {
        doc.text("-", x, y + 18);
        return y + 34;
      }
      let lineY = y + 18;
      const lines = [
        addr.name,
        addr.address1,
        [addr.city, addr.zip].filter(Boolean).join(", "),
        addr.country,
      ].filter(Boolean);
      lines.forEach((l) => {
        doc.text(l, x, lineY, { width: colW });
        lineY += 14;
      });
      return lineY;
    };

    renderAddress("SHIP TO", order?.shippingAddress || null, margin, addrY);
    renderAddress(
      "BILL TO",
      order?.billingAddress || order?.shippingAddress || null,
      margin + colW + 20,
      addrY,
    );

    // ── ITEMS TABLE ──────────────────────────────────────────────────────────
    // Estimate address block height
    const shipLines = order?.shippingAddress
      ? [
          order.shippingAddress.name,
          order.shippingAddress.address1,
          [order.shippingAddress.city, order.shippingAddress.zip]
            .filter(Boolean)
            .join(", "),
          order.shippingAddress.country,
        ].filter(Boolean).length
      : 0;
    const tableY = addrY + Math.max(shipLines, 1) * 14 + 50;

    // Table header
    doc.rect(margin, tableY, contentWidth, 24).fill(ACCENT);
    doc
      .font(FONT_BOLD)
      .fontSize(9)
      .fillColor("#ffffff")
      .text("ITEM", margin + 8, tableY + 7)
      .text("QTY", margin + contentWidth - 200, tableY + 7, {
        width: 60,
        align: "center",
      })
      .text("UNIT PRICE", margin + contentWidth - 140, tableY + 7, {
        width: 70,
        align: "right",
      })
      .text("TOTAL", margin + contentWidth - 60, tableY + 7, {
        width: 60,
        align: "right",
      });

    const itemsList =
      (order?.lineItems?.edges as Array<Record<string, any>>) || [];

    let rowY = tableY + 24;
    let subtotal = 0;
    const currency = order?.totalPrice?.currencyCode || "";

    if (itemsList.length === 0) {
      doc
        .font(FONT_REGULAR)
        .fontSize(10)
        .fillColor(TEXT_MUTED)
        .text("No items found.", margin + 8, rowY + 10);
      rowY += 34;
    } else {
      itemsList.forEach((e, idx) => {
        const node = (e?.node || e) as Record<string, any>;
        const title = node?.title || node?.name || "Item";
        const qty = Number(node?.quantity ?? node?.current_quantity ?? 1);
        const priceNum = Number(
          node?.variant?.price?.amount || node?.price || 0,
        );
        const unitPrice = Number.isFinite(priceNum) ? priceNum : 0;
        const lineTotal = unitPrice * qty;
        subtotal += lineTotal;

        // Alternating row background
        if (idx % 2 === 0) {
          doc.rect(margin, rowY, contentWidth, 32).fill(LIGHT_BG);
        }

        doc
          .font(FONT_REGULAR)
          .fontSize(10)
          .fillColor(TEXT_DARK)
          .text(title, margin + 8, rowY + 10, {
            width: contentWidth - 220,
            ellipsis: true,
          });

        doc
          .font(FONT_REGULAR)
          .fontSize(10)
          .fillColor(TEXT_DARK)
          .text(String(qty), margin + contentWidth - 200, rowY + 10, {
            width: 60,
            align: "center",
          });

        doc
          .font(FONT_REGULAR)
          .fontSize(10)
          .fillColor(TEXT_DARK)
          .text(
            formatMoney(unitPrice, currency),
            margin + contentWidth - 140,
            rowY + 10,
            { width: 70, align: "right" },
          );

        doc
          .font(FONT_BOLD)
          .fontSize(10)
          .fillColor(TEXT_DARK)
          .text(
            formatMoney(lineTotal, currency),
            margin + contentWidth - 60,
            rowY + 10,
            { width: 60, align: "right" },
          );

        rowY += 32;
      });
    }

    // Bottom line below items
    doc
      .moveTo(margin, rowY)
      .lineTo(pageWidth - margin, rowY)
      .strokeColor(DIVIDER)
      .lineWidth(1)
      .stroke();

    // ── TOTALS BLOCK ─────────────────────────────────────────────────────────
    const totalsX = margin + contentWidth - 220;
    const totalsW = 220;
    const shipping = Number(order?.shipping || 0) || 0;
    const taxes = Number(order?.taxes || 0) || 0;
    const grandTotal =
      Number(order?.totalPrice?.amount) || subtotal + shipping + taxes;

    let totY = rowY + 14;

    const totRow = (label: string, val: string, bold = false) => {
      doc
        .font(bold ? FONT_BOLD : FONT_REGULAR)
        .fontSize(10)
        .fillColor(bold ? TEXT_DARK : TEXT_MUTED)
        .text(label, totalsX, totY, { width: 120 });
      doc
        .font(bold ? FONT_BOLD : FONT_REGULAR)
        .fontSize(10)
        .fillColor(TEXT_DARK)
        .text(val, totalsX + 120, totY, { width: 100, align: "right" });
      totY += 16;
    };

    totRow("Subtotal", formatMoney(subtotal, currency));
    totRow("Shipping", formatMoney(shipping, currency));
    totRow("Tax", formatMoney(taxes, currency));

    // Grand total divider
    doc
      .moveTo(totalsX, totY + 2)
      .lineTo(totalsX + totalsW, totY + 2)
      .strokeColor(ACCENT)
      .lineWidth(1.5)
      .stroke();
    totY += 10;

    // Grand total row on accent background
    doc.rect(totalsX, totY, totalsW, 28).fill(ACCENT);
    doc
      .font(FONT_BOLD)
      .fontSize(11)
      .fillColor("#ffffff")
      .text("AMOUNT TO PAY", totalsX + 8, totY + 8, { width: 110 });
    doc
      .font(FONT_BOLD)
      .fontSize(11)
      .fillColor("#ffffff")
      .text(formatMoney(grandTotal, currency), totalsX + 120, totY + 8, {
        width: 92,
        align: "right",
      });

    // ── FOOTER ───────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 40;
    doc
      .moveTo(margin, footerY)
      .lineTo(pageWidth - margin, footerY)
      .strokeColor(DIVIDER)
      .lineWidth(0.5)
      .stroke();
    doc
      .font(FONT_REGULAR)
      .fontSize(8)
      .fillColor(TEXT_MUTED)
      .text("NSK Group  |  Thank you for your order.", margin, footerY + 8, {
        width: contentWidth,
        align: "center",
      });

    // ── Finalise ─────────────────────────────────────────────────────────────
    doc.end();

    const pdfBuffer: Buffer = await new Promise((resolve) => {
      doc.on("end", () => resolve(Buffer.concat(chunks)));
    });

    return new Response(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename=order-${id || "document"}.pdf`,
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
