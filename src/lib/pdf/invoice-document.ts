import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const FONT_REGULAR = "Helvetica";
const FONT_BOLD = "Helvetica-Bold";

const ACCENT = "#1a3b6e";
const ACCENT2 = "#2563a8";
const LIGHT_BG = "#f0f4f8";
const DIVIDER = "#c8d4e0";
const TEXT_MUTED = "#6b7280";
const TEXT_DARK = "#1f2937";
const WHITE = "#ffffff";

const MARGIN = 45;
const FOOTER_H = 36;
const TABLE_HEADER_H = 28;
const ROW_PAD = 6;
const MAX_DESC_LINES = 2;

export type InvoicePdfItem = {
  title: string;
  quantity: number;
  sku: string;
  customerNo?: string;
  unitPrice: number;
  originalUnitPrice?: number;
  lineTotal: number;
};

export type InvoicePdfInput = {
  orderNumber: string;
  dateLabel: string;
  status: string;
  terms?: string;
  currency: string;
  billTo: string[];
  shipTo: string[];
  items: InvoicePdfItem[];
  subtotal: number;
  discount?: number;
  discountLabel?: string;
  taxes: number;
  shipping: number;
  grandTotal: number;
  deliveryTerm?: string;
  paymentTerm?: string;
  totalWeight?: string;
  totalPallet?: string;
  poNumber?: string;
  logoPng?: Buffer | null;
};

type PageKind = "items" | "closing";
type Align = "left" | "center" | "right";

const NOTES = [
  "* Please send back this commercial invoice to us by e-mail with your signature and stamp within 15 days after receiving the shipment complete and correct related to this commercial invoice.",
  "  Or please make an official notice by e-mail within 15 days after receiving the shipment if you have received any damaged / wrong / missing goods.",
  "  The delivered goods will be accepted as complete and correct after 15 days with no feedback.",
  "* The goods are of Turkish origin.",
];

export async function buildInvoicePdf(input: InvoicePdfInput): Promise<Buffer> {
  const logoPng =
    input.logoPng !== undefined ? input.logoPng : await loadLogoPng();
  const layout = new InvoiceLayout({ ...input, logoPng });
  return layout.build();
}

export async function loadLogoPng(): Promise<Buffer | null> {
  const candidates = [
    path.join(process.cwd(), "public", "logo.svg"),
    path.join(process.cwd(), "public", "logo.webp"),
  ];
  let sharpMod: typeof import("sharp") | null = null;
  try {
    sharpMod = (await import("sharp")).default;
  } catch (err) {
    console.warn("[invoice-pdf] sharp unavailable, skipping logo:", err);
    return null;
  }
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    try {
      return await sharpMod(file).resize({ height: 100 }).png().toBuffer();
    } catch {
      /* try next */
    }
  }
  return null;
}

class InvoiceLayout {
  private readonly doc: InstanceType<typeof PDFDocument>;
  private readonly input: InvoicePdfInput;
  private readonly pageW: number;
  private readonly pageH: number;
  private readonly contentW: number;
  private readonly contentBottom: number;
  private readonly cols: {
    no: number;
    orderNo: number;
    custNo: number;
    rotaNo: number;
    desc: number;
    qty: number;
    price: number;
    total: number;
  };
  private y = MARGIN;

  constructor(input: InvoicePdfInput) {
    this.input = input;
    this.doc = new PDFDocument({
      size: "A4",
      bufferPages: true,
      autoFirstPage: true,
      // Zero PDFKit margins so overflowing text cannot auto-insert blank pages.
      // We clip every text run with an explicit height and paginate ourselves.
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      info: {
        Title: `Commercial Invoice ${input.orderNumber}`,
        Author: "ROTA North America, LLC",
      },
    });
    this.pageW = this.doc.page.width;
    this.pageH = this.doc.page.height;
    this.contentW = this.pageW - MARGIN * 2;
    this.contentBottom = this.pageH - FOOTER_H;

    this.cols = {
      no: 26,
      orderNo: 52,
      custNo: 48,
      rotaNo: 64,
      desc: 0,
      qty: 36,
      price: 70,
      total: 72,
    };
    this.cols.desc =
      this.contentW -
      this.cols.no -
      this.cols.orderNo -
      this.cols.custNo -
      this.cols.rotaNo -
      this.cols.qty -
      this.cols.price -
      this.cols.total;
  }

