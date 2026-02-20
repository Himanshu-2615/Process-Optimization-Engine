"""Analytics and simulation schemas."""
from enum import Enum
from pydantic import BaseModel, Field


class BottleneckType(str, Enum):
    """Types of bottlenecks."""

    DURATION = "duration"
    COST = "cost"
    SLA = "sla"
    UTILIZATION = "utilization"


class BottleneckInfo(BaseModel):
    """Information about a detected bottleneck."""

    step_id: int
    step_name: str
    type: BottleneckType
    severity: float  # 0-1
    message: str
    current_value: float


class CostBreakdown(BaseModel):
    """Cost breakdown per step and total."""

    daily_cost: float
    monthly_cost: float
    per_step_costs: dict[str, float]
    delay_loss: float | None = None
    revenue_impact: float | None = None


class AnalysisResult(BaseModel):
    """Full analysis result."""

    cycle_time_minutes: float
    throughput_per_hour: float
    bottlenecks: list[BottleneckInfo]
    resource_utilization: dict[str, float]
    cost_breakdown: CostBreakdown
    sla_risk_score: float  # 0-100
    critical_path: list[str]


class SimulationType(str, Enum):
    """Types of optimization simulations."""

    REDUCE_DURATION = "reduce_duration"
    ADD_RESOURCE = "add_resource"
    REMOVE_STEP = "remove_step"
    MERGE_STEPS = "merge_steps"
    AUTOMATE = "automate"


class SimulationRequest(BaseModel):
    """Request for optimization simulation."""

    simulation_type: SimulationType
    step_id: int
    # For reduce_duration: percentage (e.g., 40 = 40% reduction)
    duration_reduction_percent: float | None = None
    # For add_resource: number to add
    resources_to_add: int | None = None
    # For merge_steps: target step to merge with
    merge_target_step_id: int | None = None
    # For automate: new duration and cost
    new_duration_minutes: float | None = None
    new_cost_per_execution: float | None = None
    # Implementation cost for ROI
    implementation_cost: float = 0
    # Revenue modeling
    revenue_per_unit: float | None = None


class SimulationResult(BaseModel):
    """Result of optimization simulation."""

    original_cycle_time: float
    new_cycle_time: float
    time_saved_minutes: float
    original_daily_cost: float
    new_daily_cost: float
    cost_saved_daily: float
    original_throughput: float
    new_throughput: float
    roi: float | None
    annual_savings: float
    implementation_cost: float
    payback_months: float | None


class Recommendation(BaseModel):
    """Rule-based recommendation."""

    title: str
    description: str
    step_name: str | None
    priority: str  # high, medium, low
    suggested_action: str


class SensitivityRequest(BaseModel):
    """Request for sensitivity analysis."""

    step_id: int
    param: str = "duration_minutes"  # duration_minutes, cost_per_execution, resource_count, executions_per_day
    min_multiplier: float = 0.8
    max_multiplier: float = 1.2
    num_points: int = Field(ge=3, le=21, default=11)


class MultiScenarioRequest(BaseModel):
    """Request for multi-scenario comparison."""

    scenarios: list[SimulationRequest]
    scenario_names: list[str] | None = None  # Optional labels for each scenario
