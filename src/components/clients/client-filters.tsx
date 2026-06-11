"use client"

import { useTransition } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Icons } from "@/components/design/icons"
import { cn } from "@/lib/utils"

const TABS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
  { value: "all", label: "All" },
] as const

type StatusValue = (typeof TABS)[number]["value"]

export function ClientFilters({
  counts,
}: {
  counts: Record<"active" | "paused" | "ended" | "all", number>
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const current = (searchParams.get("status") ?? "active") as StatusValue
  const query = searchParams.get("q") ?? ""

  function setParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === null || value === "") params.delete(key)
    else params.set(key, value)
    startTransition(() => {
      router.replace(`/clients${params.toString() ? `?${params.toString()}` : ""}`)
    })
  }

  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      {TABS.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => setParam("status", t.value === "active" ? null : t.value)}
          className={cn(
            "h-8 px-3 rounded-md text-[12.5px] font-medium transition flex items-center gap-2",
            current === t.value ? "text-fg" : "text-muted hover:text-fg",
          )}
          style={{
            background: current === t.value ? "var(--surface-2)" : "transparent",
          }}
        >
          {t.label}
          <span className="text-[11px] text-subtle tnum">{counts[t.value]}</span>
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
          placeholder="Search clients…"
          className="input h-8 pl-7 w-[220px] text-[12.5px]"
        />
      </div>
      {isPending && <div className="spinner" />}
    </div>
  )
}
