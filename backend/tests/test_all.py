"""Comprehensive test suite for all analytics features."""
import pytest
from app.analytics.engine import analyze_process
from app.analytics.dag import detect_cycle, get_critical_path
from app.analytics.simulation import run_simulation
from app.analytics.sensitivity import run_sensitivity_analysis
from app.analytics.monte_carlo import run_monte_carlo
from app.analytics.risk import classify_risk
from app.analytics.recommendations import generate_recommendations
from app.services.csv_parser import parse_process_csv
from app.schemas.analytics import SimulationRequest, SimulationType


# ── Helpers ──────────────────────────────────────────────────────────────────

def make_steps(specs: list[tuple]) -> list[dict]:
    """Create steps from (id, name, duration, cost, resources, sla, execs_per_day)."""
    keys = ["id", "name", "duration_minutes", "cost_per_execution", "resource_count", "sla_limit_minutes", "executions_per_day"]
    return [dict(zip(keys, s)) for s in specs]


# ── DAG Tests ────────────────────────────────────────────────────────────────

class TestDAG:
    def test_no_cycle_linear(self):
        assert detect_cycle({1, 2, 3}, [(1, 2), (2, 3)]) is False

    def test_cycle_detected(self):
        assert detect_cycle({1, 2, 3}, [(1, 2), (2, 3), (3, 1)]) is True

    def test_self_loop(self):
        assert detect_cycle({1}, [(1, 1)]) is True

    def test_empty(self):
        assert detect_cycle(set(), []) is False

    def test_no_edges(self):
        assert detect_cycle({1, 2, 3}, []) is False

    def test_diamond_no_cycle(self):
        # A -> B, A -> C, B -> D, C -> D
        assert detect_cycle({1, 2, 3, 4}, [(1, 2), (1, 3), (2, 4), (3, 4)]) is False

    def test_critical_path_linear(self):
        steps = {1: ("A", 10), 2: ("B", 20), 3: ("C", 15)}
        path, t = get_critical_path(steps, [(1, 2), (2, 3)])
        assert path == ["A", "B", "C"]
        assert t == 45

    def test_critical_path_chooses_longer_branch(self):
        steps = {1: ("A", 10), 2: ("B", 30), 3: ("C", 5)}
        path, t = get_critical_path(steps, [(1, 2), (1, 3)])
        assert t == 40  # A->B=40, A->C=15
        assert "B" in path

    def test_critical_path_single(self):
        path, t = get_critical_path({1: ("X", 5)}, [])
        assert path == ["X"]
        assert t == 5

    def test_critical_path_parallel_merge(self):
        # A splits to B and C, both merge into D
        steps = {1: ("A", 5), 2: ("B", 20), 3: ("C", 10), 4: ("D", 15)}
        deps = [(1, 2), (1, 3), (2, 4), (3, 4)]
        path, t = get_critical_path(steps, deps)
        assert t == 40  # A(5) -> B(20) -> D(15) = 40


# ── Analytics Engine Tests ───────────────────────────────────────────────────

