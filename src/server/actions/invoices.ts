"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { and, eq, inArray, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  clients,
  invoiceItems,
  invoices,
  settings,
  workLogs,
} from "@/lib/db/schema"
import {
  formatInvoiceNumber,
  reserveNextNumber,
} from "@/lib/db/queries/invoice-numbering"
import { getRateAt } from "@/lib/db/queries/clients"
import {
  invoiceBuilderSchema,
  type InvoiceBuilderInput,
  INVOICE_STATUSES,
  type InvoiceStatus,
} from "@/lib/validations/invoices"
import { requireUser } from "@/server/auth"

type ActionResult =
  | { ok: true; id: string; invoiceNumber: string }
  | { ok: false; error: string }

function pctOfRound(cents: number, pct: number): number {
  return Math.round((cents * pct) / 100)
}

export async function generateInvoice(
  input: InvoiceBuilderInput,
): Promise<ActionResult> {
  const user = await requireUser()
  const parsed = invoiceBuilderSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }
  const data = parsed.data

  if (data.workLogIds.length === 0 && data.manualLineItems.length === 0) {
    return { ok: false, error: "Add at least one work log or line item." }
  }

  try {
    // 1. Verify client belongs to user + grab currency
    const clientRow = await db
      .select({ id: clients.id, currency: clients.currency })
      .from(clients)
      .where(and(eq(clients.userId, user.id), eq(clients.id, data.clientId)))
      .limit(1)
    if (clientRow.length === 0) return { ok: false, error: "Client not found" }
    const currency = clientRow[0].currency

    // 2. Resolve invoice number format from settings (default if not set)
    const settingsRow = await db
      .select({ format: settings.invoiceNumberFormat })
      .from(settings)
      .where(eq(settings.userId, user.id))
      .limit(1)
    const format = settingsRow[0]?.format ?? "INV-####"

    // 3. Snapshot the rate that was effective at period_end
    const rate = await getRateAt(user.id, data.clientId, data.periodEnd)
    const rateSnapshotCents = rate?.rateCents ?? 0

    // 4. Load the selected work logs (must be theirs, billable+unbilled)
    const selectedLogs =
      data.workLogIds.length > 0
        ? await db
            .select()
            .from(workLogs)
            .where(
              and(
                eq(workLogs.userId, user.id),
                eq(workLogs.clientId, data.clientId),
                eq(workLogs.invoiceStatus, "unbilled"),
                eq(workLogs.billable, true),
                inArray(workLogs.id, data.workLogIds),
              ),
            )
        : []

    if (selectedLogs.length !== data.workLogIds.length) {
      return {
        ok: false,
        error:
          "Some selected logs were already invoiced or no longer match. Refresh and try again.",
      }
    }

    // 5. Compute amounts (everything in cents)
    let workLogSubtotal = 0
    const workLogLineRows = selectedLogs.map((log) => {
      const hours = log.durationMinutes / 60
      const amountCents = Math.round(hours * rateSnapshotCents)
      workLogSubtotal += amountCents
      return {
        userId: user.id,
        workLogId: log.id,
        description: log.title,
        quantity: hours.toFixed(2),
        unit: "hours" as const,
        unitPriceCents: rateSnapshotCents,
        amountCents,
      }
    })

    let manualBillableSubtotal = 0
    let expensesSubtotal = 0
    const manualLineRows = data.manualLineItems.map((line) => {
      const amountCents = Math.round(line.quantity * line.unitPriceCents)
      if (line.kind === "expense") expensesSubtotal += amountCents
      else manualBillableSubtotal += amountCents
      return {
        userId: user.id,
        workLogId: null,
        description: line.description,
        quantity: line.quantity.toFixed(2),
        unit: "flat" as const,
        unitPriceCents: line.unitPriceCents,
        amountCents,
      }
    })

    const subtotalCents = workLogSubtotal + manualBillableSubtotal
    const discountCents = pctOfRound(subtotalCents, data.discountPct)
    const taxCents = pctOfRound(subtotalCents - discountCents, data.taxPct)
    const totalCents = subtotalCents - discountCents + taxCents + expensesSubtotal

    // 6. Atomic write: reserve number → insert invoice → insert items → flip work logs
    const created = await db.transaction(async (tx) => {
      const sequence = await reserveNextNumber(tx, user.id)
      const invoiceNumber = formatInvoiceNumber(format, sequence)

      const [invoiceRow] = await tx
        .insert(invoices)
        .values({
          userId: user.id,
          clientId: data.clientId,
          invoiceNumber,
          status: data.markAsSent ? "sent" : "draft",
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          issuedDate: data.issuedDate,
          dueDate: data.dueDate,
          currency,
          subtotalCents,
          discountCents,
          taxCents,
          expensesCents: expensesSubtotal,
          totalCents,
          amountPaidCents: 0,
          notes: data.notes?.trim() || null,
          rateSnapshotCents,
        })
        .returning({ id: invoices.id, invoiceNumber: invoices.invoiceNumber })

      const allLines = [
        ...workLogLineRows.map((r) => ({ ...r, invoiceId: invoiceRow.id })),
        ...manualLineRows.map((r) => ({ ...r, invoiceId: invoiceRow.id })),
      ]
      if (allLines.length > 0) {
        await tx.insert(invoiceItems).values(allLines)
      }

      if (selectedLogs.length > 0) {
        await tx
          .update(workLogs)
          .set({
            invoiceId: invoiceRow.id,
            invoiceStatus: "billed",
          })
          .where(
            and(
              eq(workLogs.userId, user.id),
              inArray(
                workLogs.id,
                selectedLogs.map((l) => l.id),
              ),
            ),
          )
      }

      return invoiceRow
    })

    revalidatePath("/invoices")
    revalidatePath("/work-logs")
    revalidatePath("/dashboard")
    revalidatePath(`/clients/${data.clientId}`)
    return { ok: true, id: created.id, invoiceNumber: created.invoiceNumber }
  } catch (err) {
    console.error("generateInvoice failed:", err)
    return { ok: false, error: "Could not generate invoice. Try again." }
  }
}

