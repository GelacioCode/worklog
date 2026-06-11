"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type { WeeklyWorkloadPoint } from "@/lib/db/queries/dashboard"

export function WeeklyWorkloadChart({ data }: { data: WeeklyWorkloadPoint[] }) {
  return (
    <div className="h-44 -mx-2 -mb-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
          <defs>
            <linearGradient id="workloadGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity={0.35} />
              <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10.5, fill: "var(--fg-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            tick={{ fontSize: 10.5, fill: "var(--fg-muted)" }}
            tickLine={false}
            axisLine={false}
            width={36}
            tickFormatter={(v) => `${Math.round(Number(v))}h`}
          />
          <Tooltip
            cursor={{ stroke: "var(--border-strong)", strokeWidth: 1 }}
            contentStyle={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--surface)",
              fontSize: 12,
            }}
            formatter={(value) => [`${Number(value).toFixed(1)}h`, "Logged"]}
            labelFormatter={(label) => `Week of ${String(label)}`}
            labelStyle={{ fontSize: 11, color: "var(--fg-muted)" }}
          />
          <Area
            type="monotone"
            dataKey="hours"
            stroke="rgb(var(--accent))"
            strokeWidth={2}
            fill="url(#workloadGrad)"
            animationDuration={700}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
