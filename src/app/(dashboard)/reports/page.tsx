import { PageHeader } from "@/components/layout/page-header"
import { DateRangePicker } from "@/components/reports/date-range-picker"
import { ReportsTabs, type ReportTab } from "@/components/reports/reports-tabs"
import { IncomeTab } from "@/components/reports/income-tab"
import { HoursTab } from "@/components/reports/hours-tab"
import { ClientsTab } from "@/components/reports/clients-tab"
import {
  getClientsReport,
  getHoursReport,
  getIncomeReport,
} from "@/lib/db/queries/reports"
import { getSettings } from "@/lib/db/queries/settings"
import { DEFAULT_PRESET, rangeFor, type RangePresetId } from "@/lib/date-ranges"
import { requireUser } from "@/server/auth"

type SearchParams = Promise<{
  tab?: string
  preset?: string
  from?: string
  to?: string
}>

const VALID_TABS: ReportTab[] = ["income", "hours", "clients"]

const VALID_PRESETS: RangePresetId[] = [
  "last-30",
  "this-month",
  "last-month",
  "this-year",
  "last-12",
  "all-time",
  "custom",
]

function isoOrNull(s: string | undefined): string | null {
  if (!s) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  return s
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireUser()
  const sp = await searchParams

  const tab: ReportTab =
    sp.tab && (VALID_TABS as string[]).includes(sp.tab)
      ? (sp.tab as ReportTab)
      : "income"

  const presetParam: RangePresetId =
    sp.preset && (VALID_PRESETS as string[]).includes(sp.preset)
      ? (sp.preset as RangePresetId)
      : DEFAULT_PRESET

  let range = rangeFor(presetParam)
  const customFrom = isoOrNull(sp.from)
  const customTo = isoOrNull(sp.to)
  if (presetParam === "custom") {
    range = {
      from: customFrom ?? range.from,
      to: customTo ?? range.to,
    }
  } else if (customFrom && customTo) {
    // If raw from/to passed but preset stayed, still honor them.
    range = { from: customFrom, to: customTo }
  }

  const settings = await getSettings(user.id)
  const baseCurrency = settings.baseCurrency

  // Only fetch the data the active tab actually needs.
  const [income, hours, clientsReport] = await Promise.all([
    tab === "income"
      ? getIncomeReport(user.id, baseCurrency, range)
      : Promise.resolve(null),
    tab === "hours" ? getHoursReport(user.id, range) : Promise.resolve(null),
    tab === "clients"
      ? getClientsReport(user.id, range)
      : Promise.resolve(null),
  ])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle={`Income, hours, and client rollup — ${baseCurrency} totals.`}
      />

      <DateRangePicker preset={presetParam} range={range} />
      <ReportsTabs current={tab} />

      {tab === "income" && income && (
        <IncomeTab report={income} currency={baseCurrency} range={range} />
      )}
      {tab === "hours" && hours && <HoursTab report={hours} range={range} />}
      {tab === "clients" && clientsReport && (
        <ClientsTab report={clientsReport} range={range} />
      )}
    </div>
  )
}
