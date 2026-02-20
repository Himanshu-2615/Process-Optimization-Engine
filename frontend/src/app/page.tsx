"use client";

import { useEffect, useState, useCallback } from "react";
import { WorkflowGraph } from "@/components/WorkflowBuilder/WorkflowGraph";
import { KPICards } from "@/components/KPIOverview/KPICards";
import { UtilizationChart } from "@/components/Dashboard/UtilizationChart";
import { RecommendationsList } from "@/components/Dashboard/RecommendationsList";
import { SimulationForm } from "@/components/SimulationPanel/SimulationForm";
import { SimulationResults } from "@/components/SimulationPanel/SimulationResults";
import { RiskBadge } from "@/components/Dashboard/RiskBadge";
import { SensitivityPanel } from "@/components/Advanced/SensitivityPanel";
import { MonteCarloPanel } from "@/components/Advanced/MonteCarloPanel";
import { MultiScenarioPanel } from "@/components/Advanced/MultiScenarioPanel";
import { CsvUpload } from "@/components/Advanced/CsvUpload";
import { ProcessEditor } from "@/components/ProcessEditor/ProcessEditor";
import {
  api,
  type Process,
  type AnalysisResult,
  type Recommendation,
  type RiskClassification,
  type SimulationResult,
} from "@/lib/api";
import {
  BarChart2, Play, FileDown, Plus, ChevronRight, Loader2, AlertCircle,
  Settings, TrendingUp, GitBranch, Zap, UploadCloud,
} from "lucide-react";

type Section = "editor" | "workflow" | "kpis" | "utilization" | "risk" | "recommendations" | "simulation" | "advanced";

const SAMPLE_PROCESS = {
  name: "Procurement Approval Process",
  description: "End-to-end procurement workflow from request to vendor allocation",
  steps: [
    { name: "Request Submission", duration_minutes: 10, cost_per_execution: 5, resource_count: 2, sla_limit_minutes: 15, executions_per_day: 50 },
    { name: "Manager Approval", duration_minutes: 120, cost_per_execution: 50, resource_count: 3, sla_limit_minutes: 90, executions_per_day: 50 },
    { name: "Finance Approval", duration_minutes: 90, cost_per_execution: 30, resource_count: 2, sla_limit_minutes: 120, executions_per_day: 50 },
    { name: "Vendor Allocation", duration_minutes: 60, cost_per_execution: 20, resource_count: 2, sla_limit_minutes: 90, executions_per_day: 50 },
  ],
  dependencies: [
    { source_step_id: 0, target_step_id: 1 },
    { source_step_id: 1, target_step_id: 2 },
    { source_step_id: 2, target_step_id: 3 },
  ],
};

