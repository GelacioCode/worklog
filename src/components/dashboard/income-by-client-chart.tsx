"use client"

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts"
import { colorFor } from "@/lib/colors"
import { formatMoney } from "@/lib/money"
import type { IncomeByClientPoint } from "@/lib/db/queries/dashboard"

export function IncomeByClientChart({ data }: { data: IncomeByClientPoint[] }) {
  const currency = data[0]?.currency ?? "USD"
  const total = data.reduce((s, d) => s + d.cents, 0)

  return (
    <div className="h-44 relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="cents"
            nameKey="name"
            innerRadius="60%"
            outerRadius="92%"
            paddingAngle={2}
            stroke="var(--surface)"
            animationDuration={700}
          >
            {data.map((entry) => (
              <Cell key={entry.clientId} fill={colorFor(entry.clientId)} />
            ))}
          </Pie>
          <Tooltip
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
            verticalAlign="bottom"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "var(--fg-muted)" }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="text-center -mt-4">
          <div className="text-[10.5px] uppercase tracking-wider text-subtle font-medium">
            Total
          </div>
          <div className="text-[15px] font-semibold tnum">
            {formatMoney(total, currency)}
          </div>
        </div>
      </div>
    </div>
  )
}
