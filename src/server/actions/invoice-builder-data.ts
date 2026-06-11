"use server"

import { listBillableUnbilled } from "@/lib/db/queries/work-logs"
import { getRateAt } from "@/lib/db/queries/clients"
import { requireUser } from "@/server/auth"

export type BuilderLog = {
  id: string
  workDate: string
  title: string
  durationMinutes: number
  tag: string | null
}

export type BuilderPreviewResult = {
  ok: true
  logs: BuilderLog[]
  rateSnapshotCents: number
  rateEffectiveFrom: string | null
} | {
  ok: false
  error: string
}

/**
 * Fetch billable+unbilled work logs in a date range for the InvoiceBuilder,
 * plus the rate that was effective at period_end (so the live preview shows
 * the same number the server will use when generating).
 */
export async function loadInvoiceBuilderData(
  clientId: string,
  periodStart: string,
  periodEnd: string,
): Promise<BuilderPreviewResult> {
  const user = await requireUser()

  if (!clientId || !periodStart || !periodEnd) {
    return { ok: true, logs: [], rateSnapshotCents: 0, rateEffectiveFrom: null }
  }

  try {
    const [logs, rate] = await Promise.all([
      listBillableUnbilled(user.id, clientId, periodStart, periodEnd),
      getRateAt(user.id, clientId, periodEnd),
    ])

    return {
      ok: true,
      logs: logs.map((l) => ({
        id: l.id,
        workDate: l.workDate,
        title: l.title,
        durationMinutes: l.durationMinutes,
        tag: l.tag,
      })),
      rateSnapshotCents: rate?.rateCents ?? 0,
      rateEffectiveFrom: rate?.effectiveFrom ?? null,
    }
  } catch (err) {
    console.error("loadInvoiceBuilderData failed:", err)
    return { ok: false, error: "Could not load preview data" }
  }
}
