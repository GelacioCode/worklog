import { drizzle } from "drizzle-orm/postgres-js"
import postgres from "postgres"

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set")
}

// Pool sizing matters because Supabase's Session pooler caps clients per
// project (15 on free). Defaults:
//   - Local dev / scripts:  1  (avoids saturating the pool when the dev server,
//                              smoke scripts, and tsx all share it)
//   - Vercel prod:          1  (each lambda is short-lived; one conn is plenty)
// Override with DB_POOL_MAX if you upgrade to a bigger Supabase plan and want
// dashboard's parallel queries to actually parallelise.
const POOL_MAX = Number.parseInt(process.env.DB_POOL_MAX ?? "1", 10)

const client = postgres(process.env.DATABASE_URL, {
  prepare: false,
  max: Number.isFinite(POOL_MAX) && POOL_MAX > 0 ? POOL_MAX : 1,
})

export const db = drizzle(client)
