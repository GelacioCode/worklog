import type { LucideIcon } from "lucide-react"

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon
  title: string
  body?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={"card flex flex-col items-center text-center px-6 py-16 anim-fade " + (className ?? "")}>
      <div className="w-14 h-14 rounded-full bg-surface-2 flex items-center justify-center mb-4">
        <Icon size={22} className="text-subtle" />
      </div>
      <div className="text-[15px] font-medium mb-1">{title}</div>
      {body && <div className="text-[13px] text-muted max-w-sm">{body}</div>}
      {action && <div className="mt-5 flex items-center gap-2">{action}</div>}
    </div>
  )
}
