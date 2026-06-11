"use client"

import { usePathname } from "next/navigation"
import { Icons } from "@/components/design/icons"
import { MobileNav } from "./mobile-nav"

const TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/work-logs": "Work Logs",
  "/invoices": "Invoices",
  "/clients": "Clients",
  "/settings": "Settings",
}

function titleFor(pathname: string) {
  for (const [prefix, label] of Object.entries(TITLES)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) return label
  }
  return "Worklog"
}

export function TopBar({ workspaceLabel }: { workspaceLabel: string }) {
  const pathname = usePathname()
  const title = titleFor(pathname)

  return (
    <div
      className="h-14 sticky top-0 z-30 bg-surface/80 backdrop-blur-xl flex items-center px-4 md:px-6 gap-3"
      style={{ borderBottom: "1px solid var(--border)" }}
    >
      <MobileNav />
      <div className="flex items-center gap-2 text-[13px] min-w-0">
        <span className="text-subtle truncate">{workspaceLabel}</span>
        <Icons.Chevron size={12} className="text-subtle shrink-0" />
        <span className="font-medium truncate">{title}</span>
      </div>
      <div className="flex-1" />
      <button
        type="button"
        className="btn btn-ghost h-8 px-2.5 text-[12.5px] gap-2.5 text-muted hidden sm:inline-flex"
        style={{ minWidth: 220 }}
        title="Cmd+K — coming soon"
      >
        <Icons.Search size={13} />
        <span className="flex-1 text-left">Search or jump to…</span>
        <span className="kbd">⌘</span>
        <span className="kbd">K</span>
      </button>
      <button
        type="button"
        className="btn btn-ghost w-8 h-8 px-0 justify-center relative"
        aria-label="Notifications"
      >
        <Icons.Bell size={14} />
        <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full accent-bg pulse-ring" />
      </button>
    </div>
  )
}
