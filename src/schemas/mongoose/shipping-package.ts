import mongoose, { Schema, Document, Model } from "mongoose";

export interface IShippingPackage extends Document {
  code: string;
  name: string;
  type: "box" | "envelope" | "soft_package";
  length: number;
  width: number;
  height: number;
  dimensionUnit: "cm" | "in";
  emptyWeight?: number | null;
  weightUnit?: "kg" | "lb" | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const ShippingPackageSchema = new Schema<IShippingPackage>(
  {
    code: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["box", "envelope", "soft_package"],
      default: "box",
    },
    length: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    dimensionUnit: { type: String, enum: ["cm", "in"], default: "cm" },
    emptyWeight: { type: Number, default: null },
    weightUnit: { type: String, enum: ["kg", "lb"], default: null },
  },
  { timestamps: true, collection: "shippingPackages" },
);

export const ShippingPackage: Model<IShippingPackage> =
  mongoose.models.ShippingPackage ||
  mongoose.model<IShippingPackage>("ShippingPackage", ShippingPackageSchema);

export default ShippingPackage;
