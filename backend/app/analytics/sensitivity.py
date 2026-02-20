"""Sensitivity analysis - vary parameters and measure impact."""
from app.analytics.engine import analyze_process


def run_sensitivity_analysis(
    steps: list[dict],
    dependencies: list[tuple[int, int]],
    step_id: int,
    param: str,
    min_multiplier: float,
    max_multiplier: float,
    num_points: int,
    revenue_per_unit: float | None = None,
) -> list[dict]:
    """
    Vary a step parameter and return analysis results for each value.
    param: 'duration_minutes', 'cost_per_execution', 'resource_count', or 'executions_per_day'
    multipliers: 0.8 = 80% of original, 1.2 = 120%
    """
    step_map = {s["id"]: dict(s) for s in steps}
    if step_id not in step_map:
        raise ValueError(f"Step {step_id} not found")

    original = step_map[step_id].get(param)
    if original is None:
        raise ValueError(f"Parameter {param} not found on step")

    results = []
    for i in range(num_points):
        t = i / max(num_points - 1, 1)
        mult = min_multiplier + t * (max_multiplier - min_multiplier)
        new_val = original * mult
        if param in ("resource_count", "executions_per_day"):
            new_val = max(1, int(round(new_val)))
        else:
            new_val = max(0, new_val)

        modified_steps = [dict(s) for s in steps]
        for ms in modified_steps:
            if ms["id"] == step_id:
                ms[param] = new_val
                break

        analysis = analyze_process(
            modified_steps, dependencies, revenue_per_unit=revenue_per_unit
        )
        results.append({
            "multiplier": round(mult, 3),
            "value": new_val if isinstance(new_val, int) else round(new_val, 2),
            "cycle_time_minutes": analysis.cycle_time_minutes,
            "throughput_per_hour": analysis.throughput_per_hour,
            "daily_cost": analysis.cost_breakdown.daily_cost,
            "sla_risk_score": analysis.sla_risk_score,
        })

    return results
