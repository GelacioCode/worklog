import { z } from "zod"

export const WORK_LOG_STATUSES = ["unbilled", "billed", "paid"] as const
export type WorkLogStatus = (typeof WORK_LOG_STATUSES)[number]

// Quick-add: minimal required fields. Submit from the sticky bar.
export const quickAddSchema = z.object({
  clientId: z.string().uuid("Pick a client"),
  title: z.string().trim().min(1, "Add a title").max(200),
  workDate: z.string().min(1, "Pick a date"),
  hours: z
    .number({ message: "Enter hours" })
    .positive("Hours must be > 0")
    .max(24, "More than 24 hours per log seems wrong"),
  billable: z.boolean(),
  tag: z.string().trim().max(40).optional().or(z.literal("")),
})
export type QuickAddInput = z.infer<typeof quickAddSchema>

// Full edit form (Sheet)
export const workLogFormSchema = z.object({
  clientId: z.string().uuid("Pick a client"),
  title: z.string().trim().min(1, "Add a title").max(200),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  workDate: z.string().min(1, "Pick a date"),
  hours: z
    .number({ message: "Enter hours" })
    .positive("Hours must be > 0")
    .max(24, "More than 24 hours per log seems wrong"),
  tag: z.string().trim().max(40).optional().or(z.literal("")),
  billable: z.boolean(),
})
export type WorkLogFormInput = z.infer<typeof workLogFormSchema>

export const COMMON_TAGS = [
  "design",
  "dev",
  "review",
  "meeting",
  "research",
  "admin",
  "qa",
  "support",
  "writing",
  "other",
] as const