class TestAnalyticsEngine:
    def test_empty_process(self):
        result = analyze_process([], [])
        assert result.cycle_time_minutes == 0
        assert result.throughput_per_hour == 0
        assert result.bottlenecks == []

    def test_linear_process(self):
        steps = make_steps([
            (1, "A", 10, 5, 1, None, 10),
            (2, "B", 20, 10, 1, None, 10),
        ])
        result = analyze_process(steps, [(1, 2)])
        assert result.cycle_time_minutes == 30
        assert result.throughput_per_hour == pytest.approx(3.0, rel=0.01)
        assert result.critical_path == ["A", "B"]
        assert result.cost_breakdown.daily_cost == 150.0  # 10*5 + 10*10

    def test_circular_raises(self):
        steps = make_steps([(1, "A", 10, 5, 1, None, 10), (2, "B", 20, 10, 1, None, 10)])
        with pytest.raises(ValueError, match="circular"):
            analyze_process(steps, [(1, 2), (2, 1)])

    def test_sla_violation_detected(self):
        steps = make_steps([(1, "Slow", 100, 10, 1, 60, 5)])  # duration > SLA
        result = analyze_process(steps, [])
        sla_bottlenecks = [b for b in result.bottlenecks if b.type.value == "sla" and b.severity == 1.0]
        assert len(sla_bottlenecks) == 1

    def test_sla_warning_near_limit(self):
        steps = make_steps([(1, "Near", 90, 10, 1, 100, 5)])  # 90 vs SLA 100 (90%)
        result = analyze_process(steps, [])
        sla_warns = [b for b in result.bottlenecks if b.type.value == "sla" and b.severity < 1.0]
        assert len(sla_warns) == 1

    def test_over_utilization_detected(self):
        # 1 resource, 100 executions * 10 min = 1000 min > 480 min capacity
        steps = make_steps([(1, "Busy", 10, 5, 1, None, 100)])
        result = analyze_process(steps, [])
        util_bottlenecks = [b for b in result.bottlenecks if b.type.value == "utilization"]
        assert len(util_bottlenecks) == 1
        assert result.resource_utilization["Busy"] > 85

    def test_monthly_cost_is_30x_daily(self):
        steps = make_steps([(1, "A", 10, 5, 1, None, 10)])
        result = analyze_process(steps, [])
        assert result.cost_breakdown.monthly_cost == result.cost_breakdown.daily_cost * 30

    def test_revenue_impact_computed(self):
        steps = make_steps([(1, "A", 10, 5, 1, None, 10)])
        result = analyze_process(steps, [], revenue_per_unit=500)
        assert result.cost_breakdown.revenue_impact is not None
        assert result.cost_breakdown.revenue_impact > 0

    def test_parallel_process(self):
        # A -> B, A -> C (parallel). Cycle time = A + max(B, C)
        steps = make_steps([
            (1, "A", 10, 5, 1, None, 10),
            (2, "B", 30, 10, 1, None, 10),
            (3, "C", 20, 8, 1, None, 10),
        ])
        result = analyze_process(steps, [(1, 2), (1, 3)])
        assert result.cycle_time_minutes == 40  # A=10 + B=30


# ── Simulation Tests ─────────────────────────────────────────────────────────

class TestSimulation:
    def _base_steps(self):
        return make_steps([
            (1, "A", 10, 5, 1, None, 10),
            (2, "B", 120, 50, 3, None, 10),
            (3, "C", 60, 20, 2, None, 10),
        ])

    def test_reduce_duration(self):
        steps = self._base_steps()
        req = SimulationRequest(
            simulation_type=SimulationType.REDUCE_DURATION,
            step_id=2,
            duration_reduction_percent=40,
            implementation_cost=100000,
        )
        result = run_simulation(steps, [(1, 2), (2, 3)], req)
        assert result.new_cycle_time < result.original_cycle_time
        assert result.time_saved_minutes > 0

    def test_add_resource(self):
        steps = self._base_steps()
        req = SimulationRequest(
            simulation_type=SimulationType.ADD_RESOURCE,
            step_id=2,
            resources_to_add=2,
        )
        result = run_simulation(steps, [(1, 2), (2, 3)], req)
        # Adding resources doesn't change cycle time but improves utilization
        assert result.new_cycle_time == result.original_cycle_time

    def test_remove_step(self):
        steps = self._base_steps()
        req = SimulationRequest(
            simulation_type=SimulationType.REMOVE_STEP,
            step_id=2,
        )
        result = run_simulation(steps, [(1, 2), (2, 3)], req)
        assert result.new_cycle_time < result.original_cycle_time
        assert result.cost_saved_daily > 0

    def test_automate_step(self):
        steps = self._base_steps()
        req = SimulationRequest(
            simulation_type=SimulationType.AUTOMATE,
            step_id=2,
            new_duration_minutes=30,
            new_cost_per_execution=10,
            implementation_cost=200000,
        )
        result = run_simulation(steps, [(1, 2), (2, 3)], req)
        assert result.new_cycle_time < result.original_cycle_time
        assert result.cost_saved_daily > 0

    def test_roi_computed(self):
        steps = self._base_steps()
        req = SimulationRequest(
            simulation_type=SimulationType.REDUCE_DURATION,
            step_id=2,
            duration_reduction_percent=40,
            implementation_cost=50000,
        )
        result = run_simulation(steps, [(1, 2), (2, 3)], req)
        assert result.roi is not None

    def test_no_impl_cost_no_roi(self):
        steps = self._base_steps()
        req = SimulationRequest(
            simulation_type=SimulationType.REDUCE_DURATION,
            step_id=2,
            duration_reduction_percent=40,
            implementation_cost=0,
        )
        result = run_simulation(steps, [(1, 2), (2, 3)], req)
        assert result.roi is None

    def test_roi_formula(self):
        """ROI = (annual_savings - impl_cost) / impl_cost"""
        steps = make_steps([(1, "A", 120, 50, 1, None, 10)])
        req = SimulationRequest(
            simulation_type=SimulationType.REDUCE_DURATION,
            step_id=1,
            duration_reduction_percent=50,
            implementation_cost=100000,
        )
        result = run_simulation(steps, [], req)
        if result.roi is not None and result.implementation_cost > 0:
            expected_roi = (result.annual_savings - result.implementation_cost) / result.implementation_cost
            assert abs(result.roi - expected_roi) < 0.01


