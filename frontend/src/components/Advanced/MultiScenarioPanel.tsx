"use client";

import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { api, type Process, type SimulationRequest, type SimulationResult } from "@/lib/api";
import { Play, AlertCircle } from "lucide-react";

interface ScenarioRow {
  name: string;
  cycle_time: number;
  daily_cost: number;
  time_saved: number;
  cost_saved: number;
  roi: number | null;
  annual_savings: number;
  payback_months: number | null;
}

interface MultiScenarioPanelProps {
  process: Process;
}

export function MultiScenarioPanel({ process }: MultiScenarioPanelProps) {
  const [results, setResults] = useState<ScenarioRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reductionPct, setReductionPct] = useState(20);
  const [implCost, setImplCost] = useState(50000);

  const runComparison = async () => {
    setLoading(true);
    setError(null);
    try {
      const steps = process.steps;
      if (steps.length === 0) { setError("Process has no steps"); return; }

      const scenarios: SimulationRequest[] = steps.slice(0, Math.min(steps.length, 5)).map((s, i) => ({
        simulation_type: "reduce_duration" as const,
        step_id: s.id,
        duration_reduction_percent: reductionPct + i * 5,
        implementation_cost: implCost,
      }));
      const names = steps.slice(0, scenarios.length).map((s, i) =>
        `Reduce "${s.name}" by ${reductionPct + i * 5}%`
      );

      const data = await api.multiScenario(process.id, { scenarios, scenario_names: names });

      const rows: ScenarioRow[] = data.scenarios
        .filter((x): x is { name: string; result: SimulationResult } => !!x.result)
        .map((x) => ({
          name: x.name,
          cycle_time: x.result.new_cycle_time,
          daily_cost: x.result.new_daily_cost,
          time_saved: x.result.time_saved_minutes,
          cost_saved: x.result.cost_saved_daily,
          roi: x.result.roi,
          annual_savings: x.result.annual_savings,
          payback_months: x.result.payback_months,
        }));
      setResults(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed");
    } finally {
      setLoading(false);
    }
  };

  const bestRoi = results ? Math.max(...results.filter((r) => r.roi != null).map((r) => r.roi!)) : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-semibold text-slate-900">Multi-Scenario Comparison</h3>
        <p className="mt-0.5 text-xs text-slate-500">
          Compare optimization scenarios across all steps side-by-side.
        </p>
      </div>

      <div className="px-5 py-4">
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Base Reduction %</label>
            <div className="flex items-center gap-2">
              <input type="range" min={5} max={50} value={reductionPct} onChange={(e) => setReductionPct(Number(e.target.value))} className="w-24" />
              <span className="text-sm font-medium text-slate-700 w-10">{reductionPct}%+</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Impl. Cost (₹)</label>
            <input
              type="number"
              value={implCost}
              onChange={(e) => setImplCost(Number(e.target.value))}
              className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={runComparison}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {loading ? (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : <Play size={14} />}
            {loading ? "Running..." : "Compare All Scenarios"}
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {results && results.length > 0 && (
          <div className="space-y-4">
            {/* Chart */}
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={results} margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#64748b" }} interval={0} />
                  <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#64748b" }} />
                  <Tooltip formatter={(v: number, name: string) =>
                    name === "time_saved" ? [`${v.toFixed(0)} min`, "Time Saved"] : [`₹${v.toLocaleString()}`, "Cost Saved/day"]
                  } />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar yAxisId="left" dataKey="time_saved" fill="#6366f1" name="Time Saved (min)" radius={[4, 4, 0, 0]} />
                  <Bar yAxisId="right" dataKey="cost_saved" fill="#10b981" name="Cost Saved/day (₹)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    {["Scenario", "Time Saved", "Cost Saved/Day", "Annual Savings", "ROI", "Payback"].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.name} className={`border-b border-slate-100 ${r.roi === bestRoi ? "bg-emerald-50" : ""}`}>
                      <td className="px-3 py-2 text-slate-800 font-medium max-w-[180px] truncate" title={r.name}>
                        {r.name}
                        {r.roi === bestRoi && <span className="ml-1 text-xs text-emerald-600 font-bold">★ Best ROI</span>}
                      </td>
                      <td className="px-3 py-2 text-slate-700">{r.time_saved.toFixed(0)} min</td>
                      <td className="px-3 py-2 text-slate-700">₹{r.cost_saved.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2 font-medium text-emerald-700">₹{r.annual_savings.toLocaleString("en-IN")}</td>
                      <td className="px-3 py-2 font-semibold text-indigo-700">
                        {r.roi != null ? `${(r.roi * 100).toFixed(0)}%` : "N/A"}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {r.payback_months != null ? `${r.payback_months.toFixed(1)} mo` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {results && results.length === 0 && (
          <div className="text-center text-sm text-slate-400 py-6">No successful scenarios to display.</div>
        )}
      </div>
    </div>
  );
}
