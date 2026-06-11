import Link from "next/link"
import type { LucideIcon } from "lucide-react"
import { Icons } from "@/components/design/icons"

type Tone = "red" | "amber" | "violet" | "blue"

type AlertCard = {
  href: string
  icon: LucideIcon
  title: string
  body: string
  tone: Tone
}

const TONE_STYLE: Record<Tone, { bg: string; fg: string; ring: string }> = {
  red: {
    bg: "rgb(254 226 226 / .55)",
    fg: "#a32525",
    ring: "rgb(254 202 202)",
  },
  amber: {
    bg: "rgb(255 240 214 / .55)",
    fg: "#8b5a07",
    ring: "rgb(253 230 138)",
  },
  violet: {
    bg: "var(--accent-soft)",
    fg: "rgb(var(--accent))",
    ring: "rgb(var(--accent) / .22)",
  },
  blue: {
    bg: "rgb(229 237 255 / .55)",
    fg: "#2e4eb0",
    ring: "rgb(191 219 254)",
  },
}

export function AlertStrip({
  overdueInvoiceCount,
  unbilledBillableLogCount,
  upcomingCutoffsCount,
}: {
  overdueInvoiceCount: number
  unbilledBillableLogCount: number
  upcomingCutoffsCount: number
}) {
  const cards: AlertCard[] = []

  if (overdueInvoiceCount > 0) {
    cards.push({
      href: "/invoices?status=overdue",
      icon: Icons.AlertCircle,
      title: `${overdueInvoiceCount} overdue ${plural(overdueInvoiceCount, "invoice")}`,
      body: "Past the due date and still unpaid.",
      tone: "red",
    })
  }
  if (unbilledBillableLogCount > 0) {
    cards.push({
      href: "/invoices/new",
      icon: Icons.Zap,
      title: `${unbilledBillableLogCount} ${plural(unbilledBillableLogCount, "log")} ready to bill`,
      body: "Bundle these into a new invoice.",
      tone: "violet",
    })
  }
  if (upcomingCutoffsCount > 0) {
    cards.push({
      href: "/clients",
      icon: Icons.Calendar,
      title: `${upcomingCutoffsCount} ${plural(upcomingCutoffsCount, "cutoff")} in the next 7 days`,
      body: "Plan ahead so nothing slips.",
      tone: "amber",
    })
  }

  if (cards.length === 0) return null

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 stagger">
      {cards.map((c) => {
        const tone = TONE_STYLE[c.tone]
        const Icon = c.icon
        return (
          <Link
            key={c.href + c.title}
            href={c.href}
            className="card p-4 flex items-center gap-3 group hover:shadow-sm transition"
          >
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
              style={{
                background: tone.bg,
                color: tone.fg,
                boxShadow: `inset 0 0 0 1px ${tone.ring}`,
              }}
            >
              <Icon size={16} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium truncate">{c.title}</div>
              <div className="text-[11.5px] text-muted truncate">{c.body}</div>
            </div>
            <Icons.Chevron
              size={14}
              className="text-subtle opacity-0 group-hover:opacity-100 transition shrink-0"
            />
          </Link>
        )
      })}
    </div>
  )
}

function plural(n: number, word: string) {
  return n === 1 ? word : word + "s"
}
