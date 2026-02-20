"use client";

import { useState } from "react";
import { api, type Process, type SimulationRequest, type SimulationResult } from "@/lib/api";
import { Play, AlertCircle } from "lucide-react";

interface SimulationFormProps {
  process: Process;
  onResult: (result: SimulationResult) => void;
  revenuePerUnit?: number;
}

const SIM_TYPES = [
  { value: "reduce_duration", label: "Reduce Duration" },
  { value: "add_resource", label: "Add Resource" },
  { value: "automate", label: "Automate Step" },
  { value: "remove_step", label: "Remove Step" },
  { value: "merge_steps", label: "Merge Steps" },
] as const;

export function SimulationForm({ process, onResult, revenuePerUnit: externalRev }: SimulationFormProps) {
  const [simType, setSimType] = useState<SimulationRequest["simulation_type"]>("reduce_duration");
  const [stepId, setStepId] = useState(process.steps[0]?.id ?? 0);
  const [mergeTargetId, setMergeTargetId] = useState(process.steps[1]?.id ?? 0);
  const [reductionPercent, setReductionPercent] = useState(40);
  const [resourcesToAdd, setResourcesToAdd] = useState(1);
  const [newDuration, setNewDuration] = useState(30);
  const [newCost, setNewCost] = useState(5);
  const [implCost, setImplCost] = useState(50000);
  const [revenuePerUnit, setRevenuePerUnit] = useState(externalRev ?? 500);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runSimulation = async () => {
    setLoading(true);
    setError(null);
    const req: SimulationRequest = {
      simulation_type: simType,
      step_id: stepId,
      implementation_cost: implCost,
      revenue_per_unit: revenuePerUnit,
    };
    if (simType === "reduce_duration") req.duration_reduction_percent = reductionPercent;
    if (simType === "add_resource") req.resources_to_add = resourcesToAdd;
    if (simType === "automate") { req.new_duration_minutes = newDuration; req.new_cost_per_execution = newCost; }
    if (simType === "merge_steps") req.merge_target_step_id = mergeTargetId;

    try {
      const result = await api.simulate(process.id, req);
      onResult(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Simulation failed");
    } finally {
      setLoading(false);
    }
  };

  const selectedStep = process.steps.find((s) => s.id === stepId);
  const otherSteps = process.steps.filter((s) => s.id !== stepId);

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h3 className="font-semibold text-slate-900">Optimization Simulation</h3>
        <p className="mt-0.5 text-xs text-slate-500">Model a process change and see before/after impact.</p>
      </div>

      <div className="px-5 py-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Simulation Type</label>
          <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
            {SIM_TYPES.map((t) => (
              <button
                key={t.value}
                onClick={() => setSimType(t.value)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  simType === t.value
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            Target Step {selectedStep && <span className="text-indigo-600">({selectedStep.duration_minutes} min, ₹{selectedStep.cost_per_execution}/exec)</span>}
          </label>
          <select
            value={stepId}
            onChange={(e) => setStepId(Number(e.target.value))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {process.steps.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        {simType === "reduce_duration" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Duration Reduction: <span className="text-indigo-600 font-bold">{reductionPercent}%</span>
              {selectedStep && <span className="text-slate-400 ml-1">({selectedStep.duration_minutes} → {(selectedStep.duration_minutes * (1 - reductionPercent / 100)).toFixed(0)} min)</span>}
            </label>
            <input
              type="range"
              value={reductionPercent}
              onChange={(e) => setReductionPercent(Number(e.target.value))}
              min={5}
              max={95}
              step={5}
              className="w-full"
            />
          </div>
        )}

        {simType === "add_resource" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Resources to Add</label>
            <input
              type="number"
              value={resourcesToAdd}
              onChange={(e) => setResourcesToAdd(Number(e.target.value))}
              min={1}
              max={20}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}

        {simType === "automate" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">New Duration (min)</label>
              <input
                type="number"
                value={newDuration}
                onChange={(e) => setNewDuration(Number(e.target.value))}
                min={0}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">New Cost/Exec (₹)</label>
              <input
                type="number"
                value={newCost}
                onChange={(e) => setNewCost(Number(e.target.value))}
                min={0}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
        )}

        {simType === "merge_steps" && (
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Merge With</label>
            <select
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {otherSteps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        )}

        {simType === "remove_step" && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
            ⚠ This simulates removing <strong>{selectedStep?.name}</strong> from the process entirely.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Implementation Cost (₹)</label>
            <input
              type="number"
              value={implCost}
              onChange={(e) => setImplCost(Number(e.target.value))}
              min={0}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Revenue/Unit (₹)</label>
            <input
              type="number"
              value={revenuePerUnit}
              onChange={(e) => setRevenuePerUnit(Number(e.target.value))}
              min={0}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <button
          onClick={runSimulation}
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? (
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : <Play size={16} />}
          {loading ? "Running..." : "Run Simulation"}
        </button>
      </div>
    </div>
  );
}
