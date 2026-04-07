import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrder extends Document {
  shopifyId: string; // gid or numeric id as string
  orderNumber?: number;
  name?: string; // e.g. "#1001"
  billingAddress?: Record<string, unknown>;
  shippingAddress?: Record<string, unknown>;
  raw: Record<string, unknown>;
}

const OrderSchema = new Schema<IOrder>(
  {
    shopifyId: { type: String, required: true, unique: true },
    orderNumber: { type: Number },
    name: { type: String },
    billingAddress: { type: Schema.Types.Mixed },
    shippingAddress: { type: Schema.Types.Mixed },
    raw: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true },
);

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);

export default Order;