  build(): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      this.doc.on("data", (chunk: Buffer | Uint8Array) =>
        chunks.push(Buffer.from(chunk)),
      );
      this.doc.on("end", () => resolve(Buffer.concat(chunks)));
      this.doc.on("error", reject);

      try {
        this.render();
        this.doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private render() {
    this.drawFirstPageChrome();
    this.drawTableHeader();
    this.drawItems();
    this.y += 14;
    this.drawSummaryAndTotals();
    this.drawPaymentSection();
    this.drawNotes();
    this.stampFooters();
  }

  private remaining() {
    return this.contentBottom - this.y;
  }

  private ensureSpace(height: number, kind: PageKind) {
    if (height <= this.remaining()) return;
    this.addContinuation(kind);
  }

  private addContinuation(kind: PageKind) {
    this.doc.addPage();
    this.y = MARGIN;
    this.drawSlimHeader();
    if (kind === "items") this.drawTableHeader();
  }

  private formatMoney(amount: number, currency = this.input.currency) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return "$-";
    return `$${n.toFixed(2)} ${currency}`.trim();
  }

  private text(
    value: string,
    x: number,
    y: number,
    opts: {
      width: number;
      height: number;
      size?: number;
      bold?: boolean;
      color?: string;
      align?: Align;
      ellipsis?: boolean;
    },
  ) {
    this.doc
      .font(opts.bold ? FONT_BOLD : FONT_REGULAR)
      .fontSize(opts.size ?? 8.5)
      .fillColor(opts.color ?? TEXT_DARK)
      .text(value ?? "", x, y, {
        width: opts.width,
        height: opts.height,
        align: opts.align ?? "left",
        ellipsis: opts.ellipsis ?? true,
        lineGap: 0,
      });
  }

  private lineHeight(size: number) {
    this.doc.font(FONT_REGULAR).fontSize(size);
    return this.doc.currentLineHeight(true);
  }

  private measureHeight(value: string, width: number, size: number, maxLines: number) {
    this.doc.font(FONT_REGULAR).fontSize(size);
    const lh = this.doc.currentLineHeight(true);
    const raw = this.doc.heightOfString(value || " ", { width, lineGap: 0 });
    return Math.min(Math.max(raw, lh), lh * maxLines);
  }

  private drawFirstPageChrome() {
    const logoH = 44;
    if (this.input.logoPng) {
      try {
        this.doc.image(this.input.logoPng, MARGIN, this.y, {
          fit: [150, logoH],
          height: logoH,
        });
      } catch {
        this.drawFallbackLogo(logoH);
      }
    } else {
      this.drawFallbackLogo(logoH);
    }

    this.text("COMMERCIAL INVOICE", MARGIN + this.contentW - 240, this.y + 8, {
      width: 240,
      height: 22,
      size: 16,
      bold: true,
      color: ACCENT,
      align: "right",
      ellipsis: false,
    });

    this.y += logoH + 10;
    this.rule(ACCENT2, 1.5);
    this.y += 10;

    const metaX = MARGIN + this.contentW - 200;
    this.text("SUPPLIER:", MARGIN, this.y, {
      width: 200,
      height: 12,
      size: 9,
      bold: true,
      color: ACCENT,
    });
    this.text("ROTA North America, LLC", MARGIN, this.y + 13, {
      width: 260,
      height: 12,
      size: 9,
      bold: true,
    });
    this.text("10 N Martingale Rd #400", MARGIN, this.y + 25, {
      width: 260,
      height: 11,
      size: 8.5,
    });
    this.text("Schaumburg, IL 60173, USA", MARGIN, this.y + 36, {
      width: 260,
      height: 11,
      size: 8.5,
    });

    this.metaRow("Date:", this.input.dateLabel, metaX, this.y);
    this.metaRow("Invoice No:", this.input.orderNumber, metaX, this.y + 13);
    this.metaRow("PO Number:", this.input.poNumber || "—", metaX, this.y + 26);

    this.y += 64;
    this.drawAddressBand();
  }

  private drawFallbackLogo(logoH: number) {
    this.text("ROTA", MARGIN, this.y + 10, {
      width: 160,
      height: logoH - 10,
      size: 20,
      bold: true,
      color: ACCENT,
    });
  }

  private metaRow(label: string, value: string, x: number, y: number) {
    this.text(label, x, y, {
      width: 80,
      height: 12,
      size: 8.5,
      bold: true,
    });
    this.text(value, x + 80, y, {
      width: 120,
      height: 12,
      size: 8.5,
    });
  }

