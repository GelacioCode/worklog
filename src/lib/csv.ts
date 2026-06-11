// Tiny CSV serializer. No deps — we don't need quoting edge cases beyond
// commas, newlines, and double quotes (RFC 4180).

export type CsvColumn<T> = {
  header: string
  // Returns a stringified cell. Empty string is fine for missing values.
  value: (row: T) => string | number | null | undefined
}

function escape(cell: string | number | null | undefined): string {
  if (cell === null || cell === undefined) return ""
  const s = String(cell)
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const lines: string[] = [columns.map((c) => escape(c.header)).join(",")]
  for (const row of rows) {
    lines.push(columns.map((c) => escape(c.value(row))).join(","))
  }
  // \r\n line endings keep Excel happy on Windows; most tools accept either.
  return lines.join("\r\n") + "\r\n"
}

export function csvHeaders(filename: string): Record<string, string> {
  return {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "private, no-store",
  }
}
