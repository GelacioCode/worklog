// Aggregation queries for the Reports page.
// All queries scoped by user_id + filtered to a single currency for clarity
// (multi-currency rollups need FX rates — out of scope for Phase 1).

import { and, eq, gte, lte, ne, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { clients, invoices, workLogs } from "@/lib/db/schema"

export type DateRange = {
  from: string // ISO yyyy-mm-dd, inclusive
  to: string // ISO yyyy-mm-dd, inclusive
}

export type IncomeMonthPoint = {
  month: string // YYYY-MM
  label: string // "May 2026"
  paidCents: number
  unpaidCents: number
  invoiceCount: number
}

export type IncomeReport = {
  totalPaidCents: number
  totalUnpaidCents: number
  totalInvoiced: number
  monthly: IncomeMonthPoint[]
  byClient: { clientId: string; name: string; cents: number; invoiceCount: number }[]
}

export async function getIncomeReport(
  userId: string,
  currency: string,
  range: DateRange,
): Promise<IncomeReport> {
  const where = and(
    eq(invoices.userId, userId),
    eq(invoices.currency, currency),
    ne(invoices.status, "cancelled"),
    gte(invoices.issuedDate, range.from),
    lte(invoices.issuedDate, range.to),
  )

  const [monthlyRows, byClientRows, totalsRow] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(${invoices.issuedDate}, 'YYYY-MM')`,
        status: invoices.status,
        cents: sql<number>`coalesce(sum(${invoices.totalCents})::int, 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(where)
      .groupBy(sql`to_char(${invoices.issuedDate}, 'YYYY-MM')`, invoices.status),
    db
      .select({
        clientId: invoices.clientId,
        name: clients.name,
        cents: sql<number>`coalesce(sum(${invoices.totalCents})::int, 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .innerJoin(clients, eq(clients.id, invoices.clientId))
      .where(where)
      .groupBy(invoices.clientId, clients.name)
      .orderBy(sql`sum(${invoices.totalCents}) desc`),
    db
      .select({
        paidCents: sql<number>`coalesce(sum(case when ${invoices.status} = 'paid' then ${invoices.totalCents} else 0 end)::int, 0)`,
        unpaidCents: sql<number>`coalesce(sum(case when ${invoices.status} in ('sent','partial','overdue') then ${invoices.totalCents} - ${invoices.amountPaidCents} else 0 end)::int, 0)`,
        totalInvoiced: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(where),
  ])

  // Build month skeleton from range
  const months: IncomeMonthPoint[] = []
  const start = new Date(range.from + "T00:00:00Z")
  const end = new Date(range.to + "T00:00:00Z")
  for (
    let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    d <= end;
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  ) {
    const key = d.toISOString().slice(0, 7)
    months.push({
      month: key,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      paidCents: 0,
      unpaidCents: 0,
      invoiceCount: 0,
    })
  }
  for (const r of monthlyRows) {
    const slot = months.find((m) => m.month === r.month)
    if (!slot) continue
    if (r.status === "paid") slot.paidCents += r.cents
    else slot.unpaidCents += r.cents
    slot.invoiceCount += r.count
  }

  return {
    totalPaidCents: totalsRow[0]?.paidCents ?? 0,
    totalUnpaidCents: totalsRow[0]?.unpaidCents ?? 0,
    totalInvoiced: totalsRow[0]?.totalInvoiced ?? 0,
    monthly: months,
    byClient: byClientRows.map((r) => ({
      clientId: r.clientId,
      name: r.name,
      cents: r.cents,
      invoiceCount: r.count,
    })),
  }
}

export type HoursMonthPoint = {
  month: string
  label: string
  billableHours: number
  nonBillableHours: number
}

export type HoursReport = {
  totalHours: number
  billableHours: number
  nonBillableHours: number
  totalLogs: number
  monthly: HoursMonthPoint[]
  byClient: {
    clientId: string
    name: string
    hours: number
    billableHours: number
    logCount: number
  }[]
}

export async function getHoursReport(
  userId: string,
  range: DateRange,
): Promise<HoursReport> {
  const where = and(
    eq(workLogs.userId, userId),
    gte(workLogs.workDate, range.from),
    lte(workLogs.workDate, range.to),
  )

  const [monthlyRows, byClientRows, totalsRow] = await Promise.all([
    db
      .select({
        month: sql<string>`to_char(${workLogs.workDate}, 'YYYY-MM')`,
        billable: workLogs.billable,
        totalMinutes: sql<number>`coalesce(sum(${workLogs.durationMinutes})::int, 0)`,
      })
      .from(workLogs)
      .where(where)
      .groupBy(sql`to_char(${workLogs.workDate}, 'YYYY-MM')`, workLogs.billable),
    db
      .select({
        clientId: workLogs.clientId,
        name: clients.name,
        totalMinutes: sql<number>`coalesce(sum(${workLogs.durationMinutes})::int, 0)`,
        billableMinutes: sql<number>`coalesce(sum(case when ${workLogs.billable} then ${workLogs.durationMinutes} else 0 end)::int, 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(workLogs)
      .innerJoin(clients, eq(clients.id, workLogs.clientId))
      .where(where)
      .groupBy(workLogs.clientId, clients.name)
      .orderBy(sql`sum(${workLogs.durationMinutes}) desc`),
    db
      .select({
        totalMinutes: sql<number>`coalesce(sum(${workLogs.durationMinutes})::int, 0)`,
        billableMinutes: sql<number>`coalesce(sum(case when ${workLogs.billable} then ${workLogs.durationMinutes} else 0 end)::int, 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(workLogs)
      .where(where),
  ])

  const months: HoursMonthPoint[] = []
  const start = new Date(range.from + "T00:00:00Z")
  const end = new Date(range.to + "T00:00:00Z")
  for (
    let d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    d <= end;
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  ) {
    const key = d.toISOString().slice(0, 7)
    months.push({
      month: key,
      label: d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
      billableHours: 0,
      nonBillableHours: 0,
    })
  }
  for (const r of monthlyRows) {
    const slot = months.find((m) => m.month === r.month)
    if (!slot) continue
    const hours = r.totalMinutes / 60
    if (r.billable) slot.billableHours += hours
    else slot.nonBillableHours += hours
  }

  const totalMinutes = totalsRow[0]?.totalMinutes ?? 0
  const billableMinutes = totalsRow[0]?.billableMinutes ?? 0

  return {
    totalHours: totalMinutes / 60,
    billableHours: billableMinutes / 60,
    nonBillableHours: (totalMinutes - billableMinutes) / 60,
    totalLogs: totalsRow[0]?.count ?? 0,
    monthly: months,
    byClient: byClientRows.map((r) => ({
      clientId: r.clientId,
      name: r.name,
      hours: r.totalMinutes / 60,
      billableHours: r.billableMinutes / 60,
      logCount: r.count,
    })),
  }
}

export type ClientsReport = {
  rows: {
    clientId: string
    name: string
    status: string
    currency: string
    totalHours: number
    billableHours: number
    invoicedCents: number
    paidCents: number
    outstandingCents: number
    invoiceCount: number
  }[]
}

export async function getClientsReport(
  userId: string,
  range: DateRange,
): Promise<ClientsReport> {
  // We aggregate work logs + invoices separately then join in JS — keeps the
  // SQL straightforward and currency-aware (currencies live on the client row).
  const [allClients, hoursRows, invoiceRows] = await Promise.all([
    db
      .select({
        id: clients.id,
        name: clients.name,
        status: clients.status,
        currency: clients.currency,
      })
      .from(clients)
      .where(eq(clients.userId, userId)),
    db
      .select({
        clientId: workLogs.clientId,
        totalMinutes: sql<number>`coalesce(sum(${workLogs.durationMinutes})::int, 0)`,
        billableMinutes: sql<number>`coalesce(sum(case when ${workLogs.billable} then ${workLogs.durationMinutes} else 0 end)::int, 0)`,
      })
      .from(workLogs)
      .where(
        and(
          eq(workLogs.userId, userId),
          gte(workLogs.workDate, range.from),
          lte(workLogs.workDate, range.to),
        ),
      )
      .groupBy(workLogs.clientId),
    db
      .select({
        clientId: invoices.clientId,
        invoicedCents: sql<number>`coalesce(sum(${invoices.totalCents})::int, 0)`,
        paidCents: sql<number>`coalesce(sum(${invoices.amountPaidCents})::int, 0)`,
        count: sql<number>`count(*)::int`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.userId, userId),
          ne(invoices.status, "cancelled"),
          gte(invoices.issuedDate, range.from),
          lte(invoices.issuedDate, range.to),
        ),
      )
      .groupBy(invoices.clientId),
  ])

  const hoursMap = new Map(hoursRows.map((r) => [r.clientId, r]))
  const invoiceMap = new Map(invoiceRows.map((r) => [r.clientId, r]))

  const rows = allClients
    .map((c) => {
      const h = hoursMap.get(c.id)
      const i = invoiceMap.get(c.id)
      const invoiced = i?.invoicedCents ?? 0
      const paid = i?.paidCents ?? 0
      return {
        clientId: c.id,
        name: c.name,
        status: c.status,
        currency: c.currency,
        totalHours: (h?.totalMinutes ?? 0) / 60,
        billableHours: (h?.billableMinutes ?? 0) / 60,
        invoicedCents: invoiced,
        paidCents: paid,
        outstandingCents: invoiced - paid,
        invoiceCount: i?.count ?? 0,
      }
    })
    .filter((r) => r.totalHours > 0 || r.invoicedCents > 0)
    .sort((a, b) => b.invoicedCents - a.invoicedCents || b.totalHours - a.totalHours)

  return { rows }
}
