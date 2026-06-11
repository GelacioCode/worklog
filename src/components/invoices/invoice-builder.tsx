"use client"

import { useEffect, useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"

import { Icons } from "@/components/design/icons"
import { formatMoney, toCents } from "@/lib/money"
import {
  loadInvoiceBuilderData,
  type BuilderLog,
} from "@/server/actions/invoice-builder-data"
import { generateInvoice } from "@/server/actions/invoices"
import type { ManualLineItem } from "@/lib/validations/invoices"

export type BuilderClient = {
  id: string
  name: string
  currency: string
  paymentTermsDays: number
  defaultInvoiceNotes: string | null
}

type ManualLineDraft = {
  id: string
  description: string
  quantity: string
  unitPrice: string
  kind: "billable" | "expense"
}

function firstOfMonth(d: Date) {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10)
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function fmtDate(iso: string) {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function newId() {
  return Math.random().toString(36).slice(2, 10)
}

export function InvoiceBuilder({
  clients,
  initialClientId,
}: {
  clients: BuilderClient[]
  initialClientId?: string
}) {
  const router = useRouter()
  const [submitting, startSubmit] = useTransition()
  const [loadingPreview, startPreview] = useTransition()

  const [clientId, setClientId] = useState<string>(
    initialClientId && clients.some((c) => c.id === initialClientId)
      ? initialClientId
      : clients[0]?.id ?? "",
  )
  const today = todayISO()
  const [periodStart, setPeriodStart] = useState(firstOfMonth(new Date()))
  const [periodEnd, setPeriodEnd] = useState(today)
  const [issuedDate, setIssuedDate] = useState(today)
  const client = clients.find((c) => c.id === clientId) ?? null
  const [dueDate, setDueDate] = useState(
    addDays(today, client?.paymentTermsDays ?? 7),
  )

  const [logs, setLogs] = useState<BuilderLog[]>([])
  const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set())
  const [rateSnapshotCents, setRateSnapshotCents] = useState(0)
  const [rateEffectiveFrom, setRateEffectiveFrom] = useState<string | null>(null)

  const [manualLines, setManualLines] = useState<ManualLineDraft[]>([])
  const [discountPct, setDiscountPct] = useState("0")
  const [taxPct, setTaxPct] = useState("0")
  const [notes, setNotes] = useState(client?.defaultInvoiceNotes ?? "")
  const [markAsSent, setMarkAsSent] = useState(false)

  // Keep due date synced with client's payment terms unless user has touched it
  // (we leave that "touched" tracking as a future polish — for now it just
  // recomputes when the client changes).
  useEffect(() => {
    if (client) {
      setDueDate(addDays(issuedDate, client.paymentTermsDays))
      setNotes(client.defaultInvoiceNotes ?? "")
    }
  }, [clientId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live preview load whenever client + range change
  useEffect(() => {
    if (!clientId || !periodStart || !periodEnd) return
    startPreview(async () => {
      const result = await loadInvoiceBuilderData(clientId, periodStart, periodEnd)
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      setLogs(result.logs)
      setSelectedLogIds(new Set(result.logs.map((l) => l.id)))
      setRateSnapshotCents(result.rateSnapshotCents)
      setRateEffectiveFrom(result.rateEffectiveFrom)
    })
  }, [clientId, periodStart, periodEnd])

  const currency = client?.currency ?? "USD"

  // Totals
  const totals = useMemo(() => {
    let workLogSubtotal = 0
    for (const log of logs) {
      if (!selectedLogIds.has(log.id)) continue
      const hours = log.durationMinutes / 60
      workLogSubtotal += Math.round(hours * rateSnapshotCents)
    }
    let manualBillable = 0
    let expensesSubtotal = 0
    for (const m of manualLines) {
      const q = Number.parseFloat(m.quantity || "0")
      const unit = m.unitPrice ? toCents(m.unitPrice) : 0
      if (!Number.isFinite(q) || q <= 0) continue
      const amount = Math.round(q * unit)
      if (m.kind === "expense") expensesSubtotal += amount
      else manualBillable += amount
    }
    const subtotal = workLogSubtotal + manualBillable
    const discountPctNum = Number.parseFloat(discountPct || "0") || 0
    const taxPctNum = Number.parseFloat(taxPct || "0") || 0
    const discount = Math.round((subtotal * discountPctNum) / 100)
    const tax = Math.round(((subtotal - discount) * taxPctNum) / 100)
    const total = subtotal - discount + tax + expensesSubtotal
    return {
      subtotal,
      discount,
      tax,
      expenses: expensesSubtotal,
      total,
    }
  }, [logs, selectedLogIds, rateSnapshotCents, manualLines, discountPct, taxPct])

  function toggleLog(id: string) {
    setSelectedLogIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function toggleAll() {
    if (selectedLogIds.size === logs.length) setSelectedLogIds(new Set())
    else setSelectedLogIds(new Set(logs.map((l) => l.id)))
  }

  function addManualLine(kind: "billable" | "expense") {
    setManualLines((prev) => [
      ...prev,
      {
        id: newId(),
        description: kind === "expense" ? "Hosting / fees" : "Extra work",
        quantity: "1",
        unitPrice: "0",
        kind,
      },
    ])
  }
  function updateManualLine(id: string, patch: Partial<ManualLineDraft>) {
    setManualLines((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
  }
  function removeManualLine(id: string) {
    setManualLines((prev) => prev.filter((m) => m.id !== id))
  }

  function onSubmit(asSent: boolean) {
    if (!clientId) {
      toast.error("Pick a client")
      return
    }
    if (selectedLogIds.size === 0 && manualLines.length === 0) {
      toast.error("Select at least one work log or add a line item")
      return
    }

    const manualLineItems: ManualLineItem[] = manualLines
      .map((m): ManualLineItem | null => {
        const quantity = Number.parseFloat(m.quantity || "0")
        const unitPriceCents = m.unitPrice ? toCents(m.unitPrice) : 0
        if (!m.description.trim() || !Number.isFinite(quantity) || quantity <= 0) {
          return null
        }
        return {
          description: m.description.trim(),
          quantity,
          unitPriceCents,
          kind: m.kind,
        }
      })
      .filter((m): m is ManualLineItem => m !== null)

    startSubmit(async () => {
      const result = await generateInvoice({
        clientId,
        periodStart,
        periodEnd,
        issuedDate,
        dueDate,
        workLogIds: Array.from(selectedLogIds),
        manualLineItems,
        discountPct: Number.parseFloat(discountPct || "0") || 0,
        taxPct: Number.parseFloat(taxPct || "0") || 0,
        notes,
        markAsSent: asSent,
      })

      if (result.ok) {
        toast.success(`${result.invoiceNumber} generated`)
        router.push(`/invoices/${result.id}`)
      } else {
        toast.error(result.error)
      }
    })
  }

  const allSelected =
    logs.length > 0 && selectedLogIds.size === logs.length

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      <div className="space-y-5">
        <SectionCard title="1. Choose client + period">
          <div className="grid sm:grid-cols-4 gap-3">
            <Field label="Client" required>
              <select
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                className="input h-9 w-full text-[13px]"
                disabled={submitting}
              >
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.currency})
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Period start" required>
              <input
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="input h-9 w-full tnum text-[13px]"
                disabled={submitting}
              />
            </Field>
            <Field label="Period end" required>
              <input
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="input h-9 w-full tnum text-[13px]"
                disabled={submitting}
              />
            </Field>
            <Field label="Issue date" required>
              <input
                type="date"
                value={issuedDate}
                onChange={(e) => {
                  setIssuedDate(e.target.value)
                  if (client) setDueDate(addDays(e.target.value, client.paymentTermsDays))
                }}
                className="input h-9 w-full tnum text-[13px]"
                disabled={submitting}
              />
            </Field>
          </div>
        </SectionCard>

        <SectionCard
          title="2. Work logs"
          right={
            <div className="flex items-center gap-3 text-[12px] text-muted">
              {loadingPreview && (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> loading
                </span>
              )}
              <span>
                Rate snapshot:{" "}
                <span className="text-fg tnum font-medium">
                  {rateSnapshotCents > 0
                    ? `${formatMoney(rateSnapshotCents, currency)}/h`
                    : "—"}
                </span>
              </span>
            </div>
          }
        >
          {logs.length === 0 ? (
            <div className="px-6 py-10 text-center text-[12.5px] text-muted">
              {loadingPreview ? (
                <>Loading billable, unbilled logs…</>
              ) : (
                <>
                  No billable unbilled logs in this date range. Widen the period or
                  log some work first.
                </>
              )}
            </div>
          ) : (
            <div>
              <div
                className="grid grid-cols-[28px_92px_1fr_64px_100px] text-[10.5px] uppercase tracking-wider text-subtle font-medium px-3 py-2"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <div>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className={"cb " + (allSelected ? "checked" : "")}
                    aria-label="Toggle all"
                  >
                    {allSelected && <Icons.Check size={11} style={{ color: "white" }} />}
                  </button>
                </div>
                <div>Date</div>
                <div>Title</div>
                <div className="text-right">Hours</div>
                <div className="text-right">Amount</div>
              </div>
              {logs.map((log) => {
                const checked = selectedLogIds.has(log.id)
                const hours = log.durationMinutes / 60
                const amount = Math.round(hours * rateSnapshotCents)
                return (
                  <div
                    key={log.id}
                    className="grid grid-cols-[28px_92px_1fr_64px_100px] items-center px-3 py-2.5 text-[13px] row-hover"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <button
                      type="button"
                      onClick={() => toggleLog(log.id)}
                      className={"cb " + (checked ? "checked" : "")}
                    >
                      {checked && <Icons.Check size={11} style={{ color: "white" }} />}
                    </button>
                    <div className="text-muted tnum text-[12.5px]">
                      {fmtDate(log.workDate)}
                    </div>
                    <div className="truncate">{log.title}</div>
                    <div className="text-right tnum">{hours.toFixed(2)}h</div>
                    <div
                      className="text-right tnum font-medium"
                      style={{ opacity: checked ? 1 : 0.4 }}
                    >
                      {formatMoney(amount, currency)}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="3. Adjustments + manual lines"
          right={
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className="btn btn-ghost h-7 text-[11.5px]"
                onClick={() => addManualLine("billable")}
              >
                <Icons.Plus size={11} /> Line item
              </button>
              <button
                type="button"
                className="btn btn-ghost h-7 text-[11.5px]"
                onClick={() => addManualLine("expense")}
              >
                <Icons.Plus size={11} /> Expense
              </button>
            </div>
          }
        >
          <div className="space-y-3">
            {manualLines.length === 0 && (
              <div className="text-[12.5px] text-subtle px-3 py-2">
                No manual lines. Add billable extras (e.g. hosting setup) or pass-through
                expenses (e.g. domain renewal).
              </div>
            )}
            {manualLines.map((line) => (
              <div
                key={line.id}
                className="grid grid-cols-[80px_1fr_64px_100px_28px] items-center gap-2 px-3"
              >
                <span
                  className="text-[10px] uppercase tracking-wider font-semibold text-center px-1.5 py-1 rounded"
                  style={{
                    background:
                      line.kind === "expense" ? "var(--surface-2)" : "var(--accent-soft)",
                    color: line.kind === "expense" ? "var(--fg-muted)" : "rgb(var(--accent))",
                  }}
                >
                  {line.kind === "expense" ? "Expense" : "Billable"}
                </span>
                <input
                  type="text"
                  value={line.description}
                  onChange={(e) =>
                    updateManualLine(line.id, { description: e.target.value })
                  }
                  className="input h-9 text-[13px]"
                  placeholder="Description"
                />
                <input
                  type="number"
                  step="0.25"
                  min="0"
                  value={line.quantity}
                  onChange={(e) => updateManualLine(line.id, { quantity: e.target.value })}
                  className="input h-9 tnum text-right text-[13px]"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={line.unitPrice}
                  onChange={(e) => updateManualLine(line.id, { unitPrice: e.target.value })}
                  className="input h-9 tnum text-right text-[13px]"
                  placeholder="Unit price"
                />
                <button
                  type="button"
                  onClick={() => removeManualLine(line.id)}
                  className="w-7 h-7 rounded-md hover:bg-surface-2 flex items-center justify-center text-subtle"
                  aria-label="Remove line"
                >
                  <Icons.X size={13} />
                </button>
              </div>
            ))}
          </div>

          <div
            className="grid sm:grid-cols-2 gap-3 mt-5 pt-5"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <Field label="Discount %">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
                className="input h-9 w-full tnum text-[13px]"
                disabled={submitting}
              />
            </Field>
            <Field label="Tax %">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={taxPct}
                onChange={(e) => setTaxPct(e.target.value)}
                className="input h-9 w-full tnum text-[13px]"
                disabled={submitting}
              />
            </Field>
            <Field label="Due date" required>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="input h-9 w-full tnum text-[13px]"
                disabled={submitting}
              />
            </Field>
            <Field label="Notes (visible on invoice)">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional"
                className="input h-9 w-full text-[13px]"
                disabled={submitting}
              />
            </Field>
          </div>
        </SectionCard>
      </div>

      <aside className="lg:sticky lg:top-20 h-fit">
        <div className="card p-5 anim-slide-up">
          <div className="text-[10.5px] uppercase tracking-wider text-subtle font-medium">
            Preview
          </div>
          <div className="text-[20px] font-semibold mt-1">
            New invoice
          </div>
          <div className="text-[12px] text-muted mt-0.5">
            Will be assigned the next number when you save.
          </div>

          <div
            className="mt-4 pt-4 space-y-2 text-[13px]"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <KV
              label="Client"
              value={client?.name ?? "—"}
            />
            <KV
              label="Period"
              value={`${fmtDate(periodStart)} – ${fmtDate(periodEnd)}`}
            />
            <KV label="Issued" value={fmtDate(issuedDate)} />
            <KV label="Due" value={fmtDate(dueDate)} />
            <KV
              label="Rate snapshot"
              value={
                rateSnapshotCents > 0
                  ? `${formatMoney(rateSnapshotCents, currency)}/h`
                  : "—"
              }
            />
            {rateEffectiveFrom && (
              <div className="text-[10.5px] text-subtle">
                Effective from {fmtDate(rateEffectiveFrom)}
              </div>
            )}
          </div>

          <div
            className="mt-4 pt-4 space-y-2 text-[13px]"
            style={{ borderTop: "1px solid var(--border)" }}
          >
            <Total
              label="Subtotal"
              value={formatMoney(totals.subtotal, currency)}
            />
            {totals.discount > 0 && (
              <Total
                label={`Discount (${discountPct || 0}%)`}
                value={"−" + formatMoney(totals.discount, currency)}
                muted
              />
            )}
            {totals.tax > 0 && (
              <Total
                label={`Tax (${taxPct || 0}%)`}
                value={"+" + formatMoney(totals.tax, currency)}
                muted
              />
            )}
            {totals.expenses > 0 && (
              <Total
                label="Expenses"
                value={"+" + formatMoney(totals.expenses, currency)}
                muted
              />
            )}
            <div
              className="flex items-center justify-between pt-2 mt-2"
              style={{ borderTop: "1px solid var(--border)" }}
            >
              <span className="text-[12.5px] uppercase tracking-wider text-subtle font-medium">
                Total
              </span>
              <span className="text-[18px] font-semibold tnum">
                {formatMoney(totals.total, currency)}
              </span>
            </div>
          </div>

          <label className="flex items-center gap-2 mt-4 text-[12.5px] cursor-pointer">
            <input
              type="checkbox"
              checked={markAsSent}
              onChange={(e) => setMarkAsSent(e.target.checked)}
              className="cb"
              disabled={submitting}
            />
            Mark as sent immediately
          </label>

          <div className="flex flex-col gap-2 mt-4">
            <button
              type="button"
              onClick={() => onSubmit(markAsSent)}
              disabled={submitting || totals.total <= 0}
              className="btn btn-primary justify-center"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {markAsSent ? (
                <>
                  <Icons.Zap size={13} /> Generate &amp; send
                </>
              ) : (
                <>
                  <Icons.Zap size={13} /> Generate draft
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              className="btn btn-ghost justify-center"
              disabled={submitting}
            >
              Cancel
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}

function SectionCard({
  title,
  right,
  children,
}: {
  title: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="card overflow-hidden anim-slide-up">
      <div
        className="px-5 py-3 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="text-[12.5px] uppercase tracking-wider text-subtle font-medium">
          {title}
        </div>
        {right}
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-[11.5px] uppercase tracking-wider text-subtle font-medium block mb-1.5">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  )
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11.5px] uppercase tracking-wider text-subtle font-medium">
        {label}
      </span>
      <span className="text-fg truncate text-right">{value}</span>
    </div>
  )
}

function Total({
  label,
  value,
  muted,
}: {
  label: string
  value: string
  muted?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={"text-[12.5px] " + (muted ? "text-muted" : "text-fg")}>{label}</span>
      <span className={"tnum " + (muted ? "text-muted" : "text-fg font-medium")}>
        {value}
      </span>
    </div>
  )
}
