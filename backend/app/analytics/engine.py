"""Main analytics engine: cycle time, throughput, bottlenecks, utilization."""
import numpy as np
from collections import defaultdict

from app.analytics.dag import detect_cycle, get_critical_path
from app.schemas.analytics import (
    AnalysisResult,
    BottleneckInfo,
    BottleneckType,
    CostBreakdown,
)

WORKING_MINUTES_PER_DAY = 480  # 8 hours


def analyze_process(
    steps: list[dict],
    dependencies: list[tuple[int, int]],
    revenue_per_unit: float | None = None,
) -> AnalysisResult:
    """
    Full process analysis: cycle time, throughput, bottlenecks, cost, utilization.
    Uses numpy for accurate statistical computations.
    """
    if not steps:
        return AnalysisResult(
            cycle_time_minutes=0,
            throughput_per_hour=0,
            bottlenecks=[],
            resource_utilization={},
            cost_breakdown=CostBreakdown(
                daily_cost=0,
                monthly_cost=0,
                per_step_costs={},
            ),
            sla_risk_score=0,
            critical_path=[],
        )

    step_ids = {s["id"] for s in steps}
    if detect_cycle(step_ids, dependencies):
        raise ValueError("Process has circular dependencies. Must form a DAG.")

    steps_dict = {s["id"]: (s["name"], s["duration_minutes"]) for s in steps}

    # Critical path and cycle time
    critical_path_names, cycle_time = get_critical_path(steps_dict, dependencies)

    # Throughput = 60 / bottleneck duration (bottleneck = step with max duration on critical path)
    durations = np.array([s["duration_minutes"] for s in steps])
    max_duration = float(np.max(durations)) if len(durations) > 0 else 0
    throughput_per_hour = 60.0 / max_duration if max_duration > 0 else 0.0

    # Bottleneck detection
    bottlenecks: list[BottleneckInfo] = []
    critical_set = set(critical_path_names)

    cost_impacts = np.array([s["executions_per_day"] * s["cost_per_execution"] for s in steps])
    max_cost_impact = float(np.max(cost_impacts)) if len(cost_impacts) > 0 else 0

    for s in steps:
        dur = s["duration_minutes"]
        cost_impact = s["executions_per_day"] * s["cost_per_execution"]
        util_avail = WORKING_MINUTES_PER_DAY * s["resource_count"]
        util_used = s["executions_per_day"] * dur
        util_pct = (util_used / util_avail * 100) if util_avail > 0 else 0

        # Duration bottleneck — longest step limits throughput
        if max_duration > 0 and dur == max_duration:
            severity = min(1.0, dur / WORKING_MINUTES_PER_DAY)
            bottlenecks.append(
                BottleneckInfo(
                    step_id=s["id"],
                    step_name=s["name"],
                    type=BottleneckType.DURATION,
                    severity=round(severity, 3),
                    message=f"Longest step ({dur:.0f} min) — limits throughput to {throughput_per_hour:.2f}/hr",
                    current_value=dur,
                )
            )

        # Cost impact bottleneck — top 80th percentile cost
        if max_cost_impact > 0 and cost_impact >= max_cost_impact * 0.8:
            bottlenecks.append(
                BottleneckInfo(
                    step_id=s["id"],
                    step_name=s["name"],
                    type=BottleneckType.COST,
                    severity=round(min(1.0, cost_impact / max_cost_impact), 3),
                    message=f"High cost impact: ₹{cost_impact:,.0f}/day ({cost_impact / max_cost_impact * 100:.0f}% of peak)",
                    current_value=round(cost_impact, 2),
                )
            )

        # SLA violation risk
        sla = s.get("sla_limit_minutes")
        if sla and dur > sla:
            overage = dur - sla
            bottlenecks.append(
                BottleneckInfo(
                    step_id=s["id"],
                    step_name=s["name"],
                    type=BottleneckType.SLA,
                    severity=1.0,
                    message=f"SLA breach: {dur:.0f} min > {sla:.0f} min limit (over by {overage:.0f} min)",
                    current_value=dur,
                )
            )
        elif sla and dur > sla * 0.85:
            # Near-SLA warning
            bottlenecks.append(
                BottleneckInfo(
                    step_id=s["id"],
                    step_name=s["name"],
                    type=BottleneckType.SLA,
                    severity=0.6,
                    message=f"Near SLA limit: {dur:.0f} min vs {sla:.0f} min ({dur/sla*100:.0f}% of limit)",
                    current_value=dur,
                )
            )

        # Resource over-utilization
        if util_pct > 85:
            bottlenecks.append(
                BottleneckInfo(
                    step_id=s["id"],
                    step_name=s["name"],
                    type=BottleneckType.UTILIZATION,
                    severity=round(min(1.0, util_pct / 100), 3),
                    message=f"Over-utilized: {util_pct:.1f}% (threshold: 85%)",
                    current_value=round(util_pct, 2),
                )
            )

    # Resource utilization map
    resource_utilization: dict[str, float] = {}
    for s in steps:
        avail = WORKING_MINUTES_PER_DAY * s["resource_count"]
        utilized = s["executions_per_day"] * s["duration_minutes"]
        util = (utilized / avail * 100) if avail > 0 else 0
        resource_utilization[s["name"]] = round(util, 2)

    # Cost breakdown
    per_step_costs: dict[str, float] = {}
    daily_cost = 0.0
    for s in steps:
        cost = s["executions_per_day"] * s["cost_per_execution"]
        per_step_costs[s["name"]] = round(cost, 2)
        daily_cost += cost

    daily_cost = round(daily_cost, 2)
    monthly_cost = round(daily_cost * 30, 2)

    delay_loss = None
    revenue_impact = None
    if revenue_per_unit and cycle_time > 0 and throughput_per_hour > 0:
        units_per_hour = throughput_per_hour
        delay_loss = round(cycle_time * (revenue_per_unit / 60) * units_per_hour, 2)
        revenue_impact = round(revenue_per_unit * units_per_hour * 8, 2)

    cost_breakdown = CostBreakdown(
        daily_cost=daily_cost,
        monthly_cost=monthly_cost,
        per_step_costs=per_step_costs,
        delay_loss=delay_loss,
        revenue_impact=revenue_impact,
    )

    # SLA risk score 0-100
    sla_violations = sum(1 for b in bottlenecks if b.type == BottleneckType.SLA and b.severity == 1.0)
    sla_warnings = sum(1 for b in bottlenecks if b.type == BottleneckType.SLA and b.severity < 1.0)
    util_high = sum(1 for u in resource_utilization.values() if u > 85)
    critical_bottleneck = any(
        b.step_name in critical_set
        for b in bottlenecks
        if b.type == BottleneckType.DURATION
    )
    sla_risk_score = min(
        100,
        sla_violations * 30
        + sla_warnings * 10
        + util_high * 15
        + (20 if critical_bottleneck else 0),
    )

    return AnalysisResult(
        cycle_time_minutes=round(cycle_time, 2),
        throughput_per_hour=round(throughput_per_hour, 4),
        bottlenecks=bottlenecks,
        resource_utilization=resource_utilization,
        cost_breakdown=cost_breakdown,
        sla_risk_score=round(sla_risk_score, 2),
        critical_path=critical_path_names,
    )
