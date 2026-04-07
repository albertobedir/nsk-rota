import { z } from "zod";

export const subscribeSchema = z.object({
  email: z.email({ message: "Please enter a valid email address" }),
  firstName: z
    .string()
    .min(1, { message: "First name cannot be empty" })
    .max(50, { message: "First name cannot exceed 50 characters" }),
  lastName: z
    .string()
    .min(1, { message: "Last name cannot be empty" })
    .max(50, { message: "Last name cannot exceed 50 characters" }),
  companyName: z
    .string()
    .min(1, { message: "Company name cannot be empty" })
    .max(100, { message: "Company name cannot exceed 100 characters" }),
  address1: z
    .string()
    .min(1, { message: "Address cannot be empty" })
    .max(100, { message: "Address cannot exceed 100 characters" }),
  city: z
    .string()
    .min(1, { message: "City cannot be empty" })
    .max(50, { message: "City cannot exceed 50 characters" }),
  state: z
    .string()
    .min(2, { message: "State must be at least 2 characters" })
    .max(2, { message: "State must be exactly 2 characters" }),
  zip: z
    .string()
    .min(5, { message: "Zip code must be at least 5 characters" })
    .max(10, { message: "Zip code cannot exceed 10 characters" }),
});
