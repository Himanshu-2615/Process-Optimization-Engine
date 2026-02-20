"""Optimization simulation engine."""
from app.analytics.engine import analyze_process
from app.schemas.analytics import SimulationRequest, SimulationResult, SimulationType


def run_simulation(
    steps: list[dict],
    dependencies: list[tuple[int, int]],
    request: SimulationRequest,
) -> SimulationResult:
    """
    Run optimization simulation and return before/after metrics.
    """
    base_analysis = analyze_process(
        steps, dependencies, revenue_per_unit=request.revenue_per_unit
    )

    new_steps = [dict(s) for s in steps]
    step_map = {s["id"]: s for s in new_steps}

    if request.step_id not in step_map:
        raise ValueError(f"Step id {request.step_id} not found")

    target = step_map[request.step_id]
    impl_cost = request.implementation_cost or 0

    if request.simulation_type == SimulationType.REDUCE_DURATION:
        pct = (request.duration_reduction_percent or 0) / 100
        target["duration_minutes"] = target["duration_minutes"] * (1 - pct)
    elif request.simulation_type == SimulationType.ADD_RESOURCE:
        add = request.resources_to_add or 1
        target["resource_count"] = target["resource_count"] + add
    elif request.simulation_type == SimulationType.REMOVE_STEP:
        new_steps = [s for s in new_steps if s["id"] != request.step_id]
        new_deps = [
            (a, b)
            for a, b in dependencies
            if a != request.step_id and b != request.step_id
        ]
        dependencies = new_deps
    elif request.simulation_type == SimulationType.AUTOMATE:
        if request.new_duration_minutes is not None:
            target["duration_minutes"] = request.new_duration_minutes
        if request.new_cost_per_execution is not None:
            target["cost_per_execution"] = request.new_cost_per_execution
    elif request.simulation_type == SimulationType.MERGE_STEPS:
        if request.merge_target_step_id and request.merge_target_step_id in step_map:
            other = step_map[request.merge_target_step_id]
            target["duration_minutes"] += other["duration_minutes"]
            target["cost_per_execution"] += other["cost_per_execution"]
            target["executions_per_day"] = max(
                target["executions_per_day"], other["executions_per_day"]
            )
            new_steps = [s for s in new_steps if s["id"] != request.merge_target_step_id]
            new_deps = [
                (a, b)
                for a, b in dependencies
                if a != request.merge_target_step_id and b != request.merge_target_step_id
            ]
            dependencies = new_deps

    if not new_steps:
        return SimulationResult(
            original_cycle_time=base_analysis.cycle_time_minutes,
            new_cycle_time=0,
            time_saved_minutes=base_analysis.cycle_time_minutes,
            original_daily_cost=base_analysis.cost_breakdown.daily_cost,
            new_daily_cost=0,
            cost_saved_daily=base_analysis.cost_breakdown.daily_cost,
            original_throughput=base_analysis.throughput_per_hour,
            new_throughput=0,
            roi=None,
            annual_savings=base_analysis.cost_breakdown.daily_cost * 365,
            implementation_cost=impl_cost,
            payback_months=impl_cost / (base_analysis.cost_breakdown.daily_cost * 30)
            if base_analysis.cost_breakdown.daily_cost > 0
            else None,
        )

    new_analysis = analyze_process(
        new_steps, dependencies, revenue_per_unit=request.revenue_per_unit
    )

    time_saved = base_analysis.cycle_time_minutes - new_analysis.cycle_time_minutes
    cost_saved = base_analysis.cost_breakdown.daily_cost - new_analysis.cost_breakdown.daily_cost
    annual_savings = cost_saved * 365

    roi = None
    if impl_cost > 0:
        roi = (annual_savings - impl_cost) / impl_cost

    payback = None
    if cost_saved > 0 and impl_cost > 0:
        monthly_savings = cost_saved * 30
        payback = impl_cost / monthly_savings

    return SimulationResult(
        original_cycle_time=base_analysis.cycle_time_minutes,
        new_cycle_time=new_analysis.cycle_time_minutes,
        time_saved_minutes=round(time_saved, 2),
        original_daily_cost=base_analysis.cost_breakdown.daily_cost,
        new_daily_cost=new_analysis.cost_breakdown.daily_cost,
        cost_saved_daily=round(cost_saved, 2),
        original_throughput=base_analysis.throughput_per_hour,
        new_throughput=new_analysis.throughput_per_hour,
        roi=round(roi, 2) if roi is not None else None,
        annual_savings=round(annual_savings, 2),
        implementation_cost=impl_cost,
        payback_months=round(payback, 2) if payback is not None else None,
    )
