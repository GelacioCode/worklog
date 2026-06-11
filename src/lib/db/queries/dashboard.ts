// Aggregation queries for the Dashboard page.
// All queries scoped by user_id; money totals are grouped by currency so the
// page can render base-currency + "+ N others" hints without FX rates.

import { and, eq, gte, lte, ne, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { clients, invoices, workLogs } from "@/lib/db/schema"

export type MoneyByCurrency = { currency: string; cents: number }[]

export type DashboardStats = {
  hoursThisMonth: number
  paidThisMonth: MoneyByCurrency
  unpaid: MoneyByCurrency // sent + partial + overdue
  expectedIncome: MoneyByCurrency // unpaid invoices + unbilled hours × current rate
  activeClientsCount: number
  overdueInvoiceCount: number
  unbilledBillableLogCount: number
  totalLogCount: number
  totalInvoiceCount: number
}

function monthBounds(date: Date) {
  const from = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10)
  const to = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10)
  return { from, to }
}

export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const now = new Date()
  const { from: monthStart, to: monthEnd } = monthBounds(now)

  const [
    hoursRow,
    paidRows,
    unpaidRows,
    unbilledRows,
    overdueRows,
    activeClientsRow,
    totalLogsRow,
    totalInvoicesRow,
  ] = await Promise.all([
    // Hours this month
    db
      .select({
        total: sql<number>`coalesce(sum(${workLogs.durationMinutes})::int, 0)`,
      })
      .from(workLogs)
      .where(
        and(
          eq(workLogs.userId, userId),
          gte(workLogs.workDate, monthStart),
          lte(workLogs.workDate, monthEnd),
        ),
      ),
    // Paid this month, by currency
    db
      .select({
        currency: invoices.currency,
        cents: sql<number>`coalesce(sum(${invoices.totalCents})::int, 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.userId, userId),
          eq(invoices.status, "paid"),
          gte(invoices.issuedDate, monthStart),
          lte(invoices.issuedDate, monthEnd),
        ),
      )
      .groupBy(invoices.currency),
    // Unpaid (sent + partial + overdue), by currency: sum of (total - amount_paid)
    db
      .select({
        currency: invoices.currency,
        cents: sql<number>`coalesce(sum(${invoices.totalCents} - ${invoices.amountPaidCents})::int, 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.userId, userId),
          // any status except draft / paid / cancelled is unpaid for our purposes
          sql`${invoices.status} in ('sent','partial','overdue')`,
        ),
      )
      .groupBy(invoices.currency),
    // Unbilled billable work, by client+currency, to project expected income.
    db
      .select({
        currency: clients.currency,
        totalMinutes: sql<number>`coalesce(sum(${workLogs.durationMinutes})::int, 0)`,
        rateCents: clients.hourlyRateCents,
      })
      .from(workLogs)
      .innerJoin(clients, eq(clients.id, workLogs.clientId))
      .where(
        and(
          eq(workLogs.userId, userId),
          eq(workLogs.invoiceStatus, "unbilled"),
          eq(workLogs.billable, true),
        ),
      )
      .groupBy(clients.id, clients.currency, clients.hourlyRateCents),
    // Overdue invoice count
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(
        and(
          eq(invoices.userId, userId),
          sql`${invoices.status} in ('sent','partial')`,
          lte(invoices.dueDate, sql`current_date`),
        ),
      ),
    // Active clients
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(clients)
      .where(and(eq(clients.userId, userId), eq(clients.status, "active"))),
    // Total log count (for empty-state detection)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(workLogs)
      .where(eq(workLogs.userId, userId)),
    // Total invoice count (for empty-state detection)
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(invoices)
      .where(eq(invoices.userId, userId)),
  ])

  // Unbilled billable work-log count (for the Alert strip)
  const unbilledCountRow = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(workLogs)
    .where(
      and(
        eq(workLogs.userId, userId),
        eq(workLogs.invoiceStatus, "unbilled"),
        eq(workLogs.billable, true),
      ),
    )

  const expectedByCurrency = new Map<string, number>()
  // Seed expected with unpaid amounts
  for (const u of unpaidRows) {
    expectedByCurrency.set(u.currency, (expectedByCurrency.get(u.currency) ?? 0) + u.cents)
  }
  // Add unbilled hours × current rate per client (best estimate)
  for (const u of unbilledRows) {
    if (u.rateCents == null) continue
    const cents = Math.round((u.totalMinutes / 60) * u.rateCents)
    expectedByCurrency.set(u.currency, (expectedByCurrency.get(u.currency) ?? 0) + cents)
  }

  return {
    hoursThisMonth: (hoursRow[0]?.total ?? 0) / 60,
    paidThisMonth: paidRows.map((r) => ({ currency: r.currency, cents: r.cents })),
    unpaid: unpaidRows.map((r) => ({ currency: r.currency, cents: r.cents })),
    expectedIncome: Array.from(expectedByCurrency.entries()).map(
      ([currency, cents]) => ({ currency, cents }),
    ),
    activeClientsCount: activeClientsRow[0]?.count ?? 0,
    overdueInvoiceCount: overdueRows[0]?.count ?? 0,
    unbilledBillableLogCount: unbilledCountRow[0]?.count ?? 0,
    totalLogCount: totalLogsRow[0]?.count ?? 0,
    totalInvoiceCount: totalInvoicesRow[0]?.count ?? 0,
  }
}

