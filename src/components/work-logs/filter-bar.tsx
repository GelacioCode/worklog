"use client"

import { useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Icons } from "@/components/design/icons"
import { cn } from "@/lib/utils"

const STATUSES = ["all", "unbilled", "billed", "paid"] as const
type Status = (typeof STATUSES)[number]

export function FilterBar({
  count,
  countsByStatus,
}: {
  count: number
  countsByStatus: { unbilled: number; billed: number; paid: number }
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const current = (searchParams.get("status") ?? "all") as Status
  const query = searchParams.get("q") ?? ""

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === "") params.delete(key)
    else params.set(key, value)
    startTransition(() => {
      router.replace(`/work-logs${params.toString() ? `?${params.toString()}` : ""}`)
    })
  }

  const totalAll = countsByStatus.unbilled + countsByStatus.billed + countsByStatus.paid
  const countFor = (s: Status) => (s === "all" ? totalAll : countsByStatus[s])

  return (
    <div className="flex items-center gap-2 mb-3 flex-wrap">
      <div className="text-[12.5px] text-muted mr-1">
        <span className="font-medium text-fg tnum">{count}</span> entries
      </div>
      <div className="h-4 w-px" style={{ background: "var(--border)" }} />
      {STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => setParam("status", s === "all" ? null : s)}
          className={cn(
            "text-[12px] px-2.5 h-7 rounded-md font-medium capitalize transition flex items-center gap-1.5",
            current === s ? "text-fg" : "text-muted hover:text-fg",
          )}
          style={{ background: current === s ? "var(--surface-2)" : "transparent" }}
        >
          {s}
          <span className="text-[11px] text-subtle tnum">{countFor(s)}</span>
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
          placeholder="Search tasks…"
          className="input h-8 pl-7 w-[200px] text-[12.5px]"
        />
      </div>
      {isPending && <div className="spinner" />}
    </div>
  )
}