  private drawSlimHeader() {
    this.text("COMMERCIAL INVOICE", MARGIN, this.y, {
      width: this.contentW * 0.55,
      height: 14,
      size: 11,
      bold: true,
      color: ACCENT,
    });
    this.text(
      `${this.input.orderNumber}  |  ${this.input.dateLabel}`,
      MARGIN + this.contentW * 0.45,
      this.y + 1,
      {
        width: this.contentW * 0.55,
        height: 14,
        size: 9,
        align: "right",
        color: TEXT_DARK,
      },
    );
    this.y += 18;
    this.rule(ACCENT2, 1);
    this.y += 8;
  }

  private drawAddressBand() {
    const colW = (this.contentW - 20) / 3;
    const lineSize = 8;
    const lineH = 11;
    const headerH = 18;
    const pad = 8;

    const heightOf = (lines: string[], width: number) =>
      lines.reduce(
        (sum, line) =>
          sum + this.measureHeight(line, width, lineSize, 2),
        0,
      );

    const bill = this.input.billTo.length ? this.input.billTo : ["-"];
    const ship = this.input.shipTo.length ? this.input.shipTo : ["-"];
    const details: [string, string][] = [
      ["Status", (this.input.status || "-").toUpperCase()],
      ["Terms", this.input.terms || "Net 30"],
    ];

    const bodyH = Math.max(
      heightOf(bill, colW - 10),
      heightOf(ship, colW - 10),
      details.length * lineH,
    );
    const bandH = headerH + bodyH + pad;

    this.doc.rect(MARGIN, this.y, this.contentW, bandH).fill(LIGHT_BG);

    this.text("BILL TO", MARGIN + 8, this.y + 6, {
      width: colW - 10,
      height: 12,
      size: 8.5,
      bold: true,
      color: ACCENT,
    });
    this.text("SHIP TO", MARGIN + colW + 10, this.y + 6, {
      width: colW - 10,
      height: 12,
      size: 8.5,
      bold: true,
      color: ACCENT,
    });
    this.text("DETAILS", MARGIN + colW * 2 + 20, this.y + 6, {
      width: colW - 10,
      height: 12,
      size: 8.5,
      bold: true,
      color: ACCENT,
    });

    let billY = this.y + headerH;
    bill.forEach((line, i) => {
      const h = this.measureHeight(line, colW - 10, lineSize, 2);
      this.text(line, MARGIN + 8, billY, {
        width: colW - 10,
        height: h,
        size: lineSize,
        bold: i === 0,
      });
      billY += h;
    });

    let shipY = this.y + headerH;
    ship.forEach((line, i) => {
      const h = this.measureHeight(line, colW - 10, lineSize, 2);
      this.text(line, MARGIN + colW + 10, shipY, {
        width: colW - 10,
        height: h,
        size: lineSize,
        bold: i === 0,
      });
      shipY += h;
    });

    let detailY = this.y + headerH;
    const detailX = MARGIN + colW * 2 + 20;
    for (const [label, value] of details) {
      this.text(label, detailX, detailY, {
        width: 68,
        height: lineH,
        size: lineSize,
        bold: true,
      });
      this.text(value, detailX + 70, detailY, {
        width: colW - 80,
        height: lineH,
        size: lineSize,
      });
      detailY += lineH;
    }

    this.y += bandH + 12;
  }

  private drawTableHeader() {
    this.doc.rect(MARGIN, this.y, this.contentW, TABLE_HEADER_H).fill(ACCENT);

    const headers: Array<{
      label: string;
      w: number;
      align?: Align;
    }> = [
      { label: "ITEM\nNO", w: this.cols.no },
      { label: "ORDER\nNO", w: this.cols.orderNo },
      { label: "CUSTOMER\nNO", w: this.cols.custNo },
      { label: "ROTA NO", w: this.cols.rotaNo },
      { label: "DESCRIPTION", w: this.cols.desc, align: "left" },
      { label: "LOADED\nQTY.", w: this.cols.qty },
      { label: "UNIT PRICE\nFrom", w: this.cols.price },
      { label: "TOTAL\nAMOUNT", w: this.cols.total },
    ];

    let x = MARGIN;
    for (const col of headers) {
      this.text(col.label, x + 3, this.y + 4, {
        width: col.w - 6,
        height: TABLE_HEADER_H - 6,
        size: 7,
        bold: true,
        color: WHITE,
        align: col.align ?? "center",
        ellipsis: false,
      });
      x += col.w;
    }

    this.y += TABLE_HEADER_H;
  }