// ============================================================
// Chart data
// ============================================================

export type HoursByClientPoint = {
  clientId: string
  name: string
  hours: number
}

/**
 * Top N clients by hours in the trailing 30 days. Remainder bucketed as "Other".
 */
export async function getHoursByClient(
  userId: string,
  topN = 5,
): Promise<HoursByClientPoint[]> {
  const from = new Date()
  from.setUTCDate(from.getUTCDate() - 30)
  const fromIso = from.toISOString().slice(0, 10)

  const rows = await db
    .select({
      clientId: workLogs.clientId,
      name: clients.name,
      totalMinutes: sql<number>`coalesce(sum(${workLogs.durationMinutes})::int, 0)`,
    })
    .from(workLogs)
    .innerJoin(clients, eq(clients.id, workLogs.clientId))
    .where(and(eq(workLogs.userId, userId), gte(workLogs.workDate, fromIso)))
    .groupBy(workLogs.clientId, clients.name)
    .orderBy(sql`sum(${workLogs.durationMinutes}) desc`)

  if (rows.length === 0) return []

  const top = rows.slice(0, topN)
  const rest = rows.slice(topN)
  const result: HoursByClientPoint[] = top.map((r) => ({
    clientId: r.clientId,
    name: r.name,
    hours: r.totalMinutes / 60,
  }))
  if (rest.length > 0) {
    const otherHours = rest.reduce((s, r) => s + r.totalMinutes, 0) / 60
    result.push({ clientId: "other", name: "Other", hours: otherHours })
  }
  return result
}

export type IncomeByClientPoint = {
  clientId: string
  name: string
  cents: number
  currency: string
}

/**
 * Top clients by invoiced amount this month, base-currency only (filter passed in).
 */
export async function getIncomeByClient(
  userId: string,
  currency: string,
): Promise<IncomeByClientPoint[]> {
  const now = new Date()
  const { from, to } = monthBounds(now)
  const rows = await db
    .select({
      clientId: invoices.clientId,
      name: clients.name,
      cents: sql<number>`coalesce(sum(${invoices.totalCents})::int, 0)`,
    })
    .from(invoices)
    .innerJoin(clients, eq(clients.id, invoices.clientId))
    .where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.currency, currency),
        ne(invoices.status, "cancelled"),
        gte(invoices.issuedDate, from),
        lte(invoices.issuedDate, to),
      ),
    )
    .groupBy(invoices.clientId, clients.name)
    .orderBy(sql`sum(${invoices.totalCents}) desc`)

  return rows.map((r) => ({
    clientId: r.clientId,
    name: r.name,
    cents: r.cents,
    currency,
  }))
}

export type PaidVsUnpaidPoint = {
  month: string // ISO yyyy-mm
  label: string // "May"
  paidCents: number
  unpaidCents: number
}

/**
 * Last 6 calendar months. Both buckets in the same currency.
 */
