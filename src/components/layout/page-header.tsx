export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
}: {
  title: string
  subtitle?: string
  eyebrow?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 xl:gap-6 mb-6">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-[11px] uppercase tracking-[0.08em] text-subtle font-medium mb-1.5">
            {eyebrow}
          </div>
        )}
        <h1 className="text-[22px] font-semibold tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-[13.5px] text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0 flex-wrap">{actions}</div>
      )}
    </div>
  )
}
