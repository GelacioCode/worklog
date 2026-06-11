import Link from "next/link"
import { notFound } from "next/navigation"

import { PageHeader } from "@/components/layout/page-header"
import { Icons } from "@/components/design/icons"
import { StatusPill } from "@/components/design/status-pill"
import { getInvoiceById } from "@/lib/db/queries/invoices"
import { requireUser } from "@/server/auth"
import { formatMoney } from "@/lib/money"
import {
  deleteInvoiceAction,
  markCancelledAction,
  markDraftAction,
  markPaidAction,
  markSentAction,
} from "@/server/actions/invoices"

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await requireUser()
  const invoice = await getInvoiceById(user.id, id)
  if (!invoice) notFound()

  const outstanding = invoice.totalCents - invoice.amountPaidCents

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1">
            <Link href="/invoices" className="hover:text-fg transition">
              Invoices
            </Link>
            <Icons.Chevron size={10} />
            <span className="font-mono">{invoice.invoiceNumber}</span>
          </span>
        }
        title={`${invoice.clientName} · ${invoice.invoiceNumber}`}
        subtitle={
          invoice.periodStart && invoice.periodEnd
            ? `For work between ${fmtDate(invoice.periodStart)} and ${fmtDate(invoice.periodEnd)}.`
            : undefined
        }
        actions={
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <StatusPill status={invoice.status} />
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              target="_blank"
              rel="noopener"
              className="btn btn-ghost"
            >
              <Icons.Download size={13} /> PDF
            </a>
            <ActionButtons status={invoice.status} id={invoice.id} />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="card overflow-hidden anim-slide-up">
          <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-start justify-between gap-6">
              <div>
                <div className="text-[10.5px] uppercase tracking-wider text-subtle font-medium">
                  Bill to
                </div>
                <div className="text-[15px] font-medium mt-1">{invoice.clientName}</div>
                {invoice.clientCompany && (
                  <div className="text-[12.5px] text-muted">{invoice.clientCompany}</div>
                )}
              </div>
              <div className="text-right">
                <div className="text-[10.5px] uppercase tracking-wider text-subtle font-medium">
                  Invoice
                </div>
                <div className="font-mono text-[16px] font-semibold tnum mt-1">
                  {invoice.invoiceNumber}
                </div>
                <div className="text-[11.5px] text-subtle tnum mt-1">
                  Issued {fmtDate(invoice.issuedDate)} · Due {fmtDate(invoice.dueDate)}
                </div>
              </div>
            </div>
          </div>

          <div
            className="grid grid-cols-[1fr_72px_120px_120px] text-[10.5px] uppercase tracking-wider text-subtle font-medium px-6 py-2.5"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div>Description</div>
            <div className="text-right">Qty</div>
            <div className="text-right">Unit price</div>
            <div className="text-right">Amount</div>
          </div>

          {invoice.items.length === 0 ? (
            <div className="px-6 py-10 text-center text-[12.5px] text-muted">
              This invoice has no line items.
            </div>
          ) : (
            invoice.items.map((item) => (
              <div
                key={item.id}
                className="grid grid-cols-[1fr_72px_120px_120px] items-center px-6 py-2.5 text-[13px]"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div className="min-w-0">
                  <div className="truncate">{item.description}</div>
                  <div className="text-[11px] text-subtle capitalize">
                    {item.unit === "hours" ? "Hourly" : item.workLogId ? "Work log" : "Manual"}
                  </div>
                </div>
                <div className="text-right tnum">
                  {Number(item.quantity).toFixed(2)}
                  {item.unit === "hours" && "h"}
                </div>
                <div className="text-right tnum">
                  {formatMoney(item.unitPriceCents, invoice.currency)}
                </div>
                <div className="text-right tnum font-medium">
                  {formatMoney(item.amountCents, invoice.currency)}
                </div>
              </div>
            ))
          )}

          <div className="px-6 py-4">
            <div className="ml-auto max-w-[280px] space-y-1.5 text-[13px]">
              <TotalLine label="Subtotal" value={formatMoney(invoice.subtotalCents, invoice.currency)} />
              {invoice.discountCents > 0 && (
                <TotalLine
                  label="Discount"
                  value={"−" + formatMoney(invoice.discountCents, invoice.currency)}
                  muted
                />
              )}
              {invoice.taxCents > 0 && (
                <TotalLine
                  label="Tax"
                  value={"+" + formatMoney(invoice.taxCents, invoice.currency)}
                  muted
                />
              )}
              {invoice.expensesCents > 0 && (
                <TotalLine
                  label="Expenses"
                  value={"+" + formatMoney(invoice.expensesCents, invoice.currency)}
                  muted
                />
              )}
              <div
                className="flex items-center justify-between pt-2 mt-1"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <span className="text-[12.5px] uppercase tracking-wider text-subtle font-medium">
                  Total
                </span>
                <span className="text-[18px] font-semibold tnum">
                  {formatMoney(invoice.totalCents, invoice.currency)}
                </span>
              </div>
            </div>
          </div>

          {invoice.notes && (
            <div
              className="px-6 py-4 text-[12.5px] text-muted whitespace-pre-wrap"
              style={{ borderTop: "1px solid var(--border)", background: "var(--surface-2)" }}
            >
              <div className="text-[10.5px] uppercase tracking-wider text-subtle font-medium mb-1.5">
                Notes
              </div>
              {invoice.notes}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="card p-5 anim-slide-up">
            <div className="text-[10.5px] uppercase tracking-wider text-subtle font-medium">
              Status
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <StatusPill status={invoice.status} />
              <span className="text-[11.5px] text-subtle">
                Updated {invoice.updatedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </span>
            </div>

            <div
              className="mt-4 pt-4 space-y-1.5 text-[13px]"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="text-muted">Total</span>
                <span className="tnum font-medium">
                  {formatMoney(invoice.totalCents, invoice.currency)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Paid</span>
                <span className="tnum text-emerald-600">
                  {formatMoney(invoice.amountPaidCents, invoice.currency)}
                </span>
              </div>
              <div
                className="flex items-center justify-between pt-2 mt-1"
                style={{ borderTop: "1px solid var(--border)" }}
              >
                <span className="font-medium">Outstanding</span>
                <span className="tnum font-semibold">
                  {formatMoney(outstanding, invoice.currency)}
                </span>
              </div>
            </div>
          </div>

          <div className="card p-5 anim-slide-up">
            <div className="text-[10.5px] uppercase tracking-wider text-subtle font-medium mb-3">
              Snapshot
            </div>
            <KV label="Rate at issue" value={
              invoice.rateSnapshotCents
                ? `${formatMoney(invoice.rateSnapshotCents, invoice.currency)}/h`
                : "—"
            } />
            <KV label="Currency" value={invoice.currency} />
            <KV
              label="Payment terms"
              value={`Net ${Math.max(0, Math.round((new Date(invoice.dueDate + "T00:00:00Z").getTime() - new Date(invoice.issuedDate + "T00:00:00Z").getTime()) / 86400000))} days`}
            />
          </div>

          <div className="card p-5 anim-slide-up">
            <div className="text-[10.5px] uppercase tracking-wider text-subtle font-medium mb-2">
              PDF
            </div>
            <p className="text-[12.5px] text-muted mb-3">
              Share this invoice as a downloadable A4 PDF. Header pulls from your
              business profile in Settings.
            </p>
            <a
              href={`/api/invoices/${invoice.id}/pdf`}
              target="_blank"
              rel="noopener"
              className="btn btn-primary w-full justify-center"
            >
              <Icons.Download size={13} /> Open PDF
            </a>
            <a
              href={`/api/invoices/${invoice.id}/pdf?download=1`}
              download={`${invoice.invoiceNumber}.pdf`}
              className="btn btn-ghost w-full justify-center mt-2"
            >
              <Icons.Download size={13} /> Download
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function ActionButtons({ status, id }: { status: string; id: string }) {
  return (
    <>
      {status === "draft" && (
        <form action={markSentAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="btn btn-ghost">
            <Icons.Arrow size={13} /> Mark sent
          </button>
        </form>
      )}
      {(status === "sent" || status === "partial" || status === "overdue") && (
        <form action={markPaidAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="btn btn-primary">
            <Icons.Check size={13} /> Mark paid
          </button>
        </form>
      )}
      {status === "paid" && (
        <form action={markSentAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="btn btn-ghost" title="Walk back to sent">
            <Icons.Arrow size={13} /> Un-pay
          </button>
        </form>
      )}
      {status !== "draft" && status !== "cancelled" && status !== "paid" && (
        <form action={markDraftAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="btn btn-ghost" title="Walk back to draft">
            Draft
          </button>
        </form>
      )}
      {status !== "cancelled" && (
        <form action={markCancelledAction}>
          <input type="hidden" name="id" value={id} />
          <button type="submit" className="btn btn-ghost">
            Cancel
          </button>
        </form>
      )}
      <form
        action={deleteInvoiceAction}
      >
        <input type="hidden" name="id" value={id} />
        <DeleteButton />
      </form>
    </>
  )
}

function DeleteButton() {
  return (
    <button
      type="submit"
      className="btn btn-ghost text-red-500 hover:text-red-600"
      formNoValidate
      onClick={(e) => {
        if (!confirm("Delete this invoice? Linked work logs go back to unbilled.")) {
          e.preventDefault()
        }
      }}
    >
      <Icons.X size={13} /> Delete
    </button>
  )
}

function TotalLine({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-muted" : ""}>{label}</span>
      <span className={"tnum " + (muted ? "text-muted" : "font-medium")}>{value}</span>
    </div>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-[13px] py-1">
      <span className="text-[11.5px] uppercase tracking-wider text-subtle font-medium">
        {label}
      </span>
      <span>{value}</span>
    </div>
  )
}
