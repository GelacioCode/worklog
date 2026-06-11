"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ClientForm } from "./client-form"
import type { Client } from "@/lib/db/schema"

export function ClientFormSheet({
  client,
  trigger,
  navigateToDetailOnCreate = false,
}: {
  client?: Client | null
  trigger: React.ReactNode
  navigateToDetailOnCreate?: boolean
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const isEdit = !!client

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={trigger as React.ReactElement} />
      <SheetContent side="right" className="w-full sm:max-w-[520px] p-0 flex flex-col">
        <div
          className="px-5 py-4 shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <SheetTitle className="text-[15px] font-semibold">
            {isEdit ? "Edit client" : "New client"}
          </SheetTitle>
          <p className="text-[12.5px] text-muted mt-0.5">
            {isEdit
              ? "Changes to billing type or rate snapshot into the rate history automatically."
              : "Set up name, billing, currency, and cutoff. You can edit any field later."}
          </p>
        </div>
        <ClientForm
          client={client}
          onCancel={() => setOpen(false)}
          onSaved={(id) => {
            setOpen(false)
            if (!isEdit && navigateToDetailOnCreate) {
              router.push(`/clients/${id}`)
            } else {
              router.refresh()
            }
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