# ── Advanced Features ─────────────────────────────────────────────────────────

class TestSensitivity:
    def test_basic_sensitivity(self):
        steps = make_steps([
            (1, "A", 10, 5, 1, None, 10),
            (2, "B", 100, 50, 1, None, 10),
        ])
        result = run_sensitivity_analysis(
            steps, [(1, 2)], step_id=2, param="duration_minutes",
            min_multiplier=0.8, max_multiplier=1.2, num_points=5
        )
        assert len(result) == 5
        assert result[0]["multiplier"] == pytest.approx(0.8, abs=0.01)
        assert result[-1]["multiplier"] == pytest.approx(1.2, abs=0.01)

    def test_longer_duration_increases_cycle_time(self):
        steps = make_steps([(1, "A", 100, 5, 1, None, 10)])
        result = run_sensitivity_analysis(steps, [], step_id=1, param="duration_minutes",
                                          min_multiplier=0.5, max_multiplier=2.0, num_points=5)
        times = [r["cycle_time_minutes"] for r in result]
        assert times == sorted(times)  # monotonically increasing

    def test_invalid_step_raises(self):
        steps = make_steps([(1, "A", 10, 5, 1, None, 10)])
        with pytest.raises(ValueError):
            run_sensitivity_analysis(steps, [], step_id=999, param="duration_minutes",
                                     min_multiplier=0.8, max_multiplier=1.2, num_points=3)


class TestMonteCarlo:
    def test_basic_run(self):
        steps = make_steps([(1, "A", 10, 5, 1, None, 10)])
        result = run_monte_carlo(steps, [], num_iterations=100, variation_percent=10, seed=42)
        assert result["iterations"] == 100
        assert result["cycle_time"]["mean"] > 0
        assert result["cycle_time"]["std"] >= 0
        assert "risk_summary" in result

    def test_seeded_reproducible(self):
        steps = make_steps([(1, "A", 50, 5, 1, None, 5)])
        r1 = run_monte_carlo(steps, [], num_iterations=50, seed=99)
        r2 = run_monte_carlo(steps, [], num_iterations=50, seed=99)
        assert r1["cycle_time"]["mean"] == r2["cycle_time"]["mean"]

    def test_higher_variation_wider_distribution(self):
        steps = make_steps([(1, "A", 50, 5, 1, None, 5)])
        r_low = run_monte_carlo(steps, [], num_iterations=200, variation_percent=5, seed=1)
        r_high = run_monte_carlo(steps, [], num_iterations=200, variation_percent=40, seed=1)
        assert r_high["cycle_time"]["std"] > r_low["cycle_time"]["std"]

    def test_percentile_ordering(self):
        steps = make_steps([(1, "A", 30, 5, 1, None, 10)])
        r = run_monte_carlo(steps, [], num_iterations=300, seed=7)
        ct = r["cycle_time"]
        assert ct["min"] <= ct["p10"] <= ct["p50"] <= ct["p90"] <= ct["p95"] <= ct["max"]


