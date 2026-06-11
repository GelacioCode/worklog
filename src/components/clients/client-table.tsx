import Link from "next/link"

import type { Client } from "@/lib/db/schema"
import { Icons } from "@/components/design/icons"
import { StatusPill } from "@/components/design/status-pill"
import {
  BILLING_TYPE_LABELS,
  type BillingType,
  type CutoffPreset,
  type CutoffScheduleJson,
  CUTOFF_LABELS,
} from "@/lib/validations/clients"
import { formatMoney } from "@/lib/money"

const STATUS_TO_PILL: Record<Client["status"], "paid" | "partial" | "draft"> = {
  active: "paid",
  paused: "partial",
  ended: "draft",
}

function rateDisplay(client: Client): string {
  if (client.billingType === "hourly" && client.hourlyRateCents != null) {
    return `${formatMoney(client.hourlyRateCents, client.currency)}/h`
  }
  if (client.monthlySalaryCents != null) {
    const suffix = client.billingType === "weekly" ? "/wk" : "/mo"
    return `${formatMoney(client.monthlySalaryCents, client.currency)}${suffix}`
  }
  if (client.hourlyRateCents != null) {
    return formatMoney(client.hourlyRateCents, client.currency)
  }
  return "—"
}

function cutoffDisplay(client: Client): string {
  const cutoff = client.cutoffSchedule as CutoffScheduleJson | null
  if (!cutoff?.preset) return "—"
  return CUTOFF_LABELS[cutoff.preset as CutoffPreset] ?? cutoff.preset
}

export function ClientTable({ clients }: { clients: Client[] }) {
  if (clients.length === 0) return null
  return (
    <div className="card overflow-x-auto">
      <div
        className="min-w-[720px] grid grid-cols-[1fr_92px_140px_120px_180px_28px] text-[11px] uppercase tracking-wider text-subtle font-medium px-4 py-2.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>Name / Company</div>
        <div>Status</div>
        <div>Billing</div>
        <div className="text-right">Rate</div>
        <div>Cutoff</div>
        <div />
      </div>
      <div className="stagger">
        {clients.map((c) => (
          <Link
            key={c.id}
            href={`/clients/${c.id}`}
            className="min-w-[720px] grid grid-cols-[1fr_92px_140px_120px_180px_28px] items-center px-4 py-3 text-[13px] row-hover group"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div className="min-w-0">
              <div className="font-medium truncate">{c.name}</div>
              {c.companyName && (
                <div className="text-[11.5px] text-subtle truncate">{c.companyName}</div>
              )}
            </div>
            <div>
              <StatusPill status={STATUS_TO_PILL[c.status]} />
            </div>
            <div className="text-[12.5px] text-muted">
              {BILLING_TYPE_LABELS[c.billingType as BillingType]}
            </div>
            <div className="text-right tnum">{rateDisplay(c)}</div>
            <div className="text-[12px] text-muted truncate">{cutoffDisplay(c)}</div>
            <div className="opacity-0 group-hover:opacity-100 transition text-subtle">
              <Icons.Chevron size={14} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
