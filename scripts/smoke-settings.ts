// Smoke test for the settings table + storage policies.
// 1. UPSERT a settings row (matches the saveSettings server action shape).
// 2. Read it back and verify the values.
// 3. Confirm the business-logos bucket exists with the expected RLS policies.
// 4. Clean up.
//
// Run with: tsx scripts/smoke-settings.ts
import "dotenv/config"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { eq, sql } from "drizzle-orm"
import { settings } from "../src/lib/db/schema"

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL not set")
    process.exit(1)
  }
  const sqlClient = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })
  const db = drizzle(sqlClient)

  const users = await sqlClient<{ id: string; email: string | null }[]>`
    select id, email from auth.users limit 1
  `
  if (users.length === 0) {
    console.error("✗ No users — sign up via the app first.")
    await sqlClient.end()
    process.exit(1)
  }
  const userId = users[0].id
  console.log("Using user: " + (users[0].email ?? userId))

  // 1. Snapshot current settings (if any) so we can restore.
  const before = await db.select().from(settings).where(eq(settings.userId, userId))
  console.log("\n▸ Existing settings row: " + (before.length === 0 ? "none" : "yes"))

  // 2. UPSERT a known shape
  console.log("\n▸ UPSERTing settings")
  await db
    .insert(settings)
    .values({
      userId,
      baseCurrency: "PHP",
      invoiceNumberFormat: "YYYY-####",
      defaultPaymentTerms: 14,
      businessName: "SMOKE Studio",
      businessEmail: "smoke@example.com",
      businessAddress: "Quezon City",
      taxId: "PH-SMOKE-001",
      defaultInvoiceNotes: "Bank: BPI · Acct: 1234",
    })
    .onConflictDoUpdate({
      target: settings.userId,
      set: {
        baseCurrency: "PHP",
        invoiceNumberFormat: "YYYY-####",
        defaultPaymentTerms: 14,
        businessName: "SMOKE Studio",
        businessEmail: "smoke@example.com",
        businessAddress: "Quezon City",
        taxId: "PH-SMOKE-001",
        defaultInvoiceNotes: "Bank: BPI · Acct: 1234",
        updatedAt: sql`now()`,
      },
    })

  const after = await db.select().from(settings).where(eq(settings.userId, userId))
  if (after.length === 0) throw new Error("Settings row not found after UPSERT")
  console.log("  ✓ row present")
  console.log("    business_name:        ", after[0].businessName)
  console.log("    base_currency:        ", after[0].baseCurrency)
  console.log("    invoice_number_format:", after[0].invoiceNumberFormat)
  console.log("    default_payment_terms:", after[0].defaultPaymentTerms)
  if (after[0].baseCurrency !== "PHP") throw new Error("baseCurrency didn't persist")
  if (after[0].defaultPaymentTerms !== 14) throw new Error("payment terms didn't persist")
  console.log("  ✓ values match")

  // 3. Verify the storage bucket + policies exist
  console.log("\n▸ Verifying storage bucket + RLS")
  const bucket = await sqlClient<{ id: string; public: boolean; allowed: string[] | null }[]>`
    select id, public, allowed_mime_types as allowed
    from storage.buckets
    where id = 'business-logos'
  `
  if (bucket.length === 0) throw new Error("business-logos bucket missing")
  console.log("  ✓ bucket exists (public=" + bucket[0].public + ")")
  if (bucket[0].public !== false) throw new Error("bucket should be private")
  if (!bucket[0].allowed || !bucket[0].allowed.includes("image/png")) {
    throw new Error("bucket should allow image/png")
  }
  console.log("  ✓ private + allows image/png")

  const policies = await sqlClient<{ policyname: string; cmd: string }[]>`
    select policyname, cmd
    from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname like 'business_logos_%'
    order by policyname
  `
  console.log("  ✓ policies: " + policies.length + " found")
  for (const p of policies) console.log("    - " + p.policyname + " (" + p.cmd + ")")
  if (policies.length !== 4) {
    throw new Error("Expected 4 business_logos_* policies (SELECT/INSERT/UPDATE/DELETE)")
  }

  // 4. Restore previous settings (or delete the row we just made)
  console.log("\n▸ Cleanup")
  if (before.length === 0) {
    await db.delete(settings).where(eq(settings.userId, userId))
    console.log("  ✓ deleted the row we created")
  } else {
    await db
      .update(settings)
      .set({
        baseCurrency: before[0].baseCurrency,
        invoiceNumberFormat: before[0].invoiceNumberFormat,
        defaultPaymentTerms: before[0].defaultPaymentTerms,
        businessName: before[0].businessName,
        businessEmail: before[0].businessEmail,
        businessAddress: before[0].businessAddress,
        taxId: before[0].taxId,
        defaultInvoiceNotes: before[0].defaultInvoiceNotes,
      })
      .where(eq(settings.userId, userId))
    console.log("  ✓ restored prior values")
  }

  await sqlClient.end()
  console.log("\n✓ Settings smoke test passed.")
}

main().catch(async (err) => {
  console.error("\n✗ Settings smoke test failed:", err)
  process.exit(1)
})
