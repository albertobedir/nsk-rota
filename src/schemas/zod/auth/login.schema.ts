import { z } from "zod";

export const loginSchema = z.object({
  email: z.email({ message: "Please enter a valid email address" }),
  password: z.string(),
});

export type LoginSchemaInput = z.infer<typeof loginSchema>;
