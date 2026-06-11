import { z } from "zod"

export const loginSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
})
export type LoginInput = z.infer<typeof loginSchema>

export const signupSchema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})
export type SignupInput = z.infer<typeof signupSchema>
