// Drizzle query helpers for work logs.
// Every query is explicitly scoped by user_id (defense-in-depth alongside RLS).

import { and, asc, desc, eq, gte, ilike, lte, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { clients, workLogs, type WorkLog } from "@/lib/db/schema"
import type { WorkLogStatus } from "@/lib/validations/work-logs"

export type WorkLogWithClient = WorkLog & {
  clientName: string
  clientCurrency: string
}

type ListFilters = {
  status?: WorkLogStatus | "all"
  query?: string
  clientId?: string
  from?: string // ISO date
  to?: string // ISO date
  billable?: boolean
}

export async function listWorkLogs(
  userId: string,
  filters: ListFilters = {},
): Promise<WorkLogWithClient[]> {
  const conditions = [eq(workLogs.userId, userId)]

  if (filters.status && filters.status !== "all") {
    conditions.push(eq(workLogs.invoiceStatus, filters.status))
  }
  if (filters.clientId) {
    conditions.push(eq(workLogs.clientId, filters.clientId))
  }
  if (filters.from) {
    conditions.push(gte(workLogs.workDate, filters.from))
  }
  if (filters.to) {
    conditions.push(lte(workLogs.workDate, filters.to))
  }
  if (filters.billable !== undefined) {
    conditions.push(eq(workLogs.billable, filters.billable))
  }
  if (filters.query?.trim()) {
    const like = `%${filters.query.trim()}%`
    const matches = or(ilike(workLogs.title, like), ilike(workLogs.description, like))
    if (matches) conditions.push(matches)
  }

  const rows = await db
    .select({
      id: workLogs.id,
      userId: workLogs.userId,
      clientId: workLogs.clientId,
      title: workLogs.title,
      description: workLogs.description,
      notes: workLogs.notes,
      workDate: workLogs.workDate,
      startTime: workLogs.startTime,
      endTime: workLogs.endTime,
      durationMinutes: workLogs.durationMinutes,
      tag: workLogs.tag,
      billable: workLogs.billable,
      invoiceStatus: workLogs.invoiceStatus,
      invoiceId: workLogs.invoiceId,
      attachmentUrl: workLogs.attachmentUrl,
      createdAt: workLogs.createdAt,
      updatedAt: workLogs.updatedAt,
      clientName: clients.name,
      clientCurrency: clients.currency,
    })
    .from(workLogs)
    .innerJoin(clients, eq(clients.id, workLogs.clientId))
    .where(and(...conditions))
    .orderBy(desc(workLogs.workDate), desc(workLogs.createdAt))

  return rows
}

export async function getWorkLogById(
  userId: string,
  workLogId: string,
): Promise<WorkLogWithClient | null> {
  const rows = await db
    .select({
      id: workLogs.id,
      userId: workLogs.userId,
      clientId: workLogs.clientId,
      title: workLogs.title,
      description: workLogs.description,
      notes: workLogs.notes,
      workDate: workLogs.workDate,
      startTime: workLogs.startTime,
      endTime: workLogs.endTime,
      durationMinutes: workLogs.durationMinutes,
      tag: workLogs.tag,
      billable: workLogs.billable,
      invoiceStatus: workLogs.invoiceStatus,
      invoiceId: workLogs.invoiceId,
      attachmentUrl: workLogs.attachmentUrl,
      createdAt: workLogs.createdAt,
      updatedAt: workLogs.updatedAt,
      clientName: clients.name,
      clientCurrency: clients.currency,
    })
    .from(workLogs)
    .innerJoin(clients, eq(clients.id, workLogs.clientId))
    .where(and(eq(workLogs.userId, userId), eq(workLogs.id, workLogId)))
    .limit(1)
  return rows[0] ?? null
}

export async function countWorkLogsByStatus(userId: string) {
  const rows = await db
    .select({
      status: workLogs.invoiceStatus,
      count: sql<number>`count(*)::int`,
    })
    .from(workLogs)
    .where(eq(workLogs.userId, userId))
    .groupBy(workLogs.invoiceStatus)

  const result: Record<WorkLogStatus, number> = {
    unbilled: 0,
    billed: 0,
    paid: 0,
  }
  for (const r of rows) result[r.status] = r.count
  return result
}

export async function getMonthlyHours(userId: string, year: number, month: number) {
  // First day of month, last day of month (UTC)
  const from = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)

  const rows = await db
    .select({
      total: sql<number>`coalesce(sum(${workLogs.durationMinutes})::int, 0)`,
    })
    .from(workLogs)
    .where(
      and(
        eq(workLogs.userId, userId),
        gte(workLogs.workDate, from),
        lte(workLogs.workDate, to),
      ),
    )

  return (rows[0]?.total ?? 0) / 60
}

export async function listWorkLogsForMonth(
  userId: string,
  year: number,
  month: number,
): Promise<WorkLogWithClient[]> {
  const from = new Date(Date.UTC(year, month - 1, 1)).toISOString().slice(0, 10)
  const to = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)
  return listWorkLogs(userId, { from, to })
}

// Confirm a client belongs to the current user before insert/update.
// Throws if not — server actions surface a friendly error.
export async function assertClientOwned(userId: string, clientId: string) {
  const rows = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.userId, userId), eq(clients.id, clientId)))
    .limit(1)
  if (rows.length === 0) {
    throw new Error("Client not found or not yours")
  }
}

// Used by Step 6 (invoice generator) — billable unbilled logs in a date range
export async function listBillableUnbilled(
  userId: string,
  clientId: string,
  from: string,
  to: string,
) {
  return db
    .select()
    .from(workLogs)
    .where(
      and(
        eq(workLogs.userId, userId),
        eq(workLogs.clientId, clientId),
        eq(workLogs.billable, true),
        eq(workLogs.invoiceStatus, "unbilled"),
        gte(workLogs.workDate, from),
        lte(workLogs.workDate, to),
      ),
    )
    .orderBy(asc(workLogs.workDate))
}
