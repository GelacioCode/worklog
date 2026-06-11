"use client"

import { LogOut, User as UserIcon } from "lucide-react"
import { Icons } from "@/components/design/icons"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOut } from "@/server/actions/auth"

export function SidebarUserCard({ email }: { email: string }) {
  const initials = (email || "??").slice(0, 2).toUpperCase()
  const localPart = email.split("@")[0] || email
  const displayName = localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ") || "Account"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className="w-full flex items-center gap-2.5 p-2 rounded-lg hover:bg-surface-2 transition text-left"
            style={{ transition: "background .15s" }}
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-semibold text-white tnum shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, rgb(var(--accent)), oklch(72% 0.15 280))",
              }}
            >
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12.5px] font-medium truncate">{displayName}</div>
              <div className="text-[11px] text-subtle truncate">{email}</div>
            </div>
            <Icons.ChevronDown size={14} className="text-subtle shrink-0" />
          </button>
        }
      />
      <DropdownMenuContent align="end" side="top" className="w-[228px]">
        <DropdownMenuLabel className="font-normal">
          <div className="text-xs text-muted-foreground">Signed in as</div>
          <div className="text-sm font-medium truncate">{email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <UserIcon className="mr-2 h-4 w-4" />
          Account
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <button
            type="submit"
            className="relative flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
