import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrder extends Document {
  shopifyId: string; // gid or numeric id as string
  orderNumber?: number;
  name?: string; // e.g. "#1001"
  poNumber?: string | null;
  customerId?: string; // gid://shopify/Customer/xxx
  paymentCollectionUrl?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  trackingCompany?: string;
  fulfillmentStatus?: string;
  financialStatus?: string;
  cancelledAt?: Date | null;
  cancelReason?: string | null;
  billingAddress?: Record<string, unknown>;
  shippingAddress?: Record<string, unknown>;
  creditDeducted?: boolean;
  creditDeductedAmount?: number;
  creditCurrency?: string;
  creditDeductedAt?: Date | null;
  creditRestoreEligible?: boolean;
  creditRestored?: boolean;
  creditRestoredAt?: Date | null;
  raw: Record<string, unknown>;
  createdAt?: Date;
  updatedAt?: Date;
}

const OrderSchema = new Schema<IOrder>(
  {
    shopifyId: { type: String, required: true, unique: true },
    orderNumber: { type: Number },
    name: { type: String },
    poNumber: { type: String, default: null },
    customerId: { type: String, index: true },
    paymentCollectionUrl: { type: String },
    trackingNumber: { type: String },
    trackingUrl: { type: String },
    trackingCompany: { type: String },
    fulfillmentStatus: { type: String },
    financialStatus: { type: String },
    cancelledAt: { type: Date, default: null },
    cancelReason: { type: String, default: null },
    billingAddress: { type: Schema.Types.Mixed },
    shippingAddress: { type: Schema.Types.Mixed },
    creditDeducted: { type: Boolean, default: false },
    creditDeductedAmount: { type: Number },
    creditCurrency: { type: String },
    creditDeductedAt: { type: Date, default: null },
    creditRestoreEligible: { type: Boolean, default: false },
    creditRestored: { type: Boolean, default: false },
    creditRestoredAt: { type: Date, default: null },
    raw: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);

export default Order;
