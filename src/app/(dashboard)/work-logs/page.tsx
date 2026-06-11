import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { Icons } from "@/components/design/icons"
import { EmptyState } from "@/components/design/empty-state"
import { QuickAddBar, type ClientLite } from "@/components/work-logs/quick-add-bar"
import { WorkLogsViewSwitcher } from "@/components/work-logs/work-logs-view-toggle"
import { listClients } from "@/lib/db/queries/clients"
import {
  countWorkLogsByStatus,
  listWorkLogs,
} from "@/lib/db/queries/work-logs"
import type { WorkLogStatus } from "@/lib/validations/work-logs"
import { requireUser } from "@/server/auth"

type SearchParams = Promise<{ status?: string; q?: string }>

export default async function WorkLogsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireUser()
  const { status: statusParam, q } = await searchParams

  const status: WorkLogStatus | "all" =
    statusParam === "unbilled" || statusParam === "billed" || statusParam === "paid"
      ? statusParam
      : "all"

  const [activeClients, logs, countsByStatus] = await Promise.all([
    listClients(user.id, { status: "active" }),
    listWorkLogs(user.id, { status, query: q }),
    countWorkLogsByStatus(user.id),
  ])

  const lite: ClientLite[] = activeClients.map((c) => ({
    id: c.id,
    name: c.name,
    currency: c.currency,
    hourlyRateCents: c.hourlyRateCents,
  }))

  const hasClients = lite.length > 0
  const totalLogs =
    countsByStatus.unbilled + countsByStatus.billed + countsByStatus.paid

  return (
    <div>
      <PageHeader
        title="Work Logs"
        subtitle="Log work in seconds. Everything flows into invoices."
        actions={
          <>
            <button className="btn btn-ghost" type="button" disabled>
              <Icons.Download size={13} /> Export
            </button>
            {totalLogs > 0 ? (
              <Link href="/invoices/new" className="btn btn-primary">
                <Icons.Zap size={13} /> Generate invoice
              </Link>
            ) : (
              <button className="btn btn-primary" type="button" disabled>
                <Icons.Zap size={13} /> Generate invoice
              </button>
            )}
          </>
        }
      />

      {!hasClients ? (
        <EmptyState
          icon={Icons.Users}
          title="Add a client first"
          body="Work logs are always tied to a client. Add at least one to enable the quick-add bar and start tracking."
          action={
            <Link href="/clients" className="btn btn-primary">
              <Icons.Plus size={13} /> Add your first client
            </Link>
          }
        />
      ) : (
        <>
          <QuickAddBar clients={lite} />
          <WorkLogsViewSwitcher
            logs={logs}
            clients={lite}
            countsByStatus={countsByStatus}
          />
        </>
      )}
    </div>
  )
}
