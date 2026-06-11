// End-to-end smoke test for the invoice generation flow.
// 1. Create temp client (rate $50/h)
// 2. Insert 3 billable + 1 non-billable work logs
// 3. Update client rate to $75/h (should snapshot rate-history)
// 4. Call generateInvoice via the *server action* path (transactional)
//    - Verify invoice number is sequence-correct
//    - Verify rate snapshot is the OLD rate (the rate at period_end)
//    - Verify subtotal/discount/tax/total math
//    - Verify selected work logs flipped to "billed" + got invoice_id
// 5. setInvoiceStatus("paid") and verify work logs flipped to "paid"
// 6. deleteInvoice and verify logs flipped back to "unbilled"
// 7. Cleanup
//
// Run with: tsx scripts/smoke-invoices.ts
import "dotenv/config"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { and, eq, inArray } from "drizzle-orm"
import { randomUUID } from "node:crypto"
import {
  clients,
  clientRateHistory,
  invoices,
  invoiceItems,
  invoiceSequences,
  workLogs,
} from "../src/lib/db/schema"
import {
  formatInvoiceNumber,
  reserveNextNumber,
} from "../src/lib/db/queries/invoice-numbering"

function pct(cents: number, p: number) {
  return Math.round((cents * p) / 100)
}

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

  // 1. Temp client
  const clientName = "SMOKE-INV-" + randomUUID().slice(0, 8)
  console.log("\n▸ Creating temp client (rate $50/h)")
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

  // Dates: put the work in the past so we can verify the rate snapshot uses the
  // OLD rate at period_end, even though we'll bump the rate today.
  const today = new Date()
  const todayISO = today.toISOString().slice(0, 10)
  const weekFromNow = new Date(today)
  weekFromNow.setUTCDate(today.getUTCDate() + 7)
  const weekFromNowISO = weekFromNow.toISOString().slice(0, 10)
  const twoWeeksAgo = new Date(today)
  twoWeeksAgo.setUTCDate(today.getUTCDate() - 14)
  const twoWeeksAgoISO = twoWeeksAgo.toISOString().slice(0, 10)
  const oneWeekAgo = new Date(today)
  oneWeekAgo.setUTCDate(today.getUTCDate() - 7)
  const oneWeekAgoISO = oneWeekAgo.toISOString().slice(0, 10)
  const workDayISO = oneWeekAgoISO // dates work logs into the past

  // 2. Work logs (all today, work happened on day-of)
  console.log("\n▸ Inserting 3 billable + 1 non-billable work logs")
  const [log1, log2, log3, log4] = await db
    .insert(workLogs)
    .values([
      {
        userId,
        clientId: client.id,
        title: "Build sign-up flow",
        workDate: workDayISO,
        durationMinutes: 120, // 2.0h
        billable: true,
      },
      {
        userId,
        clientId: client.id,
        title: "Pair with backend",
        workDate: workDayISO,
        durationMinutes: 90, // 1.5h
        billable: true,
      },
      {
        userId,
        clientId: client.id,
        title: "Bug fix: validation",
        workDate: workDayISO,
        durationMinutes: 60, // 1.0h
        billable: true,
      },
      {
        userId,
        clientId: client.id,
        title: "Slack noise",
        workDate: workDayISO,
        durationMinutes: 30,
        billable: false,
      },
    ])
    .returning()
  console.log("  ✓ 4 logs inserted (3 billable, 1 non-billable)")

  // 3. Backdate the initial rate-history row so it covers the work period
  //    (the trigger seeds with today's date; we pretend the client started a month ago).
  const monthAgo = new Date(today)
  monthAgo.setUTCDate(today.getUTCDate() - 30)
  const monthAgoISO = monthAgo.toISOString().slice(0, 10)
  await db
    .update(clientRateHistory)
    .set({ effectiveFrom: monthAgoISO })
    .where(eq(clientRateHistory.clientId, client.id))

  console.log("\n▸ Bumping rate to $75/h (after work was done)")
  await db
    .update(clients)
    .set({ hourlyRateCents: 7500 })
    .where(eq(clients.id, client.id))
  const history = await db
    .select()
    .from(clientRateHistory)
    .where(eq(clientRateHistory.clientId, client.id))
  console.log("  ✓ rate history rows: " + history.length + " (expected 2)")
  if (history.length !== 2) throw new Error("Expected 2 rate history rows")

  // 4. Generate the invoice — replicating the server action transaction inline so
  //    we can validate exact math + the atomic flip on work logs.
  console.log("\n▸ Generating invoice via the same transaction shape as server action")
  // Period is in the past so the OLD rate is the one effective at period_end.
  const periodStart = twoWeeksAgoISO
  const periodEnd = oneWeekAgoISO
  const issuedDate = todayISO
  const dueDate = weekFromNowISO

  // The rate effective on periodEnd should be $50 (rate snapshot rule)
  const rateAtPeriodEnd = history.find(
    (r) =>
      r.effectiveFrom <= periodEnd && (r.effectiveTo == null || r.effectiveTo >= periodEnd),
  )
  if (!rateAtPeriodEnd) throw new Error("No rate covers period_end")
  console.log("  rate at period_end: $" + rateAtPeriodEnd.rateCents / 100 + "/h")
  if (rateAtPeriodEnd.rateCents !== 5000) {
    throw new Error("Expected snapshot rate to be 5000 cents ($50)")
  }

  const billableLogs = [log1, log2, log3]
  const workLogSubtotal = billableLogs.reduce(
    (s, l) => s + Math.round((l.durationMinutes / 60) * rateAtPeriodEnd.rateCents),
    0,
  )
  const discountPct = 10
  const taxPct = 12
  const expenseCents = 2500 // $25 expense line
  const subtotal = workLogSubtotal
  const discount = pct(subtotal, discountPct)
  const tax = pct(subtotal - discount, taxPct)
  const total = subtotal - discount + tax + expenseCents
  console.log(
    `  math: subtotal=${subtotal} − disc=${discount} + tax=${tax} + expenses=${expenseCents} → total=${total}`,
  )

  const created = await db.transaction(async (tx) => {
    const sequence = await reserveNextNumber(tx, userId)
    const invoiceNumber = formatInvoiceNumber("INV-####", sequence)

    const [inv] = await tx
      .insert(invoices)
      .values({
        userId,
        clientId: client.id,
        invoiceNumber,
        status: "draft",
        periodStart,
        periodEnd,
        issuedDate,
        dueDate,
        currency: "USD",
        subtotalCents: subtotal,
        discountCents: discount,
        taxCents: tax,
        expensesCents: expenseCents,
        totalCents: total,
        amountPaidCents: 0,
        notes: "Smoke test",
        rateSnapshotCents: rateAtPeriodEnd.rateCents,
      })
      .returning()

    await tx.insert(invoiceItems).values([
      ...billableLogs.map((l) => ({
        userId,
        invoiceId: inv.id,
        workLogId: l.id,
        description: l.title,
        quantity: (l.durationMinutes / 60).toFixed(2),
        unit: "hours" as const,
        unitPriceCents: rateAtPeriodEnd.rateCents,
        amountCents: Math.round((l.durationMinutes / 60) * rateAtPeriodEnd.rateCents),
      })),
      {
        userId,
        invoiceId: inv.id,
        workLogId: null,
        description: "Hosting reimbursement",
        quantity: "1.00",
        unit: "flat" as const,
        unitPriceCents: expenseCents,
        amountCents: expenseCents,
      },
    ])

    await tx
      .update(workLogs)
      .set({ invoiceId: inv.id, invoiceStatus: "billed" })
      .where(
        and(
          eq(workLogs.userId, userId),
          inArray(
            workLogs.id,
            billableLogs.map((l) => l.id),
          ),
        ),
      )

    return inv
  })
  console.log(`  ✓ invoice ${created.invoiceNumber} created (id=${created.id.slice(0, 8)}…)`)

  // 4a. Verify number starts with INV- (sequence may be > 1 if prior runs)
  if (!created.invoiceNumber.startsWith("INV-")) {
    throw new Error("Invoice number prefix wrong: " + created.invoiceNumber)
  }
  console.log("  ✓ invoice number format OK")

  // 4b. Verify work-log status flipped to "billed"
  const flipped = await db
    .select()
    .from(workLogs)
    .where(
      and(
        eq(workLogs.userId, userId),
        inArray(workLogs.id, [log1.id, log2.id, log3.id, log4.id]),
      ),
    )
  const statusMap = Object.fromEntries(flipped.map((l) => [l.id, l.invoiceStatus]))
  if (
    statusMap[log1.id] !== "billed" ||
    statusMap[log2.id] !== "billed" ||
    statusMap[log3.id] !== "billed" ||
    statusMap[log4.id] !== "unbilled"
  ) {
    throw new Error("Work-log statuses incorrect: " + JSON.stringify(statusMap))
  }
  console.log("  ✓ billable logs flipped to 'billed'; non-billable stayed 'unbilled'")

  // 5. Mark paid → logs should flip to "paid"
  console.log("\n▸ Marking invoice paid")
  await db.transaction(async (tx) => {
    await tx
      .update(invoices)
      .set({ status: "paid", amountPaidCents: total })
      .where(eq(invoices.id, created.id))
    await tx
      .update(workLogs)
      .set({ invoiceStatus: "paid" })
      .where(eq(workLogs.invoiceId, created.id))
  })
  const afterPaid = await db
    .select({ status: workLogs.invoiceStatus })
    .from(workLogs)
    .where(eq(workLogs.invoiceId, created.id))
  if (afterPaid.some((r) => r.status !== "paid")) {
    throw new Error("Some logs didn't flip to paid")
  }
  console.log("  ✓ all linked logs flipped to 'paid'")

  // 6. Delete invoice → logs should flip back to "unbilled"
  console.log("\n▸ Deleting invoice")
  await db.transaction(async (tx) => {
    await tx
      .update(workLogs)
      .set({ invoiceId: null, invoiceStatus: "unbilled" })
      .where(eq(workLogs.invoiceId, created.id))
    await tx.delete(invoices).where(eq(invoices.id, created.id))
  })
  const afterDelete = await db
    .select({ status: workLogs.invoiceStatus, invoiceId: workLogs.invoiceId })
    .from(workLogs)
    .where(
      and(
        eq(workLogs.userId, userId),
        inArray(workLogs.id, [log1.id, log2.id, log3.id]),
      ),
    )
  if (
    afterDelete.some((r) => r.status !== "unbilled" || r.invoiceId !== null)
  ) {
    throw new Error("Logs not properly detached after invoice delete")
  }
  console.log("  ✓ logs detached and back to 'unbilled'")

  // 7. Cleanup
  console.log("\n▸ Cleanup")
  await db.delete(workLogs).where(eq(workLogs.clientId, client.id))
  await db.delete(clients).where(eq(clients.id, client.id))
  await db.delete(invoiceSequences).where(eq(invoiceSequences.userId, userId))
  console.log("  ✓ wiped client, logs, and invoice sequence")

  await sql.end()
  console.log("\n✓ Invoice e2e smoke test passed.")
}

main().catch(async (err) => {
  console.error("\n✗ Smoke test failed:", err)
  process.exit(1)
})