  private hasComparePrice(item: InvoicePdfItem) {
    const original = Number(item.originalUnitPrice || 0);
    return original - Number(item.unitPrice || 0) > 0.004;
  }

  private rowHeight(item: InvoicePdfItem) {
    const descH = this.measureHeight(
      item.title || "Item",
      this.cols.desc - 6,
      8,
      MAX_DESC_LINES,
    );
    const priceH = this.hasComparePrice(item) ? 26 : this.lineHeight(8);
    return Math.max(22, descH + ROW_PAD * 2, priceH + ROW_PAD * 2);
  }

  private drawItems() {
    const items = this.input.items;
    if (items.length === 0) {
      const h = 22;
      this.ensureSpace(h, "items");
      this.doc.rect(MARGIN, this.y, this.contentW, h).fill(LIGHT_BG);
      this.text("No items found.", MARGIN + 8, this.y + 6, {
        width: this.contentW - 16,
        height: 12,
        size: 9,
        color: TEXT_MUTED,
      });
      this.y += h;
      return;
    }

    items.forEach((item, idx) => {
      const h = this.rowHeight(item);
      this.ensureSpace(h, "items");
      this.drawItemRow(item, idx, h);
      this.y += h;
    });
  }

  private drawItemRow(item: InvoicePdfItem, idx: number, h: number) {
    if (idx % 2 === 0) {
      this.doc.rect(MARGIN, this.y, this.contentW, h).fill(LIGHT_BG);
    }
    this.doc
      .rect(MARGIN, this.y, this.contentW, h)
      .strokeColor(DIVIDER)
      .lineWidth(0.4)
      .stroke();

    const singleH = this.lineHeight(8);
    const midY = this.y + Math.max(ROW_PAD, (h - singleH) / 2);
    const topY = this.y + ROW_PAD;
    const hasCompare = this.hasComparePrice(item);

    const cells: Array<{
      text: string;
      w: number;
      align?: Align;
      bold?: boolean;
      y: number;
      height: number;
      skip?: boolean;
    }> = [
      {
        text: String(idx + 1),
        w: this.cols.no,
        y: midY,
        height: singleH,
      },
      {
        text: this.input.orderNumber,
        w: this.cols.orderNo,
        y: midY,
        height: singleH,
      },
      {
        text: item.customerNo || "-",
        w: this.cols.custNo,
        y: midY,
        height: singleH,
      },
      {
        text: item.sku || "-",
        w: this.cols.rotaNo,
        y: midY,
        height: singleH,
      },
      {
        text: item.title || "Item",
        w: this.cols.desc,
        align: "left",
        y: topY,
        height: h - ROW_PAD * 2,
      },
      {
        text: String(item.quantity),
        w: this.cols.qty,
        y: midY,
        height: singleH,
      },
      {
        text: this.formatMoney(item.unitPrice),
        w: this.cols.price,
        align: "right",
        y: midY,
        height: singleH,
        skip: hasCompare,
      },
      {
        text: this.formatMoney(item.lineTotal),
        w: this.cols.total,
        align: "right",
        bold: true,
        y: midY,
        height: singleH,
      },
    ];

    let x = MARGIN;
    for (const cell of cells) {
      if (!cell.skip) {
        this.text(cell.text, x + 3, cell.y, {
          width: cell.w - 6,
          height: cell.height,
          size: 8,
          bold: cell.bold,
          align: cell.align ?? "center",
        });
      }
      x += cell.w;
    }

    if (hasCompare) {
      const priceX =
        MARGIN +
        this.cols.no +
        this.cols.orderNo +
        this.cols.custNo +
        this.cols.rotaNo +
        this.cols.desc +
        this.cols.qty;
      this.drawCompareUnitPrice(item, priceX, h);
    }
  }

