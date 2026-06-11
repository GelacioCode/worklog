"use client"

import { useTransition } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Icons } from "@/components/design/icons"
import { cn } from "@/lib/utils"

export type ReportTab = "income" | "hours" | "clients"

const TABS: { value: ReportTab; label: string; icon: keyof typeof Icons }[] = [
  { value: "income", label: "Income", icon: "Money" },
  { value: "hours", label: "Hours", icon: "Clock" },
  { value: "clients", label: "Clients", icon: "Users" },
]

export function ReportsTabs({ current }: { current: ReportTab }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  function setTab(t: ReportTab) {
    const params = new URLSearchParams(searchParams.toString())
    if (t === "income") params.delete("tab")
    else params.set("tab", t)
    startTransition(() => {
      router.replace(`${pathname}${params.toString() ? `?${params.toString()}` : ""}`)
    })
  }

  return (
    <div className="flex items-center gap-1 anim-slide-up">
      {TABS.map((t) => {
        const Icon = Icons[t.icon]
        const active = current === t.value
        return (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={cn(
              "flex items-center gap-2 h-9 px-3 rounded-md text-[13px] font-medium transition",
              active ? "text-fg" : "text-muted hover:text-fg",
            )}
            style={{
              background: active ? "var(--surface-2)" : "transparent",
              boxShadow: active ? "inset 0 -2px 0 rgb(var(--accent))" : "none",
            }}
          >
            <Icon size={14} />
            {t.label}
          </button>
        )
      })}
      {isPending && <div className="spinner ml-2" />}
    </div>
  )
}
