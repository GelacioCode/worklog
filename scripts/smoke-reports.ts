// Smoke test for the Reports query module + CSV serializer.
// Seeds a small scenario, runs all three reports, checks shapes + key totals,
// renders a CSV snippet, then cleans up.
//
// Run with: tsx scripts/smoke-reports.ts
import "dotenv/config"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { eq } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import {
  clients,
  invoiceItems,
  invoices,
  workLogs,
} from "../src/lib/db/schema"
import {
  getClientsReport,
  getHoursReport,
  getIncomeReport,
} from "../src/lib/db/queries/reports"
import { toCsv } from "../src/lib/csv"

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
  const yearAgoIso = new Date(
    Date.UTC(today.getUTCFullYear() - 1, today.getUTCMonth(), today.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10)

  // Seed
  const clientName = "SMOKE-REP-" + randomUUID().slice(0, 8)
  console.log("\n▸ Seeding client + 2 logs + 1 paid invoice")
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

  const [log1, log2] = await db
    .insert(workLogs)
    .values([
      {
        userId,
        clientId: c.id,
        title: "Billable hour",
        workDate: todayISO,
        durationMinutes: 60,
        billable: true,
      },
      {
        userId,
        clientId: c.id,
        title: "Admin",
        workDate: todayISO,
        durationMinutes: 30,
        billable: false,
      },
    ])
    .returning()

  const [inv] = await db
    .insert(invoices)
    .values({
      userId,
      clientId: c.id,
      invoiceNumber: "SMOKE-REP-" + randomUUID().slice(0, 8),
      status: "paid",
      periodStart: todayISO,
      periodEnd: todayISO,
      issuedDate: todayISO,
      dueDate: todayISO,
      currency: "USD",
      subtotalCents: 5000,
      discountCents: 0,
      taxCents: 0,
      expensesCents: 0,
      totalCents: 5000,
      amountPaidCents: 5000,
      notes: null,
      rateSnapshotCents: 5000,
    })
    .returning()

  await db.insert(invoiceItems).values({
    userId,
    invoiceId: inv.id,
    workLogId: log1.id,
    description: log1.title,
    quantity: "1.00",
    unit: "hours",
    unitPriceCents: 5000,
    amountCents: 5000,
  })

  await db
    .update(workLogs)
    .set({ invoiceId: inv.id, invoiceStatus: "paid" })
    .where(eq(workLogs.id, log1.id))

  console.log("  ✓ seeded")

  // Reports
  console.log("\n▸ getIncomeReport (USD, year-to-date)")
  const income = await getIncomeReport(userId, "USD", {
    from: yearAgoIso,
    to: todayISO,
  })
  console.log("  totalPaidCents:", income.totalPaidCents)
  console.log("  byClient len:", income.byClient.length)
  console.log("  monthly len:", income.monthly.length)
  if (income.totalPaidCents < 5000) {
    throw new Error("Expected ≥5000c paid income")
  }
  if (!income.byClient.some((r) => r.name === clientName)) {
    throw new Error("Smoke client missing from income report")
  }

  console.log("\n▸ getHoursReport (year-to-date)")
  const hours = await getHoursReport(userId, { from: yearAgoIso, to: todayISO })
  console.log("  totalHours:", hours.totalHours.toFixed(2))
  console.log("  billableHours:", hours.billableHours.toFixed(2))
  console.log("  nonBillableHours:", hours.nonBillableHours.toFixed(2))
  if (hours.billableHours < 1) {
    throw new Error("Expected ≥1 billable hour")
  }
  if (hours.nonBillableHours < 0.5) {
    throw new Error("Expected ≥0.5 non-billable hour")
  }

  console.log("\n▸ getClientsReport (year-to-date)")
  const clientsReport = await getClientsReport(userId, {
    from: yearAgoIso,
    to: todayISO,
  })
  const row = clientsReport.rows.find((r) => r.name === clientName)
  if (!row) throw new Error("Smoke client missing from clients report")
  console.log("  client row:")
  console.log("    invoicedCents:", row.invoicedCents)
  console.log("    paidCents:", row.paidCents)
  console.log("    outstandingCents:", row.outstandingCents)
  console.log("    totalHours:", row.totalHours.toFixed(2))
  if (row.invoicedCents !== 5000) throw new Error("invoicedCents off")
  if (row.paidCents !== 5000) throw new Error("paidCents off")
  if (row.outstandingCents !== 0) throw new Error("outstandingCents should be 0")

  // CSV
  console.log("\n▸ toCsv (3 rows)")
  const csv = toCsv(
    [
      { date: todayISO, title: "Hello, world", hours: 1.5 },
      { date: todayISO, title: 'With "quotes"', hours: 2.0 },
      { date: todayISO, title: "Plain", hours: 0.25 },
    ],
    [
      { header: "Date", value: (r) => r.date },
      { header: "Title", value: (r) => r.title },
      { header: "Hours", value: (r) => r.hours.toFixed(2) },
    ],
  )
  const lines = csv.split("\r\n").filter(Boolean)
  if (lines.length !== 4) throw new Error("Expected 4 lines (header + 3)")
  if (!lines[1].includes('"Hello, world"')) {
    throw new Error("Comma cell wasn't quoted")
  }
  if (!lines[2].includes('"With ""quotes"""')) {
    throw new Error("Embedded quotes weren't escaped")
  }
  console.log("  ✓ CSV escaping correct")
  console.log("  first row:", JSON.stringify(lines[1]))

  // Cleanup
  console.log("\n▸ Cleanup")
  await db.delete(invoiceItems).where(eq(invoiceItems.invoiceId, inv.id))
  await db.delete(invoices).where(eq(invoices.id, inv.id))
  await db.delete(workLogs).where(eq(workLogs.clientId, c.id))
  await db.delete(clients).where(eq(clients.id, c.id))

  await sql.end()
  console.log("\n✓ Reports smoke test passed.")
}

main().catch(async (err) => {
  console.error("\n✗ Reports smoke test failed:", err)
  process.exit(1)
})
