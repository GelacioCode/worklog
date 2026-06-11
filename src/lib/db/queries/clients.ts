// Drizzle query helpers for clients.
// Every query is explicitly scoped by user_id (defense-in-depth alongside RLS).

import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm"
import { db } from "@/lib/db"
import { clients, clientRateHistory, type Client } from "@/lib/db/schema"

type ListFilters = {
  status?: "active" | "paused" | "ended" | "all"
  query?: string
}

export async function listClients(
  userId: string,
  { status = "all", query }: ListFilters = {},
): Promise<Client[]> {
  const conditions = [eq(clients.userId, userId)]

  if (status !== "all") {
    conditions.push(eq(clients.status, status))
  }

  if (query?.trim()) {
    const like = `%${query.trim()}%`
    const matches = or(
      ilike(clients.name, like),
      ilike(clients.companyName, like),
      ilike(clients.email, like),
    )
    if (matches) conditions.push(matches)
  }

  return db
    .select()
    .from(clients)
    .where(and(...conditions))
    .orderBy(desc(clients.status), asc(clients.name))
}

export async function getClientById(
  userId: string,
  clientId: string,
): Promise<Client | null> {
  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.userId, userId), eq(clients.id, clientId)))
    .limit(1)
  return rows[0] ?? null
}

export async function countClientsByStatus(userId: string) {
  const rows = await db
    .select({
      status: clients.status,
      count: sql<number>`count(*)::int`,
    })
    .from(clients)
    .where(eq(clients.userId, userId))
    .groupBy(clients.status)

  const result: Record<"active" | "paused" | "ended", number> = {
    active: 0,
    paused: 0,
    ended: 0,
  }
  for (const r of rows) result[r.status] = r.count
  return result
}

export async function listRateHistoryFor(userId: string, clientId: string) {
  return db
    .select()
    .from(clientRateHistory)
    .where(
      and(
        eq(clientRateHistory.userId, userId),
        eq(clientRateHistory.clientId, clientId),
      ),
    )
    .orderBy(desc(clientRateHistory.effectiveFrom))
}

/**
 * The rate that was in effect on a given date. Used by the invoice generator
 * so old invoices stay accurate even if the rate later changes.
 *
 * Returns null if no history row covers the date (which shouldn't happen for
 * clients created through the app — the insert trigger always seeds one).
 */
export async function getRateAt(userId: string, clientId: string, isoDate: string) {
  const rows = await db
    .select()
    .from(clientRateHistory)
    .where(
      and(
        eq(clientRateHistory.userId, userId),
        eq(clientRateHistory.clientId, clientId),
        // effective_from <= isoDate AND (effective_to is null OR effective_to >= isoDate)
        sql`${clientRateHistory.effectiveFrom} <= ${isoDate}`,
        sql`(${clientRateHistory.effectiveTo} IS NULL OR ${clientRateHistory.effectiveTo} >= ${isoDate})`,
      ),
    )
    .orderBy(desc(clientRateHistory.effectiveFrom))
    .limit(1)
  return rows[0] ?? null
}
