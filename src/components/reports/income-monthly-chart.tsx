"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatMoney } from "@/lib/money"
import type { IncomeMonthPoint } from "@/lib/db/queries/reports"

export function IncomeMonthlyChart({
  data,
  currency,
}: {
  data: IncomeMonthPoint[]
  currency: string
}) {
  return (
    <div className="h-56 -mx-2 -mb-1">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--fg-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            tick={{ fontSize: 10.5, fill: "var(--fg-muted)" }}
            tickLine={false}
            axisLine={false}
            width={50}
            tickFormatter={(v) => {
              const n = Number(v)
              return n >= 100000 ? `${Math.round(n / 100000)}k` : (n / 100).toFixed(0)
            }}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-2)" }}
            contentStyle={{
              border: "1px solid var(--border)",
              borderRadius: 8,
              background: "var(--surface)",
              fontSize: 12,
            }}
            formatter={(value, name) => [
              formatMoney(Number(value), currency),
              String(name),
            ]}
          />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "var(--fg-muted)" }}
          />
          <Bar
            dataKey="paidCents"
            name="Paid"
            stackId="amt"
            fill="#10b981"
            radius={[0, 0, 0, 0]}
            animationDuration={700}
          />
          <Bar
            dataKey="unpaidCents"
            name="Unpaid"
            stackId="amt"
            fill="rgb(var(--accent))"
            radius={[4, 4, 0, 0]}
            animationDuration={700}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
