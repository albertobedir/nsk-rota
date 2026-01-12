import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICollection extends Document {
  shopifyId: number;
  raw: Record<string, unknown>;
}

const CollectionSchema = new Schema<ICollection>(
  {
    shopifyId: { type: Number, required: true, unique: true },
    raw: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

export const Collection: Model<ICollection> =
  mongoose.models.Collection ||
  mongoose.model<ICollection>("Collection", CollectionSchema);

export default Collection;
