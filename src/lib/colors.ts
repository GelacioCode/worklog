// Deterministic color for a stable string (e.g. client ID).
// Gives each client a consistent dot color without persisting it.

const PALETTE = [
  "#8a5cf6", // violet
  "#10b981", // emerald
  "#f59e0b", // amber
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#3b82f6", // blue
  "#f97316", // orange
  "#22c55e", // green
  "#a855f7", // purple
  "#14b8a6", // teal
] as const

function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return h >>> 0
}

export function colorFor(seed: string): string {
  return PALETTE[hash(seed) % PALETTE.length]
}

// Short code: first two letters uppercased of the seed, useful for "ACM" etc.
export function shortFor(name: string): string {
  return name
    .replace(/[^a-z0-9 ]/gi, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 3)
}
