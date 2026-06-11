// Quick connection probe — shows the real Postgres error.
// Run with: npm run db:check
import "dotenv/config"
import postgres from "postgres"

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.error("✗ DATABASE_URL is not set in .env")
    process.exit(1)
  }

  const m = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/(.+?)(?:\?.*)?$/)
  if (m) {
    const pwRaw = m[2]
    const pwDecoded = (() => {
      try {
        return decodeURIComponent(pwRaw)
      } catch {
        return pwRaw
      }
    })()
    const masked =
      pwDecoded.length <= 4
        ? "*".repeat(pwDecoded.length)
        : pwDecoded.slice(0, 2) + "*".repeat(pwDecoded.length - 4) + pwDecoded.slice(-2)
    console.log("Connection target:")
    console.log("  host:    " + m[3])
    console.log("  port:    " + m[4])
    console.log("  user:    " + m[1])
    console.log("  db:      " + m[5])
    console.log("  pw:      " + masked + "  (length: " + pwDecoded.length + ")")
    if (pwDecoded.startsWith("[") || pwDecoded.endsWith("]")) {
      console.log(
        "  ⚠️  Password has square brackets — you likely kept the [YOUR-PASSWORD] placeholder. Remove the brackets.",
      )
    }
  } else {
    console.log("(could not parse DATABASE_URL — proceeding anyway)")
  }

  console.log("\nConnecting…")
  const sql = postgres(url, {
    prepare: false,
    max: 1,
    connect_timeout: 10,
  })

  try {
    const r = await sql`select current_user, current_database(), version()`
    console.log("✓ Connected:")
    console.log("  user: " + r[0].current_user)
    console.log("  db:   " + r[0].current_database)
    console.log("  ver:  " + (r[0].version as string).slice(0, 60) + "…")
    await sql.end()
    process.exit(0)
  } catch (err: unknown) {
    const e = err as { code?: string; message?: string; address?: string; port?: number }
    console.error("\n✗ Connection failed")
    if (e.code) console.error("  code:    " + e.code)
    if (e.message) console.error("  message: " + e.message)
    if (e.address) console.error("  address: " + e.address)
    if (e.port) console.error("  port:    " + e.port)
    await sql.end().catch(() => {})
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
