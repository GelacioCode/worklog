"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Icons, type IconName } from "@/components/design/icons"

type NavItem = {
  href: string
  label: string
  icon: IconName
  soon?: boolean
}

const MAIN: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: "Dashboard" },
  { href: "/work-logs", label: "Work Logs", icon: "Logs" },
  { href: "/invoices", label: "Invoices", icon: "Invoice" },
  { href: "/clients", label: "Clients", icon: "Users" },
]

const SOON: NavItem[] = [
  { href: "/projects", label: "Projects", icon: "Folder", soon: true },
  { href: "/checklists", label: "Checklists", icon: "Checks", soon: true },
  { href: "/payments", label: "Payments", icon: "Money", soon: true },
  { href: "/vault", label: "Access Vault", icon: "Lock", soon: true },
]

const SYSTEM: NavItem[] = [
  { href: "/reports", label: "Reports", icon: "Chart" },
  { href: "/settings", label: "Settings", icon: "Settings" },
]

function Section({ label }: { label: string }) {
  return (
    <div className="text-[10.5px] uppercase tracking-[0.07em] text-subtle font-medium px-2.5 mb-2 mt-5 first:mt-1">
      {label}
    </div>
  )
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = Icons[item.icon]
  const inner = (
    <>
      <Icon size={15} />
      <span className="flex-1">{item.label}</span>
      {item.soon && (
        <span className="text-[9.5px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-surface-2 text-subtle font-semibold">
          Soon
        </span>
      )}
    </>
  )

  if (item.soon) {
    return (
      <div className="nav-link disabled" aria-disabled title="Coming in a later phase">
        {inner}
      </div>
    )
  }

  return (
    <Link href={item.href} className={cn("nav-link", active && "active")}>
      {inner}
    </Link>
  )
}

export function SidebarNav() {
  const pathname = usePathname()
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
      <Section label="Main" />
      {MAIN.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} />
      ))}
      <Section label="Soon" />
      {SOON.map((item) => (
        <NavLink key={item.href} item={item} active={false} />
      ))}
      <Section label="System" />
      {SYSTEM.map((item) => (
        <NavLink key={item.href} item={item} active={isActive(item.href)} />
      ))}
    </nav>
  )
}
