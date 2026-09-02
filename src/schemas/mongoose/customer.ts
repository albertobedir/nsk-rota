import mongoose, { Schema, Document, Model } from "mongoose";

export interface ICustomer extends Document {
  shopifyCustomerId: string;
  companyId?: string | null;
  companyLocationId?: string | null;
  companyContactId?: string | null;
  companyName?: string | null;
  email?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    shopifyCustomerId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    companyId: { type: String, default: null },
    companyLocationId: { type: String, default: null },
    companyContactId: { type: String, default: null },
    companyName: { type: String, default: null },
    email: { type: String, default: null },
  },
  { timestamps: true },
);

export const Customer: Model<ICustomer> =
  mongoose.models.Customer ||
  mongoose.model<ICustomer>("Customer", CustomerSchema);

export default Customer;
