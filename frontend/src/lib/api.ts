export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export interface ProcessStep {
  id: number;
  process_id: number;
  name: string;
  duration_minutes: number;
  cost_per_execution: number;
  resource_count: number;
  sla_limit_minutes: number | null;
  executions_per_day: number;
}

export interface Dependency {
  id: number;
  source_step_id: number;
  target_step_id: number;
}

export interface Process {
  id: number;
  name: string;
  description: string | null;
  steps: ProcessStep[];
  dependencies: Dependency[];
}

export interface BottleneckInfo {
  step_id: number;
  step_name: string;
  type: "duration" | "cost" | "sla" | "utilization";
  severity: number;
  message: string;
  current_value: number;
}

export interface CostBreakdown {
  daily_cost: number;
  monthly_cost: number;
  per_step_costs: Record<string, number>;
  delay_loss?: number;
  revenue_impact?: number;
}

export interface AnalysisResult {
  cycle_time_minutes: number;
  throughput_per_hour: number;
  bottlenecks: BottleneckInfo[];
  resource_utilization: Record<string, number>;
  cost_breakdown: CostBreakdown;
  sla_risk_score: number;
  critical_path: string[];
}

export interface RiskClassification {
  overall_risk: "low" | "medium" | "high" | "critical";
  risk_score: number;
  step_risks: Record<string, { score: number; level: string }>;
}

export interface Recommendation {
  title: string;
  description: string;
  step_name: string | null;
  priority: string;
  suggested_action: string;
}

export interface SimulationRequest {
  simulation_type: "reduce_duration" | "add_resource" | "remove_step" | "merge_steps" | "automate";
  step_id: number;
  duration_reduction_percent?: number;
  resources_to_add?: number;
  merge_target_step_id?: number;
  new_duration_minutes?: number;
  new_cost_per_execution?: number;
  implementation_cost?: number;
  revenue_per_unit?: number;
}

export interface SimulationResult {
  original_cycle_time: number;
  new_cycle_time: number;
  time_saved_minutes: number;
  original_daily_cost: number;
  new_daily_cost: number;
  cost_saved_daily: number;
  original_throughput: number;
  new_throughput: number;
  roi: number | null;
  annual_savings: number;
  implementation_cost: number;
  payback_months: number | null;
}

export interface StepAddRequest {
  name: string;
  duration_minutes: number;
  cost_per_execution: number;
  resource_count: number;
  sla_limit_minutes?: number | null;
  executions_per_day: number;
  link_from_last?: boolean;
}

export interface MonteCarloResult {
  iterations: number;
  successful_iterations: number;
  variation_percent: number;
  cycle_time: { mean: number; std: number; min: number; max: number; p10: number; p50: number; p90: number; p95: number };
  daily_cost: { mean: number; std: number; min: number; max: number; p10: number; p50: number; p90: number; p95: number };
  throughput: { mean: number; std: number; min: number; max: number; p10: number; p50: number; p90: number; p95: number };
  risk_summary: { p50_vs_p95_spread_minutes: number; spread_percent: number; volatility: "low" | "medium" | "high" };
}

async function fetchApi<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    let errMsg = `HTTP ${res.status}`;
    try { const body = await res.json(); errMsg = body?.detail || JSON.stringify(body); } catch { errMsg = await res.text() || errMsg; }
    throw new Error(errMsg);
  }
  if (res.status === 204) return undefined as unknown as T;
  if (res.headers.get("content-type")?.includes("application/json")) return res.json();
  return res as unknown as T;
}

