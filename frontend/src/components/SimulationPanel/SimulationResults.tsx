"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from "recharts";
import type { SimulationResult } from "@/lib/api";
import { TrendingDown, DollarSign, Calendar, Percent } from "lucide-react";

interface SimulationResultsProps {
  result: SimulationResult | null;
}

export function SimulationResults({ result }: SimulationResultsProps) {
  if (!result) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 p-12 text-center">
        <div className="rounded-full bg-slate-100 p-4 mb-3">
          <TrendingDown size={24} className="text-slate-400" />
        </div>
        <p className="text-sm font-medium text-slate-500">Run a simulation to see before/after impact</p>
        <p className="text-xs text-slate-400 mt-1">Cycle time, cost savings, ROI, and payback period</p>
      </div>
    );
  }

  const timeImproved = result.time_saved_minutes > 0;
  const costImproved = result.cost_saved_daily > 0;

  const kpis = [
    {
      label: "Time Saved",
      value: `${Math.abs(result.time_saved_minutes).toFixed(0)} min`,
      sub: `${result.original_cycle_time.toFixed(0)} → ${result.new_cycle_time.toFixed(0)} min`,
      color: timeImproved ? "text-emerald-600" : "text-red-500",
      icon: TrendingDown,
      bg: timeImproved ? "bg-emerald-50" : "bg-red-50",
    },
    {
      label: "Daily Cost Saved",
      value: `₹${Math.abs(result.cost_saved_daily).toLocaleString("en-IN")}`,
      sub: `₹${result.original_daily_cost.toLocaleString()} → ₹${result.new_daily_cost.toLocaleString()}`,
      color: costImproved ? "text-emerald-600" : "text-red-500",
      icon: DollarSign,
      bg: costImproved ? "bg-emerald-50" : "bg-red-50",
    },
    {
      label: "Annual Savings",
      value: `₹${result.annual_savings.toLocaleString("en-IN")}`,
      sub: `Over 12 months`,
      color: "text-indigo-600",
      icon: Calendar,
      bg: "bg-indigo-50",
    },
    {
      label: "ROI",
      value: result.roi != null ? `${(result.roi * 100).toFixed(0)}%` : "N/A",
      sub: result.payback_months != null ? `Payback: ${result.payback_months.toFixed(1)} months` : "No impl. cost set",
      color: result.roi != null && result.roi > 0 ? "text-emerald-600" : "text-slate-500",
      icon: Percent,
      bg: result.roi != null && result.roi > 0 ? "bg-emerald-50" : "bg-slate-50",
    },
  ];

  const chartData = [
    {
      metric: "Cycle Time (min)",
      Before: result.original_cycle_time,
      After: result.new_cycle_time,
    },
    {
      metric: "Daily Cost (₹)",
      Before: result.original_daily_cost,
      After: result.new_daily_cost,
    },
    {
      metric: "Throughput (/hr ×10)",
      Before: result.original_throughput * 10,
      After: result.new_throughput * 10,
    },
  ];

  return (
    <div className="space-y-4">
      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <span className={`rounded-lg p-1.5 ${kpi.bg}`}>
                  <Icon size={13} className={kpi.color} />
                </span>
                <span className="text-xs text-slate-500">{kpi.label}</span>
              </div>
              <div className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</div>
              <div className="mt-0.5 text-xs text-slate-400">{kpi.sub}</div>
            </div>
          );
        })}
      </div>

      {/* Comparison chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h4 className="mb-3 text-sm font-semibold text-slate-700">Before vs After</h4>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barGap={6}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="metric" tick={{ fontSize: 10, fill: "#64748b" }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
              <Tooltip formatter={(v: number) => v.toFixed(2)} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Before" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="After" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Implementation cost: ₹{result.implementation_cost.toLocaleString("en-IN")}
        </p>
      </div>
    </div>
  );
}
