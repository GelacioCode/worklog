"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

export type ViewToggleOption<T extends string> = {
  value: T
  label: string
  icon: React.ComponentType<{ size?: number; className?: string }>
}

export function ViewToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (next: T) => void
  options: ViewToggleOption<T>[]
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; width: number }>({ left: 3, width: 0 })

  useEffect(() => {
    const el = containerRef.current?.querySelector<HTMLButtonElement>(
      `[data-view="${value}"]`,
    )
    if (el) setPos({ left: el.offsetLeft, width: el.offsetWidth })
  }, [value])

  return (
    <div ref={containerRef} className="view-toggle nosel">
      <div className="pill-slider" style={{ left: pos.left, width: pos.width }} />
      {options.map(({ value: v, label, icon: Icon }) => (
        <button
          key={v}
          type="button"
          data-view={v}
          onClick={() => onChange(v)}
          className={cn(value === v && "active")}
        >
          <Icon size={13} />
          {label}
        </button>
      ))}
    </div>
  )
}
