import { connectDB } from "@/lib/mongoose/instance";
import PendingRegistration, {
  type IPendingRegistration,
} from "@/schemas/mongoose/pending-registration";

export type PendingRegistrationInput = {
  email: string;
  companyName: string;
  firstName?: string | null;
  lastName?: string | null;
  address1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
};

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function upsertPendingRegistration(
  input: PendingRegistrationInput,
) {
  await connectDB();
  const email = normalizeEmail(input.email);

  return PendingRegistration.findOneAndUpdate(
    { email },
    {
      $set: {
        email,
        companyName: input.companyName,
        firstName: input.firstName ?? null,
        lastName: input.lastName ?? null,
        address1: input.address1,
        city: input.city,
        state: input.state,
        zip: input.zip,
        country: input.country,
        usedAt: null,
      },
    },
    { upsert: true, new: true },
  );
}

export async function findPendingRegistrationByEmail(
  email?: string | null,
): Promise<IPendingRegistration | null> {
  if (!email) return null;
  await connectDB();
  return PendingRegistration.findOne({ email: normalizeEmail(email) });
}

export async function markPendingRegistrationUsed(email: string) {
  await connectDB();
  await PendingRegistration.updateOne(
    { email: normalizeEmail(email) },
    { $set: { usedAt: new Date() } },
  );
}
