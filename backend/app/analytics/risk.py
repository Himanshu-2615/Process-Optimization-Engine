"""Risk classification engine."""
from app.schemas.analytics import AnalysisResult, BottleneckType


def classify_risk(analysis: AnalysisResult) -> dict:
    """
    Classify overall process risk and per-step risk.
    Returns: overall_risk (low/medium/high/critical), risk_score 0-100, step_risks.
    """
    score = 0

    # SLA violations: high impact
    sla_bottlenecks = [b for b in analysis.bottlenecks if b.type == BottleneckType.SLA]
    score += len(sla_bottlenecks) * 25

    # Utilization > 85%
    over_util = sum(1 for u in analysis.resource_utilization.values() if u > 85)
    score += over_util * 15

    # Duration bottleneck on critical path
    duration_bottlenecks = [b for b in analysis.bottlenecks if b.type == BottleneckType.DURATION]
    critical_set = set(analysis.critical_path)
    if any(b.step_name in critical_set for b in duration_bottlenecks):
        score += 20

    # High cost concentration
    if analysis.cost_breakdown.daily_cost > 0:
        costs = list(analysis.cost_breakdown.per_step_costs.values())
        max_cost = max(costs) if costs else 0
        if max_cost / analysis.cost_breakdown.daily_cost > 0.5:
            score += 15

    # SLA risk score from analysis
    score = max(score, analysis.sla_risk_score)

    if score >= 75:
        level = "critical"
    elif score >= 50:
        level = "high"
    elif score >= 25:
        level = "medium"
    else:
        level = "low"

    # Per-step risk
    step_risks: dict[str, dict] = {}
    bottleneck_steps = {b.step_name for b in analysis.bottlenecks}
    for name, util in analysis.resource_utilization.items():
        step_score = 0
        if name in bottleneck_steps:
            b_list = [b for b in analysis.bottlenecks if b.step_name == name]
            for b in b_list:
                if b.type == BottleneckType.SLA:
                    step_score += 40
                elif b.type == BottleneckType.UTILIZATION:
                    step_score += 30
                elif b.type == BottleneckType.DURATION:
                    step_score += 25
                else:
                    step_score += 15
        if util > 85:
            step_score = max(step_score, 35)
        if name in critical_set:
            step_score += 10

        if step_score >= 60:
            step_level = "high"
        elif step_score >= 30:
            step_level = "medium"
        else:
            step_level = "low"

        step_risks[name] = {"score": min(100, step_score), "level": step_level}

    return {
        "overall_risk": level,
        "risk_score": min(100, round(score, 1)),
        "step_risks": step_risks,
    }
