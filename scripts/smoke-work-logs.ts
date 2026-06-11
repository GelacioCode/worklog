// Smoke test for work-log CRUD against the live DB.
// Creates a temp client, inserts logs, queries by filter, edits, deletes.
// Run with: tsx scripts/smoke-work-logs.ts
import "dotenv/config"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { and, eq } from "drizzle-orm"
import { clients, workLogs } from "../src/lib/db/schema"
import { randomUUID } from "node:crypto"

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL not set")
    process.exit(1)
  }
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })
  const db = drizzle(sql)

  const users = await sql<{ id: string; email: string | null }[]>`
    select id, email from auth.users limit 1
  `
  if (users.length === 0) {
    console.error("✗ No users in auth.users — sign up via the app first.")
    await sql.end()
    process.exit(1)
  }
  const userId = users[0].id
  console.log("Using user: " + (users[0].email ?? userId))

  // Create a temp client
  const clientName = "SMOKE-WL-" + randomUUID().slice(0, 8)
  console.log("\n▸ Creating temp client: " + clientName)
  const [client] = await db
    .insert(clients)
    .values({
      userId,
      name: clientName,
      billingType: "hourly",
      hourlyRateCents: 5000,
      currency: "USD",
      cutoffSchedule: { preset: "biweekly_15_30" },
      paymentTermsDays: 7,
    })
    .returning()
  console.log("  ✓ client id=" + client.id)

  // Insert 3 work logs
  console.log("\n▸ Inserting 3 work logs")
  const inserted = await db
    .insert(workLogs)
    .values([
      {
        userId,
        clientId: client.id,
        title: "Frontend kickoff",
        workDate: "2026-05-15",
        durationMinutes: 90,
        billable: true,
        tag: "design",
      },
      {
        userId,
        clientId: client.id,
        title: "API spec review",
        workDate: "2026-05-16",
        durationMinutes: 60,
        billable: true,
        tag: "review",
      },
      {
        userId,
        clientId: client.id,
        title: "Slack noise",
        workDate: "2026-05-16",
        durationMinutes: 30,
        billable: false,
        tag: "admin",
      },
    ])
    .returning()
  console.log("  ✓ inserted " + inserted.length + " rows")

  // List + filter
  console.log("\n▸ Querying logs")
  const unbilled = await db
    .select()
    .from(workLogs)
    .where(
      and(
        eq(workLogs.userId, userId),
        eq(workLogs.clientId, client.id),
        eq(workLogs.invoiceStatus, "unbilled"),
      ),
    )
  console.log("  ✓ unbilled count: " + unbilled.length)
  if (unbilled.length !== 3) throw new Error("Expected 3 unbilled rows")

  const billableOnly = unbilled.filter((l) => l.billable)
  const totalMinutes = billableOnly.reduce((s, l) => s + l.durationMinutes, 0)
  console.log(
    "  ✓ billable total: " +
      billableOnly.length +
      " logs / " +
      (totalMinutes / 60).toFixed(1) +
      "h",
  )
  if (billableOnly.length !== 2 || totalMinutes !== 150) {
    throw new Error("Billable totals mismatch")
  }

  // Update one
  console.log("\n▸ Updating log #1 (90m → 120m)")
  await db
    .update(workLogs)
    .set({ durationMinutes: 120 })
    .where(and(eq(workLogs.userId, userId), eq(workLogs.id, inserted[0].id)))
  const after = await db
    .select()
    .from(workLogs)
    .where(and(eq(workLogs.userId, userId), eq(workLogs.id, inserted[0].id)))
    .limit(1)
  if (after[0].durationMinutes !== 120) throw new Error("Update did not persist")
  console.log("  ✓ updated to 120m")

  // Cleanup
  console.log("\n▸ Cleanup")
  await db
    .delete(workLogs)
    .where(and(eq(workLogs.userId, userId), eq(workLogs.clientId, client.id)))
  await db
    .delete(clients)
    .where(and(eq(clients.userId, userId), eq(clients.id, client.id)))
  console.log("  ✓ deleted logs + temp client")

  await sql.end()
  console.log("\n✓ Smoke test passed.")
}

main().catch(async (err) => {
  console.error("\n✗ Smoke test failed:", err)
  process.exit(1)
})
