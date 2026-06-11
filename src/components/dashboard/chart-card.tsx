import type { LucideIcon } from "lucide-react"

export function ChartCard({
  title,
  subtitle,
  icon: Icon,
  empty,
  emptyHint,
  children,
}: {
  title: string
  subtitle?: string
  icon: LucideIcon
  empty?: boolean
  emptyHint?: string
  children: React.ReactNode
}) {
  return (
    <div className="card p-5 anim-slide-up">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-[13px] font-medium">{title}</div>
          {subtitle && <div className="text-[11.5px] text-subtle mt-0.5">{subtitle}</div>}
        </div>
        <div className="w-7 h-7 rounded-lg bg-surface-2 flex items-center justify-center text-muted">
          <Icon size={13} />
        </div>
      </div>
      {empty ? (
        <div
          className="h-44 rounded-lg flex flex-col items-center justify-center gap-2 text-center"
          style={{ background: "var(--surface-2)", border: "1px dashed var(--border)" }}
        >
          <Icon size={20} className="text-subtle" />
          <div className="text-[12px] text-muted">No data yet</div>
          {emptyHint && <div className="text-[11px] text-subtle">{emptyHint}</div>}
        </div>
      ) : (
        children
      )}
    </div>
  )
}
