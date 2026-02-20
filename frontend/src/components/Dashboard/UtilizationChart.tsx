"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell,
} from "recharts";
import type { AnalysisResult } from "@/lib/api";

interface UtilizationChartProps {
  analysis: AnalysisResult | null;
}

export function UtilizationChart({ analysis }: UtilizationChartProps) {
  if (!analysis) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-slate-700">Resource Utilization</h3>
        <p className="text-sm text-slate-400">Run analysis to see utilization data.</p>
      </div>
    );
  }

  const data = Object.entries(analysis.resource_utilization)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({
      name: name.length > 14 ? name.slice(0, 13) + "…" : name,
      utilization: value,
      fullName: name,
    }));

  const overCount = data.filter((d) => d.utilization > 85).length;
  const warningCount = data.filter((d) => d.utilization > 70 && d.utilization <= 85).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-slate-700">Resource Utilization %</h3>
        <div className="flex gap-2">
          {overCount > 0 && (
            <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-xs font-medium text-red-600">
              {overCount} over 85%
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-medium text-amber-600">
              {warningCount} warning
            </span>
          )}
        </div>
      </div>
      <div className="h-[220px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 6, left: 0, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "#64748b" }}
              angle={-30}
              textAnchor="end"
              height={45}
            />
            <YAxis domain={[0, 130]} tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(v) => `${v}%`} />
            <Tooltip
              formatter={(v: number) => [`${v.toFixed(1)}%`, "Utilization"]}
              labelFormatter={(_, payload) => payload[0]?.payload?.fullName ?? ""}
            />
            <ReferenceLine y={85} stroke="#dc2626" strokeDasharray="5 4" strokeWidth={1.5} label={{ value: "85% — Over-utilized", fill: "#dc2626", fontSize: 9, position: "insideTopRight" }} />
            <ReferenceLine y={70} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1} label={{ value: "70% — Warning", fill: "#f59e0b", fontSize: 9, position: "insideTopRight" }} />
            <Bar dataKey="utilization" radius={[4, 4, 0, 0]} fillOpacity={0.85}>
              {data.map((d, i) => (
                <Cell
                  key={i}
                  fill={d.utilization > 85 ? "#ef4444" : d.utilization > 70 ? "#f59e0b" : "#6366f1"}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 flex gap-4 text-xs text-slate-400">
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-indigo-500" /> Normal</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-400" /> Warning (&gt;70%)</span>
        <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" /> Over-utilized (&gt;85%)</span>
      </div>
    </div>
  );
}
