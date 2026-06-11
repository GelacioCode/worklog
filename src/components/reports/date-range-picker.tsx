"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Icons } from "@/components/design/icons"
import { PRESET_LABELS, rangeFor, type RangePresetId } from "@/lib/date-ranges"
import { cn } from "@/lib/utils"

const PRESETS: Exclude<RangePresetId, "custom">[] = [
  "last-30",
  "this-month",
  "last-month",
  "this-year",
  "last-12",
  "all-time",
]

export function DateRangePicker({
  preset,
  range,
}: {
  preset: RangePresetId
  range: { from: string; to: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function navigate(params: URLSearchParams) {
    startTransition(() => {
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`)
    })
  }

  function applyPreset(p: Exclude<RangePresetId, "custom">) {
    const r = rangeFor(p)
    const params = new URLSearchParams(searchParams.toString())
    params.set("preset", p)
    params.set("from", r.from)
    params.set("to", r.to)
    navigate(params)
  }

  function applyCustom(key: "from" | "to", value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("preset", "custom")
    params.set(key, value)
    if (!params.get("from")) params.set("from", range.from)
    if (!params.get("to")) params.set("to", range.to)
    navigate(params)
  }

  return (
    <div className="card p-4 anim-slide-up">
      <div className="flex items-center gap-2 flex-wrap">
        <Icons.Calendar size={14} className="text-subtle shrink-0" />
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => applyPreset(p)}
            className={cn(
              "h-7 px-2.5 rounded-md text-[12px] font-medium transition",
              preset === p ? "text-fg" : "text-muted hover:text-fg",
            )}
            style={{ background: preset === p ? "var(--surface-2)" : "transparent" }}
          >
            {PRESET_LABELS[p]}
          </button>
        ))}
        <div className="h-4 w-px hidden sm:block" style={{ background: "var(--border)" }} />
        <div className="flex items-center gap-1.5">
          <input
            type="date"
            value={range.from}
            onChange={(e) => applyCustom("from", e.target.value)}
            className="input h-7 text-[12px] tnum"
            aria-label="From"
          />
          <span className="text-subtle text-[12px]">→</span>
          <input
            type="date"
            value={range.to}
            onChange={(e) => applyCustom("to", e.target.value)}
            className="input h-7 text-[12px] tnum"
            aria-label="To"
          />
        </div>
        {isPending && <div className="spinner" />}
      </div>
    </div>
  )
}
