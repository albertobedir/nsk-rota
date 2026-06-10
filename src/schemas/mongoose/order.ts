import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrder extends Document {
  shopifyId: string; // gid or numeric id as string
  orderNumber?: number;
  name?: string; // e.g. "#1001"
  customerId?: string; // gid://shopify/Customer/xxx
  paymentCollectionUrl?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  trackingCompany?: string;
  fulfillmentStatus?: string;
  financialStatus?: string;
  billingAddress?: Record<string, unknown>;
  shippingAddress?: Record<string, unknown>;
  raw: Record<string, unknown>;
}

const OrderSchema = new Schema<IOrder>(
  {
    shopifyId: { type: String, required: true, unique: true },
    orderNumber: { type: Number },
    name: { type: String },
    customerId: { type: String, index: true },
    paymentCollectionUrl: { type: String },
    trackingNumber: { type: String },
    trackingUrl: { type: String },
    trackingCompany: { type: String },
    fulfillmentStatus: { type: String },
    financialStatus: { type: String },
    billingAddress: { type: Schema.Types.Mixed },
    shippingAddress: { type: Schema.Types.Mixed },
    raw: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);

export default Order;
