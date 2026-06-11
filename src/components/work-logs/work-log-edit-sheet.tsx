"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  workLogFormSchema,
  type WorkLogFormInput,
} from "@/lib/validations/work-logs"
import { Icons } from "@/components/design/icons"
import { StatusPill } from "@/components/design/status-pill"
import { updateWorkLog, deleteWorkLog } from "@/server/actions/work-logs"
import type { ClientLite } from "./quick-add-bar"
import type { WorkLogWithClient } from "@/lib/db/queries/work-logs"

export function WorkLogEditSheet({
  log,
  clients,
  onClose,
}: {
  log: WorkLogWithClient | null
  clients: ClientLite[]
  onClose: () => void
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isDeleting, startDelete] = useTransition()
  const open = !!log

  const form = useForm<WorkLogFormInput>({
    resolver: zodResolver(workLogFormSchema),
    defaultValues: {
      clientId: "",
      title: "",
      description: "",
      notes: "",
      workDate: "",
      hours: 0,
      tag: "",
      billable: true,
    },
  })

  useEffect(() => {
    if (!log) return
    form.reset({
      clientId: log.clientId,
      title: log.title,
      description: log.description ?? "",
      notes: log.notes ?? "",
      workDate: log.workDate,
      hours: Math.round((log.durationMinutes / 60) * 100) / 100,
      tag: log.tag ?? "",
      billable: log.billable,
    })
  }, [log, form])

  function onSubmit(values: WorkLogFormInput) {
    if (!log) return
    startTransition(async () => {
      const result = await updateWorkLog(log.id, values)
      if (result.ok) {
        toast.success("Log updated")
        onClose()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  function onDelete() {
    if (!log) return
    if (!confirm(`Delete "${log.title}"? This can't be undone.`)) return
    startDelete(async () => {
      const result = await deleteWorkLog(log.id)
      if (result.ok) {
        toast.success("Log deleted")
        onClose()
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-[520px] p-0 flex flex-col">
        <div
          className="px-5 py-4 flex items-center justify-between shrink-0"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <SheetTitle className="text-[15px] font-semibold">Edit work log</SheetTitle>
          {log && <StatusPill status={log.invoiceStatus} />}
        </div>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1 overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
            <Field label="Task" required error={form.formState.errors.title?.message}>
              <input
                {...form.register("title")}
                placeholder="What did you work on?"
                className="input h-9 w-full text-[14px]"
                autoFocus
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Client" required>
                <select {...form.register("clientId")} className="input h-9 w-full text-[13px]">
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tag">
                <input
                  {...form.register("tag")}
                  placeholder="e.g. design"
                  className="input h-9 w-full text-[13px]"
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Date" required>
                <input
                  type="date"
                  {...form.register("workDate")}
                  className="input h-9 w-full tnum text-[13px]"
                />
              </Field>
              <Field label="Hours" required error={form.formState.errors.hours?.message}>
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  {...form.register("hours", { valueAsNumber: true })}
                  className="input h-9 w-full tnum text-[13px]"
                />
              </Field>
            </div>

            <Field label="Billable">
              <label className="flex items-center gap-2 text-[13px] cursor-pointer">
                <input type="checkbox" {...form.register("billable")} className="cb" />
                <span>Bill this on the next invoice</span>
              </label>
            </Field>

            <Field label="Description">
              <textarea
                {...form.register("description")}
                rows={2}
                placeholder="Optional: short summary"
                className="w-full bg-surface rounded-lg p-3 text-[13px] resize-none focus-ring"
                style={{ border: "1px solid var(--border)" }}
              />
            </Field>

            <Field label="Notes">
              <textarea
                {...form.register("notes")}
                rows={4}
                placeholder="Optional: longer details or links"
                className="w-full bg-surface-2 rounded-lg p-3 text-[13px] resize-none focus-ring"
                style={{ border: "1px solid var(--border)" }}
              />
            </Field>
          </div>

          <div
            className="px-5 py-3 flex items-center justify-between gap-2 shrink-0"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <button
              type="button"
              onClick={onDelete}
              disabled={isPending || isDeleting}
              className="btn btn-ghost text-red-500 hover:text-red-600"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icons.X size={13} />}
              Delete
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-ghost"
                disabled={isPending || isDeleting}
              >
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isPending || isDeleting}>
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save changes
              </button>
            </div>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-[11.5px] uppercase tracking-wider text-subtle font-medium block mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
      {error && <span className="text-[11.5px] text-red-500 mt-1 block">{error}</span>}
    </label>
  )
}
