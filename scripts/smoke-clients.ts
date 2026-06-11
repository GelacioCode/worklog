// Smoke test for clients CRUD against the live DB.
// Inserts a fake client as a system user, reads it back, updates the rate
// (triggering rate-history snapshot), then cleans up.
// Run with: tsx scripts/smoke-clients.ts
import "dotenv/config"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { and, eq } from "drizzle-orm"
import { clients, clientRateHistory } from "../src/lib/db/schema"
import { randomUUID } from "node:crypto"

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL not set")
    process.exit(1)
  }
  const client = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })
  const db = drizzle(client)

  // Find an existing auth user to attribute the test row to.
  const users = await client<{ id: string; email: string | null }[]>`
    select id, email from auth.users limit 1
  `
  if (users.length === 0) {
    console.error("✗ No users found in auth.users — sign up via the app first.")
    await client.end()
    process.exit(1)
  }
  const userId = users[0].id
  console.log("Using user: " + (users[0].email ?? userId))

  const testName = "SMOKE-TEST-" + randomUUID().slice(0, 8)
  console.log("\n▸ Inserting test client: " + testName)
  const [inserted] = await db
    .insert(clients)
    .values({
      userId,
      name: testName,
      billingType: "hourly",
      hourlyRateCents: 5000,
      currency: "USD",
      cutoffSchedule: { preset: "biweekly_15_30" },
      paymentTermsDays: 7,
    })
    .returning()
  console.log("  ✓ inserted id=" + inserted.id)

  // Rate history should auto-snapshot via trigger
  const initialHistory = await db
    .select()
    .from(clientRateHistory)
    .where(eq(clientRateHistory.clientId, inserted.id))
  console.log("  ✓ rate history rows after insert: " + initialHistory.length)
  if (initialHistory.length !== 1) {
    throw new Error("Expected 1 history row after insert, got " + initialHistory.length)
  }

  console.log("\n▸ Updating rate from $50 → $75")
  await db
    .update(clients)
    .set({ hourlyRateCents: 7500 })
    .where(and(eq(clients.userId, userId), eq(clients.id, inserted.id)))

  const afterUpdate = await db
    .select()
    .from(clientRateHistory)
    .where(eq(clientRateHistory.clientId, inserted.id))
  console.log("  ✓ rate history rows after update: " + afterUpdate.length)
  if (afterUpdate.length !== 2) {
    throw new Error("Expected 2 history rows after rate change, got " + afterUpdate.length)
  }
  const current = afterUpdate.find((r) => r.effectiveTo == null)
  if (!current || current.rateCents !== 7500) {
    throw new Error("Expected current rate to be 7500 cents")
  }
  console.log("  ✓ trigger snapshotted rate change correctly")

  console.log("\n▸ Cleanup")
  await db
    .delete(clients)
    .where(and(eq(clients.userId, userId), eq(clients.id, inserted.id)))
  console.log("  ✓ deleted (rate history cascaded)")

  await client.end()
  console.log("\n✓ Smoke test passed.")
}

main().catch(async (err) => {
  console.error("\n✗ Smoke test failed:", err)
  process.exit(1)
})
