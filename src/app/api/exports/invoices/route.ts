// GET /api/exports/invoices?from=&to=&status=&clientId=
// Streams a CSV of the user's invoices.

import { NextResponse } from "next/server"
import { and, eq, gte, lte } from "drizzle-orm"
import { db } from "@/lib/db"
import { clients, invoices } from "@/lib/db/schema"
import { requireUser } from "@/server/auth"
import { csvHeaders, toCsv, type CsvColumn } from "@/lib/csv"
import {
  INVOICE_STATUSES,
  type InvoiceStatus,
} from "@/lib/validations/invoices"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type InvoiceRow = {
  invoiceNumber: string
  clientName: string
  clientCurrency: string
  status: string
  issuedDate: string
  dueDate: string
  periodStart: string | null
  periodEnd: string | null
  subtotal: number
  discount: number
  tax: number
  expenses: number
  total: number
  paid: number
  outstanding: number
  notes: string | null
}

const COLUMNS: CsvColumn<InvoiceRow>[] = [
  { header: "Invoice number", value: (r) => r.invoiceNumber },
  { header: "Client", value: (r) => r.clientName },
  { header: "Currency", value: (r) => r.clientCurrency },
  { header: "Status", value: (r) => r.status },
  { header: "Issued", value: (r) => r.issuedDate },
  { header: "Due", value: (r) => r.dueDate },
  { header: "Period start", value: (r) => r.periodStart ?? "" },
  { header: "Period end", value: (r) => r.periodEnd ?? "" },
  { header: "Subtotal", value: (r) => (r.subtotal / 100).toFixed(2) },
  { header: "Discount", value: (r) => (r.discount / 100).toFixed(2) },
  { header: "Tax", value: (r) => (r.tax / 100).toFixed(2) },
  { header: "Expenses", value: (r) => (r.expenses / 100).toFixed(2) },
  { header: "Total", value: (r) => (r.total / 100).toFixed(2) },
  { header: "Paid", value: (r) => (r.paid / 100).toFixed(2) },
  { header: "Outstanding", value: (r) => (r.outstanding / 100).toFixed(2) },
  { header: "Notes", value: (r) => r.notes ?? "" },
]

export async function GET(req: Request) {
  const user = await requireUser()
  const url = new URL(req.url)
  const from = url.searchParams.get("from") ?? undefined
  const to = url.searchParams.get("to") ?? undefined
  const statusParam = url.searchParams.get("status") ?? undefined
  const clientId = url.searchParams.get("clientId") ?? undefined

  const conditions = [eq(invoices.userId, user.id)]
  if (from) conditions.push(gte(invoices.issuedDate, from))
  if (to) conditions.push(lte(invoices.issuedDate, to))
  if (statusParam && (INVOICE_STATUSES as readonly string[]).includes(statusParam)) {
    conditions.push(eq(invoices.status, statusParam as InvoiceStatus))
  }
  if (clientId) conditions.push(eq(invoices.clientId, clientId))

  const rows = await db
    .select({
      invoiceNumber: invoices.invoiceNumber,
      clientName: clients.name,
      clientCurrency: invoices.currency,
      status: invoices.status,
      issuedDate: invoices.issuedDate,
      dueDate: invoices.dueDate,
      periodStart: invoices.periodStart,
      periodEnd: invoices.periodEnd,
      subtotal: invoices.subtotalCents,
      discount: invoices.discountCents,
      tax: invoices.taxCents,
      expenses: invoices.expensesCents,
      total: invoices.totalCents,
      paid: invoices.amountPaidCents,
      notes: invoices.notes,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(and(...conditions))

  const enriched: InvoiceRow[] = rows.map((r) => ({
    invoiceNumber: r.invoiceNumber,
    clientName: r.clientName,
    clientCurrency: r.clientCurrency,
    status: r.status,
    issuedDate: r.issuedDate,
    dueDate: r.dueDate,
    periodStart: r.periodStart,
    periodEnd: r.periodEnd,
    subtotal: r.subtotal,
    discount: r.discount,
    tax: r.tax,
    expenses: r.expenses,
    total: r.total,
    paid: r.paid,
    outstanding: r.total - r.paid,
    notes: r.notes,
  }))

  const csv = toCsv(enriched, COLUMNS)
  const today = new Date().toISOString().slice(0, 10)
  const fname = `invoices-${today}.csv`

  return new NextResponse(csv, { status: 200, headers: csvHeaders(fname) })
}