export default function Home() {
  const [processes, setProcesses] = useState<Process[]>([]);
  const [selected, setSelected] = useState<Process | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [risk, setRisk] = useState<RiskClassification | null>(null);
  const [revenuePerUnit, setRevenuePerUnit] = useState(500);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("editor");
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);

  useEffect(() => {
    api.listProcesses()
      .then(setProcesses)
      .catch(() => setProcesses([]))
      .finally(() => setLoading(false));
  }, []);

  // Refresh selected process when it changes
  // useEffect(() => {
  //   if (selected) {
  //     api.getProcess(selected.id).then((p) => {
  //       setSelected(p);
  //       setProcesses((prev) => prev.map((x) => (x.id === p.id ? p : x)));
  //     }).catch(() => {});
  //   }
  // }, [selected?.id]);

  const selectProcess = useCallback((p: Process | null) => {
    setSelected(p);
    setAnalysis(null);
    setRecommendations([]);
    setSimResult(null);
    setRisk(null);
    setAnalyzeError(null);
    setActiveSection("editor");
  }, []);

  const handleAnalyze = async () => {
    if (!selected) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const res = await api.analyze(selected.id, revenuePerUnit);
      setAnalysis(res.analysis);
      setRecommendations(res.recommendations);
      setRisk(res.risk ?? null);
      setActiveSection("kpis");
    } catch (e) {
      setAnalyzeError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleUpdate = useCallback((updated: Process) => {
    setSelected(updated);
    setProcesses((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    setAnalysis(null);
    setRecommendations([]);
    setRisk(null);
    setSimResult(null);
  }, []);

  const handleDelete = useCallback(() => {
    if (selected) {
      setProcesses((prev) => prev.filter((p) => p.id !== selected.id));
      setSelected(null);
    }
  }, [selected]);

  const handleCreateSample = async () => {
    setCreating(true);
    try {
      const p = await api.createProcess(SAMPLE_PROCESS);
      setProcesses((prev) => [...prev, p]);
      selectProcess(p);
    } catch (e) {
      alert("Failed to create sample process: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setCreating(false);
    }
  };

  const handleExportPdf = () => {
    if (!selected) return;
    window.open(api.exportPdf(selected.id, revenuePerUnit), "_blank");
  };

  const bottleneckIds = new Set(analysis?.bottlenecks.map((b) => b.step_id) ?? []);
  const criticalPathSet = new Set(analysis?.critical_path ?? []);

  const navItems: { id: Section; label: string; icon: React.ComponentType<{ size?: number; className?: string }> }[] = [
    { id: "editor", label: "Edit Process", icon: Settings },
    { id: "workflow", label: "Workflow", icon: GitBranch },
    { id: "kpis", label: "KPI Overview", icon: TrendingUp },
    { id: "utilization", label: "Utilization", icon: BarChart2 },
    { id: "risk", label: "Risk", icon: AlertCircle },
    { id: "recommendations", label: "Recommendations", icon: Zap },
    { id: "simulation", label: "Simulation", icon: Play },
    { id: "advanced", label: "Advanced", icon: BarChart2 },
  ];

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      {/* ── Top Nav ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm">
        <div className="mx-auto flex max-w-screen-2xl items-center gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600">
              <BarChart2 size={16} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-bold text-slate-900 leading-none">Process Optimizer</h1>
              <p className="text-xs text-slate-500">Impact Simulation Engine</p>
            </div>
          </div>

          <div className="flex flex-1 items-center gap-2 min-w-0">
            {loading ? (
              <Loader2 size={16} className="animate-spin text-slate-400" />
            ) : (
              <select
                value={selected?.id ?? ""}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  const p = processes.find((x) => x.id === id) ?? null;
                  selectProcess(p);
                }}
                className="flex-1 min-w-0 max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">— Select process —</option>
                {processes.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {selected && (
              <>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500 hidden md:inline">₹/unit</span>
                  <input
                    type="number"
                    value={revenuePerUnit}
                    onChange={(e) => setRevenuePerUnit(Number(e.target.value))}
                    className="w-20 rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {analyzing ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  <span className="hidden sm:inline">{analyzing ? "Analyzing..." : "Analyze"}</span>
                </button>
                <button
                  onClick={handleExportPdf}
                  title="Export PDF"
                  className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  <FileDown size={14} />
                  <span className="hidden md:inline">PDF</span>
                </button>
              </>
            )}
            <button
              onClick={handleCreateSample}
              disabled={creating}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              <span className="hidden sm:inline">Sample</span>
            </button>
            <button
              onClick={() => setShowImport((v) => !v)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 ${showImport ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-slate-300"}`}
            >
              <UploadCloud size={14} />
              <span className="hidden sm:inline">Import</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      {!selected && !loading ? (
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
            {showImport ? (
              <div className="mb-8">
                <CsvUpload onSuccess={(p) => { setProcesses((prev) => [...prev, p]); selectProcess(p); setShowImport(false); }} />
              </div>
            ) : null}
            <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-white p-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50">
                <BarChart2 size={32} className="text-indigo-600" />
              </div>
              <h2 className="mb-2 text-xl font-bold text-slate-900">Process Optimization Engine</h2>
              <p className="mb-6 text-slate-500 max-w-sm mx-auto">
                Model your business workflows, detect bottlenecks, simulate optimizations, and calculate ROI.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={handleCreateSample}
                  disabled={creating}
                  className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Load Sample Process
                </button>
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center justify-center gap-2 rounded-xl border-2 border-slate-200 px-6 py-3 font-medium text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                >
                  <UploadCloud size={16} /> Import from CSV
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : selected ? (
        <div className="flex flex-1 overflow-hidden">
          {/* ── Sidebar ── */}
          <aside className="hidden w-52 flex-shrink-0 border-r border-slate-200 bg-white overflow-y-auto lg:block">
            <nav className="p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      activeSection === item.id
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Icon size={15} className={activeSection === item.id ? "text-indigo-600" : "text-slate-400"} />
                    {item.label}
                    {activeSection === item.id && <ChevronRight size={13} className="ml-auto text-indigo-400" />}
                  </button>
                );
              })}
            </nav>

            {/* Process info */}
            <div className="border-t border-slate-100 p-3">
              <div className="text-xs text-slate-400 font-medium mb-1 uppercase tracking-wide">Process</div>
              <div className="text-sm font-medium text-slate-800 leading-tight">{selected.name}</div>
              <div className="text-xs text-slate-400 mt-1">{selected.steps.length} steps · {selected.dependencies.length} deps</div>
              {analysis && (
                <div className="mt-2 space-y-1">
                  <div className="text-xs text-slate-500">
                    <span className="text-slate-400">Cycle: </span>
                    <span className="font-medium text-slate-700">{analysis.cycle_time_minutes} min</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    <span className="text-slate-400">Cost: </span>
                    <span className="font-medium text-slate-700">₹{analysis.cost_breakdown.daily_cost.toLocaleString()}/day</span>
                  </div>
                </div>
              )}
            </div>
          </aside>

          {/* ── Main content ── */}
          <main className="flex-1 overflow-y-auto">
            {/* Mobile nav */}
            <div className="lg:hidden border-b border-slate-200 bg-white px-4 py-2 overflow-x-auto">
              <div className="flex gap-1 min-w-max">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        activeSection === item.id ? "bg-indigo-50 text-indigo-700" : "text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <Icon size={12} /> {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {analyzeError && (
              <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle size={14} />
                <span>{analyzeError}</span>
                <button onClick={() => setAnalyzeError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
              </div>
            )}

            <div className="p-6 space-y-6">
              {/* Import overlay */}
              {showImport && (
                <div className="max-w-xl">
                  <CsvUpload onSuccess={(p) => { setProcesses((prev) => [...prev, p]); selectProcess(p); setShowImport(false); }} />
                </div>
              )}

              {activeSection === "editor" && (
                <ProcessEditor process={selected} onUpdate={handleUpdate} onDelete={handleDelete} />
              )}

              {activeSection === "workflow" && (
                <div>
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">Workflow Graph</h2>
                  <WorkflowGraph
                    process={selected}
                    bottleneckStepIds={bottleneckIds}
                    criticalPathSteps={criticalPathSet}
                  />
                  {!analysis && (
                    <p className="mt-3 text-sm text-slate-400 text-center">
                      Click <strong>Analyze</strong> in the header to highlight bottlenecks and critical path.
                    </p>
                  )}
                </div>
              )}

              {activeSection === "kpis" && (
                <div>
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">Key Performance Indicators</h2>
                  {!analysis ? (
                    <div className="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-400">
                      <Play size={24} className="mx-auto mb-2 opacity-40" />
                      <p>Click <strong>Analyze</strong> to compute KPIs</p>
                    </div>
                  ) : (
                    <>
                      <KPICards analysis={analysis} />
                      {analysis.critical_path.length > 0 && (
                        <div className="mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                          <GitBranch size={15} className="text-amber-600 flex-shrink-0" />
                          <span className="text-sm text-amber-700">
                            <strong>Critical Path:</strong> {analysis.critical_path.join(" → ")}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {activeSection === "utilization" && (
                <div>
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">Resource Utilization</h2>
                  <UtilizationChart analysis={analysis} />
                </div>
              )}

              {activeSection === "risk" && (
                <div>
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">Risk Classification</h2>
                  <RiskBadge risk={risk} />
                </div>
              )}

              {activeSection === "recommendations" && (
                <div>
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">Recommendations</h2>
                  {recommendations.length === 0 && !analysis ? (
                    <div className="rounded-xl border-2 border-dashed border-slate-200 p-10 text-center text-slate-400">
                      <Zap size={24} className="mx-auto mb-2 opacity-40" />
                      <p>Run <strong>Analyze</strong> to generate recommendations</p>
                    </div>
                  ) : (
                    <RecommendationsList recommendations={recommendations} />
                  )}
                </div>
              )}

              {activeSection === "simulation" && (
                <div>
                  <h2 className="mb-4 text-lg font-semibold text-slate-900">Optimization Simulation</h2>
                  <div className="grid gap-6 xl:grid-cols-2">
                    <SimulationForm process={selected} onResult={setSimResult} revenuePerUnit={revenuePerUnit} />
                    <SimulationResults result={simResult} />
                  </div>
                </div>
              )}

              {activeSection === "advanced" && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-slate-900">Advanced Analytics</h2>
                  <div className="grid gap-6 xl:grid-cols-2">
                    <SensitivityPanel process={selected} revenuePerUnit={revenuePerUnit} />
                    <MonteCarloPanel process={selected} revenuePerUnit={revenuePerUnit} />
                  </div>
                  <MultiScenarioPanel process={selected} />
                </div>
              )}
            </div>
          </main>
        </div>
      ) : null}
    </div>
  );
}
