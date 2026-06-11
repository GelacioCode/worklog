import { Icons } from "@/components/design/icons"
import { formatMoney } from "@/lib/money"
import { BILLING_TYPE_LABELS, type BillingType } from "@/lib/validations/clients"
import type { ClientRate } from "@/lib/db/schema"

function fmtDate(d: string | null): string {
  if (!d) return "now"
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export function RateHistoryTimeline({ entries }: { entries: ClientRate[] }) {
  if (entries.length === 0) {
    return (
      <div
        className="card flex flex-col items-center text-center py-10 px-6"
        style={{ background: "var(--surface-2)", borderStyle: "dashed" }}
      >
        <Icons.Clock size={18} className="text-subtle mb-2" />
        <div className="text-[13px] font-medium">No rate history yet</div>
        <div className="text-[12px] text-muted mt-1 max-w-xs">
          Snapshots are created automatically every time you change the billing rate or
          type.
        </div>
      </div>
    )
  }

  return (
    <ol className="relative pl-5">
      <span
        className="absolute left-1.5 top-1 bottom-1 w-px"
        style={{ background: "var(--border)" }}
        aria-hidden
      />
      {entries.map((e, i) => {
        const current = e.effectiveTo == null
        return (
          <li key={e.id} className="relative pb-5 last:pb-0">
            <span
              className={
                "absolute -left-[1px] top-1 w-3 h-3 rounded-full " +
                (current ? "accent-bg" : "")
              }
              style={{
                background: current ? undefined : "var(--surface)",
                border: "2px solid " + (current ? "rgb(var(--accent))" : "var(--border-strong)"),
                boxSizing: "border-box",
              }}
            />
            <div className="ml-3">
              <div className="flex items-baseline gap-2">
                <div className="text-[14px] font-semibold tnum">
                  {formatMoney(e.rateCents, e.currency)}
                </div>
                <div className="text-[12px] text-muted">
                  {BILLING_TYPE_LABELS[e.billingType as BillingType]}
                </div>
                {current && (
                  <span
                    className="pill pill-unbilled !h-[18px] !text-[10px]"
                    style={{ marginLeft: "auto" }}
                  >
                    Current
                  </span>
                )}
              </div>
              <div className="text-[11.5px] text-subtle tnum mt-0.5">
                {fmtDate(e.effectiveFrom)} → {fmtDate(e.effectiveTo)}
                {i === entries.length - 1 && entries.length > 1 && " (initial)"}
              </div>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
