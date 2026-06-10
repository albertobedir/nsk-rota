/* eslint-disable @typescript-eslint/no-explicit-any */
import mongoose, { Schema, Document, Model } from "mongoose";

export interface IInvoice extends Document {
  invoiceNumber?: string;
  orderNumber?: number;
  orderId: string;
  invoiceDate?: Date;
  customer?: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  shippingAddress?: Record<string, unknown>;
  items?: any[];
  shipping?: Record<string, unknown> | null;
  subtotal?: number;
  totalTax?: number;
  totalShipping?: number;
  totalDiscount?: number;
  grandTotal?: number;
  taxLines?: any[];
  currency?: string;
  status?: string;
  fulfillmentStatus?: string;
  note?: string;
  discountCodes?: any[];
  raw?: Record<string, unknown>;
}

const InvoiceSchema = new Schema<IInvoice>(
  {
    invoiceNumber: { type: String },
    orderNumber: { type: Number },
    orderId: { type: String, required: true, unique: true },
    invoiceDate: { type: Date },
    customer: { type: Schema.Types.Mixed },
    billingAddress: { type: Schema.Types.Mixed },
    shippingAddress: { type: Schema.Types.Mixed },
    items: { type: Array },
    shipping: { type: Schema.Types.Mixed },
    subtotal: { type: Number },
    totalTax: { type: Number },
    totalShipping: { type: Number },
    totalDiscount: { type: Number },
    grandTotal: { type: Number },
    taxLines: { type: Array },
    currency: { type: String },
    status: { type: String },
    fulfillmentStatus: { type: String },
    note: { type: String },
    discountCodes: { type: Array },
    raw: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

const Invoice: Model<IInvoice> =
  mongoose.models.Invoice || mongoose.model<IInvoice>("Invoice", InvoiceSchema);

export default Invoice;