export const api = {
  // ── Process CRUD ──────────────────────────────────────────────────────────
  listProcesses: () => fetchApi<Process[]>("/api/processes"),
  getProcess: (id: number) => fetchApi<Process>(`/api/processes/${id}`),
  createProcess: (data: { name: string; description?: string; steps: StepAddRequest[]; dependencies: Array<{ source_step_id: number; target_step_id: number }> }) =>
    fetchApi<Process>("/api/processes", { method: "POST", body: JSON.stringify(data) }),
  updateProcess: (id: number, data: { name?: string; description?: string }) =>
    fetchApi<Process>(`/api/processes/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteProcess: (id: number) =>
    fetchApi<void>(`/api/processes/${id}`, { method: "DELETE" }),

  // ── Step CRUD ─────────────────────────────────────────────────────────────
  addStep: (processId: number, step: StepAddRequest) =>
    fetchApi<Process>(`/api/processes/${processId}/steps`, { method: "POST", body: JSON.stringify(step) }),
  updateStep: (processId: number, stepId: number, data: Partial<Omit<ProcessStep, "id" | "process_id">>) =>
    fetchApi<Process>(`/api/processes/${processId}/steps/${stepId}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteStep: (processId: number, stepId: number) =>
    fetchApi<Process>(`/api/processes/${processId}/steps/${stepId}`, { method: "DELETE" }),

  // ── Dependency CRUD ───────────────────────────────────────────────────────
  addDependency: (processId: number, dep: { source_step_id: number; target_step_id: number }) =>
    fetchApi<Process>(`/api/processes/${processId}/dependencies`, { method: "POST", body: JSON.stringify(dep) }),
  deleteDependency: (processId: number, depId: number) =>
    fetchApi<Process>(`/api/processes/${processId}/dependencies/${depId}`, { method: "DELETE" }),

  // ── Analytics ─────────────────────────────────────────────────────────────
  analyze: (processId: number, revenue_per_unit?: number) => {
    const q = revenue_per_unit != null ? `?revenue_per_unit=${revenue_per_unit}` : "";
    return fetchApi<{ analysis: AnalysisResult; recommendations: Recommendation[]; risk: RiskClassification }>(
      `/api/processes/${processId}/analyze${q}`,
      { method: "POST" }
    );
  },
  simulate: (processId: number, request: SimulationRequest) =>
    fetchApi<SimulationResult>(`/api/processes/${processId}/simulate`, { method: "POST", body: JSON.stringify(request) }),
  sensitivity: (processId: number, body: { step_id: number; param?: string; min_multiplier?: number; max_multiplier?: number; num_points?: number }, revenue_per_unit?: number) => {
    const q = revenue_per_unit != null ? `?revenue_per_unit=${revenue_per_unit}` : "";
    return fetchApi<Array<Record<string, number | string>>>(`/api/processes/${processId}/sensitivity${q}`, { method: "POST", body: JSON.stringify(body) });
  },
  monteCarlo: (processId: number, params?: { num_iterations?: number; variation_percent?: number; seed?: number; revenue_per_unit?: number }) => {
    const sp = new URLSearchParams();
    if (params?.num_iterations) sp.set("num_iterations", String(params.num_iterations));
    if (params?.variation_percent) sp.set("variation_percent", String(params.variation_percent));
    if (params?.seed != null) sp.set("seed", String(params.seed));
    if (params?.revenue_per_unit != null) sp.set("revenue_per_unit", String(params.revenue_per_unit));
    const q = sp.toString();
    return fetchApi<MonteCarloResult>(`/api/processes/${processId}/monte-carlo${q ? `?${q}` : ""}`, { method: "POST" });
  },
  multiScenario: (processId: number, body: { scenarios: SimulationRequest[]; scenario_names?: string[] }) =>
    fetchApi<{ scenarios: Array<{ name: string; result?: SimulationResult; error?: string }> }>(
      `/api/processes/${processId}/multi-scenario`,
      { method: "POST", body: JSON.stringify(body) }
    ),

  // ── Export & Import ───────────────────────────────────────────────────────
  exportPdf: (processId: number, revenue_per_unit?: number) =>
    `${API_BASE}/api/processes/${processId}/export-pdf${revenue_per_unit != null ? `?revenue_per_unit=${revenue_per_unit}` : ""}`,
  uploadCsv: async (file: File, name?: string, description?: string) => {
    const form = new FormData();
    form.append("file", file);
    const params = new URLSearchParams();
    if (name) params.set("name", name);
    if (description) params.set("description", description);
    const res = await fetch(`${API_BASE}/api/processes/upload-csv?${params}`, { method: "POST", body: form });
    if (!res.ok) throw new Error(await res.text());
    return res.json() as Promise<Process>;
  },
};
