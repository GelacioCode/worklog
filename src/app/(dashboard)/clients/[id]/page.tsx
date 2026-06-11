import Link from "next/link"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { Icons } from "@/components/design/icons"
import { StatusPill } from "@/components/design/status-pill"
import { ClientFormSheet } from "@/components/clients/client-form-sheet"
import { RateHistoryTimeline } from "@/components/clients/rate-history-timeline"
import { getClientById, listRateHistoryFor } from "@/lib/db/queries/clients"
import { requireUser } from "@/server/auth"
import { formatMoney } from "@/lib/money"
import {
  BILLING_TYPE_LABELS,
  CUTOFF_LABELS,
  type BillingType,
  type CutoffPreset,
  type CutoffScheduleJson,
} from "@/lib/validations/clients"
import {
  archiveClientAction,
  deleteClientAction,
} from "@/server/actions/clients"

const STATUS_TO_PILL = {
  active: "paid" as const,
  paused: "partial" as const,
  ended: "draft" as const,
}

const STATUS_LABEL = {
  active: "Active",
  paused: "Paused",
  ended: "Ended",
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()
  const [client, rateHistory] = await Promise.all([
    getClientById(user.id, id),
    listRateHistoryFor(user.id, id),
  ])

  if (!client) notFound()

  const cutoff = client.cutoffSchedule as CutoffScheduleJson | null
  const cutoffLabel = cutoff?.preset
    ? (CUTOFF_LABELS[cutoff.preset as CutoffPreset] ?? cutoff.preset)
    : "—"

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1">
            <Link href="/clients" className="hover:text-fg transition">
              Clients
            </Link>
            <Icons.Chevron size={10} />
            <span>{client.name}</span>
          </span>
        }
        title={client.name}
        subtitle={client.companyName ?? "Independent / freelance client"}
        actions={
          <div className="flex items-center gap-2">
            <StatusPill status={STATUS_TO_PILL[client.status]} />
            <ClientFormSheet
              client={client}
              trigger={
                <button type="button" className="btn btn-ghost">
                  <Icons.Sparkle size={13} /> Edit
                </button>
              }
            />
            {client.status !== "ended" && (
              <form action={archiveClientAction}>
                <input type="hidden" name="id" value={client.id} />
                <button type="submit" className="btn btn-ghost" title="Mark as Ended">
                  <Icons.Inbox size={13} /> Archive
                </button>
              </form>
            )}
            <form
              action={deleteClientAction}
              onSubmit={(e) => {
                if (
                  !confirm(
                    `Delete ${client.name}? This is permanent and only works if no work logs or invoices reference this client.`,
                  )
                ) {
                  e.preventDefault()
                }
              }}
            >
              <input type="hidden" name="id" value={client.id} />
              <button
                type="submit"
                className="btn btn-ghost text-red-500 hover:text-red-600"
              >
                <Icons.X size={13} /> Delete
              </button>
            </form>
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card title="Contact">
            <Grid>
              <KV label="Contact person" value={client.contactPerson} />
              <KV label="Email" value={client.email} />
              <KV label="Timezone" value={client.timezone} />
              <KV label="Work type" value={client.workType} />
            </Grid>
          </Card>

          <Card title="Billing">
            <Grid>
              <KV
                label="Billing type"
                value={BILLING_TYPE_LABELS[client.billingType as BillingType]}
              />
              <KV label="Currency" value={client.currency} />
              <KV
                label="Hourly rate"
                value={
                  client.hourlyRateCents != null
                    ? formatMoney(client.hourlyRateCents, client.currency) + "/h"
                    : null
                }
              />
              <KV
                label="Salary"
                value={
                  client.monthlySalaryCents != null
                    ? formatMoney(client.monthlySalaryCents, client.currency)
                    : null
                }
              />
              <KV label="Cutoff" value={cutoffLabel} />
              <KV label="Payment terms" value={`Net ${client.paymentTermsDays} days`} />
            </Grid>
          </Card>

          <Card title="Contract">
            <Grid>
              <KV label="Status" value={STATUS_LABEL[client.status]} />
              <KV label="Start" value={client.contractStart} />
              <KV label="End" value={client.contractEnd} />
            </Grid>
            {client.defaultInvoiceNotes && (
              <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
                <div className="text-[11.5px] uppercase tracking-wider text-subtle font-medium mb-1.5">
                  Default invoice notes
                </div>
                <p className="text-[13px] whitespace-pre-wrap">{client.defaultInvoiceNotes}</p>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Rate history">
            <RateHistoryTimeline entries={rateHistory} />
          </Card>

          <Card title="Generate">
            <p className="text-[12.5px] text-muted mb-3">
              Bundle this client&apos;s billable, unbilled work into a new invoice.
            </p>
            <Link
              href={`/invoices/new?clientId=${client.id}`}
              className="btn btn-primary w-full justify-center"
            >
              <Icons.Zap size={13} /> Generate invoice
            </Link>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 anim-slide-up">
      <div className="text-[10.5px] uppercase tracking-wider text-subtle font-medium mb-3">
        {title}
      </div>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-x-5 gap-y-3">{children}</div>
}

function KV({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-subtle font-medium mb-0.5">
        {label}
      </div>
      <div className="text-[13.5px]">{value && value !== "" ? value : <span className="text-subtle">—</span>}</div>
    </div>
  )
}
