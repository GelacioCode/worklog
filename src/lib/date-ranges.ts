// Date-range presets shared between the picker and report queries.

export type RangePresetId =
  | "last-30"
  | "this-month"
  | "last-month"
  | "this-year"
  | "last-12"
  | "all-time"
  | "custom"

export type Range = { from: string; to: string }

const ALL_TIME_FROM = "2000-01-01"

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function rangeFor(preset: RangePresetId, today: Date = new Date()): Range {
  const t = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
  )
  const to = iso(t)

  switch (preset) {
    case "last-30": {
      const from = new Date(t)
      from.setUTCDate(t.getUTCDate() - 29)
      return { from: iso(from), to }
    }
    case "this-month": {
      const from = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1))
      return { from: iso(from), to }
    }
    case "last-month": {
      const from = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1))
      const end = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0))
      return { from: iso(from), to: iso(end) }
    }
    case "this-year": {
      const from = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
      return { from: iso(from), to }
    }
    case "last-12": {
      const from = new Date(t)
      from.setUTCMonth(t.getUTCMonth() - 11)
      from.setUTCDate(1)
      return { from: iso(from), to }
    }
    case "all-time":
      return { from: ALL_TIME_FROM, to }
    case "custom":
      return { from: iso(t), to } // caller overrides
  }
}

export const PRESET_LABELS: Record<Exclude<RangePresetId, "custom">, string> = {
  "last-30": "Last 30 days",
  "this-month": "This month",
  "last-month": "Last month",
  "this-year": "This year",
  "last-12": "Last 12 months",
  "all-time": "All time",
}

export const DEFAULT_PRESET: RangePresetId = "this-year"
