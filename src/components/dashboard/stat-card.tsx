import type { LucideIcon } from "lucide-react"

export function StatCard({
  label,
  value,
  delta,
  hint,
  icon: Icon,
  accent,
}: {
  label: string
  value: string
  delta?: { value: string; direction: "up" | "down" | "flat" }
  hint?: string
  icon?: LucideIcon
  accent?: boolean
}) {
  return (
    <div className="card p-4 anim-slide-up">
      <div className="flex items-start justify-between mb-3">
        <div className="text-[11.5px] uppercase tracking-wider text-subtle font-medium">
          {label}
        </div>
        {Icon && (
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{
              background: accent ? "var(--accent-soft)" : "var(--surface-2)",
              color: accent ? "rgb(var(--accent))" : "var(--fg-muted)",
            }}
          >
            <Icon size={14} />
          </div>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <div className="text-[26px] font-semibold tracking-tight tnum count-up">{value}</div>
        {delta && (
          <span
            className="text-[12px] font-medium tnum"
            style={{
              color:
                delta.direction === "up"
                  ? "#10b981"
                  : delta.direction === "down"
                    ? "#ef4444"
                    : "var(--fg-subtle)",
            }}
          >
            {delta.direction === "up" ? "↑" : delta.direction === "down" ? "↓" : "·"}{" "}
            {delta.value}
          </span>
        )}
      </div>
      {hint && <div className="text-[12px] text-subtle mt-1">{hint}</div>}
    </div>
  )
}
