import { z } from "zod"
import { SUPPORTED_CURRENCIES } from "@/lib/money"

export const INVOICE_NUMBER_FORMATS = [
  "INV-####",
  "YYYY-####",
  "INV-YYYY-####",
] as const
export type InvoiceNumberFormat = (typeof INVOICE_NUMBER_FORMATS)[number]

export const INVOICE_NUMBER_FORMAT_LABELS: Record<InvoiceNumberFormat, string> = {
  "INV-####": "INV-0001 (default)",
  "YYYY-####": "2026-0001 (year-prefixed)",
  "INV-YYYY-####": "INV-2026-0001 (year + prefix)",
}

export const settingsFormSchema = z.object({
  businessName: z.string().trim().max(120).optional().or(z.literal("")),
  businessEmail: z
    .string()
    .trim()
    .email("Enter a valid email")
    .optional()
    .or(z.literal("")),
  businessAddress: z.string().trim().max(400).optional().or(z.literal("")),
  taxId: z.string().trim().max(80).optional().or(z.literal("")),
  baseCurrency: z.enum(SUPPORTED_CURRENCIES),
  invoiceNumberFormat: z.enum(INVOICE_NUMBER_FORMATS),
  defaultPaymentTerms: z.number().int().min(0).max(180),
  defaultInvoiceNotes: z.string().trim().max(2000).optional().or(z.literal("")),
})
export type SettingsFormInput = z.infer<typeof settingsFormSchema>

// Logo file constraints
export const LOGO_MAX_BYTES = 1024 * 1024 // 1 MB
export const LOGO_ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
] as const
