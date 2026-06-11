import Link from "next/link"

import { Icons } from "@/components/design/icons"
import { StatusPill } from "@/components/design/status-pill"
import type { ClientsReport } from "@/lib/db/queries/reports"
import { formatMoney } from "@/lib/money"
import { ReportStat } from "./report-stat"
import { ExportButton } from "./export-button"

const STATUS_TO_PILL = {
  active: "paid" as const,
  paused: "partial" as const,
  ended: "draft" as const,
}

export function ClientsTab({
  report,
  range,
}: {
  report: ClientsReport
  range: { from: string; to: string }
}) {
  const totalHours = report.rows.reduce((s, r) => s + r.totalHours, 0)
  const activeCount = report.rows.filter((r) => r.status === "active").length

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3 stagger">
        <ReportStat
          label="Clients with activity"
          value={report.rows.length.toString()}
          hint={`${activeCount} active`}
          icon={Icons.Users}
        />
        <ReportStat
          label="Total hours"
          value={totalHours.toFixed(1) + "h"}
          hint="Across all clients"
          icon={Icons.Clock}
        />
        <ReportStat
          label="Total invoices"
          value={report.rows.reduce((s, r) => s + r.invoiceCount, 0).toString()}
          hint="In this period"
          icon={Icons.Invoice}
        />
      </div>

      <div className="card overflow-x-auto anim-slide-up">
        <div
          className="flex items-center justify-between px-5 py-3 gap-3 flex-wrap"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <div className="text-[13px] font-medium">Client rollup</div>
            <div className="text-[11.5px] text-subtle mt-0.5">
              Sorted by total invoiced. Currency follows each client.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportButton
              href={`/api/exports/invoices?from=${range.from}&to=${range.to}`}
              label="Export invoices"
            />
            <ExportButton
              href={`/api/exports/work-logs?from=${range.from}&to=${range.to}`}
              label="Export logs"
            />
          </div>
        </div>

        {report.rows.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-2 mx-auto flex items-center justify-center mb-3">
              <Icons.Users size={20} className="text-subtle" />
            </div>
            <div className="text-[14px] font-medium mb-1">No client activity</div>
            <div className="text-[12.5px] text-muted">
              Log some work or generate an invoice to populate the rollup.
            </div>
          </div>
        ) : (
          <div className="min-w-[860px]">
            <div
              className="grid grid-cols-[1fr_80px_92px_100px_120px_120px_120px] text-[11px] uppercase tracking-wider text-subtle font-medium px-5 py-2.5"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div>Client</div>
              <div>Status</div>
              <div className="text-right">Hours</div>
              <div className="text-right">Invoices</div>
              <div className="text-right">Invoiced</div>
              <div className="text-right">Paid</div>
              <div className="text-right">Outstanding</div>
            </div>
            {report.rows.map((row) => (
              <Link
                key={row.clientId}
                href={`/clients/${row.clientId}`}
                className="grid grid-cols-[1fr_80px_92px_100px_120px_120px_120px] items-center px-5 py-2.5 text-[13px] row-hover"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="min-w-0">
                  <div className="truncate font-medium">{row.name}</div>
                  <div className="text-[11px] text-subtle">{row.currency}</div>
                </div>
                <div>
                  <StatusPill
                    status={
                      STATUS_TO_PILL[row.status as keyof typeof STATUS_TO_PILL] ??
                      "draft"
                    }
                  />
                </div>
                <div className="text-right tnum text-muted">
                  {row.totalHours.toFixed(1)}h
                </div>
                <div className="text-right tnum text-muted">{row.invoiceCount}</div>
                <div className="text-right tnum">
                  {formatMoney(row.invoicedCents, row.currency)}
                </div>
                <div className="text-right tnum text-emerald-600">
                  {formatMoney(row.paidCents, row.currency)}
                </div>
                <div
                  className="text-right tnum font-medium"
                  style={{
                    color:
                      row.outstandingCents > 0
                        ? "var(--fg)"
                        : "var(--fg-subtle)",
                  }}
                >
                  {formatMoney(row.outstandingCents, row.currency)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
