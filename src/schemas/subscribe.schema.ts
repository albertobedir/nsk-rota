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
});
