// Wipe any leftover artifacts from the smoke-test scripts.
// Anything with a name/number/title starting with `SMOKE-` gets deleted in
// dependency order so foreign keys stay happy.
//
// Run with: npx tsx scripts/cleanup-smoke.ts
import "dotenv/config"
import postgres from "postgres"

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL not set")
    process.exit(1)
  }
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })

  console.log("▸ Cleaning SMOKE-* artifacts…")

  const smokeClients = await sql<{ id: string; name: string }[]>`
    select id, name from clients where name like 'SMOKE-%'
  `
  console.log(`  found ${smokeClients.length} SMOKE-* clients`)

  for (const c of smokeClients) {
    console.log(`  · ${c.name} (${c.id.slice(0, 8)}…)`)
    // Delete in dependency order:
    //   invoice_items → invoices → work_logs → client_rate_history → clients
    await sql`
      delete from invoice_items
      where invoice_id in (select id from invoices where client_id = ${c.id})
    `
    await sql`delete from invoices where client_id = ${c.id}`
    await sql`delete from work_logs where client_id = ${c.id}`
    await sql`delete from client_rate_history where client_id = ${c.id}`
    await sql`delete from clients where id = ${c.id}`
  }

  // Also nuke any orphan invoices with SMOKE- in the number (in case the
  // client was already deleted but invoice rows survived).
  const orphanInvoices = await sql<{ id: string; invoice_number: string }[]>`
    delete from invoices
    where invoice_number like 'SMOKE-%'
    returning id, invoice_number
  `
  if (orphanInvoices.length > 0) {
    console.log(`  · cleaned ${orphanInvoices.length} orphan SMOKE-* invoices`)
  }

  await sql.end()
  console.log("\n✓ Cleanup complete.")
}

main().catch(async (err) => {
  console.error("\n✗ Cleanup failed:", err)
  process.exit(1)
})
