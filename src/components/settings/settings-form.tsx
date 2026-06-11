"use client"

import { useTransition } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Icons } from "@/components/design/icons"
import {
  settingsFormSchema,
  type SettingsFormInput,
  INVOICE_NUMBER_FORMATS,
  INVOICE_NUMBER_FORMAT_LABELS,
} from "@/lib/validations/settings"
import { SUPPORTED_CURRENCIES } from "@/lib/money"
import { saveSettings } from "@/server/actions/settings"
import type { ResolvedSettings } from "@/lib/db/queries/settings"
import { LogoUploader } from "./logo-uploader"

export function SettingsForm({
  settings,
  logoUrl,
  email,
}: {
  settings: ResolvedSettings
  logoUrl: string | null
  email: string
}) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const supportedFormats: string[] = [...INVOICE_NUMBER_FORMATS]
  const supportedCurrencies: string[] = [...SUPPORTED_CURRENCIES]

  const form = useForm<SettingsFormInput>({
    resolver: zodResolver(settingsFormSchema),
    defaultValues: {
      businessName:
        settings.businessName === "Your business" ? "" : settings.businessName,
      businessEmail: settings.businessEmail,
      businessAddress: settings.businessAddress,
      taxId: settings.taxId,
      baseCurrency: supportedCurrencies.includes(settings.baseCurrency)
        ? (settings.baseCurrency as (typeof SUPPORTED_CURRENCIES)[number])
        : "USD",
      invoiceNumberFormat: supportedFormats.includes(settings.invoiceNumberFormat)
        ? (settings.invoiceNumberFormat as (typeof INVOICE_NUMBER_FORMATS)[number])
        : "INV-####",
      defaultPaymentTerms: settings.defaultPaymentTerms,
      defaultInvoiceNotes: settings.defaultInvoiceNotes,
    },
  })

  function onSubmit(values: SettingsFormInput) {
    startTransition(async () => {
      const result = await saveSettings(values)
      if (result.ok) {
        toast.success("Settings saved")
        form.reset(values)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
      <Card title="Business profile">
        <LogoUploader
          initialPreviewUrl={logoUrl}
          businessName={form.watch("businessName") ?? settings.businessName}
        />
        <div className="grid sm:grid-cols-2 gap-4 mt-5 pt-5"
          style={{ borderTop: "1px solid var(--border)" }}>
          <Field label="Business name" error={form.formState.errors.businessName?.message}>
            <input
              {...form.register("businessName")}
              placeholder="Your name or company"
              className="input h-9 w-full text-[13px]"
            />
          </Field>
          <Field label="Email" error={form.formState.errors.businessEmail?.message}>
            <input
              type="email"
              {...form.register("businessEmail")}
              placeholder="hello@example.com"
              className="input h-9 w-full text-[13px]"
            />
          </Field>
          <Field label="Address">
            <input
              {...form.register("businessAddress")}
              placeholder="City, country"
              className="input h-9 w-full text-[13px]"
            />
          </Field>
          <Field label="Tax ID / VAT">
            <input
              {...form.register("taxId")}
              placeholder="Optional"
              className="input h-9 w-full text-[13px]"
            />
          </Field>
        </div>
      </Card>

      <Card title="Invoicing defaults">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Base currency">
            <select
              {...form.register("baseCurrency")}
              className="input h-9 w-full text-[13px]"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Invoice number format">
            <select
              {...form.register("invoiceNumberFormat")}
              className="input h-9 w-full text-[13px]"
            >
              {INVOICE_NUMBER_FORMATS.map((f) => (
                <option key={f} value={f}>
                  {INVOICE_NUMBER_FORMAT_LABELS[f]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Default payment terms (days)">
            <input
              type="number"
              min={0}
              max={180}
              {...form.register("defaultPaymentTerms", { valueAsNumber: true })}
              className="input h-9 w-full tnum text-[13px]"
            />
          </Field>
          <div /> {/* spacer for symmetry */}
        </div>
        <div className="mt-4">
          <Field label="Default invoice notes">
            <textarea
              {...form.register("defaultInvoiceNotes")}
              rows={3}
              placeholder="Bank info, payment instructions, thanks — appears at the bottom of every PDF."
              className="w-full bg-surface-2 rounded-lg p-3 text-[13px] resize-none focus-ring"
              style={{ border: "1px solid var(--border)" }}
            />
          </Field>
        </div>
      </Card>

      <Card title="Account">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Email">
            <input
              value={email}
              readOnly
              disabled
              className="input h-9 w-full text-[13px]"
            />
          </Field>
        </div>
        <p className="text-[12px] text-muted mt-3">
          Sign out from the user menu at the bottom of the sidebar.
        </p>
      </Card>

      <div
        className="flex items-center justify-end gap-2 sticky bottom-0 -mx-1 px-1 py-3"
        style={{
          background:
            "linear-gradient(to top, var(--bg) 50%, transparent)",
        }}
      >
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => form.reset()}
          disabled={isPending || !form.formState.isDirty}
        >
          Discard
        </button>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={isPending || !form.formState.isDirty}
        >
          {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          <Icons.Check size={13} /> Save changes
        </button>
      </div>
    </form>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 anim-slide-up">
      <div className="text-[10.5px] uppercase tracking-wider text-subtle font-medium mb-4">
        {title}
      </div>
      {children}
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-[11.5px] uppercase tracking-wider text-subtle font-medium block mb-1.5">
        {label}
      </span>
      {children}
      {error && <span className="text-[11.5px] text-red-500 mt-1 block">{error}</span>}
    </label>
  )
}
