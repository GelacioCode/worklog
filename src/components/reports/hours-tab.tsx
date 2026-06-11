import Link from "next/link"

import { Icons } from "@/components/design/icons"
import { ChartCard } from "@/components/dashboard/chart-card"
import type { HoursReport } from "@/lib/db/queries/reports"
import { HoursMonthlyChart } from "./hours-monthly-chart"
import { ReportStat } from "./report-stat"
import { ExportButton } from "./export-button"

export function HoursTab({
  report,
  range,
}: {
  report: HoursReport
  range: { from: string; to: string }
}) {
  const hasData = report.totalHours > 0

  const billablePct =
    report.totalHours > 0
      ? Math.round((report.billableHours / report.totalHours) * 100)
      : 0

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        <ReportStat
          label="Total hours"
          value={report.totalHours.toFixed(1) + "h"}
          hint={`${report.totalLogs} logs`}
          icon={Icons.Clock}
        />
        <ReportStat
          label="Billable"
          value={report.billableHours.toFixed(1) + "h"}
          hint={`${billablePct}% of total`}
          icon={Icons.Sparkle}
          accent
        />
        <ReportStat
          label="Non-billable"
          value={report.nonBillableHours.toFixed(1) + "h"}
          hint="Admin, meetings, etc"
          icon={Icons.Inbox}
        />
        <ReportStat
          label="Top client"
          value={report.byClient[0]?.name ?? "—"}
          hint={
            report.byClient[0]
              ? report.byClient[0].hours.toFixed(1) + "h"
              : "No logs yet"
          }
          icon={Icons.Users}
        />
      </div>

      <ChartCard
        title="Hours by month"
        subtitle="Billable + Non-billable"
        icon={Icons.TrendUp}
        empty={!hasData}
        emptyHint="No work logged in this date range."
      >
        <HoursMonthlyChart data={report.monthly} />
      </ChartCard>

      <div className="card overflow-x-auto anim-slide-up">
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <div className="text-[13px] font-medium">Hours by client</div>
            <div className="text-[11.5px] text-subtle mt-0.5">
              Sorted by total hours
            </div>
          </div>
          <ExportButton
            href={`/api/exports/work-logs?from=${range.from}&to=${range.to}`}
            label="Export logs"
          />
        </div>

        {report.byClient.length === 0 ? (
          <div className="px-6 py-10 text-center text-[12.5px] text-muted">
            No work logged in this date range.{" "}
            <Link href="/work-logs" className="accent-text underline-offset-2 hover:underline">
              Log some
            </Link>
            .
          </div>
        ) : (
          <div className="min-w-[640px]">
            <div
              className="grid grid-cols-[1fr_120px_120px_140px] text-[11px] uppercase tracking-wider text-subtle font-medium px-5 py-2.5"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div>Client</div>
              <div className="text-right">Logs</div>
              <div className="text-right">Billable</div>
              <div className="text-right">Total hours</div>
            </div>
            {report.byClient.map((row) => (
              <Link
                key={row.clientId}
                href={`/clients/${row.clientId}`}
                className="grid grid-cols-[1fr_120px_120px_140px] items-center px-5 py-2.5 text-[13px] row-hover"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="truncate font-medium">{row.name}</div>
                <div className="text-right tnum text-muted">{row.logCount}</div>
                <div className="text-right tnum text-muted">
                  {row.billableHours.toFixed(1)}h
                </div>
                <div className="text-right tnum font-medium">
                  {row.hours.toFixed(1)}h
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
