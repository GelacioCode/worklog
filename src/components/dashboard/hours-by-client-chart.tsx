"use client"

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { colorFor } from "@/lib/colors"
import type { HoursByClientPoint } from "@/lib/db/queries/dashboard"

export function HoursByClientChart({ data }: { data: HoursByClientPoint[] }) {
  return (
    <div className="h-44 -mx-2 -mb-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 12, bottom: 0, left: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            width={84}
            tick={{ fontSize: 11, fill: "var(--fg-muted)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            contentStyle={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--surface)",
              fontSize: 12,
            }}
            formatter={(value) => [`${Number(value).toFixed(1)}h`, "Hours"]}
            labelStyle={{ fontSize: 11, color: "var(--fg-muted)" }}
          />
          <Bar dataKey="hours" radius={[4, 4, 4, 4]} animationDuration={700}>
            {data.map((entry) => (
              <Cell
                key={entry.clientId}
                fill={entry.clientId === "other" ? "var(--border-strong)" : colorFor(entry.clientId)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
