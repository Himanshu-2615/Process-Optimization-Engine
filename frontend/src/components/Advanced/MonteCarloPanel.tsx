"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { api, type MonteCarloResult, type Process } from "@/lib/api";
import { AlertCircle } from "lucide-react";

interface MonteCarloPanelProps {
  process: Process;
  revenuePerUnit?: number;
}

export function MonteCarloPanel({ process, revenuePerUnit }: MonteCarloPanelProps) {
  const [iterations, setIterations] = useState(500);
  const [variation, setVariation] = useState(20);
  const [result, setResult] = useState<MonteCarloResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.monteCarlo(process.id, {
        num_iterations: iterations,
        variation_percent: variation,
        revenue_per_unit: revenuePerUnit,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  const volatilityColor = {
    low: "text-emerald-600 bg-emerald-50 border-emerald-200",
    medium: "text-amber-600 bg-amber-50 border-amber-200",
    high: "text-red-600 bg-red-50 border-red-200",
  };

  const chartData = result
    ? [
        { label: "P10", cycle_time: result.cycle_time.p10, daily_cost: result.daily_cost.p10 },
        { label: "P50", cycle_time: result.cycle_time.p50, daily_cost: result.daily_cost.p50 },
        { label: "Mean", cycle_time: result.cycle_time.mean, daily_cost: result.daily_cost.mean },
        { label: "P90", cycle_time: result.cycle_time.p90, daily_cost: result.daily_cost.p90 },
        { label: "P95", cycle_time: result.cycle_time.p95, daily_cost: result.daily_cost.p95 },
      ]
    : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-semibold text-slate-900">Monte Carlo Simulation</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Simulate delay variability: randomly vary step durations by ±X% across N iterations to get outcome distributions.
        </p>
      </div>

      <div className="px-5 py-4">
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Iterations</label>
            <input
              type="number"
              value={iterations}
              onChange={(e) => setIterations(Math.min(2000, Math.max(100, Number(e.target.value))))}
              step={100}
              className="w-28 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Variation %</label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={5}
                max={50}
                value={variation}
                onChange={(e) => setVariation(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm font-medium text-slate-700 w-8">±{variation}%</span>
            </div>
          </div>
          <button
            onClick={run}
            disabled={loading}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Running {iterations} iterations...
              </span>
            ) : "Run Simulation"}
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {result && (
          <div className="space-y-4">
            {/* Risk summary badge */}
            {result.risk_summary && (
              <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${volatilityColor[result.risk_summary.volatility]}`}>
                <AlertCircle size={16} />
                <div>
                  <span className="font-semibold capitalize">{result.risk_summary.volatility} Volatility</span>
                  <span className="ml-2 text-sm">
                    P95 is {result.risk_summary.spread_percent.toFixed(1)}% above median
                    (+{result.risk_summary.p50_vs_p95_spread_minutes.toFixed(0)} min worst case)
                  </span>
                </div>
              </div>
            )}

            {/* Distribution chart */}
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} />
                  <YAxis yAxisId="ct" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis yAxisId="cost" orientation="right" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip
                    formatter={(val: number, name: string) =>
                      name === "cycle_time" ? [`${val.toFixed(1)} min`, "Cycle Time"] : [`₹${val.toLocaleString()}`, "Daily Cost"]
                    }
                  />
                  <Bar yAxisId="ct" dataKey="cycle_time" fill="#6366f1" radius={[4, 4, 0, 0]} name="cycle_time" />
                  <Bar yAxisId="cost" dataKey="daily_cost" fill="#10b981" radius={[4, 4, 0, 0]} name="daily_cost" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Stats table */}
            <div className="grid gap-3 sm:grid-cols-2">
              <StatTable title="Cycle Time (min)" stats={result.cycle_time} />
              <StatTable title="Daily Cost (₹)" stats={result.daily_cost} isCost />
            </div>

            <p className="text-xs text-slate-400">
              {result.successful_iterations} of {result.iterations} iterations completed successfully.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function StatTable({ title, stats, isCost = false }: {
  title: string;
  stats: { mean: number; std: number; min: number; max: number; p10: number; p50: number; p90: number; p95: number };
  isCost?: boolean;
}) {
  const fmt = (v: number) => isCost ? `₹${v.toLocaleString("en-IN")}` : v.toFixed(1);
  const rows = [
    ["Mean", stats.mean],
    ["Std Dev (±)", stats.std],
    ["P10 (best 10%)", stats.p10],
    ["P50 (median)", stats.p50],
    ["P90 (worst 10%)", stats.p90],
    ["P95 (tail risk)", stats.p95],
  ] as const;

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50 overflow-hidden">
      <div className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">{title}</div>
      <table className="w-full text-sm">
        <tbody>
          {rows.map(([label, val]) => (
            <tr key={label} className="border-t border-slate-100">
              <td className="px-3 py-1.5 text-slate-600">{label}</td>
              <td className="px-3 py-1.5 text-right font-medium text-slate-900">{fmt(val)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
