import Link from "next/link"

import { PageHeader } from "@/components/layout/page-header"
import { Icons } from "@/components/design/icons"
import { EmptyState } from "@/components/design/empty-state"
import {
  InvoiceBuilder,
  type BuilderClient,
} from "@/components/invoices/invoice-builder"
import { listClients } from "@/lib/db/queries/clients"
import { requireUser } from "@/server/auth"

type SearchParams = Promise<{ clientId?: string }>

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireUser()
  const { clientId } = await searchParams

  const activeClients = await listClients(user.id, { status: "active" })

  const builderClients: BuilderClient[] = activeClients.map((c) => ({
    id: c.id,
    name: c.name,
    currency: c.currency,
    paymentTermsDays: c.paymentTermsDays,
    defaultInvoiceNotes: c.defaultInvoiceNotes,
  }))

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1">
            <Link href="/invoices" className="hover:text-fg transition">
              Invoices
            </Link>
            <Icons.Chevron size={10} />
            <span>New</span>
          </span>
        }
        title="Generate invoice"
        subtitle="Pick a client + period, select billable work, adjust, and save."
      />

      {builderClients.length === 0 ? (
        <EmptyState
          icon={Icons.Users}
          title="Add a client first"
          body="Invoices are always tied to a client. Add at least one client before generating."
          action={
            <Link href="/clients" className="btn btn-primary">
              <Icons.Plus size={13} /> Add your first client
            </Link>
          }
        />
      ) : (
        <InvoiceBuilder clients={builderClients} initialClientId={clientId} />
      )}
    </div>
  )
}
