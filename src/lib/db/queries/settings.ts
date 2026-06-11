// Drizzle query helper for per-user settings.

import { eq } from "drizzle-orm"
import { db } from "@/lib/db"
import { settings, type Settings } from "@/lib/db/schema"

export type ResolvedSettings = Settings & {
  // Convenience: never null at the call site — pre-filled with defaults.
  businessName: string
  businessEmail: string
  businessAddress: string
  taxId: string
  defaultInvoiceNotes: string
}

const DEFAULTS = {
  baseCurrency: "USD",
  invoiceNumberFormat: "INV-####",
  defaultPaymentTerms: 7,
  businessName: "Your business",
  businessAddress: "",
  businessEmail: "",
  taxId: "",
  logoStoragePath: null as string | null,
  defaultInvoiceNotes: "",
}

export async function getSettings(userId: string): Promise<ResolvedSettings> {
  const rows = await db
    .select()
    .from(settings)
    .where(eq(settings.userId, userId))
    .limit(1)

  const row = rows[0]
  if (!row) {
    return {
      userId,
      baseCurrency: DEFAULTS.baseCurrency,
      invoiceNumberFormat: DEFAULTS.invoiceNumberFormat,
      defaultPaymentTerms: DEFAULTS.defaultPaymentTerms,
      businessName: DEFAULTS.businessName,
      businessAddress: DEFAULTS.businessAddress,
      businessEmail: DEFAULTS.businessEmail,
      taxId: DEFAULTS.taxId,
      logoStoragePath: DEFAULTS.logoStoragePath,
      defaultInvoiceNotes: DEFAULTS.defaultInvoiceNotes,
      updatedAt: new Date(),
    } satisfies ResolvedSettings
  }

  return {
    ...row,
    businessName: row.businessName ?? DEFAULTS.businessName,
    businessAddress: row.businessAddress ?? DEFAULTS.businessAddress,
    businessEmail: row.businessEmail ?? DEFAULTS.businessEmail,
    taxId: row.taxId ?? DEFAULTS.taxId,
    defaultInvoiceNotes: row.defaultInvoiceNotes ?? DEFAULTS.defaultInvoiceNotes,
  }
}
