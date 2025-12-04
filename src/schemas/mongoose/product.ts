import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProduct extends Document {
  shopifyId: number;
  raw: Record<string, unknown>;
}

const ProductSchema = new Schema<IProduct>(
  {
    shopifyId: { type: Number, required: true, unique: true },
    raw: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>("Product", ProductSchema);

export default Product;
