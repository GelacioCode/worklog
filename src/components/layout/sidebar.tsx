"use client"

import Link from "next/link"
import { Icons } from "@/components/design/icons"
import { SidebarNav } from "./sidebar-nav"
import { SidebarUserCard } from "./sidebar-user-card"

export function Sidebar({ email }: { email: string }) {
  return (
    <aside
      className="hidden md:flex md:flex-col w-[256px] shrink-0 h-screen sticky top-0 bg-surface"
      style={{ borderRight: "1px solid var(--border)" }}
    >
      <div
        className="px-5 py-[18px] flex items-center gap-2.5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <Link
          href="/dashboard"
          className="w-7 h-7 rounded-lg accent-bg flex items-center justify-center text-white"
          style={{ boxShadow: "inset 0 -1px 0 rgb(0 0 0 / .15), 0 2px 6px rgb(var(--accent) / .35)" }}
          aria-label="Worklog home"
        >
          <Icons.Logo size={15} />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="text-[14px] font-semibold leading-tight">Worklog</div>
          <div className="text-[11px] text-subtle leading-tight">For one excellent freelancer</div>
        </div>
      </div>

      <SidebarNav />

      <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
        <SidebarUserCard email={email} />
      </div>
    </aside>
  )
}
