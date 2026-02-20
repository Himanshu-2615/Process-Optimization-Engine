"use client";

import { useState } from "react";
import { api, type Process, type ProcessStep, type StepAddRequest } from "@/lib/api";
import { Plus, Trash2, Edit3, Check, X, ChevronDown, ChevronUp, Link, Unlink } from "lucide-react";

interface ProcessEditorProps {
  process: Process;
  onUpdate: (updated: Process) => void;
  onDelete?: () => void;
}

const DEFAULT_STEP: StepAddRequest = {
  name: "",
  duration_minutes: 30,
  cost_per_execution: 10,
  resource_count: 1,
  sla_limit_minutes: null,
  executions_per_day: 10,
  link_from_last: true,
};

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";

const labelCls = "block text-xs font-medium text-slate-600 mb-1";

export function ProcessEditor({ process: proc, onUpdate, onDelete }: ProcessEditorProps) {
  const [editHeader, setEditHeader] = useState(false);
  const [headerForm, setHeaderForm] = useState({ name: proc.name, description: proc.description ?? "" });
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [stepForm, setStepForm] = useState<Partial<ProcessStep>>({});
  const [addingStep, setAddingStep] = useState(false);
  const [newStep, setNewStep] = useState<StepAddRequest>({ ...DEFAULT_STEP });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showDeps, setShowDeps] = useState(false);
  const [newDep, setNewDep] = useState({ source: "", target: "" });
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [confirmDeleteProcess, setConfirmDeleteProcess] = useState(false);

  const withSave = async (fn: () => Promise<Process | void>) => {
    setSaving(true);
    setError(null);
    try {
      const result = await fn();
      if (result) onUpdate(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // ── Header ────────────────────────────────────────────────────────────────
  const saveHeader = () =>
    withSave(async () => {
      const updated = await api.updateProcess(proc.id, {
        name: headerForm.name,
        description: headerForm.description || null,
      });
      setEditHeader(false);
      return updated;
    });

  // ── Step edit ─────────────────────────────────────────────────────────────
  const startEdit = (step: ProcessStep) => {
    setEditingStep(step.id);
    setAddingStep(false);
    setStepForm({
      name: step.name,
      duration_minutes: step.duration_minutes,
      cost_per_execution: step.cost_per_execution,
      resource_count: step.resource_count,
      sla_limit_minutes: step.sla_limit_minutes,
      executions_per_day: step.executions_per_day,
    });
  };

  const saveStep = () =>
    withSave(async () => {
      if (editingStep == null) return;
      const updated = await api.updateStep(proc.id, editingStep, stepForm);
      setEditingStep(null);
      return updated;
    });

  const deleteStep = (stepId: number) =>
    withSave(async () => {
      const updated = await api.deleteStep(proc.id, stepId);
      setConfirmDelete(null);
      return updated;
    });

  // ── Add step ──────────────────────────────────────────────────────────────
  const addStep = () =>
    withSave(async () => {
      if (!newStep.name.trim()) { setError("Step name is required"); return; }
      const updated = await api.addStep(proc.id, newStep);
      setNewStep({ ...DEFAULT_STEP });
      setAddingStep(false);
      return updated;
    });

  // ── Dependency management ─────────────────────────────────────────────────
  const addDep = () =>
    withSave(async () => {
      if (!newDep.source || !newDep.target) { setError("Select both steps for the dependency"); return; }
      const updated = await api.addDependency(proc.id, {
        source_step_id: Number(newDep.source),
        target_step_id: Number(newDep.target),
      });
      setNewDep({ source: "", target: "" });
      return updated;
    });

  const removeDep = (depId: number) =>
    withSave(async () => api.deleteDependency(proc.id, depId));

  // ── Process delete ────────────────────────────────────────────────────────
  const handleDeleteProcess = async () => {
    setSaving(true);
    try {
      await api.deleteProcess(proc.id);
      onDelete?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* ── Header ── */}
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div>
          {editHeader ? (
            <div className="flex items-center gap-2">
              <input
                value={headerForm.name}
                onChange={(e) => setHeaderForm((f) => ({ ...f, name: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-900 font-semibold focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                placeholder="Process name"
              />
              <input
                value={headerForm.description}
                onChange={(e) => setHeaderForm((f) => ({ ...f, description: e.target.value }))}
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-56"
                placeholder="Description (optional)"
              />
            </div>
          ) : (
            <div>
              <h3 className="font-semibold text-slate-900">{proc.name}</h3>
              {proc.description && <p className="text-xs text-slate-500 mt-0.5">{proc.description}</p>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {editHeader ? (
            <>
              <button onClick={saveHeader} disabled={saving} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                <Check size={12} /> Save
              </button>
              <button onClick={() => { setEditHeader(false); setHeaderForm({ name: proc.name, description: proc.description ?? "" }); }} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                <X size={12} /> Cancel
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditHeader(true)} className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
                <Edit3 size={12} /> Edit
              </button>
              {!confirmDeleteProcess ? (
                <button onClick={() => setConfirmDeleteProcess(true)} className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50">
                  <Trash2 size={12} /> Delete Process
                </button>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-red-600 font-medium">Sure?</span>
                  <button onClick={handleDeleteProcess} disabled={saving} className="rounded-lg bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700">Yes, delete</button>
                  <button onClick={() => setConfirmDeleteProcess(false)} className="rounded-lg border px-2 py-1.5 text-xs hover:bg-slate-50">Cancel</button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mx-5 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* ── Steps ── */}
      <div className="px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-sm font-semibold text-slate-700">Steps ({proc.steps.length})</h4>
          <button
            onClick={() => { setAddingStep((v) => !v); setEditingStep(null); setError(null); }}
            className="flex items-center gap-1 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 hover:bg-indigo-100"
          >
            <Plus size={12} /> Add Step
          </button>
        </div>

        {/* Add Step Form */}
        {addingStep && (
          <div className="mb-3 rounded-xl border-2 border-indigo-200 bg-indigo-50/40 p-4">
            <h5 className="mb-3 text-sm font-semibold text-indigo-700">New Step</h5>
            <StepFormFields
              values={newStep}
              onChange={(f) => setNewStep((v) => ({ ...v, ...f }))}
            />
            <div className="mt-3 flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newStep.link_from_last}
                  onChange={(e) => setNewStep((v) => ({ ...v, link_from_last: e.target.checked }))}
                  className="rounded"
                />
                Auto-link from last step
              </label>
              <div className="ml-auto flex gap-2">
                <button onClick={addStep} disabled={saving} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                  <Check size={14} /> Add Step
                </button>
                <button onClick={() => { setAddingStep(false); setNewStep({ ...DEFAULT_STEP }); setError(null); }} className="rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                  <X size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step list */}
        <div className="space-y-2">
          {proc.steps.map((step, idx) =>
            editingStep === step.id ? (
              <div key={step.id} className="rounded-xl border-2 border-indigo-300 bg-indigo-50/40 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold text-indigo-700">Editing Step {idx + 1}</span>
                </div>
                <StepFormFields
                  values={stepForm as StepAddRequest}
                  onChange={(f) => setStepForm((v) => ({ ...v, ...f }))}
                />
                <div className="mt-3 flex gap-2">
                  <button onClick={saveStep} disabled={saving} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-700 disabled:opacity-50">
                    <Check size={14} /> Save
                  </button>
                  <button onClick={() => { setEditingStep(null); setError(null); }} className="rounded-lg border px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ) : (
              <div key={step.id} className="group flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-3 hover:border-slate-200 hover:bg-white transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-xs font-bold text-slate-600 flex-shrink-0">{idx + 1}</span>
                  <div className="min-w-0">
                    <span className="font-medium text-slate-900">{step.name}</span>
                    <span className="ml-2 text-sm text-slate-500">
                      {step.duration_minutes}min · ₹{step.cost_per_execution} · {step.resource_count}res · {step.executions_per_day}/day
                      {step.sla_limit_minutes != null && <> · SLA:{step.sla_limit_minutes}min</>}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => startEdit(step)} className="rounded-lg p-1.5 text-slate-400 hover:bg-indigo-50 hover:text-indigo-600">
                    <Edit3 size={14} />
                  </button>
                  {confirmDelete === step.id ? (
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-red-600">Delete?</span>
                      <button onClick={() => deleteStep(step.id)} disabled={saving} className="rounded bg-red-600 px-2 py-0.5 text-xs text-white">Yes</button>
                      <button onClick={() => setConfirmDelete(null)} className="rounded border px-2 py-0.5 text-xs">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDelete(step.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            )
          )}
          {proc.steps.length === 0 && !addingStep && (
            <div className="rounded-lg border-2 border-dashed border-slate-200 p-6 text-center text-sm text-slate-400">
              No steps yet. Click "Add Step" to get started.
            </div>
          )}
        </div>
      </div>

      {/* ── Dependencies ── */}
      <div className="border-t border-slate-100 px-5 py-4">
        <button
          onClick={() => setShowDeps((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-semibold text-slate-700"
        >
          <span className="flex items-center gap-1.5">
            <Link size={14} /> Dependencies ({proc.dependencies.length})
          </span>
          {showDeps ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>

        {showDeps && (
          <div className="mt-3 space-y-3">
            {/* Current dependencies */}
            {proc.dependencies.length > 0 ? (
              <div className="space-y-1.5">
                {proc.dependencies.map((dep) => {
                  const src = proc.steps.find((s) => s.id === dep.source_step_id);
                  const tgt = proc.steps.find((s) => s.id === dep.target_step_id);
                  return (
                    <div key={dep.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <span className="text-sm text-slate-700">
                        <span className="font-medium text-indigo-700">{src?.name ?? dep.source_step_id}</span>
                        <span className="mx-2 text-slate-400">→</span>
                        <span className="font-medium text-slate-800">{tgt?.name ?? dep.target_step_id}</span>
                      </span>
                      <button onClick={() => removeDep(dep.id)} disabled={saving} className="rounded p-1 text-slate-400 hover:text-red-500">
                        <Unlink size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400">No dependencies. Steps run independently.</p>
            )}

            {/* Add dependency */}
            {proc.steps.length >= 2 && (
              <div className="flex items-center gap-2 rounded-lg border border-dashed border-slate-200 p-3">
                <select value={newDep.source} onChange={(e) => setNewDep((d) => ({ ...d, source: e.target.value }))} className={`${inputCls} flex-1`}>
                  <option value="">From step...</option>
                  {proc.steps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <span className="text-slate-400 text-sm">→</span>
                <select value={newDep.target} onChange={(e) => setNewDep((d) => ({ ...d, target: e.target.value }))} className={`${inputCls} flex-1`}>
                  <option value="">To step...</option>
                  {proc.steps.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <button onClick={addDep} disabled={saving || !newDep.source || !newDep.target} className="flex items-center gap-1 rounded-lg bg-slate-700 px-3 py-2 text-xs text-white hover:bg-slate-800 disabled:opacity-50">
                  <Plus size={12} /> Add
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Shared step form fields component ────────────────────────────────────────
function StepFormFields({
  values,
  onChange,
}: {
  values: Partial<StepAddRequest>;
  onChange: (f: Partial<StepAddRequest>) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <div className="col-span-2">
        <label className="block text-xs font-medium text-slate-600 mb-1">Name *</label>
        <input
          value={values.name ?? ""}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="e.g. Manager Approval"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Duration (min)</label>
        <input
          type="number"
          value={values.duration_minutes ?? ""}
          onChange={(e) => onChange({ duration_minutes: Number(e.target.value) })}
          min={0}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Cost/Exec (₹)</label>
        <input
          type="number"
          value={values.cost_per_execution ?? ""}
          onChange={(e) => onChange({ cost_per_execution: Number(e.target.value) })}
          min={0}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Resources</label>
        <input
          type="number"
          value={values.resource_count ?? ""}
          onChange={(e) => onChange({ resource_count: Number(e.target.value) })}
          min={1}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Exec/Day</label>
        <input
          type="number"
          value={values.executions_per_day ?? ""}
          onChange={(e) => onChange({ executions_per_day: Number(e.target.value) })}
          min={1}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div className="col-span-2 sm:col-span-1">
        <label className="block text-xs font-medium text-slate-600 mb-1">SLA Limit (min, optional)</label>
        <input
          type="number"
          value={values.sla_limit_minutes ?? ""}
          onChange={(e) => onChange({ sla_limit_minutes: e.target.value ? Number(e.target.value) : null })}
          min={0}
          placeholder="—"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    </div>
  );
}
