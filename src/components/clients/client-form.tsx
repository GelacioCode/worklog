"use client"

import { useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import {
  BILLING_TYPE_LABELS,
  BILLING_TYPES,
  CLIENT_STATUSES,
  COMMON_TIMEZONES,
  CUTOFF_LABELS,
  CUTOFF_PRESETS,
  clientFormSchema,
  type ClientFormInput,
  type CutoffScheduleJson,
} from "@/lib/validations/clients"
import { centsToDecimal, SUPPORTED_CURRENCIES } from "@/lib/money"
import type { Client } from "@/lib/db/schema"
import { createClient, updateClient } from "@/server/actions/clients"

const STATUS_LABELS: Record<(typeof CLIENT_STATUSES)[number], string> = {
  active: "Active",
  paused: "Paused",
  ended: "Ended",
}

function defaultValuesFor(client?: Client | null): ClientFormInput {
  if (!client) {
    return {
      name: "",
      companyName: "",
      contactPerson: "",
      email: "",
      timezone: "UTC",
      workType: "",
      status: "active",
      billingType: "hourly",
      hourlyRate: "",
      monthlySalary: "",
      currency: "USD",
      cutoffPreset: "biweekly_15_30",
      paymentTermsDays: 7,
      defaultInvoiceNotes: "",
      contractStart: "",
      contractEnd: "",
    }
  }
  const cutoff = (client.cutoffSchedule as CutoffScheduleJson | null) ?? null
  return {
    name: client.name,
    companyName: client.companyName ?? "",
    contactPerson: client.contactPerson ?? "",
    email: client.email ?? "",
    timezone: (COMMON_TIMEZONES as readonly string[]).includes(client.timezone)
      ? (client.timezone as (typeof COMMON_TIMEZONES)[number])
      : "UTC",
    workType: client.workType ?? "",
    status: client.status,
    billingType: client.billingType,
    hourlyRate: client.hourlyRateCents != null ? centsToDecimal(client.hourlyRateCents) : "",
    monthlySalary:
      client.monthlySalaryCents != null ? centsToDecimal(client.monthlySalaryCents) : "",
    currency: (SUPPORTED_CURRENCIES as readonly string[]).includes(client.currency)
      ? (client.currency as (typeof SUPPORTED_CURRENCIES)[number])
      : "USD",
    cutoffPreset:
      cutoff && (CUTOFF_PRESETS as readonly string[]).includes(cutoff.preset)
        ? cutoff.preset
        : "biweekly_15_30",
    paymentTermsDays: client.paymentTermsDays,
    defaultInvoiceNotes: client.defaultInvoiceNotes ?? "",
    contractStart: client.contractStart ?? "",
    contractEnd: client.contractEnd ?? "",
  }
}

export function ClientForm({
  client,
  onSaved,
  onCancel,
}: {
  client?: Client | null
  onSaved?: (id: string) => void
  onCancel?: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const isEdit = !!client

  const form = useForm<ClientFormInput>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: defaultValuesFor(client),
  })

  const billingType = form.watch("billingType")
  const showHourly = billingType === "hourly" || billingType === "fixed_project"
  const showSalary =
    billingType === "monthly" || billingType === "bi_monthly" || billingType === "weekly"

  function onSubmit(values: ClientFormInput) {
    startTransition(async () => {
      const result = isEdit
        ? await updateClient(client.id, values)
        : await createClient(values)

      if (result.ok) {
        toast.success(isEdit ? "Client updated" : `Added ${values.name}`)
        onSaved?.(result.id)
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
        <Section title="Identity">
          <Row>
            <Field label="Name" required error={form.formState.errors.name?.message}>
              <input
                {...form.register("name")}
                className="input h-9 w-full text-[13px]"
                placeholder="e.g. Acme Corp"
                autoFocus
              />
            </Field>
            <Field label="Company">
              <input
                {...form.register("companyName")}
                className="input h-9 w-full text-[13px]"
                placeholder="Optional"
              />
            </Field>
          </Row>
          <Row>
            <Field label="Contact person">
              <input
                {...form.register("contactPerson")}
                className="input h-9 w-full text-[13px]"
                placeholder="Optional"
              />
            </Field>
            <Field label="Email" error={form.formState.errors.email?.message}>
              <input
                {...form.register("email")}
                className="input h-9 w-full text-[13px]"
                placeholder="billing@acme.com"
                type="email"
              />
            </Field>
          </Row>
          <Row>
            <Field label="Timezone">
              <select {...form.register("timezone")} className="input h-9 w-full text-[13px]">
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Work type">
              <input
                {...form.register("workType")}
                className="input h-9 w-full text-[13px]"
                placeholder="e.g. Frontend dev"
              />
            </Field>
          </Row>
        </Section>

        <Section title="Status & contract">
          <Row>
            <Field label="Status">
              <select {...form.register("status")} className="input h-9 w-full text-[13px]">
                {CLIENT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Payment terms (days)">
              <input
                type="number"
                min={0}
                {...form.register("paymentTermsDays", { valueAsNumber: true })}
                className="input h-9 w-full text-[13px] tnum"
              />
            </Field>
          </Row>
          <Row>
            <Field label="Contract start">
              <input
                type="date"
                {...form.register("contractStart")}
                className="input h-9 w-full text-[13px] tnum"
              />
            </Field>
            <Field label="Contract end">
              <input
                type="date"
                {...form.register("contractEnd")}
                className="input h-9 w-full text-[13px] tnum"
              />
            </Field>
          </Row>
        </Section>

        <Section title="Billing">
          <Row>
            <Field label="Billing type">
              <select
                {...form.register("billingType")}
                className="input h-9 w-full text-[13px]"
              >
                {BILLING_TYPES.map((b) => (
                  <option key={b} value={b}>
                    {BILLING_TYPE_LABELS[b]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Currency">
              <select {...form.register("currency")} className="input h-9 w-full text-[13px]">
                {SUPPORTED_CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </Row>
          <Row>
            {showHourly && (
              <Field
                label="Hourly rate"
                error={form.formState.errors.hourlyRate?.message}
                required={billingType === "hourly"}
              >
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("hourlyRate")}
                  className="input h-9 w-full text-[13px] tnum"
                  placeholder="50.00"
                />
              </Field>
            )}
            {showSalary && (
              <Field
                label="Salary amount"
                error={form.formState.errors.monthlySalary?.message}
                required
              >
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  {...form.register("monthlySalary")}
                  className="input h-9 w-full text-[13px] tnum"
                  placeholder="2500.00"
                />
              </Field>
            )}
            <Field label="Cutoff schedule">
              <select
                {...form.register("cutoffPreset")}
                className="input h-9 w-full text-[13px]"
              >
                {CUTOFF_PRESETS.map((p) => (
                  <option key={p} value={p}>
                    {CUTOFF_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>
          </Row>
        </Section>

        <Section title="Defaults">
          <Field label="Default invoice notes">
            <textarea
              {...form.register("defaultInvoiceNotes")}
              rows={3}
              className="w-full bg-surface-2 rounded-lg p-3 text-[13px] resize-none focus-ring"
              style={{ border: "1px solid var(--border)" }}
              placeholder="e.g. Bank: BPI · Account: 1234 · Net 7"
            />
          </Field>
        </Section>
      </div>

      <div
        className="px-5 py-3 flex items-center justify-between gap-2 shrink-0"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        {onCancel ? (
          <button type="button" onClick={onCancel} className="btn btn-ghost" disabled={isPending}>
            Cancel
          </button>
        ) : (
          <span />
        )}
        <button type="submit" className="btn btn-primary" disabled={isPending}>
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {isEdit ? "Save changes" : "Add client"}
        </button>
      </div>
    </form>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="text-[10.5px] uppercase tracking-wider text-subtle font-medium">
        {title}
      </div>
      {children}
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid sm:grid-cols-2 gap-3">{children}</div>
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
