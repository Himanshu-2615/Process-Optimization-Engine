"""Rule-based recommendation engine with executive summary."""
from app.schemas.analytics import AnalysisResult, BottleneckType, Recommendation


def generate_recommendations(analysis: AnalysisResult) -> list[Recommendation]:
    """
    Generate structured recommendations based on analysis results.
    Returns prioritized, deduplicated list of actionable recommendations.
    """
    recs: list[Recommendation] = []
    seen_steps: set[str] = set()

    duration_bottlenecks = [b for b in analysis.bottlenecks if b.type == BottleneckType.DURATION]
    util_bottlenecks = [b for b in analysis.bottlenecks if b.type == BottleneckType.UTILIZATION]
    cost_bottlenecks = [b for b in analysis.bottlenecks if b.type == BottleneckType.COST]
    sla_bottlenecks = [b for b in analysis.bottlenecks if b.type == BottleneckType.SLA and b.severity == 1.0]
    sla_warnings = [b for b in analysis.bottlenecks if b.type == BottleneckType.SLA and b.severity < 1.0]
    critical_set = set(analysis.critical_path)

    # 1. Automation: high duration + high utilization
    for b in duration_bottlenecks:
        util = analysis.resource_utilization.get(b.step_name, 0)
        if util > 85 and b.step_name not in seen_steps:
            recs.append(Recommendation(
                title="Automate High-Load Step",
                description=(
                    f"'{b.step_name}' has both the longest duration ({b.current_value:.0f} min) "
                    f"and high resource utilization ({util:.1f}%). This is your most critical bottleneck."
                ),
                step_name=b.step_name,
                priority="high",
                suggested_action=(
                    "Evaluate RPA, workflow automation tools, or AI-assisted processing "
                    "to reduce duration and free up resources. Target 40–60% duration reduction."
                ),
            ))
            seen_steps.add(b.step_name)

    # 2. SLA violations — urgent
    for b in sla_bottlenecks:
        if b.step_name not in seen_steps:
            recs.append(Recommendation(
                title="Resolve SLA Breach — Urgent",
                description=(
                    f"'{b.step_name}' is violating its SLA: {b.current_value:.0f} min actual vs SLA limit. "
                    "This indicates a contractual or operational risk that requires immediate attention."
                ),
                step_name=b.step_name,
                priority="high",
                suggested_action=(
                    "Add resources, parallelize work, or escalate to leadership. "
                    "Consider re-negotiating SLA if structural constraints prevent improvement."
                ),
            ))
            seen_steps.add(b.step_name)

    # 3. Critical path bottleneck → process redesign
    if duration_bottlenecks and critical_set:
        bottleneck_names = {b.step_name for b in duration_bottlenecks}
        critical_bottlenecks = [b for b in duration_bottlenecks if b.step_name in critical_set]
        if critical_bottlenecks:
            central = critical_bottlenecks[0]
            if central.step_name not in seen_steps:
                recs.append(Recommendation(
                    title="Redesign Critical Path Bottleneck",
                    description=(
                        f"'{central.step_name}' is both the duration bottleneck and lies on the critical path "
                        f"({' → '.join(analysis.critical_path)}). Improving this step directly reduces total cycle time."
                    ),
                    step_name=central.step_name,
                    priority="high",
                    suggested_action=(
                        "Consider parallelizing sub-tasks, splitting this step into concurrent streams, "
                        "or redesigning the dependency structure to remove this as a single point of constraint."
                    ),
                ))
                seen_steps.add(central.step_name)

    # 4. SLA warnings (near limit)
    for b in sla_warnings:
        if b.step_name not in seen_steps:
            recs.append(Recommendation(
                title="SLA Warning — Proactive Action Needed",
                description=(
                    f"'{b.step_name}' is operating at {b.current_value / b.current_value * 100:.0f}% "
                    f"near its SLA limit. Minor variability could trigger an SLA breach."
                ),
                step_name=b.step_name,
                priority="medium",
                suggested_action=(
                    "Monitor closely. Build buffer capacity or improve the step's reliability "
                    "to create headroom before the SLA limit."
                ),
            ))
            seen_steps.add(b.step_name)

    # 5. Cost optimization
    for b in cost_bottlenecks:
        if b.step_name not in seen_steps:
            recs.append(Recommendation(
                title="Cost Optimization Opportunity",
                description=(
                    f"'{b.step_name}' is contributing ₹{b.current_value:,.0f}/day — "
                    "a dominant cost center. This is your highest ROI target for cost reduction."
                ),
                step_name=b.step_name,
                priority="medium",
                suggested_action=(
                    "Review vendor pricing, internal cost allocations, or execution frequency. "
                    "Even a 20% cost reduction here creates significant monthly savings."
                ),
            ))
            seen_steps.add(b.step_name)

    # 6. Resource capacity
    for b in util_bottlenecks:
        if b.step_name not in seen_steps:
            recs.append(Recommendation(
                title="Resource Capacity Warning",
                description=(
                    f"'{b.step_name}' is at {b.current_value:.1f}% resource utilization. "
                    "This leaves no buffer for volume spikes or unexpected delays."
                ),
                step_name=b.step_name,
                priority="medium",
                suggested_action=(
                    "Add 1–2 resources to bring utilization below 75%, or reduce executions_per_day. "
                    "Over-utilized steps degrade quality and increase error rates over time."
                ),
            ))
            seen_steps.add(b.step_name)

    # 7. Overall process health — if no bottlenecks detected
    if not recs:
        recs.append(Recommendation(
            title="Process Appears Healthy",
            description=(
                f"No critical bottlenecks detected. Cycle time is {analysis.cycle_time_minutes:.0f} min "
                f"with throughput of {analysis.throughput_per_hour:.2f} units/hr."
            ),
            step_name=None,
            priority="low",
            suggested_action=(
                "Continue monitoring. Consider sensitivity analysis to understand where "
                "the process is most vulnerable to changes in volume or duration."
            ),
        ))

    # Sort: high → medium → low
    priority_order = {"high": 0, "medium": 1, "low": 2}
    recs.sort(key=lambda r: priority_order.get(r.priority, 99))

    return recs
