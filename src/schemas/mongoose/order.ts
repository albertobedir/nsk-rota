import mongoose, { Schema, Document, Model } from "mongoose";

export interface IOrder extends Document {
  shopifyId: string; // gid or numeric id as string
  orderNumber?: number;
  name?: string; // e.g. "#1001"
  raw: Record<string, unknown>;
}

const OrderSchema = new Schema<IOrder>(
  {
    shopifyId: { type: String, required: true, unique: true },
    orderNumber: { type: Number },
    name: { type: String },
    raw: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>("Order", OrderSchema);

export default Order;