type StatusActionResult = { ok: true } | { ok: false; error: string }

export async function setInvoiceStatus(
  invoiceId: string,
  status: InvoiceStatus,
): Promise<StatusActionResult> {
  const user = await requireUser()
  if (!INVOICE_STATUSES.includes(status)) {
    return { ok: false, error: "Unknown status" }
  }

  try {
    const result = await db.transaction(async (tx) => {
      const setObj =
        status === "paid"
          ? { status, amountPaidCents: sql`${invoices.totalCents}` }
          : { status }

      const updated = await tx
        .update(invoices)
        .set(setObj)
        .where(and(eq(invoices.userId, user.id), eq(invoices.id, invoiceId)))
        .returning({ id: invoices.id })

      if (updated.length === 0) return null

      // When paid, flip linked work logs to "paid".
      // When walked back to draft/sent/partial, return them to "billed".
      if (status === "paid") {
        await tx
          .update(workLogs)
          .set({ invoiceStatus: "paid" })
          .where(
            and(eq(workLogs.userId, user.id), eq(workLogs.invoiceId, invoiceId)),
          )
      } else if (status === "sent" || status === "partial" || status === "draft") {
        await tx
          .update(workLogs)
          .set({ invoiceStatus: "billed" })
          .where(
            and(eq(workLogs.userId, user.id), eq(workLogs.invoiceId, invoiceId)),
          )
      }
      return updated[0]
    })

    if (!result) return { ok: false, error: "Invoice not found" }

    revalidatePath("/invoices")
    revalidatePath(`/invoices/${invoiceId}`)
    revalidatePath("/work-logs")
    revalidatePath("/dashboard")
    return { ok: true }
  } catch (err) {
    console.error("setInvoiceStatus failed:", err)
    return { ok: false, error: "Could not update status. Try again." }
  }
}

export async function deleteInvoice(
  invoiceId: string,
): Promise<StatusActionResult> {
  const user = await requireUser()
  try {
    const result = await db.transaction(async (tx) => {
      // Free up the work logs first. invoice_id FK is ON DELETE SET NULL, but
      // the denormalised invoice_status flag must come back to "unbilled".
      await tx
        .update(workLogs)
        .set({ invoiceId: null, invoiceStatus: "unbilled" })
        .where(
          and(eq(workLogs.userId, user.id), eq(workLogs.invoiceId, invoiceId)),
        )

      // invoice_items have ON DELETE CASCADE so they go with the parent.
      const deleted = await tx
        .delete(invoices)
        .where(and(eq(invoices.userId, user.id), eq(invoices.id, invoiceId)))
        .returning({ id: invoices.id })

      return deleted[0] ?? null
    })

    if (!result) return { ok: false, error: "Invoice not found" }

    revalidatePath("/invoices")
    revalidatePath("/work-logs")
    revalidatePath("/dashboard")
    return { ok: true }
  } catch (err) {
    console.error("deleteInvoice failed:", err)
    return { ok: false, error: "Could not delete invoice. Try again." }
  }
}

// Form-action wrappers for use with `<form action={...}>`.
export async function markSentAction(formData: FormData) {
  const id = String(formData.get("id") ?? "")
  if (!id) return
  await setInvoiceStatus(id, "sent")
}
export async function markPaidAction(formData: FormData) {
  const id = String(formData.get("id") ?? "")
  if (!id) return
  await setInvoiceStatus(id, "paid")
}
export async function markDraftAction(formData: FormData) {
  const id = String(formData.get("id") ?? "")
  if (!id) return
  await setInvoiceStatus(id, "draft")
}
export async function markCancelledAction(formData: FormData) {
  const id = String(formData.get("id") ?? "")
  if (!id) return
  await setInvoiceStatus(id, "cancelled")
}
export async function deleteInvoiceAction(formData: FormData) {
  const id = String(formData.get("id") ?? "")
  if (!id) return
  await deleteInvoice(id)
  redirect("/invoices")
}
