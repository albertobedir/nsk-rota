import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICollection extends Document {
  shopifyId: number;
  raw: Record<string, unknown>;
  products: {
    id: number;
    title: string;
    handle: string;
    gid: string;
  }[];
  productCount: number;
}

const CollectionSchema = new Schema<ICollection>(
  {
    shopifyId: { type: Number, required: true, unique: true },
    raw: { type: Schema.Types.Mixed, required: true },
    products: [
      {
        id: Number,
        title: String,
        handle: String,
        gid: String,
      },
    ],
    productCount: Number,
  },
  { timestamps: true }
);

export const Collection: Model<ICollection> =
  mongoose.models.Collection ||
  mongoose.model<ICollection>("Collection", CollectionSchema);

export default Collection;