export async function getPaidVsUnpaid(
  userId: string,
  currency: string,
): Promise<PaidVsUnpaidPoint[]> {
  const now = new Date()
  // Start from 5 months ago, first of that month
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1))
  const startIso = start.toISOString().slice(0, 10)
  const endIso = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0))
    .toISOString()
    .slice(0, 10)

  const rows = await db
    .select({
      month: sql<string>`to_char(${invoices.issuedDate}, 'YYYY-MM')`,
      status: invoices.status,
      cents: sql<number>`coalesce(sum(${invoices.totalCents})::int, 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.userId, userId),
        eq(invoices.currency, currency),
        ne(invoices.status, "cancelled"),
        gte(invoices.issuedDate, startIso),
        lte(invoices.issuedDate, endIso),
      ),
    )
    .groupBy(sql`to_char(${invoices.issuedDate}, 'YYYY-MM')`, invoices.status)

  // Build month skeleton
  const months: PaidVsUnpaidPoint[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1))
    const monthKey = d.toISOString().slice(0, 7)
    months.push({
      month: monthKey,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      paidCents: 0,
      unpaidCents: 0,
    })
  }

  for (const r of rows) {
    const slot = months.find((m) => m.month === r.month)
    if (!slot) continue
    if (r.status === "paid") slot.paidCents += r.cents
    else slot.unpaidCents += r.cents
  }
  return months
}

export type WeeklyWorkloadPoint = {
  week: string // ISO date of Monday
  label: string // "5/12"
  hours: number
}

/**
 * Last 12 weeks of hours logged. Weeks start Monday (ISO).
 */
export async function getWeeklyWorkload(userId: string): Promise<WeeklyWorkloadPoint[]> {
  const now = new Date()
  const start = new Date(now)
  start.setUTCDate(start.getUTCDate() - 7 * 12)
  const startIso = start.toISOString().slice(0, 10)

  const rows = await db
    .select({
      week: sql<string>`to_char(date_trunc('week', ${workLogs.workDate}::timestamp), 'YYYY-MM-DD')`,
      total: sql<number>`coalesce(sum(${workLogs.durationMinutes})::int, 0)`,
    })
    .from(workLogs)
    .where(and(eq(workLogs.userId, userId), gte(workLogs.workDate, startIso)))
    .groupBy(sql`date_trunc('week', ${workLogs.workDate}::timestamp)`)

  const byWeek = new Map(rows.map((r) => [r.week, r.total]))

  const weeks: WeeklyWorkloadPoint[] = []
  // Anchor to the most recent Monday and walk back 12 weeks.
  const dayOfWeek = now.getUTCDay()
  // Move to Monday of current week (Sunday = 0; want previous Monday)
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - ((dayOfWeek + 6) % 7))
  for (let i = 11; i >= 0; i--) {
    const d = new Date(monday)
    d.setUTCDate(monday.getUTCDate() - 7 * i)
    const key = d.toISOString().slice(0, 10)
    const total = byWeek.get(key) ?? 0
    weeks.push({
      week: key,
      label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
      hours: total / 60,
    })
  }
  return weeks
}

// ============================================================
// Cutoff projection — compute next cutoff date per active client.
// ============================================================

import type { CutoffScheduleJson } from "@/lib/validations/clients"

export type UpcomingCutoff = {
  clientId: string
  clientName: string
  nextCutoff: string // ISO date
  daysAway: number
}

function nextCutoffDate(preset: string, from: Date): Date | null {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  if (preset === "biweekly_15_30") {
    const day = d.getUTCDate()
    if (day < 15) {
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 15))
    }
    if (day < 30) {
      return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 30))
    }
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 15))
  }
  if (preset === "weekly_friday" || preset === "weekly_monday") {
    const target = preset === "weekly_friday" ? 5 : 1 // 0=Sun
    const dow = d.getUTCDay()
    let delta = target - dow
    if (delta <= 0) delta += 7
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + delta))
  }
  if (preset === "monthly_last") {
    const lastOfMonth = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0))
    if (d.getUTCDate() <= lastOfMonth.getUTCDate()) return lastOfMonth
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 2, 0))
  }
  if (preset === "monthly_first") {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))
  }
  return null
}

export async function getUpcomingCutoffs(
  userId: string,
  withinDays = 7,
): Promise<UpcomingCutoff[]> {
  const rows = await db
    .select({
      id: clients.id,
      name: clients.name,
      cutoffSchedule: clients.cutoffSchedule,
    })
    .from(clients)
    .where(and(eq(clients.userId, userId), eq(clients.status, "active")))

  const today = new Date()
  const results: UpcomingCutoff[] = []
  for (const c of rows) {
    const cutoff = c.cutoffSchedule as CutoffScheduleJson | null
    if (!cutoff?.preset || cutoff.preset === "none") continue
    const next = nextCutoffDate(cutoff.preset, today)
    if (!next) continue
    const daysAway = Math.round(
      (next.getTime() - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) /
        86400000,
    )
    if (daysAway >= 0 && daysAway <= withinDays) {
      results.push({
        clientId: c.id,
        clientName: c.name,
        nextCutoff: next.toISOString().slice(0, 10),
        daysAway,
      })
    }
  }
  results.sort((a, b) => a.daysAway - b.daysAway)
  return results
}

