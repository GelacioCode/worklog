import { z } from "zod"
import { SUPPORTED_CURRENCIES } from "@/lib/money"

export const CLIENT_STATUSES = ["active", "paused", "ended"] as const
export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export const BILLING_TYPES = [
  "hourly",
  "weekly",
  "bi_monthly",
  "monthly",
  "fixed_project",
] as const
export type BillingType = (typeof BILLING_TYPES)[number]

export const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  hourly: "Hourly",
  weekly: "Weekly",
  bi_monthly: "Bi-monthly (15/30)",
  monthly: "Monthly",
  fixed_project: "Fixed project",
}

export const CUTOFF_PRESETS = [
  "biweekly_15_30",
  "weekly_friday",
  "weekly_monday",
  "monthly_last",
  "monthly_first",
  "none",
] as const
export type CutoffPreset = (typeof CUTOFF_PRESETS)[number]

export const CUTOFF_LABELS: Record<CutoffPreset, string> = {
  biweekly_15_30: "Bi-weekly — 15th & 30th",
  weekly_friday: "Weekly — Friday",
  weekly_monday: "Weekly — Monday",
  monthly_last: "Monthly — last day",
  monthly_first: "Monthly — 1st",
  none: "No regular cutoff",
}

// JSON shape stored in clients.cutoff_schedule
export type CutoffScheduleJson = { preset: CutoffPreset }

// Short list of common timezones. Real picker can swap to Intl.supportedValuesOf later.
export const COMMON_TIMEZONES = [
  "UTC",
  "Asia/Manila",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
] as const

export const clientFormSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    companyName: z.string().trim().max(160).optional().or(z.literal("")),
    contactPerson: z.string().trim().max(120).optional().or(z.literal("")),
    email: z
      .string()
      .trim()
      .email("Enter a valid email")
      .optional()
      .or(z.literal("")),
    timezone: z.enum(COMMON_TIMEZONES),
    workType: z.string().trim().max(80).optional().or(z.literal("")),
    status: z.enum(CLIENT_STATUSES),
    billingType: z.enum(BILLING_TYPES),
    // Decimal strings; converted to cents server-side
    hourlyRate: z.string().trim().optional().or(z.literal("")),
    monthlySalary: z.string().trim().optional().or(z.literal("")),
    currency: z.enum(SUPPORTED_CURRENCIES),
    cutoffPreset: z.enum(CUTOFF_PRESETS),
    paymentTermsDays: z.number().int().min(0).max(180),
    defaultInvoiceNotes: z.string().trim().max(800).optional().or(z.literal("")),
    contractStart: z.string().optional().or(z.literal("")),
    contractEnd: z.string().optional().or(z.literal("")),
  })
  .superRefine((data, ctx) => {
    if (data.billingType === "hourly") {
      const rate = Number.parseFloat(data.hourlyRate || "")
      if (!Number.isFinite(rate) || rate <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["hourlyRate"],
          message: "Hourly rate is required for hourly billing",
        })
      }
    }
    if (
      data.billingType === "monthly" ||
      data.billingType === "bi_monthly" ||
      data.billingType === "weekly"
    ) {
      const salary = Number.parseFloat(data.monthlySalary || "")
      if (!Number.isFinite(salary) || salary <= 0) {
        ctx.addIssue({
          code: "custom",
          path: ["monthlySalary"],
          message: "Salary amount is required for this billing type",
        })
      }
    }
  })

export type ClientFormInput = z.infer<typeof clientFormSchema>
