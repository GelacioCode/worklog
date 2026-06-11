import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { Icons } from "@/components/design/icons"
import { StatCard } from "@/components/dashboard/stat-card"
import { AlertStrip } from "@/components/dashboard/alert-strip"
import { ChartCard } from "@/components/dashboard/chart-card"
import { HoursByClientChart } from "@/components/dashboard/hours-by-client-chart"
import { IncomeByClientChart } from "@/components/dashboard/income-by-client-chart"
import { PaidVsUnpaidChart } from "@/components/dashboard/paid-vs-unpaid-chart"
import { WeeklyWorkloadChart } from "@/components/dashboard/weekly-workload-chart"
import { formatMoney } from "@/lib/money"
import {
  getDashboardStats,
  getHoursByClient,
  getIncomeByClient,
  getPaidVsUnpaid,
  getUpcomingCutoffs,
  getWeeklyWorkload,
  type MoneyByCurrency,
} from "@/lib/db/queries/dashboard"
import { getSettings } from "@/lib/db/queries/settings"
import { requireUser } from "@/server/auth"

function pickBase(by: MoneyByCurrency, base: string) {
  const baseRow = by.find((r) => r.currency === base)
  const others = by.filter((r) => r.currency !== base && r.cents > 0)
  return {
    cents: baseRow?.cents ?? 0,
    others,
  }
}

function otherHint(others: { currency: string; cents: number }[], label: string) {
  if (others.length === 0) return `Across all ${label} this month`
  if (others.length === 1) {
    const o = others[0]
    return `+ ${formatMoney(o.cents, o.currency)}`
  }
  return `+ ${others.length} other currencies`
}

export default async function DashboardPage() {
  const user = await requireUser()
  const settings = await getSettings(user.id)
  const base = settings.baseCurrency

  const [
    stats,
    upcomingCutoffs,
    hoursByClient,
    incomeByClient,
    paidVsUnpaid,
    weeklyWorkload,
  ] = await Promise.all([
    getDashboardStats(user.id),
    getUpcomingCutoffs(user.id, 7),
    getHoursByClient(user.id, 5),
    getIncomeByClient(user.id, base),
    getPaidVsUnpaid(user.id, base),
    getWeeklyWorkload(user.id),
  ])

  const paid = pickBase(stats.paidThisMonth, base)
  const unpaid = pickBase(stats.unpaid, base)
  const expected = pickBase(stats.expectedIncome, base)

  // Totally fresh = no clients, no logs, no invoices yet. Show the welcome card.
  const isFresh =
    stats.totalLogCount === 0 &&
    stats.totalInvoiceCount === 0 &&
    stats.activeClientsCount === 0

  const fmtHours = (h: number) =>
    h === 0 ? "0h" : h < 10 ? `${h.toFixed(1)}h` : `${Math.round(h)}h`

  const hoursHasData = hoursByClient.some((p) => p.hours > 0)
  const incomeHasData = incomeByClient.some((p) => p.cents > 0)
  const paidUnpaidHasData = paidVsUnpaid.some(
    (p) => p.paidCents > 0 || p.unpaidCents > 0,
  )
  const workloadHasData = weeklyWorkload.some((w) => w.hours > 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Where's your money, what's billable, and what's overdue — at a glance."
        actions={
          <Link href="/work-logs" className="btn btn-primary">
            <Icons.Plus size={13} /> Log work
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 stagger">
        <StatCard
          label="Hours this month"
          value={fmtHours(stats.hoursThisMonth)}
          hint={`Across ${stats.activeClientsCount} active ${
            stats.activeClientsCount === 1 ? "client" : "clients"
          }`}
          icon={Icons.Clock}
        />
        <StatCard
          label="Expected income"
          value={formatMoney(expected.cents, base)}
          hint={otherHint(expected.others, "currencies")}
          icon={Icons.Sparkle}
          accent
        />
        <StatCard
          label="Paid this month"
          value={formatMoney(paid.cents, base)}
          hint={otherHint(paid.others, "currencies")}
          icon={Icons.Money}
        />
        <StatCard
          label="Unpaid"
          value={formatMoney(unpaid.cents, base)}
          hint={otherHint(unpaid.others, "currencies")}
          icon={Icons.AlertCircle}
        />
      </div>

      <AlertStrip
        overdueInvoiceCount={stats.overdueInvoiceCount}
        unbilledBillableLogCount={stats.unbilledBillableLogCount}
        upcomingCutoffsCount={upcomingCutoffs.length}
      />

      <div className="grid gap-4 lg:grid-cols-2 stagger">
        <ChartCard
          title="Hours by client"
          subtitle="Last 30 days, top 5 + Other"
          icon={Icons.Chart}
          empty={!hoursHasData}
          emptyHint="Log some work to populate this."
        >
          <HoursByClientChart data={hoursByClient} />
        </ChartCard>
        <ChartCard
          title="Income by client"
          subtitle={`This month · ${base}`}
          icon={Icons.Money}
          empty={!incomeHasData}
          emptyHint={`No ${base} invoices this month yet.`}
        >
          <IncomeByClientChart data={incomeByClient} />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 stagger">
        <ChartCard
          title="Paid vs Unpaid"
          subtitle={`Last 6 months · ${base}`}
          icon={Icons.TrendUp}
          empty={!paidUnpaidHasData}
          emptyHint="Generate an invoice to start tracking."
        >
          <PaidVsUnpaidChart data={paidVsUnpaid} currency={base} />
        </ChartCard>
        <ChartCard
          title="Weekly workload"
          subtitle="Last 12 weeks"
          icon={Icons.Calendar}
          empty={!workloadHasData}
          emptyHint="Log work over multiple weeks to see the trend."
        >
          <WeeklyWorkloadChart data={weeklyWorkload} />
        </ChartCard>
      </div>

      {isFresh && (
        <div className="card p-6 text-center anim-fade">
          <div className="text-[14px] font-medium">Welcome to your dashboard</div>
          <div className="text-[13px] text-muted mt-1 max-w-md mx-auto">
            Add your first client, log some work, then generate an invoice — these
            cards and charts populate automatically.
          </div>
          <div className="flex items-center justify-center gap-2 mt-4">
            <Link href="/clients" className="btn btn-ghost">
              <Icons.Users size={13} /> Add a client
            </Link>
            <Link href="/work-logs" className="btn btn-primary">
              <Icons.Plus size={13} /> Log first task
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
