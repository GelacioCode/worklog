import Link from "next/link"

import { Icons } from "@/components/design/icons"
import { ChartCard } from "@/components/dashboard/chart-card"
import { formatMoney } from "@/lib/money"
import type { IncomeReport } from "@/lib/db/queries/reports"
import { IncomeMonthlyChart } from "./income-monthly-chart"
import { ReportStat } from "./report-stat"
import { ExportButton } from "./export-button"

export function IncomeTab({
  report,
  currency,
  range,
}: {
  report: IncomeReport
  currency: string
  range: { from: string; to: string }
}) {
  const hasData = report.totalInvoiced > 0

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        <ReportStat
          label="Paid"
          value={formatMoney(report.totalPaidCents, currency)}
          hint={`${report.totalInvoiced} invoices total`}
          icon={Icons.Money}
          accent
        />
        <ReportStat
          label="Outstanding"
          value={formatMoney(report.totalUnpaidCents, currency)}
          hint="Sent + partial + overdue"
          icon={Icons.AlertCircle}
        />
        <ReportStat
          label="Avg / invoice"
          value={
            report.totalInvoiced > 0
              ? formatMoney(
                  Math.round(
                    (report.totalPaidCents + report.totalUnpaidCents) /
                      report.totalInvoiced,
                  ),
                  currency,
                )
              : "—"
          }
          hint="Paid + unpaid blended"
          icon={Icons.Chart}
        />
        <ReportStat
          label="Top client"
          value={report.byClient[0]?.name ?? "—"}
          hint={
            report.byClient[0]
              ? formatMoney(report.byClient[0].cents, currency)
              : "No invoices yet"
          }
          icon={Icons.Users}
        />
      </div>

      <ChartCard
        title="Income by month"
        subtitle={`Paid vs Unpaid · ${currency}`}
        icon={Icons.TrendUp}
        empty={!hasData}
        emptyHint="No invoices in this date range."
      >
        <IncomeMonthlyChart data={report.monthly} currency={currency} />
      </ChartCard>

      <div className="card overflow-x-auto anim-slide-up">
        <div
          className="flex items-center justify-between px-5 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div>
            <div className="text-[13px] font-medium">Income by client</div>
            <div className="text-[11.5px] text-subtle mt-0.5">
              Sorted by total invoiced ({currency})
            </div>
          </div>
          <ExportButton
            href={`/api/exports/invoices?from=${range.from}&to=${range.to}`}
            label="Export invoices"
          />
        </div>

        {report.byClient.length === 0 ? (
          <div className="px-6 py-10 text-center text-[12.5px] text-muted">
            No invoices in this date range.{" "}
            <Link href="/invoices/new" className="accent-text underline-offset-2 hover:underline">
              Generate one
            </Link>
            .
          </div>
        ) : (
          <div className="min-w-[560px]">
            <div
              className="grid grid-cols-[1fr_120px_140px] text-[11px] uppercase tracking-wider text-subtle font-medium px-5 py-2.5"
              style={{ borderBottom: "1px solid var(--border)" }}
            >
              <div>Client</div>
              <div className="text-right">Invoices</div>
              <div className="text-right">Total invoiced</div>
            </div>
            {report.byClient.map((row) => (
              <Link
                key={row.clientId}
                href={`/clients/${row.clientId}`}
                className="grid grid-cols-[1fr_120px_140px] items-center px-5 py-2.5 text-[13px] row-hover"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="truncate font-medium">{row.name}</div>
                <div className="text-right tnum text-muted">{row.invoiceCount}</div>
                <div className="text-right tnum font-medium">
                  {formatMoney(row.cents, currency)}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
