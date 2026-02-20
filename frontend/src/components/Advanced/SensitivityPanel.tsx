"use client";

import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { api, type Process } from "@/lib/api";
import { AlertCircle } from "lucide-react";

interface SensitivityPanelProps {
  process: Process;
  revenuePerUnit?: number;
}

const PARAM_LABELS: Record<string, string> = {
  duration_minutes: "Duration (min)",
  cost_per_execution: "Cost per Execution (₹)",
  resource_count: "Resource Count",
  executions_per_day: "Executions per Day",
};

export function SensitivityPanel({ process, revenuePerUnit }: SensitivityPanelProps) {
  const [stepId, setStepId] = useState(process.steps[0]?.id ?? 0);
  const [param, setParam] = useState("duration_minutes");
  const [minMult, setMinMult] = useState(0.5);
  const [maxMult, setMaxMult] = useState(2.0);
  const [data, setData] = useState<Array<Record<string, number | string>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.sensitivity(
        process.id,
        { step_id: stepId, param, min_multiplier: minMult, max_multiplier: maxMult, num_points: 15 },
        revenuePerUnit
      );
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setLoading(false);
    }
  };

  const baselinePoint = data?.find((d) => Math.abs(Number(d.multiplier) - 1.0) < 0.05);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-semibold text-slate-900">Sensitivity Analysis</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Vary a single parameter and see how it affects cycle time and cost.
        </p>
      </div>

      <div className="px-5 py-4">
        <div className="flex flex-wrap gap-3 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Step</label>
            <select
              value={stepId}
              onChange={(e) => setStepId(Number(e.target.value))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {process.steps.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Parameter</label>
            <select
              value={param}
              onChange={(e) => setParam(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {Object.entries(PARAM_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Range (multiplier)</label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={minMult}
                onChange={(e) => setMinMult(Number(e.target.value))}
                step={0.1}
                min={0.1}
                className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-slate-400 text-xs">to</span>
              <input
                type="number"
                value={maxMult}
                onChange={(e) => setMaxMult(Number(e.target.value))}
                step={0.1}
                className="w-16 rounded-lg border border-slate-300 px-2 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={run}
              disabled={loading}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Analyzing...
                </span>
              ) : "Analyze"}
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {data && data.length > 0 && (
          <div className="space-y-3">
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data} margin={{ left: 0, right: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="multiplier"
                    tickFormatter={(v) => `${(v as number).toFixed(1)}×`}
                    tick={{ fontSize: 10, fill: "#64748b" }}
                  />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip
                    formatter={(v: number, name: string) =>
                      name === "cycle_time_minutes"
                        ? [`${v.toFixed(1)} min`, "Cycle Time"]
                        : [`₹${v.toLocaleString()}`, "Daily Cost"]
                    }
                    labelFormatter={(l) => `Multiplier: ${(l as number).toFixed(2)}×`}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine yAxisId="left" x={1.0} stroke="#94a3b8" strokeDasharray="4 4" label={{ value: "Baseline", fontSize: 9, fill: "#94a3b8" }} />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="cycle_time_minutes"
                    stroke="#6366f1"
                    strokeWidth={2}
                    name="Cycle Time (min)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="daily_cost"
                    stroke="#10b981"
                    strokeWidth={2}
                    name="Daily Cost (₹)"
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="text-xs text-slate-400">
              Varying <strong>{PARAM_LABELS[param]}</strong> of step <strong>{process.steps.find((s) => s.id === stepId)?.name}</strong> from {minMult}× to {maxMult}× baseline.
              {baselinePoint && ` Baseline cycle time: ${Number(baselinePoint.cycle_time_minutes).toFixed(1)} min.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
