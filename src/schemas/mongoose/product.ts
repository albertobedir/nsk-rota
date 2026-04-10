import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProduct extends Document {
  shopifyId: number;
  raw: Record<string, unknown>;
  originalPrice?: number; // Store original/base price before customer pricing
}

const ProductSchema = new Schema<IProduct>(
  {
    shopifyId: { type: Number, required: true, unique: true },
    raw: { type: Schema.Types.Mixed, required: true },
    originalPrice: { type: Number, default: null }, // Original/base price
  },
  { timestamps: true },
);

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
