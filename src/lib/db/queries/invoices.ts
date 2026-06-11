// Drizzle query helpers for invoices.
// Every query is explicitly scoped by user_id.

import { and, desc, eq, ilike, lt, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import {
  clients,
  invoices,
  invoiceItems,
  type Invoice,
  type InvoiceItem,
} from "@/lib/db/schema"
import type { InvoiceStatus } from "@/lib/validations/invoices"

export type InvoiceWithClient = Invoice & {
  clientName: string
  clientCompany: string | null
}

type ListFilters = {
  status?: InvoiceStatus | "all"
  query?: string
  clientId?: string
}

export async function listInvoices(
  userId: string,
  filters: ListFilters = {},
): Promise<InvoiceWithClient[]> {
  const conditions = [eq(invoices.userId, userId)]

  if (filters.status && filters.status !== "all") {
    conditions.push(eq(invoices.status, filters.status))
  }
  if (filters.clientId) {
    conditions.push(eq(invoices.clientId, filters.clientId))
  }
  if (filters.query?.trim()) {
    const like = `%${filters.query.trim()}%`
    const matches = or(
      ilike(invoices.invoiceNumber, like),
      ilike(clients.name, like),
      ilike(clients.companyName, like),
    )
    if (matches) conditions.push(matches)
  }

  return db
    .select({
      id: invoices.id,
      userId: invoices.userId,
      clientId: invoices.clientId,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      periodStart: invoices.periodStart,
      periodEnd: invoices.periodEnd,
      issuedDate: invoices.issuedDate,
      dueDate: invoices.dueDate,
      currency: invoices.currency,
      subtotalCents: invoices.subtotalCents,
      discountCents: invoices.discountCents,
      taxCents: invoices.taxCents,
      expensesCents: invoices.expensesCents,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      notes: invoices.notes,
      rateSnapshotCents: invoices.rateSnapshotCents,
      pdfStoragePath: invoices.pdfStoragePath,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
      clientName: clients.name,
      clientCompany: clients.companyName,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(...conditions))
    .orderBy(desc(invoices.issuedDate), desc(invoices.createdAt))
}

export async function getInvoiceById(
  userId: string,
  invoiceId: string,
): Promise<(InvoiceWithClient & { items: InvoiceItem[] }) | null> {
  const rows = await db
    .select({
      id: invoices.id,
      userId: invoices.userId,
      clientId: invoices.clientId,
      invoiceNumber: invoices.invoiceNumber,
      status: invoices.status,
      periodStart: invoices.periodStart,
      periodEnd: invoices.periodEnd,
      issuedDate: invoices.issuedDate,
      dueDate: invoices.dueDate,
      currency: invoices.currency,
      subtotalCents: invoices.subtotalCents,
      discountCents: invoices.discountCents,
      taxCents: invoices.taxCents,
      expensesCents: invoices.expensesCents,
      totalCents: invoices.totalCents,
      amountPaidCents: invoices.amountPaidCents,
      notes: invoices.notes,
      rateSnapshotCents: invoices.rateSnapshotCents,
      pdfStoragePath: invoices.pdfStoragePath,
      createdAt: invoices.createdAt,
      updatedAt: invoices.updatedAt,
      clientName: clients.name,
      clientCompany: clients.companyName,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(eq(invoices.userId, userId), eq(invoices.id, invoiceId)))
    .limit(1)

  if (rows.length === 0) return null

  const items = await db
    .select()
    .from(invoiceItems)
    .where(
      and(eq(invoiceItems.userId, userId), eq(invoiceItems.invoiceId, invoiceId)),
    )

  return { ...rows[0], items }
}

export async function countInvoicesByStatus(userId: string) {
  const rows = await db
    .select({
      status: invoices.status,
      count: sql<number>`count(*)::int`,
    })
    .from(invoices)
    .where(eq(invoices.userId, userId))
    .groupBy(invoices.status)

  const result: Record<InvoiceStatus, number> = {
    draft: 0,
    sent: 0,
    partial: 0,
    paid: 0,
    overdue: 0,
    cancelled: 0,
  }
  for (const r of rows) result[r.status] = r.count
  return result
}

// Anything past due and not yet paid/cancelled is overdue. Returns the list
// so we can lazily flip status on read or via a cron later.
export async function listOverdueCandidates(userId: string) {
  const today = new Date().toISOString().slice(0, 10)
  return db
    .select({ id: invoices.id })
    .from(invoices)
    .where(
      and(
        eq(invoices.userId, userId),
        or(eq(invoices.status, "sent"), eq(invoices.status, "partial")),
        lt(invoices.dueDate, today),
      ),
    )
}
