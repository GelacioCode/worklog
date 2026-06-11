"use client"

import { useMemo, useState } from "react"
import { Icons } from "@/components/design/icons"
import { colorFor } from "@/lib/colors"
import type { WorkLogWithClient } from "@/lib/db/queries/work-logs"
import type { ClientLite } from "./quick-add-bar"
import { WorkLogEditSheet } from "./work-log-edit-sheet"

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
const HOUR_TICKS = ["9a", "12a", "3p", "6p"] // visual rail in the day panel

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function startOfMonthGrid(year: number, month: number) {
  // month is 1-12
  const first = new Date(Date.UTC(year, month - 1, 1))
  const dayOfWeek = first.getUTCDay() // 0 = Sun
  const gridStart = new Date(first)
  gridStart.setUTCDate(first.getUTCDate() - dayOfWeek)
  return gridStart
}

function isSameMonth(d: Date, year: number, month: number) {
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1
}

export function CalendarView({
  logs,
  clients,
}: {
  logs: WorkLogWithClient[]
  clients: ClientLite[]
}) {
  const today = new Date()
  const [cursor, setCursor] = useState({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1, // 1-12
  })
  const [selectedDate, setSelectedDate] = useState(ymd(today))
  const [editing, setEditing] = useState<WorkLogWithClient | null>(null)

  // Group logs by date
  const byDate = useMemo(() => {
    const m = new Map<string, WorkLogWithClient[]>()
    for (const log of logs) {
      const arr = m.get(log.workDate) ?? []
      arr.push(log)
      m.set(log.workDate, arr)
    }
    return m
  }, [logs])

  // Build 42 days (6 weeks) starting from previous Sunday of month-start
  const days = useMemo(() => {
    const start = startOfMonthGrid(cursor.year, cursor.month)
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start)
      d.setUTCDate(start.getUTCDate() + i)
      return d
    })
  }, [cursor])

  // Stats for the entire calendar month
  const monthStats = useMemo(() => {
    let totalMinutes = 0
    let taskCount = 0
    for (const log of logs) {
      const d = new Date(log.workDate + "T00:00:00Z")
      if (isSameMonth(d, cursor.year, cursor.month)) {
        totalMinutes += log.durationMinutes
        taskCount += 1
      }
    }
    return { hours: totalMinutes / 60, count: taskCount }
  }, [logs, cursor])

  const selectedLogs = byDate.get(selectedDate) ?? []
  const selectedDateObj = new Date(selectedDate + "T00:00:00Z")
  const selectedHours = selectedLogs.reduce((s, l) => s + l.durationMinutes, 0) / 60
  const selectedBillable =
    selectedLogs.reduce((s, l) => s + (l.billable ? l.durationMinutes : 0), 0) / 60

  // Cap density bar at 8h for a clean visual.
  function densityWidth(minutes: number) {
    return Math.min(100, Math.round((minutes / 60 / 8) * 100))
  }

  function shift(delta: number) {
    let m = cursor.month + delta
    let y = cursor.year
    if (m < 1) {
      m = 12
      y -= 1
    } else if (m > 12) {
      m = 1
      y += 1
    }
    setCursor({ year: y, month: m })
  }

  const monthLabel = new Date(Date.UTC(cursor.year, cursor.month - 1, 1)).toLocaleDateString(
    "en-US",
    { month: "long", year: "numeric" },
  )

  return (
    <>
      <div className="grid lg:grid-cols-[1fr_360px] gap-4">
        <div className="card overflow-hidden anim-slide-up">
          <div
            className="flex items-center justify-between px-5 py-3"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <div>
              <div className="text-[15px] font-semibold tnum">{monthLabel}</div>
              <div className="text-[11.5px] text-subtle tnum">
                {monthStats.hours.toFixed(1)}h logged · {monthStats.count} tasks
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="btn btn-ghost w-8 h-8 px-0 justify-center"
                onClick={() => shift(-1)}
                type="button"
                aria-label="Previous month"
              >
                <Icons.ChevronLeft size={14} />
              </button>
              <button
                className="btn btn-ghost h-8 px-3 text-[12px]"
                onClick={() => {
                  const now = new Date()
                  setCursor({ year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 })
                  setSelectedDate(ymd(now))
                }}
                type="button"
              >
                Today
              </button>
              <button
                className="btn btn-ghost w-8 h-8 px-0 justify-center"
                onClick={() => shift(1)}
                type="button"
                aria-label="Next month"
              >
                <Icons.Chevron size={14} />
              </button>
            </div>
          </div>

          <div
            className="grid grid-cols-7 text-[10.5px] uppercase tracking-wider text-subtle font-medium"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            {WEEKDAYS.map((d) => (
              <div key={d} className="px-3 py-2 text-center">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((d, i) => {
              const key = ymd(d)
              const inMonth = isSameMonth(d, cursor.year, cursor.month)
              const dayLogs = byDate.get(key) ?? []
              const minutes = dayLogs.reduce((s, l) => s + l.durationMinutes, 0)
              const isToday = key === ymd(today)
              const isSelected = key === selectedDate

              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setSelectedDate(key)
                    if (!inMonth) {
                      setCursor({
                        year: d.getUTCFullYear(),
                        month: d.getUTCMonth() + 1,
                      })
                    }
                  }}
                  className={
                    "cal-day text-left p-2 min-h-[88px] flex flex-col gap-1 transition " +
                    (isSelected ? "bg-surface-2" : "")
                  }
                  style={{
                    borderRight: (i + 1) % 7 === 0 ? "none" : "1px solid var(--border)",
                    borderBottom: i < 35 ? "1px solid var(--border)" : "none",
                    opacity: inMonth ? 1 : 0.45,
                  }}
                >
                  <div className="flex items-baseline justify-between">
                    <span
                      className={
                        "text-[11px] tnum " +
                        (isToday ? "accent-text font-semibold" : "text-muted")
                      }
                    >
                      {d.getUTCDate()}
                    </span>
                    {minutes > 0 && (
                      <span className="text-[10.5px] text-subtle tnum">
                        {(minutes / 60).toFixed(1)}h
                      </span>
                    )}
                  </div>
                  {minutes > 0 && (
                    <div
                      className="h-1 rounded-full bar-grow"
                      style={{
                        width: `${densityWidth(minutes)}%`,
                        background: "rgb(var(--accent) / 0.6)",
                      }}
                    />
                  )}
                  <div className="flex flex-col gap-0.5 mt-auto">
                    {dayLogs.slice(0, 2).map((log) => (
                      <span
                        key={log.id}
                        className="cal-task truncate"
                        style={{
                          background: "var(--surface-2)",
                          color: "var(--fg)",
                        }}
                      >
                        <span
                          className="client-dot shrink-0"
                          style={{ background: colorFor(log.clientId) }}
                        />
                        <span className="truncate">{log.title}</span>
                      </span>
                    ))}
                    {dayLogs.length > 2 && (
                      <span className="text-[10px] text-subtle">+{dayLogs.length - 2} more</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="card p-5 anim-slide-up h-fit">
          <div className="text-[10.5px] uppercase tracking-wider text-subtle font-medium">
            {selectedDateObj.toLocaleDateString("en-US", { weekday: "long" })}
          </div>
          <div className="flex items-baseline justify-between mt-1">
            <div className="text-[20px] font-semibold">
              {selectedDateObj.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
              })}
            </div>
            <div className="text-right">
              <div className="text-[18px] font-semibold tnum">
                {selectedHours.toFixed(1)} h
              </div>
              <div className="text-[11px] text-subtle tnum">
                {selectedBillable.toFixed(1)} billable
              </div>
            </div>
          </div>

          <div
            className="grid grid-cols-4 gap-0 mt-4 mb-2 text-[10.5px] text-subtle"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            {HOUR_TICKS.map((t) => (
              <div key={t} className="px-1 py-1">
                {t}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {selectedLogs.length === 0 ? (
              <div
                className="h-32 rounded-lg flex flex-col items-center justify-center gap-1.5"
                style={{ background: "var(--surface-2)", border: "1px dashed var(--border)" }}
              >
                <Icons.Clock size={18} className="text-subtle" />
                <div className="text-[12px] text-muted">No tasks this day</div>
              </div>
            ) : (
              selectedLogs.map((log) => (
                <button
                  key={log.id}
                  type="button"
                  onClick={() => setEditing(log)}
                  className="w-full text-left rounded-lg p-3 row-hover transition"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
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
                    <span className="text-[12px] font-medium tnum shrink-0">
                      {(log.durationMinutes / 60).toFixed(1)}h
                    </span>
                  </div>
                  <div className="text-[13px] font-medium leading-snug">{log.title}</div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      <WorkLogEditSheet log={editing} clients={clients} onClose={() => setEditing(null)} />
    </>
  )
}
