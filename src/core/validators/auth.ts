import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Valid work email required"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Minimum 8 characters"),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