class TestRisk:
    def test_low_risk(self):
        steps = make_steps([(1, "A", 5, 2, 2, 30, 5)])
        analysis = analyze_process(steps, [])
        risk = classify_risk(analysis)
        assert risk["overall_risk"] in ("low", "medium")

    def test_high_risk_sla_violation(self):
        steps = make_steps([(1, "A", 100, 5, 1, 30, 50)])  # SLA breach + high util
        analysis = analyze_process(steps, [])
        risk = classify_risk(analysis)
        assert risk["overall_risk"] in ("high", "critical")
        assert risk["risk_score"] > 25

    def test_step_risks_present(self):
        steps = make_steps([(1, "A", 10, 5, 1, None, 10)])
        analysis = analyze_process(steps, [])
        risk = classify_risk(analysis)
        assert "step_risks" in risk
        assert isinstance(risk["step_risks"], dict)

    def test_score_bounded(self):
        steps = make_steps([(1, "A", 200, 100, 1, 10, 100)])
        analysis = analyze_process(steps, [])
        risk = classify_risk(analysis)
        assert 0 <= risk["risk_score"] <= 100


class TestRecommendations:
    def test_healthy_process_gets_recommendation(self):
        steps = make_steps([(1, "A", 5, 2, 3, 30, 5)])
        analysis = analyze_process(steps, [])
        recs = generate_recommendations(analysis)
        assert len(recs) >= 1

    def test_sla_violation_high_priority(self):
        steps = make_steps([(1, "Slow", 200, 10, 1, 30, 5)])
        analysis = analyze_process(steps, [])
        recs = generate_recommendations(analysis)
        highs = [r for r in recs if r.priority == "high"]
        assert len(highs) > 0

    def test_priorities_sorted(self):
        steps = make_steps([(1, "A", 200, 100, 1, 30, 100)])
        analysis = analyze_process(steps, [])
        recs = generate_recommendations(analysis)
        order = {"high": 0, "medium": 1, "low": 2}
        priorities = [order[r.priority] for r in recs]
        assert priorities == sorted(priorities)


class TestCsvParser:
    def test_basic_csv(self):
        csv = "name,duration_minutes,cost_per_execution,resource_count,sla_limit_minutes,executions_per_day\nStep A,10,5,2,15,50\nStep B,20,10,1,,30"
        data = parse_process_csv(csv, "Test")
        assert len(data["steps"]) == 2
        assert data["steps"][0]["name"] == "Step A"
        assert data["steps"][1]["sla_limit_minutes"] is None

    def test_sequential_deps_auto_created(self):
        csv = "name,duration_minutes,cost_per_execution,resource_count,sla_limit_minutes,executions_per_day\nA,10,5,1,,10\nB,20,10,1,,10\nC,30,15,1,,10"
        data = parse_process_csv(csv)
        assert data["dependencies"] == [
            {"source_step_id": 0, "target_step_id": 1},
            {"source_step_id": 1, "target_step_id": 2},
        ]

    def test_empty_csv_raises(self):
        with pytest.raises(ValueError, match="empty"):
            parse_process_csv("name,duration_minutes\n")

    def test_flexible_column_names(self):
        csv = "step,duration,cost,resources,sla,executions\nMy Step,15,8,2,60,20"
        data = parse_process_csv(csv)
        assert len(data["steps"]) == 1
        assert data["steps"][0]["duration_minutes"] == 15
