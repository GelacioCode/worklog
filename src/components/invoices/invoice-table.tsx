import Link from "next/link"

import { Icons } from "@/components/design/icons"
import { StatusPill } from "@/components/design/status-pill"
import { formatMoney } from "@/lib/money"
import type { InvoiceWithClient } from "@/lib/db/queries/invoices"

function fmtDate(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function fmtRange(start: string | null, end: string | null) {
  if (!start || !end) return "—"
  return `${fmtDate(start)} – ${fmtDate(end)}`
}

export function InvoiceTable({ invoices }: { invoices: InvoiceWithClient[] }) {
  if (invoices.length === 0) return null

  return (
    <div className="card overflow-x-auto">
      <div
        className="min-w-[820px] grid grid-cols-[110px_1fr_140px_92px_92px_120px_92px_28px] text-[11px] uppercase tracking-wider text-subtle font-medium px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>#</div>
        <div>Client</div>
        <div>Period</div>
        <div>Issued</div>
        <div>Due</div>
        <div className="text-right">Total</div>
        <div>Status</div>
        <div />
      </div>
      <div className="stagger">
        {invoices.map((inv) => (
          <Link
            key={inv.id}
            href={`/invoices/${inv.id}`}
            className="min-w-[820px] grid grid-cols-[110px_1fr_140px_92px_92px_120px_92px_28px] items-center px-4 py-3 text-[13px] row-hover group"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="font-mono text-[12px] tnum text-fg">{inv.invoiceNumber}</div>
            <div className="min-w-0">
              <div className="truncate font-medium">{inv.clientName}</div>
              {inv.clientCompany && (
                <div className="text-[11.5px] text-subtle truncate">
                  {inv.clientCompany}
                </div>
              )}
            </div>
            <div className="text-[12px] text-muted tnum">
              {fmtRange(inv.periodStart, inv.periodEnd)}
            </div>
            <div className="text-[12px] text-muted tnum">{fmtDate(inv.issuedDate)}</div>
            <div className="text-[12px] text-muted tnum">{fmtDate(inv.dueDate)}</div>
            <div className="text-right tnum font-medium">
              {formatMoney(inv.totalCents, inv.currency)}
            </div>
            <div>
              <StatusPill status={inv.status} />
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition text-subtle">
              <Icons.Chevron size={14} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