  private drawCompareUnitPrice(item: InvoicePdfItem, x: number, h: number) {
    const sale = this.formatMoney(item.unitPrice);
    const original = this.formatMoney(Number(item.originalUnitPrice));
    const innerW = this.cols.price - 6;
    const cellX = x + 3;
    const saleSize = 8;
    const origSize = 6.5;
    const saleH = this.lineHeight(saleSize);
    const origH = this.lineHeight(origSize);
    const stackH = saleH + origH + 2;
    const startY = this.y + Math.max(ROW_PAD - 1, (h - stackH) / 2);

    this.text(sale, cellX, startY, {
      width: innerW,
      height: saleH,
      size: saleSize,
      bold: true,
      align: "right",
    });

    this.doc.font(FONT_BOLD).fontSize(saleSize);
    const saleW = Math.min(this.doc.widthOfString(sale), innerW);
    const saleLineX = cellX + innerW - saleW;
    this.doc.save();
    this.doc
      .strokeColor(TEXT_MUTED)
      .lineWidth(0.5)
      .dash(1.2, { space: 1.2 })
      .moveTo(saleLineX, startY + saleH - 1)
      .lineTo(saleLineX + saleW, startY + saleH - 1)
      .stroke();
    this.doc.restore();

    const origY = startY + saleH + 1;
    this.text(original, cellX, origY, {
      width: innerW,
      height: origH,
      size: origSize,
      color: TEXT_MUTED,
      align: "right",
    });

    this.doc.font(FONT_REGULAR).fontSize(origSize);
    const origW = Math.min(this.doc.widthOfString(original), innerW);
    const origLineX = cellX + innerW - origW;
    const strikeY = origY + origH * 0.45;
    this.doc.save();
    this.doc
      .strokeColor(TEXT_MUTED)
      .lineWidth(0.6)
      .undash()
      .moveTo(origLineX, strikeY)
      .lineTo(origLineX + origW, strikeY)
      .stroke();
    this.doc.restore();
  }

  private drawSummaryAndTotals() {
    const discount = Number.isFinite(Number(this.input.discount))
      ? Math.max(0, Number(this.input.discount))
      : 0;
    const blockH = 112;
    this.ensureSpace(blockH, "closing");

    const startY = this.y;
    const summaryRows: [string, string][] = [
      ["DELIVERY TERM", this.input.deliveryTerm || "DAP"],
      ["PAYMENT TERM", this.input.paymentTerm || this.input.terms || "Net 30"],
      ["TOTAL WEIGHT", this.input.totalWeight || "-"],
      ["TOTAL PALLET", this.input.totalPallet || "-"],
    ];

    let sy = startY;
    for (const [label, value] of summaryRows) {
      this.text(label, MARGIN, sy, {
        width: 110,
        height: 12,
        size: 8.5,
        bold: true,
      });
      this.text(value, MARGIN + 114, sy, {
        width: 140,
        height: 12,
        size: 8.5,
      });
      sy += 16;
    }

    const totW = 220;
    const totX = this.pageW - MARGIN - totW;
    let totY = startY;

    const totRow = (label: string, value: string, highlight = false) => {
      if (highlight) {
        this.doc.rect(totX, totY - 2, totW, 20).fill(ACCENT);
        this.text(label, totX + 6, totY + 2, {
          width: 100,
          height: 14,
          size: 9.5,
          bold: true,
          color: WHITE,
        });
        this.text(value, totX + 110, totY + 2, {
          width: totW - 118,
          height: 14,
          size: 9.5,
          bold: true,
          color: WHITE,
          align: "right",
        });
        totY += 22;
        return;
      }
      this.text(label, totX + 6, totY, {
        width: 100,
        height: 12,
        size: 9,
        color: TEXT_MUTED,
      });
      this.text(value, totX + 110, totY, {
        width: totW - 118,
        height: 12,
        size: 9,
        align: "right",
      });
      totY += 16;
    };

    totRow("Subtotal", this.formatMoney(this.input.subtotal));
    totRow(
      "Discount",
      discount > 0.004
        ? `-${this.formatMoney(discount)}`
        : this.formatMoney(0),
    );
    totRow("Sales Tax", this.formatMoney(this.input.taxes));
    totRow("Shipping", this.formatMoney(this.input.shipping));
    this.doc
      .moveTo(totX, totY - 2)
      .lineTo(totX + totW, totY - 2)
      .strokeColor(ACCENT)
      .lineWidth(1)
      .stroke();
    totY += 6;
    totRow("Total", this.formatMoney(this.input.grandTotal), true);

    this.y = Math.max(sy, totY) + 12;
  }

