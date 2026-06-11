// Per-user invoice number sequence + formatting.

import { sql } from "drizzle-orm"
import { invoiceSequences } from "@/lib/db/schema"

/**
 * Tx-aware DB handle: can be the top-level `db` or a transaction. We only need
 * INSERT/RETURNING for reservation, so this minimal shape covers both.
 */
type TxLike = {
  insert: typeof import("@/lib/db").db.insert
}

/**
 * Atomically reserve the next invoice number for a user. MUST be called inside
 * a transaction so the reservation commits with the invoice row.
 *
 * Semantics: `next_number` stores "the next number to *assign*". On insert we
 * read it, then increment so the next caller gets a fresh value. The UPSERT
 * makes concurrent callers serialise on the per-user row lock.
 */
export async function reserveNextNumber(tx: TxLike, userId: string): Promise<number> {
  const [row] = await tx
    .insert(invoiceSequences)
    .values({ userId, nextNumber: 2 })
    .onConflictDoUpdate({
      target: invoiceSequences.userId,
      set: { nextNumber: sql`${invoiceSequences.nextNumber} + 1` },
    })
    .returning({ next: invoiceSequences.nextNumber })

  if (!row) throw new Error("Could not reserve invoice number")
  // Returned value is the *new* next_number; we just assigned (new - 1).
  return row.next - 1
}

/**
 * Format a numeric sequence per the user's chosen format. Supported:
 *   "INV-####"  → "INV-0042"
 *   "YYYY-####" → "2026-0042"
 */
export function formatInvoiceNumber(format: string, sequence: number): string {
  const year = new Date().getUTCFullYear().toString()
  const hashMatch = format.match(/#+/)
  if (!hashMatch) return `${format}${sequence}`
  const padded = String(sequence).padStart(hashMatch[0].length, "0")
  return format.replace(/YYYY/g, year).replace(/#+/, padded)
}
