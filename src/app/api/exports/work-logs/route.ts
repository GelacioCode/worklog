// GET /api/exports/work-logs?from=&to=&clientId=&status=&q=
// Streams a CSV of the user's work logs, filtered like the work-logs page.

import { NextResponse } from "next/server"
import { listWorkLogs } from "@/lib/db/queries/work-logs"
import type { WorkLogStatus } from "@/lib/validations/work-logs"
import { requireUser } from "@/server/auth"
import { csvHeaders, toCsv, type CsvColumn } from "@/lib/csv"
import type { WorkLogWithClient } from "@/lib/db/queries/work-logs"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const STATUSES: WorkLogStatus[] = ["unbilled", "billed", "paid"]

const COLUMNS: CsvColumn<WorkLogWithClient>[] = [
  { header: "Date", value: (r) => r.workDate },
  { header: "Client", value: (r) => r.clientName },
  { header: "Title", value: (r) => r.title },
  { header: "Tag", value: (r) => r.tag ?? "" },
  { header: "Hours", value: (r) => (r.durationMinutes / 60).toFixed(2) },
  { header: "Billable", value: (r) => (r.billable ? "yes" : "no") },
  { header: "Status", value: (r) => r.invoiceStatus },
  { header: "Description", value: (r) => r.description ?? "" },
  { header: "Notes", value: (r) => r.notes ?? "" },
  { header: "Currency", value: (r) => r.clientCurrency },
]

export async function GET(req: Request) {
  const user = await requireUser()
  const url = new URL(req.url)
  const from = url.searchParams.get("from") ?? undefined
  const to = url.searchParams.get("to") ?? undefined
  const clientId = url.searchParams.get("clientId") ?? undefined
  const statusParam = url.searchParams.get("status") ?? undefined
  const query = url.searchParams.get("q") ?? undefined

  const status: WorkLogStatus | "all" =
    statusParam && (STATUSES as string[]).includes(statusParam)
      ? (statusParam as WorkLogStatus)
      : "all"

  const logs = await listWorkLogs(user.id, {
    from,
    to,
    clientId,
    status,
    query,
  })

  const csv = toCsv(logs, COLUMNS)
  const today = new Date().toISOString().slice(0, 10)
  const fname = `work-logs-${today}.csv`

  return new NextResponse(csv, { status: 200, headers: csvHeaders(fname) })
}