  private drawPaymentSection() {
    const blockH = 118;
    this.ensureSpace(blockH, "closing");
    this.rule(DIVIDER, 0.8);
    this.y += 10;

    const startY = this.y;
    const halfW = (this.contentW - 20) / 2;

    this.text("BANKING DETAILS", MARGIN, startY, {
      width: halfW,
      height: 12,
      size: 9,
      bold: true,
      color: ACCENT,
    });

    const bankRows: [string, string][] = [
      ["Name:", "ROTA NORTH AMERICA LLC"],
      ["Bank:", "CHASE BANK"],
      ["Account No:", "610891258"],
      ["Routing No:", "021202337"],
    ];
    let leftY = startY + 16;
    for (const [label, value] of bankRows) {
      this.text(label, MARGIN, leftY, {
        width: 80,
        height: 12,
        size: 8.5,
        bold: true,
      });
      this.text(value, MARGIN + 82, leftY, {
        width: halfW - 82,
        height: 12,
        size: 8.5,
      });
      leftY += 14;
    }

    const payX = MARGIN + halfW + 20;
    let payY = startY;
    this.text("PAYMENT INSTRUCTIONS", payX, payY, {
      width: halfW,
      height: 12,
      size: 9,
      bold: true,
      color: ACCENT,
    });
    payY += 16;
    this.text("PAY BY CHECK", payX, payY, {
      width: halfW,
      height: 12,
      size: 8.5,
      bold: true,
    });
    payY += 14;
    this.text(
      "Check mailing address: 14 Hughes Ste B200, Irvine CA 92618",
      payX,
      payY,
      { width: halfW, height: 22, size: 8.5 },
    );
    payY += 24;
    this.text("FOR WIRE TRANSFERS:", payX, payY, {
      width: halfW,
      height: 12,
      size: 8.5,
      bold: true,
    });
    payY += 14;
    this.text("Please use routing number 021000021", payX, payY, {
      width: halfW,
      height: 12,
      size: 8.5,
    });
    payY += 16;
    this.text("PAY BY ZELLE", payX, payY, {
      width: halfW,
      height: 12,
      size: 8.5,
      bold: true,
    });
    payY += 14;
    this.text("NAME: b.kilic@nskgroup.com.tr", payX, payY, {
      width: halfW,
      height: 12,
      size: 8.5,
    });
    payY += 14;

    this.y = Math.max(leftY, payY) + 8;
  }

  private drawNotes() {
    this.doc.font(FONT_REGULAR).fontSize(7.5);
    const notesH = NOTES.reduce((sum, note) => {
      return (
        sum +
        this.doc.heightOfString(note, {
          width: this.contentW,
          lineGap: 1,
        }) +
        4
      );
    }, 18);
    this.ensureSpace(Math.min(notesH, this.contentBottom - MARGIN), "closing");

    this.rule(DIVIDER, 0.5);
    this.y += 10;

    for (const note of NOTES) {
      this.doc.font(FONT_REGULAR).fontSize(7.5);
      const h = Math.max(
        10,
        this.doc.heightOfString(note, { width: this.contentW, lineGap: 1 }),
      );
      this.ensureSpace(h + 4, "closing");
      this.text(note, MARGIN, this.y, {
        width: this.contentW,
        height: h + 2,
        size: 7.5,
        color: TEXT_MUTED,
        ellipsis: false,
      });
      this.y += h + 4;
    }
  }

  private rule(color: string, width: number) {
    this.doc
      .moveTo(MARGIN, this.y)
      .lineTo(this.pageW - MARGIN, this.y)
      .strokeColor(color)
      .lineWidth(width)
      .stroke();
  }

  private stampFooters() {
    const range = this.doc.bufferedPageRange();
    for (let i = 0; i < range.count; i++) {
      this.doc.switchToPage(range.start + i);
      const fy = this.pageH - 28;
      this.doc
        .moveTo(MARGIN, fy)
        .lineTo(this.pageW - MARGIN, fy)
        .strokeColor(DIVIDER)
        .lineWidth(0.5)
        .stroke();
      this.text(
        "ROTA North America, LLC  |  10 N Martingale Rd #400, Schaumburg, IL 60173, USA  |  Thank you for your business.",
        MARGIN,
        fy + 6,
        {
          width: this.contentW - 70,
          height: 12,
          size: 7,
          color: TEXT_MUTED,
        },
      );
      this.text(`Page ${i + 1} of ${range.count}`, MARGIN + this.contentW - 70, fy + 6, {
        width: 70,
        height: 12,
        size: 7.5,
        bold: true,
        color: TEXT_DARK,
        align: "right",
      });
    }
  }
}
