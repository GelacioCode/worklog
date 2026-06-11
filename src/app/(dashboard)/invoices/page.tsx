import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { Icons } from "@/components/design/icons"
import { EmptyState } from "@/components/design/empty-state"
import { InvoiceFilters } from "@/components/invoices/invoice-filters"
import { InvoiceTable } from "@/components/invoices/invoice-table"
import {
  countInvoicesByStatus,
  listInvoices,
} from "@/lib/db/queries/invoices"
import type { InvoiceStatus } from "@/lib/validations/invoices"
import { requireUser } from "@/server/auth"

type SearchParams = Promise<{ status?: string; q?: string }>

const VALID: InvoiceStatus[] = [
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
  "cancelled",
]

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireUser()
  const { status: statusParam, q } = await searchParams

  const status: InvoiceStatus | "all" =
    statusParam && VALID.includes(statusParam as InvoiceStatus)
      ? (statusParam as InvoiceStatus)
      : "all"

  const [list, counts] = await Promise.all([
    listInvoices(user.id, { status, query: q }),
    countInvoicesByStatus(user.id),
  ])

  const totalCount = Object.values(counts).reduce((s, n) => s + n, 0)

  return (
    <div>
      <PageHeader
        title="Invoices"
        subtitle="Generate invoices from billable work logs and track payments."
        actions={
          <Link href="/invoices/new" className="btn btn-primary">
            <Icons.Zap size={13} /> Generate invoice
          </Link>
        }
      />

      <InvoiceFilters countsByStatus={counts} />

      {list.length === 0 && totalCount === 0 ? (
        <EmptyState
          icon={Icons.Invoice}
          title="No invoices yet"
          body="Generate your first invoice from billable work logs once you've logged some work."
          action={
            <Link href="/invoices/new" className="btn btn-primary">
              <Icons.Zap size={13} /> Generate your first invoice
            </Link>
          }
        />
      ) : list.length === 0 ? (
        <div className="card py-16 text-center text-[13px] text-muted">
          No invoices match these filters.
        </div>
      ) : (
        <InvoiceTable invoices={list} />
      )}
    </div>
  )
}
