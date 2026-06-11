// Smoke test for dashboard aggregation queries.
// Seeds a tiny scenario (client + a few logs + an invoice), runs all queries,
// prints the results, then cleans up.
//
// Run with: tsx scripts/smoke-dashboard.ts
import "dotenv/config"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { and, eq } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import {
  clients,
  invoices,
  invoiceItems,
  invoiceSequences,
  workLogs,
} from "../src/lib/db/schema"
import {
  getDashboardStats,
  getHoursByClient,
  getIncomeByClient,
  getPaidVsUnpaid,
  getUpcomingCutoffs,
  getWeeklyWorkload,
} from "../src/lib/db/queries/dashboard"

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
    console.error("✗ No users — sign up via the app first.")
    await sql.end()
    process.exit(1)
  }
  const userId = users[0].id
  console.log("Using user: " + (users[0].email ?? userId))

  const today = new Date()
  const todayISO = today.toISOString().slice(0, 10)

  // ----- Seed -----
  const clientName = "SMOKE-DASH-" + randomUUID().slice(0, 8)
  console.log("\n▸ Seeding client + 3 logs + 1 paid invoice")
  const [c] = await db
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

  // 2 unbilled (1h + 2h), 1 will go onto an invoice (3h)
  const [unbilledA, unbilledB, billedC] = await db
    .insert(workLogs)
    .values([
      {
        userId,
        clientId: c.id,
        title: "Unbilled A",
        workDate: todayISO,
        durationMinutes: 60,
        billable: true,
      },
      {
        userId,
        clientId: c.id,
        title: "Unbilled B",
        workDate: todayISO,
        durationMinutes: 120,
        billable: true,
      },
      {
        userId,
        clientId: c.id,
        title: "Billed C",
        workDate: todayISO,
        durationMinutes: 180,
        billable: true,
      },
    ])
    .returning()

  // Insert one PAID invoice covering the third log
  const [inv] = await db
    .insert(invoices)
    .values({
      userId,
      clientId: c.id,
      invoiceNumber: "SMOKE-" + randomUUID().slice(0, 8),
      status: "paid",
      periodStart: todayISO,
      periodEnd: todayISO,
      issuedDate: todayISO,
      dueDate: todayISO,
      currency: "USD",
      subtotalCents: 15000,
      discountCents: 0,
      taxCents: 0,
      expensesCents: 0,
      totalCents: 15000,
      amountPaidCents: 15000,
      notes: null,
      rateSnapshotCents: 5000,
    })
    .returning()

  await db.insert(invoiceItems).values({
    userId,
    invoiceId: inv.id,
    workLogId: billedC.id,
    description: billedC.title,
    quantity: "3.00",
    unit: "hours",
    unitPriceCents: 5000,
    amountCents: 15000,
  })

  await db
    .update(workLogs)
    .set({ invoiceId: inv.id, invoiceStatus: "paid" })
    .where(eq(workLogs.id, billedC.id))

  console.log("  ✓ seeded")

  // ----- Run queries -----
  console.log("\n▸ Running aggregations")

  const stats = await getDashboardStats(userId)
  console.log("  hoursThisMonth:           ", stats.hoursThisMonth.toFixed(2) + "h")
  console.log("  paidThisMonth:            ", JSON.stringify(stats.paidThisMonth))
  console.log("  unpaid:                   ", JSON.stringify(stats.unpaid))
  console.log("  expectedIncome:           ", JSON.stringify(stats.expectedIncome))
  console.log("  activeClientsCount:       ", stats.activeClientsCount)
  console.log("  overdueInvoiceCount:      ", stats.overdueInvoiceCount)
  console.log("  unbilledBillableLogCount: ", stats.unbilledBillableLogCount)

  // Asserts on the seeded scenario for *this* test:
  if (stats.hoursThisMonth < 6) {
    throw new Error("Expected at least 6 hours this month (we just added them)")
  }
  const paidUSD = stats.paidThisMonth.find((r) => r.currency === "USD")
  if (!paidUSD || paidUSD.cents < 15000) {
    throw new Error("Expected paid USD bucket to include our 15000 cents invoice")
  }
  const expectedUSD = stats.expectedIncome.find((r) => r.currency === "USD")
  // Expected = unbilled hours × rate = (60+120)/60 × 5000 = 15000 (no unpaid invoices)
  if (!expectedUSD || expectedUSD.cents < 15000) {
    throw new Error(
      "Expected income USD should include unbilled hours × rate (≥15000c)",
    )
  }
  console.log("  ✓ stats sanity checks passed")

  const hours = await getHoursByClient(userId, 5)
  console.log("\n  hoursByClient (top 5):")
  for (const h of hours) console.log("    " + h.name + ": " + h.hours.toFixed(2) + "h")
  if (!hours.some((h) => h.name === clientName)) {
    throw new Error("Hours-by-client should include our smoke client")
  }

  const income = await getIncomeByClient(userId, "USD")
  console.log("\n  incomeByClient (USD):")
  for (const i of income) console.log("    " + i.name + ": " + i.cents + "c")
  if (!income.some((i) => i.name === clientName)) {
    throw new Error("Income-by-client should include our smoke client")
  }

  const paidVsUnpaid = await getPaidVsUnpaid(userId, "USD")
  console.log("\n  paidVsUnpaid (USD, 6 months):")
  for (const m of paidVsUnpaid) {
    console.log(
      "    " + m.label + ": paid=" + m.paidCents + "c, unpaid=" + m.unpaidCents + "c",
    )
  }
  if (paidVsUnpaid.length !== 6) throw new Error("Expected 6 months in chart data")

  const weekly = await getWeeklyWorkload(userId)
  console.log("\n  weeklyWorkload (12 weeks):")
  for (const w of weekly.slice(-3)) {
    console.log("    " + w.label + ": " + w.hours.toFixed(2) + "h")
  }
  if (weekly.length !== 12) throw new Error("Expected 12 weeks in chart data")
  if (!weekly.some((w) => w.hours > 0)) {
    throw new Error("Expected at least one week with hours")
  }

  const cutoffs = await getUpcomingCutoffs(userId, 7)
  console.log("\n  upcomingCutoffs (7 days):", cutoffs.length, "match")
  for (const c of cutoffs) {
    console.log("    " + c.clientName + " → " + c.nextCutoff + " (" + c.daysAway + "d)")
  }

  // ----- Cleanup -----
  console.log("\n▸ Cleanup")
  await db.delete(workLogs).where(eq(workLogs.clientId, c.id))
  await db.delete(invoices).where(eq(invoices.id, inv.id))
  await db.delete(clients).where(eq(clients.id, c.id))
  // Reset sequence so subsequent runs don't leak numbers
  await db
    .delete(invoiceSequences)
    .where(and(eq(invoiceSequences.userId, userId)))

  void unbilledA
  void unbilledB

  await sql.end()
  console.log("\n✓ Dashboard smoke test passed.")
}

main().catch(async (err) => {
  console.error("\n✗ Dashboard smoke test failed:", err)
  process.exit(1)
})
