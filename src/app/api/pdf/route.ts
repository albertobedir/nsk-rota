/* eslint-disable @typescript-eslint/no-explicit-any */
import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    const origin = url.origin;

    // Try to fetch order data (if id provided) from internal API and normalize it
    let order: Record<string, any> | null = null;
    if (id) {
      try {
        const res = await fetch(`${origin}/api/orders/${encodeURIComponent(id)}`);
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
                    amount: li.price || li.price_set?.shop_money?.amount || null,
                    currencyCode: raw.currency || raw.presentment_currency || null,
                  },
                },
              },
            }));
          })();

          order = {
            id: src._id?.toString?.() || src.id || src.shopifyId || raw.id,
            orderNumber:
              src.orderNumber || src.order_number || raw.order_number || src.name,
            processedAt: src.processedAt || raw.processed_at || src.createdAt,
            financialStatus: src.financialStatus || raw.financial_status,
            fulfillmentStatus: src.fulfillmentStatus || raw.fulfillment_status,
            totalPrice: {
              amount:
                src.totalPrice?.amount || raw.total_price || raw.current_total_price || null,
              currencyCode:
                src.totalPrice?.currencyCode || raw.currency || raw.presentment_currency || null,
            },
            shippingAddress:
              src.shippingAddress ||
              (raw.shipping_address
                ? {
                    address1: raw.shipping_address.address1 || "",
                    city: raw.shipping_address.city || raw.shipping_address.province || "",
                    zip: raw.shipping_address.zip || "",
                    country: raw.shipping_address.country || raw.shipping_address.country_name || "",
                    name: raw.shipping_address.name || raw.shipping_address.full_name || undefined,
                  }
                : null),
            billingAddress:
              src.billingAddress ||
              (raw.billing_address
                ? {
                    address1: raw.billing_address.address1 || "",
                    city: raw.billing_address.city || raw.billing_address.province || "",
                    zip: raw.billing_address.zip || "",
                    country: raw.billing_address.country || raw.billing_address.country_name || "",
                    name: raw.billing_address.name || raw.billing_address.full_name || undefined,
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

    const doc = new PDFDocument({ autoFirstPage: true });

    // Register bundled fonts (regular + semibold) to use in layout
    const fontsDir = path.join(process.cwd(), "src", "font", "biotif");
    const regularFont = path.join(
      fontsDir,
      "Fontspring-DEMO-biotif-regular.otf",
    );
    const semiboldFont = path.join(
      fontsDir,
      "Fontspring-DEMO-biotif-semibold.otf",
    );
    if (fs.existsSync(regularFont)) doc.font(regularFont);

    // Small helpers
    const formatMoney = (amt: any, cur = "") => {
      const n = Number(amt);
      if (Number.isNaN(n)) return `${amt || "-"} ${cur}`;
      return `${n.toFixed(2)} ${cur}`.trim();
    };

    const pageWidth = doc.page.width;
    const margin = 50;

    // Prepare PDF data chunks collector
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Uint8Array | Buffer) =>
      chunks.push(Buffer.from(chunk)),
    );

    // Header: left=brand, right=invoice meta
    if (fs.existsSync(semiboldFont)) doc.font(semiboldFont).fontSize(18);
    else doc.fontSize(18).font(regularFont);
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.webp");
      if (fs.existsSync(logoPath)) {
        doc.image(logoPath, margin, 30, { width: 140 });
      } else {
        doc.text("NSK Group", margin, 40);
      }
    } catch (_e) {
      doc.text("NSK Group", margin, 40);
    }

    const rightX = pageWidth - margin;
    doc.fontSize(10);
    const invoiceLabel = `Invoice ${order?.orderNumber || order?.id || id || "#"}`;
    doc.text(invoiceLabel, rightX - 200, 40, { width: 200, align: "right" });
    doc.moveDown(1);

    // Order metadata + payment CTA
    doc.moveDown(0.5);
    doc.font(regularFont).fontSize(10);
    doc.text(`Order ID: ${order?.id || id || "-"}`, margin, doc.y);
    doc.text(
      `Date: ${(order?.processedAt || "").slice(0, 10) || "-"}`,
      rightX - 200,
      doc.y,
      { width: 200, align: "right" },
    );

    // No payment CTA — start summary below header/logo
    const summaryStartY = 80;

    // Order Summary title
    if (fs.existsSync(semiboldFont)) doc.font(semiboldFont).fontSize(14);
    else doc.font(regularFont).fontSize(14);
    doc.fillColor("black").text("Order summary", margin, summaryStartY);

    // Item row (thumbnail + title + qty + price)
    const itemY = summaryStartY + 20;
    const thumbX = margin;
    const thumbSize = 36;
    const textX = thumbX + thumbSize + 12;
    const priceX = pageWidth - margin - 60;

    // Render all items with thumbnail box, title, qty and right-aligned line total
    const itemsList =
      (order?.lineItems?.edges as Array<Record<string, any>>) || [];
    let itemsY = itemY;
    if (itemsList.length === 0) {
      doc.font(regularFont).fontSize(10).text("- No items -", margin, itemsY);
      itemsY += 18;
    } else {
      itemsList.forEach((e) => {
        const node = (e?.node || e) as Record<string, any>;
        const title = node?.title || node?.name || "Item";
        const qty = Number(node?.quantity ?? node?.current_quantity ?? 1);
        const priceNum = Number(
          node?.variant?.price?.amount || node?.price || 0,
        );
        const lineTotal = (Number.isFinite(priceNum) ? priceNum : 0) * qty;

        // thumbnail box
        doc
          .rect(thumbX, itemsY, thumbSize, thumbSize)
          .strokeColor("#d1d5db")
          .stroke();
        // title and qty
        doc
          .font(regularFont)
          .fontSize(10)
          .fillColor("black")
          .text(title, textX, itemsY);
        doc
          .fontSize(9)
          .fillColor("#6b7280")
          .text(`Qty: ${qty}`, textX, itemsY + 14);
        // price on right
        doc
          .fillColor("black")
          .text(
            formatMoney(
              lineTotal,
              node?.variant?.price?.currencyCode ||
                order?.totalPrice?.currencyCode ||
                "",
            ),
            priceX,
            itemsY,
          );

        itemsY += thumbSize + 12;
      });
    }

    // Horizontal divider
    const dividerY = itemY + 54;
    doc
      .moveTo(margin, dividerY)
      .lineTo(pageWidth - margin, dividerY)
      .strokeColor("#e5e7eb")
      .stroke();

    // Totals block on right
    const totalsX = pageWidth - margin - 200;
    const totalsTop = dividerY + 12;
    const shipping =
      Number(order?.shipping || 0) ||
      Number(order?.totalPrice?.shipping || 0) ||
      0;
    const taxes = Number(order?.taxes || 0) || 0;
    let subtotal = 0;
    itemsList.forEach((e) => {
      const node = (e?.node || e) as Record<string, any>;
      const qty = Number(node?.quantity ?? node?.current_quantity ?? 1);
      const priceNum = Number(node?.variant?.price?.amount || node?.price || 0);
      subtotal += (Number.isFinite(priceNum) ? priceNum : 0) * qty;
    });

    doc.font(regularFont).fontSize(10).fillColor("#374151");
    doc.text("Subtotal", totalsX, totalsTop);
    doc.text(
      formatMoney(subtotal, order?.totalPrice?.currencyCode || ""),
      pageWidth - margin - 10,
      totalsTop,
      { align: "right" },
    );
    doc.text("Shipping", totalsX, totalsTop + 14);
    doc.text(
      formatMoney(shipping, order?.totalPrice?.currencyCode || ""),
      pageWidth - margin - 10,
      totalsTop + 14,
      { align: "right" },
    );
    doc.text("Estimated taxes", totalsX, totalsTop + 28);
    doc.text(
      formatMoney(taxes, order?.totalPrice?.currencyCode || ""),
      pageWidth - margin - 10,
      totalsTop + 28,
      { align: "right" },
    );

    // Amount to pay emphasized
    const amountY = totalsTop + 48;
    if (fs.existsSync(semiboldFont)) doc.font(semiboldFont).fontSize(12);
    doc.text("Amount to pay", totalsX, amountY);
    doc.text(
      formatMoney(
        order?.totalPrice?.amount || subtotal + shipping + taxes,
        order?.totalPrice?.currencyCode || "",
      ),
      pageWidth - margin - 10,
      amountY,
      { align: "right" },
    );

    // Customer information heading
    const custY = itemsY + 24;
    if (fs.existsSync(semiboldFont)) doc.font(semiboldFont).fontSize(12);
    else doc.font(regularFont).fontSize(12);
    doc.fillColor("black").text("Customer information", margin, custY);
    doc.moveDown(0.2);

    // Shipping and billing columns
    doc.font(regularFont).fontSize(10).fillColor("#374151");
    const leftColX = margin;
    const rightColX = pageWidth / 2 + 10;
    const ship = order?.shippingAddress || {};
    const shipLines = [
      ship.name || "",
      ship.address1 || "",
      `${ship.city || ""} ${ship.zip || ""}`.trim(),
      ship.country || "",
    ].filter(Boolean);
    const billing = order?.billingAddress || {};
    const billLines = [
      billing.name || "",
      billing.address1 || "",
      `${billing.city || ""} ${billing.zip || ""}`.trim(),
      billing.country || "",
    ].filter(Boolean);
    const addrStartY = custY + 20;
    shipLines.forEach((l, i) => doc.text(l, leftColX, addrStartY + i * 12));
    billLines.forEach((l, i) => doc.text(l, rightColX, addrStartY + i * 12));

    // Shipping method below
    const methodY =
      addrStartY + Math.max(shipLines.length, billLines.length) * 12 + 14;
    if (order?.shipping_method || order?.shipping_method_title) {
      doc
        .font(regularFont)
        .fontSize(10)
        .fillColor("#374151")
        .text("Shipping method", leftColX, methodY);
      doc
        .font(regularFont)
        .fontSize(10)
        .fillColor("#6b7280")
        .text(
          order?.shipping_method || order?.shipping_method_title || "",
          leftColX,
          methodY + 12,
        );
    } else if (shipping) {
      doc
        .font(regularFont)
        .fontSize(10)
        .fillColor("#374151")
        .text("Shipping", leftColX, methodY);
      doc
        .font(regularFont)
        .fontSize(10)
        .fillColor("#6b7280")
        .text(
          formatMoney(shipping, order?.totalPrice?.currencyCode || ""),
          leftColX,
          methodY + 12,
        );
    }

    // Finalize document
    doc.end();

    const pdfBuffer: Buffer = await new Promise((resolve) => {
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
    });

    // Response body expects BodyInit (Uint8Array, ArrayBuffer, etc.) — provide Uint8Array
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
