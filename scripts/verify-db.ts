// Verify schema landed + RLS is enabled. Read-only.
// Run with: tsx scripts/verify-db.ts
import "dotenv/config"
import postgres from "postgres"

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("✗ DATABASE_URL is not set")
    process.exit(1)
  }
  const sql = postgres(process.env.DATABASE_URL, { max: 1, prepare: false })

  const tables = await sql<{ tablename: string; rls: boolean }[]>`
    select c.relname as tablename, c.relrowsecurity as rls
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
    order by c.relname
  `
  console.log("Tables (rls=row level security enabled):")
  for (const t of tables) console.log(`  ${t.rls ? "🔒" : "  "} ${t.tablename}`)

  const policies = await sql<{ tablename: string; policyname: string }[]>`
    select tablename, policyname from pg_policies
    where schemaname = 'public'
    order by tablename, policyname
  `
  console.log(`\nRLS policies: ${policies.length} total`)
  const byTable: Record<string, string[]> = {}
  for (const p of policies) {
    byTable[p.tablename] = byTable[p.tablename] ?? []
    byTable[p.tablename].push(p.policyname)
  }
  for (const t of Object.keys(byTable).sort()) {
    console.log(`  ${t}: ${byTable[t].length} policies`)
  }

  const triggers = await sql<{ table_name: string; trigger_name: string }[]>`
    select event_object_table as table_name, trigger_name
    from information_schema.triggers
    where trigger_schema = 'public'
    order by table_name, trigger_name
  `
  const uniqueTriggers = new Set(triggers.map((t) => `${t.table_name}.${t.trigger_name}`))
  console.log(`\nTriggers: ${uniqueTriggers.size} total`)
  for (const t of [...uniqueTriggers].sort()) console.log(`  ${t}`)

  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
