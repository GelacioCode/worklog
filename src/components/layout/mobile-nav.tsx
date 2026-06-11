"use client"

import { useState } from "react"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { SidebarNav } from "./sidebar-nav"
import { Icons } from "@/components/design/icons"

export function MobileNav() {
  const [open, setOpen] = useState(false)
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button variant="ghost" size="icon" className="md:hidden h-8 w-8 -ml-1">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Open menu</span>
          </Button>
        }
      />
      <SheetContent side="left" className="w-64 p-0 flex flex-col">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <div
          className="px-5 py-[18px] flex items-center gap-2.5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div
            className="w-7 h-7 rounded-lg accent-bg flex items-center justify-center text-white"
            style={{
              boxShadow:
                "inset 0 -1px 0 rgb(0 0 0 / .15), 0 2px 6px rgb(var(--accent) / .35)",
            }}
          >
            <Icons.Logo size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold leading-tight">Worklog</div>
            <div className="text-[11px] text-subtle leading-tight">
              For one excellent freelancer
            </div>
          </div>
        </div>
        <div onClick={() => setOpen(false)}>
          <SidebarNav />
        </div>
      </SheetContent>
    </Sheet>
  )
}
