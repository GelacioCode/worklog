"use client"

import { useState } from "react"
import { ViewToggle } from "@/components/design/view-toggle"
import { Icons } from "@/components/design/icons"
import { FilterBar } from "./filter-bar"
import { WorkLogTable } from "./work-log-table"
import { CalendarView } from "./calendar-view"
import { BoardView } from "./board-view"
import type { WorkLogWithClient } from "@/lib/db/queries/work-logs"
import type { ClientLite } from "./quick-add-bar"

type View = "list" | "calendar" | "board"

const OPTIONS = [
  { value: "list", label: "List", icon: Icons.List },
  { value: "calendar", label: "Calendar", icon: Icons.Calendar },
  { value: "board", label: "Board", icon: Icons.Dashboard },
] satisfies Array<{
  value: View
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}>

export function WorkLogsViewSwitcher({
  logs,
  clients,
  countsByStatus,
}: {
  logs: WorkLogWithClient[]
  clients: ClientLite[]
  countsByStatus: { unbilled: number; billed: number; paid: number }
}) {
  const [view, setView] = useState<View>("list")

  return (
    <>
      <div className="flex items-center justify-end mb-4">
        <ViewToggle<View> value={view} onChange={setView} options={OPTIONS} />
      </div>

      {view === "list" && (
        <>
          <FilterBar count={logs.length} countsByStatus={countsByStatus} />
          <WorkLogTable logs={logs} clients={clients} />
        </>
      )}
      {view === "calendar" && <CalendarView logs={logs} clients={clients} />}
      {view === "board" && <BoardView logs={logs} clients={clients} />}
    </>
  )
}
