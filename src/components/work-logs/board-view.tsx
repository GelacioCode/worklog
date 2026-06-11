"use client"

import { useMemo, useState } from "react"
import { Icons } from "@/components/design/icons"
import { StatusPill, type PillStatus } from "@/components/design/status-pill"
import { colorFor } from "@/lib/colors"
import type { WorkLogWithClient } from "@/lib/db/queries/work-logs"
import type { ClientLite } from "./quick-add-bar"
import { WorkLogEditSheet } from "./work-log-edit-sheet"

const COLS: PillStatus[] = ["unbilled", "billed", "paid"]

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function BoardView({
  logs,
  clients,
}: {
  logs: WorkLogWithClient[]
  clients: ClientLite[]
}) {
  const [editing, setEditing] = useState<WorkLogWithClient | null>(null)

  const byStatus = useMemo(() => {
    const m: Record<PillStatus, WorkLogWithClient[]> = {
      unbilled: [],
      billed: [],
      paid: [],
      draft: [],
      sent: [],
      partial: [],
      overdue: [],
      cancelled: [],
    }
    for (const log of logs) {
      m[log.invoiceStatus].push(log)
    }
    return m
  }, [logs])

  return (
    <>
      <div className="grid md:grid-cols-3 gap-4 stagger">
        {COLS.map((col) => {
          const items = byStatus[col]
          const totalHours = items.reduce((s, l) => s + l.durationMinutes, 0) / 60
          return (
            <div key={col} className="card p-3 min-h-[280px] flex flex-col">
              <div className="flex items-center justify-between px-1 mb-3">
                <div className="flex items-center gap-2">
                  <StatusPill status={col} />
                  <span className="text-[12px] text-muted tnum">{items.length}</span>
                </div>
                <span className="text-[11.5px] text-muted tnum">{totalHours.toFixed(1)}h</span>
              </div>

              {items.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center text-[12px] text-subtle px-4">
                  <Icons.Inbox size={18} className="mb-2" />
                  <span>Nothing here yet.</span>
                </div>
              ) : (
                <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1 stagger">
                  {items.slice(0, 30).map((log) => (
                    <button
                      key={log.id}
                      type="button"
                      onClick={() => setEditing(log)}
                      className="w-full text-left rounded-lg p-3 transition row-hover"
                      style={{
                        background: "var(--surface)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="client-dot"
                            style={{ background: colorFor(log.clientId) }}
                          />
                          <span className="text-[11.5px] text-muted truncate">
                            {log.clientName}
                          </span>
                        </div>
                        <span className="text-[10.5px] text-subtle tnum shrink-0">
                          {fmtDate(log.workDate)}
                        </span>
                      </div>
                      <div className="text-[13px] font-medium leading-snug mb-2">
                        {log.title}
                      </div>
                      <div className="flex items-center justify-between">
                        {log.tag && (
                          <span className="text-[10.5px] capitalize px-1.5 py-0.5 rounded bg-surface-2 text-muted">
                            {log.tag}
                          </span>
                        )}
                        <span className="text-[12px] font-medium tnum ml-auto">
                          {(log.durationMinutes / 60).toFixed(1)}h
                        </span>
                      </div>
                    </button>
                  ))}
                  {items.length > 30 && (
                    <div className="text-center text-[11px] text-subtle py-2">
                      …{items.length - 30} more
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <WorkLogEditSheet log={editing} clients={clients} onClose={() => setEditing(null)} />
    </>
  )
}
