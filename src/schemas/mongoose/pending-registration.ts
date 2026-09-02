import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPendingRegistration extends Document {
  email: string;
  companyName: string;
  firstName?: string | null;
  lastName?: string | null;
  address1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  usedAt?: Date | null;
}

const PendingRegistrationSchema = new Schema<IPendingRegistration>(
  {
    email: { type: String, required: true, unique: true, index: true },
    companyName: { type: String, required: true },
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    address1: { type: String, required: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    zip: { type: String, required: true },
    country: { type: String, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true, collection: "pendingRegistrations" },
);

export const PendingRegistration: Model<IPendingRegistration> =
  mongoose.models.PendingRegistration ||
  mongoose.model<IPendingRegistration>(
    "PendingRegistration",
    PendingRegistrationSchema,
  );

export default PendingRegistration;
