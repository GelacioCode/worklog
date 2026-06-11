"use client"

import { useEffect, useRef, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import { Icons } from "@/components/design/icons"
import { quickAddWorkLog } from "@/server/actions/work-logs"

const TODAY = new Date().toISOString().slice(0, 10)

export type ClientLite = {
  id: string
  name: string
  currency: string
  hourlyRateCents: number | null
}

export function QuickAddBar({ clients }: { clients: ClientLite[] }) {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [hours, setHours] = useState("")
  const [date, setDate] = useState(TODAY)
  const [billable, setBillable] = useState(true)
  const [focused, setFocused] = useState(false)
  const [clientId, setClientId] = useState<string>(clients[0]?.id ?? "")
  const [isPending, startTransition] = useTransition()
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!clientId && clients[0]) setClientId(clients[0].id)
  }, [clientId, clients])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (
        e.key === "n" &&
        !e.metaKey &&
        !e.ctrlKey &&
        !e.altKey &&
        tag !== "INPUT" &&
        tag !== "TEXTAREA" &&
        tag !== "SELECT"
      ) {
        e.preventDefault()
        titleRef.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const hoursNum = Number(hours)
    if (!clientId || !title.trim() || !Number.isFinite(hoursNum) || hoursNum <= 0) return

    const titleSnapshot = title.trim()
    const hoursSnapshot = hoursNum
    const clientName = clients.find((c) => c.id === clientId)?.name ?? ""

    startTransition(async () => {
      const result = await quickAddWorkLog({
        clientId,
        title: titleSnapshot,
        workDate: date,
        hours: hoursSnapshot,
        billable,
        tag: "",
      })

      if (result.ok) {
        toast.success(`Logged ${hoursSnapshot.toFixed(1)}h`, {
          description: `${clientName} · ${titleSnapshot}`,
        })
        // Keep client + date, clear title + hours so next entry is fast
        setTitle("")
        setHours("")
        setTimeout(() => titleRef.current?.focus(), 50)
        router.refresh()
      } else {
        toast.error(result.error)
      }
    })
  }

  const canSubmit = clientId && title.trim().length > 0 && Number(hours) > 0
  const hasClients = clients.length > 0

  return (
    <form
      onSubmit={onSubmit}
      className={"sticky top-14 z-20 mb-5 transition " + (focused ? "glow" : "")}
      style={{
        background: "var(--surface)",
        border: "1px solid " + (focused ? "rgb(var(--accent))" : "var(--border)"),
        borderRadius: 12,
        padding: 8,
        display: "flex",
        alignItems: "center",
        gap: 8,
        boxShadow: focused
          ? "0 0 0 4px rgb(var(--accent) / .1), 0 8px 24px rgb(15 15 14 / .08)"
          : "var(--shadow-sm)",
        transition: "box-shadow .25s, border-color .15s",
        overflowX: "auto",
      }}
    >
      <div
        className="flex items-center gap-2 pl-1 pr-2 self-stretch"
        style={{ borderRight: "1px solid var(--border)" }}
      >
        <div className="w-7 h-7 rounded-md accent-bg text-white flex items-center justify-center">
          <Icons.Plus size={14} />
        </div>
      </div>

      {hasClients ? (
        <div className="relative flex items-center">
          <span
            className="client-dot absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
            style={{ background: "rgb(var(--accent))" }}
          />
          <select
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="input h-9 pl-6 pr-7 min-w-[170px] text-[13px] appearance-none"
            disabled={isPending}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <Icons.ChevronDown
            size={13}
            className="text-subtle absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none"
          />
        </div>
      ) : (
        <Link
          href="/clients"
          className="input h-9 flex items-center gap-2 pr-2 min-w-[170px] text-left hover:bg-surface-2"
          title="Add a client to enable quick-add"
        >
          <Icons.Plus size={13} className="text-subtle" />
          <span className="flex-1 truncate text-[13px] text-subtle">Add a client first</span>
        </Link>
      )}

      <div className="flex-1 relative min-w-[200px]">
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={hasClients ? "What did you work on?" : "Add a client to start logging"}
          className="w-full bg-transparent outline-none px-2 py-2 text-[14px] placeholder:text-subtle"
          disabled={!hasClients || isPending}
        />
        {!title && !focused && hasClients && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
            <span className="kbd">N</span>
          </div>
        )}
      </div>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="input h-9 w-[140px] tnum text-[12.5px]"
        disabled={!hasClients || isPending}
      />

      <div className="relative">
        <input
          type="number"
          step="0.25"
          min="0"
          value={hours}
          onChange={(e) => setHours(e.target.value)}
          placeholder="0.0"
          className="input h-9 w-[78px] tnum text-right pr-8"
          disabled={!hasClients || isPending}
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] text-subtle pointer-events-none">
          h
        </span>
      </div>

      <button
        type="button"
        onClick={() => setBillable((b) => !b)}
        className="h-9 px-2.5 rounded-md text-[12px] font-medium flex items-center gap-1.5 transition"
        style={{
          background: billable ? "var(--accent-soft)" : "var(--surface-2)",
          color: billable ? "rgb(var(--accent))" : "var(--fg-muted)",
        }}
        disabled={!hasClients || isPending}
      >
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: billable ? "rgb(var(--accent))" : "var(--fg-subtle)" }}
        />
        Billable
      </button>

      <button
        type="submit"
        disabled={!canSubmit || isPending}
        className="btn btn-primary h-9 px-3.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icons.Plus size={13} />}
        <span>{isPending ? "Adding" : "Log"}</span>
        {!isPending && (
          <span
            className="kbd ml-1"
            style={{
              background: "rgb(255 255 255 / .12)",
              borderColor: "rgb(255 255 255 / .2)",
              color: "rgb(255 255 255 / .8)",
            }}
          >
            ↵
          </span>
        )}
      </button>
    </form>
  )
}
