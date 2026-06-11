import { z } from "zod"

export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
  "cancelled",
] as const
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Draft",
  sent: "Sent",
  partial: "Partial",
  paid: "Paid",
  overdue: "Overdue",
  cancelled: "Cancelled",
}

// A manual line item the user types directly (expense or extra)
export const manualLineItemSchema = z.object({
  description: z.string().trim().min(1, "Add a description").max(200),
  quantity: z
    .number({ message: "Quantity is required" })
    .positive("Must be > 0"),
  unitPriceCents: z
    .number({ message: "Unit price is required" })
    .int()
    .min(0),
  kind: z.enum(["billable", "expense"]),
})
export type ManualLineItem = z.infer<typeof manualLineItemSchema>

// The full builder payload submitted to generateInvoice
export const invoiceBuilderSchema = z.object({
  clientId: z.string().uuid("Pick a client"),
  periodStart: z.string().min(1, "Pick a start date"),
  periodEnd: z.string().min(1, "Pick an end date"),
  issuedDate: z.string().min(1, "Pick an issued date"),
  dueDate: z.string().min(1, "Pick a due date"),
  workLogIds: z.array(z.string().uuid()),
  manualLineItems: z.array(manualLineItemSchema),
  discountPct: z.number().min(0).max(100),
  taxPct: z.number().min(0).max(100),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  markAsSent: z.boolean(),
})
export type InvoiceBuilderInput = z.infer<typeof invoiceBuilderSchema>
