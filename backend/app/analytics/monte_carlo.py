"""Monte Carlo simulation for delay variability using numpy."""
import numpy as np

from app.analytics.engine import analyze_process


def run_monte_carlo(
    steps: list[dict],
    dependencies: list[tuple[int, int]],
    num_iterations: int = 500,
    variation_percent: float = 20,
    seed: int | None = None,
    revenue_per_unit: float | None = None,
) -> dict:
    """
    Run Monte Carlo simulation: randomly vary step durations AND costs by ±variation_percent.
    Uses numpy for vectorized random generation for better performance.
    Returns distribution stats for cycle_time, daily_cost, and throughput.
    """
    rng = np.random.default_rng(seed)
    vf = variation_percent / 100.0

    cycle_times: list[float] = []
    daily_costs: list[float] = []
    throughputs: list[float] = []

    n_steps = len(steps)
    if n_steps > 0:
        # Separate multipliers for duration and cost so they vary independently
        duration_multipliers = rng.uniform(1 - vf, 1 + vf, size=(num_iterations, n_steps))
        cost_multipliers = rng.uniform(1 - vf, 1 + vf, size=(num_iterations, n_steps))
    else:
        duration_multipliers = np.ones((num_iterations, 1))
        cost_multipliers = np.ones((num_iterations, 1))

    original_durations = np.array([s["duration_minutes"] for s in steps])
    original_costs = np.array([s["cost_per_execution"] for s in steps])

    for i in range(num_iterations):
        modified_steps = []
        for j, s in enumerate(steps):
            ms = dict(s)
            ms["duration_minutes"] = max(0.1, float(original_durations[j] * duration_multipliers[i, j]))
            ms["cost_per_execution"] = max(0.0, float(original_costs[j] * cost_multipliers[i, j]))
            modified_steps.append(ms)

        try:
            analysis = analyze_process(
                modified_steps, dependencies, revenue_per_unit=revenue_per_unit
            )
            cycle_times.append(analysis.cycle_time_minutes)
            daily_costs.append(analysis.cost_breakdown.daily_cost)
            throughputs.append(analysis.throughput_per_hour)
        except ValueError:
            continue

    def stats(vals: list[float]) -> dict:
        if not vals:
            return {"mean": 0, "std": 0, "min": 0, "max": 0, "p10": 0, "p50": 0, "p90": 0, "p95": 0}
        arr = np.array(vals)
        return {
            "mean": round(float(np.mean(arr)), 2),
            "std": round(float(np.std(arr)), 2),
            "min": round(float(np.min(arr)), 2),
            "max": round(float(np.max(arr)), 2),
            "p10": round(float(np.percentile(arr, 10)), 2),
            "p50": round(float(np.percentile(arr, 50)), 2),
            "p90": round(float(np.percentile(arr, 90)), 2),
            "p95": round(float(np.percentile(arr, 95)), 2),
        }

    return {
        "iterations": num_iterations,
        "successful_iterations": len(cycle_times),
        "variation_percent": variation_percent,
        "cycle_time": stats(cycle_times),
        "daily_cost": stats(daily_costs),
        "throughput": stats(throughputs),
        "risk_summary": _risk_summary(cycle_times, steps, dependencies),
    }


def _risk_summary(cycle_times: list[float], steps: list[dict], deps: list) -> dict:
    """Compute high-level risk summary from Monte Carlo results."""
    if not cycle_times:
        return {}
    arr = np.array(cycle_times)
    p50 = float(np.percentile(arr, 50))
    p95 = float(np.percentile(arr, 95))
    spread = p95 - p50
    spread_pct = (spread / p50 * 100) if p50 > 0 else 0
    if spread_pct > 40:
        volatility = "high"
    elif spread_pct > 20:
        volatility = "medium"
    else:
        volatility = "low"
    return {
        "p50_vs_p95_spread_minutes": round(spread, 2),
        "spread_percent": round(spread_pct, 1),
        "volatility": volatility,
    }