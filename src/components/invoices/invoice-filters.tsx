"use client"

import { useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Icons } from "@/components/design/icons"
import { StatusPill, type PillStatus } from "@/components/design/status-pill"
import { cn } from "@/lib/utils"
import {
  INVOICE_STATUS_LABELS,
  type InvoiceStatus,
} from "@/lib/validations/invoices"

const TABS: { value: "all" | InvoiceStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: INVOICE_STATUS_LABELS.draft },
  { value: "sent", label: INVOICE_STATUS_LABELS.sent },
  { value: "partial", label: INVOICE_STATUS_LABELS.partial },
  { value: "paid", label: INVOICE_STATUS_LABELS.paid },
  { value: "overdue", label: INVOICE_STATUS_LABELS.overdue },
  { value: "cancelled", label: INVOICE_STATUS_LABELS.cancelled },
]

const PILL_MAP: Record<InvoiceStatus, PillStatus> = {
  draft: "draft",
  sent: "sent",
  partial: "partial",
  paid: "paid",
  overdue: "overdue",
  cancelled: "cancelled",
}

export function InvoiceFilters({
  countsByStatus,
}: {
  countsByStatus: Record<InvoiceStatus, number>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const current = (searchParams.get("status") ?? "all") as
    | "all"
    | InvoiceStatus

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === "") params.delete(key)
    else params.set(key, value)
    startTransition(() => {
      router.replace(`/invoices${params.toString() ? `?${params.toString()}` : ""}`)
    })
  }

  const totalAll = Object.values(countsByStatus).reduce((s, n) => s + n, 0)
  const countFor = (v: "all" | InvoiceStatus) =>
    v === "all" ? totalAll : countsByStatus[v]

  const query = searchParams.get("q") ?? ""

  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      {TABS.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => setParam("status", t.value === "all" ? null : t.value)}
          className={cn(
            "h-8 px-2.5 rounded-md text-[12.5px] font-medium transition flex items-center gap-1.5",
            current === t.value ? "text-fg" : "text-muted hover:text-fg",
          )}
          style={{
            background: current === t.value ? "var(--surface-2)" : "transparent",
          }}
        >
          {t.value !== "all" ? (
            <StatusPill
              status={PILL_MAP[t.value]}
              className="!h-[18px] !text-[10px]"
            />
          ) : (
            <span>All</span>
          )}
          <span className="text-[11px] text-subtle tnum">{countFor(t.value)}</span>
        </button>
      ))}
      <div className="flex-1" />
      <div className="relative">
        <Icons.Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-subtle" />
        <input
          defaultValue={query}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              setParam("q", (e.target as HTMLInputElement).value || null)
            }
          }}
          onBlur={(e) => setParam("q", e.target.value || null)}
          placeholder="Search by number or client…"
          className="input h-8 pl-7 w-[240px] text-[12.5px]"
        />
      </div>
      {isPending && <div className="spinner" />}
    </div>
  )
}
