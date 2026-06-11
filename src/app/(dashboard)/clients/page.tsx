import { PageHeader } from "@/components/layout/page-header"
import { Icons } from "@/components/design/icons"
import { EmptyState } from "@/components/design/empty-state"
import { ClientFilters } from "@/components/clients/client-filters"
import { ClientTable } from "@/components/clients/client-table"
import { ClientFormSheet } from "@/components/clients/client-form-sheet"
import {
  countClientsByStatus,
  listClients,
} from "@/lib/db/queries/clients"
import { requireUser } from "@/server/auth"

type SearchParams = Promise<{ status?: string; q?: string }>

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireUser()
  const { status: statusParam, q } = await searchParams

  const statusFilter =
    statusParam === "paused" || statusParam === "ended" || statusParam === "all"
      ? statusParam
      : "active"

  const [list, counts] = await Promise.all([
    listClients(user.id, { status: statusFilter, query: q }),
    countClientsByStatus(user.id),
  ])

  const totalCount = counts.active + counts.paused + counts.ended

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Manage who you bill, their rates, currencies, and cutoff schedules."
        actions={
          <ClientFormSheet
            navigateToDetailOnCreate
            trigger={
              <button type="button" className="btn btn-primary">
                <Icons.Plus size={13} /> Add client
              </button>
            }
          />
        }
      />

      <ClientFilters
        counts={{
          active: counts.active,
          paused: counts.paused,
          ended: counts.ended,
          all: totalCount,
        }}
      />

      {list.length === 0 && totalCount === 0 ? (
        <EmptyState
          icon={Icons.Users}
          title="No clients yet"
          body="Add a client to start tracking work and generating invoices. Set rates, billing schedules, and per-client currencies."
          action={
            <ClientFormSheet
              navigateToDetailOnCreate
              trigger={
                <button type="button" className="btn btn-primary">
                  <Icons.Plus size={13} /> Add your first client
                </button>
              }
            />
          }
        />
      ) : list.length === 0 ? (
        <div className="card py-16 text-center text-[13px] text-muted">
          No clients match these filters.
        </div>
      ) : (
        <ClientTable clients={list} />
      )}
    </div>
  )
}
