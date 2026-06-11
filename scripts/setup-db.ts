// scripts/setup-db.ts
//
// One command to set up the DB:
//   1. Apply Drizzle migrations from drizzle/ (non-interactive, production-correct)
//   2. Apply drizzle/post-push.sql (auth FKs, triggers, RLS policies)
//
// Run with: npm run db:setup
//
// To generate a new migration after changing schema.ts:
//   npm run db:generate -- --name my_change
// Then re-run npm run db:setup.

import "dotenv/config"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import postgres from "postgres"
import { drizzle } from "drizzle-orm/postgres-js"
import { migrate } from "drizzle-orm/postgres-js/migrator"

if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL is not set. Add it to .env first.")
  process.exit(1)
}

const POST_PUSH_SQL = resolve(process.cwd(), "drizzle/post-push.sql")
const MIGRATIONS_DIR = resolve(process.cwd(), "drizzle")

async function main() {
  const client = postgres(process.env.DATABASE_URL!, {
    max: 1,
    prepare: false,
    onnotice: () => {}, // silence "already exists" notices
  })
  const db = drizzle(client)

  console.log("▸ Applying Drizzle migrations…")
  try {
    await migrate(db, { migrationsFolder: MIGRATIONS_DIR })
    console.log("✓ Migrations applied.")
  } catch (err) {
    console.error("✗ Migration failed:", err)
    await client.end().catch(() => {})
    process.exit(1)
  }

  console.log("\n▸ Applying post-push SQL (auth FKs, triggers, RLS)…")
  const sql = readFileSync(POST_PUSH_SQL, "utf-8")
  try {
    await client.unsafe(sql)
    console.log("✓ Post-push SQL applied.")
  } catch (err) {
    console.error("✗ Post-push SQL failed:", err)
    await client.end().catch(() => {})
    process.exit(1)
  }

  await client.end()
  console.log("\n✓ Database setup complete.")
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
