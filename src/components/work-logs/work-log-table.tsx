"use client"

import { useState } from "react"
import { Icons } from "@/components/design/icons"
import { StatusPill } from "@/components/design/status-pill"
import { colorFor } from "@/lib/colors"
import type { WorkLogWithClient } from "@/lib/db/queries/work-logs"
import type { ClientLite } from "./quick-add-bar"
import { WorkLogEditSheet } from "./work-log-edit-sheet"

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

export function WorkLogTable({
  logs,
  clients,
}: {
  logs: WorkLogWithClient[]
  clients: ClientLite[]
}) {
  const [editing, setEditing] = useState<WorkLogWithClient | null>(null)

  if (logs.length === 0) {
    return (
      <div className="card overflow-x-auto">
        <div
          className="min-w-[640px] grid grid-cols-[28px_92px_1fr_140px_64px_80px_92px_28px] text-[11px] uppercase tracking-wider text-subtle font-medium px-3 py-2.5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div />
          <div>Date</div>
          <div>Title</div>
          <div>Client</div>
          <div className="text-right">Hours</div>
          <div>Tag</div>
          <div>Status</div>
          <div />
        </div>
        <div className="px-6 py-16 text-center anim-fade">
          <div className="w-12 h-12 rounded-full bg-surface-2 mx-auto flex items-center justify-center mb-3">
            <Icons.Inbox size={20} className="text-subtle" />
          </div>
          <div className="text-[14px] font-medium mb-1">No logs match these filters</div>
          <div className="text-[12.5px] text-muted">
            Press <span className="kbd">N</span> to add a task or change the status tab.
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="card overflow-x-auto">
        <div
          className="min-w-[640px] grid grid-cols-[28px_92px_1fr_140px_64px_80px_92px_28px] text-[11px] uppercase tracking-wider text-subtle font-medium px-3 py-2.5"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <div />
          <div>Date</div>
          <div>Title</div>
          <div>Client</div>
          <div className="text-right">Hours</div>
          <div>Tag</div>
          <div>Status</div>
          <div />
        </div>
        <div>
          {logs.map((log, i) => {
            const color = colorFor(log.clientId)
            return (
              <button
                key={log.id}
                type="button"
                onClick={() => setEditing(log)}
                className="w-full min-w-[640px] text-left grid grid-cols-[28px_92px_1fr_140px_64px_80px_92px_28px] items-center px-3 py-2.5 text-[13px] row-hover group"
                style={{
                  borderBottom: "1px solid var(--border)",
                  animation: "slideUp .4s var(--ease-out) both",
                  animationDelay: Math.min(i, 10) * 28 + "ms",
                }}
              >
                <div className="text-subtle">
                  <Icons.Drag size={14} className="opacity-0 group-hover:opacity-100 transition" />
                </div>
                <div className="text-muted tnum text-[12.5px]">{fmtDate(log.workDate)}</div>
                <div className="min-w-0 flex items-center gap-2">
                  <span className="truncate">{log.title}</span>
                  {!log.billable && (
                    <span className="text-[10px] uppercase tracking-wider text-subtle">
                      non-bill
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 min-w-0">
                  <span className="client-dot" style={{ background: color }} />
                  <span className="truncate text-muted text-[12.5px]">{log.clientName}</span>
                </div>
                <div className="text-right tnum font-medium">
                  {(log.durationMinutes / 60).toFixed(1)}h
                </div>
                <div className="text-[11.5px] capitalize text-muted truncate">
                  {log.tag ?? "—"}
                </div>
                <div>
                  <StatusPill status={log.invoiceStatus} />
                </div>
                <div className="opacity-0 group-hover:opacity-100 transition text-subtle">
                  <Icons.More size={14} />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <WorkLogEditSheet log={editing} clients={clients} onClose={() => setEditing(null)} />
    </>
  )
}
