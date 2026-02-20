"""Process CRUD and analytics routes."""
from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.process import Dependency, Process, ProcessStep
from app.schemas.process import (
    DependencyCreate,
    DependencyResponse,
    ProcessCreate,
    ProcessFullResponse,
    ProcessResponse,
    ProcessStepCreate,
    ProcessStepUpdate,
    ProcessUpdate,
    StepAddRequest,
)
from app.schemas.analytics import (
    SimulationRequest,
    SimulationResult,
    SensitivityRequest,
    MultiScenarioRequest,
)
from app.analytics.engine import analyze_process
from app.analytics.dag import detect_cycle
from app.analytics.simulation import run_simulation
from app.analytics.sensitivity import run_sensitivity_analysis
from app.analytics.monte_carlo import run_monte_carlo
from app.analytics.risk import classify_risk
from app.analytics.recommendations import generate_recommendations
from app.services.pdf_export import generate_executive_summary_pdf
from app.services.csv_parser import parse_process_csv
from fastapi.responses import Response

router = APIRouter(prefix="/api/processes", tags=["processes"])


def process_to_full(process: Process, deps: list | None = None) -> ProcessFullResponse:
    """Convert Process model to full response with steps and dependencies."""
    steps = [
        {
            "id": s.id,
            "process_id": s.process_id,
            "name": s.name,
            "duration_minutes": s.duration_minutes,
            "cost_per_execution": s.cost_per_execution,
            "resource_count": s.resource_count,
            "sla_limit_minutes": s.sla_limit_minutes,
            "executions_per_day": s.executions_per_day,
        }
        for s in process.steps
    ]
    if deps is None:
        deps = []
    dep_list = [
        {"id": d.id, "source_step_id": d.source_step_id, "target_step_id": d.target_step_id}
        for d in deps
    ]
    return ProcessFullResponse(
        id=process.id,
        name=process.name,
        description=process.description,
        steps=steps,
        dependencies=dep_list,
    )


def _get_dependency_models(db: Session, process_id: int) -> list:
    """Get Dependency model instances for a process."""
    steps = db.query(ProcessStep).filter(ProcessStep.process_id == process_id).all()
    step_ids = {s.id for s in steps}
    return (
        db.query(Dependency)
        .filter(
            Dependency.source_step_id.in_(step_ids),
            Dependency.target_step_id.in_(step_ids),
        )
        .all()
    )


def _get_dependencies(db: Session, process_id: int) -> list:
    steps = db.query(ProcessStep).filter(ProcessStep.process_id == process_id).all()
    step_ids = {s.id for s in steps}
    deps = (
        db.query(Dependency)
        .filter(
            Dependency.source_step_id.in_(step_ids),
            Dependency.target_step_id.in_(step_ids),
        )
        .all()
    )
    return [(d.source_step_id, d.target_step_id) for d in deps]


def _steps_for_analysis(process: Process) -> list[dict]:
    return [
        {
            "id": s.id,
            "name": s.name,
            "duration_minutes": s.duration_minutes,
            "cost_per_execution": s.cost_per_execution,
            "resource_count": s.resource_count,
            "sla_limit_minutes": s.sla_limit_minutes,
            "executions_per_day": s.executions_per_day,
        }
        for s in process.steps
    ]


# ── IMPORTANT: static routes BEFORE /{process_id} ──────────────────────────

@router.post("/upload-csv", response_model=ProcessFullResponse)
def upload_csv_process(
    file: UploadFile = File(...),
    name: str = Query("Imported Process"),
    description: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """Upload CSV file to create a new process."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(400, "File must be a CSV")
    content = file.file.read()
    try:
        data = parse_process_csv(content, process_name=name, description=description)
    except Exception as e:
        raise HTTPException(400, f"Invalid CSV: {e}")

    create = ProcessCreate(
        name=data["name"],
        description=data["description"],
        steps=[ProcessStepCreate(**s) for s in data["steps"]],
        dependencies=[DependencyCreate(**d) for d in data["dependencies"]],
    )
    return create_process(create, db)


# ── Process CRUD ────────────────────────────────────────────────────────────

@router.get("/", response_model=list[ProcessResponse])
def list_processes(db: Session = Depends(get_db)):
    """List all processes."""
    return db.query(Process).all()


@router.post("/", response_model=ProcessFullResponse)
def create_process(create: ProcessCreate, db: Session = Depends(get_db)):
    """Create process with steps and dependencies."""
    process = Process(name=create.name, description=create.description)
    db.add(process)
    db.flush()

    step_ids: dict[int, int] = {}  # temp index -> real id
    for i, s in enumerate(create.steps):
        step = ProcessStep(
            process_id=process.id,
            name=s.name,
            duration_minutes=s.duration_minutes,
            cost_per_execution=s.cost_per_execution,
            resource_count=s.resource_count,
            sla_limit_minutes=s.sla_limit_minutes,
            executions_per_day=s.executions_per_day,
        )
        db.add(step)
        db.flush()
        step_ids[i] = step.id

    for d in create.dependencies:
        src = d.source_step_id
        tgt = d.target_step_id
        if src in step_ids and tgt in step_ids:
            dep = Dependency(
                source_step_id=step_ids[src],
                target_step_id=step_ids[tgt],
            )
            db.add(dep)

    db.commit()
    db.refresh(process)
    deps = _get_dependency_models(db, process_id=process.id)
    return process_to_full(process, deps)


@router.get("/{process_id}", response_model=ProcessFullResponse)
def get_process(process_id: int, db: Session = Depends(get_db)):
    """Get process by ID with steps and dependencies."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(404, "Process not found")

    deps = _get_dependency_models(db, process_id)
    return process_to_full(process, deps)


@router.patch("/{process_id}", response_model=ProcessFullResponse)
def update_process(process_id: int, update: ProcessUpdate, db: Session = Depends(get_db)):
    """Update process name and/or description."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(404, "Process not found")
    if update.name is not None:
        process.name = update.name
    if update.description is not None:
        process.description = update.description
    db.commit()
    db.refresh(process)
    deps = _get_dependency_models(db, process_id)
    return process_to_full(process, deps)


@router.delete("/{process_id}", status_code=204)
def delete_process(process_id: int, db: Session = Depends(get_db)):
    """Delete a process and all its steps/dependencies."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(404, "Process not found")
    db.delete(process)
    db.commit()


# ── Step CRUD ───────────────────────────────────────────────────────────────

@router.post("/{process_id}/steps", response_model=ProcessFullResponse)
def add_step(
    process_id: int,
    step: StepAddRequest,
    db: Session = Depends(get_db),
):
    """Add a new step to an existing process."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(404, "Process not found")

    new_step = ProcessStep(
        process_id=process_id,
        name=step.name,
        duration_minutes=step.duration_minutes,
        cost_per_execution=step.cost_per_execution,
        resource_count=step.resource_count,
        sla_limit_minutes=step.sla_limit_minutes,
        executions_per_day=step.executions_per_day,
    )
    db.add(new_step)
    db.flush()

    # Auto-link from last step if requested
    if step.link_from_last and process.steps:
        last_step = process.steps[-1]
        if last_step.id != new_step.id:
            dep = Dependency(source_step_id=last_step.id, target_step_id=new_step.id)
            db.add(dep)

    db.commit()
    db.refresh(process)
    deps = _get_dependency_models(db, process_id)
    return process_to_full(process, deps)


@router.patch("/{process_id}/steps/{step_id}", response_model=ProcessFullResponse)
def update_step(
    process_id: int,
    step_id: int,
    update: ProcessStepUpdate,
    db: Session = Depends(get_db),
):
    """Update a process step."""
    step = (
        db.query(ProcessStep)
        .filter(ProcessStep.id == step_id, ProcessStep.process_id == process_id)
        .first()
    )
    if not step:
        raise HTTPException(404, "Step not found")
    for field in update.model_fields_set:
        setattr(step, field, getattr(update, field))
    db.commit()
    db.refresh(step)
    process = db.query(Process).filter(Process.id == process_id).first()
    deps = _get_dependency_models(db, process_id)
    return process_to_full(process, deps)


@router.delete("/{process_id}/steps/{step_id}", response_model=ProcessFullResponse)
def delete_step(
    process_id: int,
    step_id: int,
    db: Session = Depends(get_db),
):
    """Delete a step from a process (also removes its dependencies)."""
    step = (
        db.query(ProcessStep)
        .filter(ProcessStep.id == step_id, ProcessStep.process_id == process_id)
        .first()
    )
    if not step:
        raise HTTPException(404, "Step not found")
    db.delete(step)
    db.commit()
    process = db.query(Process).filter(Process.id == process_id).first()
    deps = _get_dependency_models(db, process_id)
    return process_to_full(process, deps)


# ── Dependency CRUD ─────────────────────────────────────────────────────────

@router.post("/{process_id}/dependencies", response_model=ProcessFullResponse)
def add_dependency(
    process_id: int,
    dep: DependencyCreate,
    db: Session = Depends(get_db),
):
    """Add a dependency between two steps."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(404, "Process not found")

    steps = db.query(ProcessStep).filter(ProcessStep.process_id == process_id).all()
    step_ids = {s.id for s in steps}

    if dep.source_step_id not in step_ids or dep.target_step_id not in step_ids:
        raise HTTPException(400, "Both steps must belong to this process")

    if dep.source_step_id == dep.target_step_id:
        raise HTTPException(400, "A step cannot depend on itself")

    # Check for duplicates
    existing = db.query(Dependency).filter(
        Dependency.source_step_id == dep.source_step_id,
        Dependency.target_step_id == dep.target_step_id,
    ).first()
    if existing:
        raise HTTPException(400, "Dependency already exists")

    # Cycle check
    all_deps = _get_dependencies(db, process_id)
    test_deps = all_deps + [(dep.source_step_id, dep.target_step_id)]
    if detect_cycle(step_ids, test_deps):
        raise HTTPException(400, "Adding this dependency would create a cycle")

    new_dep = Dependency(source_step_id=dep.source_step_id, target_step_id=dep.target_step_id)
    db.add(new_dep)
    db.commit()
    db.refresh(process)
    deps = _get_dependency_models(db, process_id)
    return process_to_full(process, deps)


@router.delete("/{process_id}/dependencies/{dep_id}", response_model=ProcessFullResponse)
def delete_dependency(
    process_id: int,
    dep_id: int,
    db: Session = Depends(get_db),
):
    """Remove a dependency."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(404, "Process not found")

    dep = db.query(Dependency).filter(Dependency.id == dep_id).first()
    if not dep:
        raise HTTPException(404, "Dependency not found")

    db.delete(dep)
    db.commit()
    db.refresh(process)
    deps = _get_dependency_models(db, process_id)
    return process_to_full(process, deps)


# ── Analytics ───────────────────────────────────────────────────────────────

@router.post("/{process_id}/analyze", response_model=dict)
def analyze_process_route(
    process_id: int,
    revenue_per_unit: float | None = Query(None),
    db: Session = Depends(get_db),
):
    """Analyze process: cycle time, throughput, bottlenecks, cost, recommendations."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(404, "Process not found")
    if not process.steps:
        raise HTTPException(400, "Process has no steps to analyze")

    steps = _steps_for_analysis(process)
    deps = _get_dependencies(db, process_id)

    if detect_cycle({s["id"] for s in steps}, deps):
        raise HTTPException(400, "Process has circular dependencies. Must form a DAG.")

    analysis = analyze_process(steps, deps, revenue_per_unit=revenue_per_unit)
    recommendations = generate_recommendations(analysis)
    risk = classify_risk(analysis)

    return {
        "analysis": analysis.model_dump(),
        "recommendations": [r.model_dump() for r in recommendations],
        "risk": risk,
    }


@router.post("/{process_id}/simulate", response_model=SimulationResult)
def simulate_optimization(
    process_id: int,
    request: SimulationRequest,
    db: Session = Depends(get_db),
):
    """Run optimization simulation."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(404, "Process not found")
    if not process.steps:
        raise HTTPException(400, "Process has no steps to simulate")

    steps = _steps_for_analysis(process)
    deps = _get_dependencies(db, process_id)
    return run_simulation(steps, deps, request)


@router.post("/{process_id}/sensitivity")
def sensitivity_analysis(
    process_id: int,
    request: SensitivityRequest,
    revenue_per_unit: float | None = Query(None),
    db: Session = Depends(get_db),
):
    """Run sensitivity analysis by varying a step parameter."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(404, "Process not found")
    steps = _steps_for_analysis(process)
    deps = _get_dependencies(db, process_id)
    return run_sensitivity_analysis(
        steps,
        deps,
        step_id=request.step_id,
        param=request.param,
        min_multiplier=request.min_multiplier,
        max_multiplier=request.max_multiplier,
        num_points=request.num_points,
        revenue_per_unit=revenue_per_unit,
    )


@router.post("/{process_id}/monte-carlo")
def monte_carlo_simulation(
    process_id: int,
    num_iterations: int = Query(500, ge=100, le=2000),
    variation_percent: float = Query(20, ge=5, le=50),
    seed: int | None = Query(None),
    revenue_per_unit: float | None = Query(None),
    db: Session = Depends(get_db),
):
    """Run Monte Carlo simulation with random duration variability."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(404, "Process not found")
    steps = _steps_for_analysis(process)
    deps = _get_dependencies(db, process_id)
    return run_monte_carlo(
        steps,
        deps,
        num_iterations=num_iterations,
        variation_percent=variation_percent,
        seed=seed,
        revenue_per_unit=revenue_per_unit,
    )


@router.post("/{process_id}/multi-scenario")
def multi_scenario_comparison(
    process_id: int,
    request: MultiScenarioRequest,
    db: Session = Depends(get_db),
):
    """Run multiple simulation scenarios and compare results."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(404, "Process not found")
    steps = _steps_for_analysis(process)
    deps = _get_dependencies(db, process_id)
    names = request.scenario_names or [f"Scenario {i+1}" for i in range(len(request.scenarios))]
    results = []
    for i, sim_req in enumerate(request.scenarios):
        try:
            r = run_simulation(steps, deps, sim_req)
            results.append({
                "name": names[i] if i < len(names) else f"Scenario {i+1}",
                "result": r.model_dump(),
            })
        except Exception as e:
            results.append({
                "name": names[i] if i < len(names) else f"Scenario {i+1}",
                "error": str(e),
            })
    return {"scenarios": results}


@router.get("/{process_id}/export-pdf")
def export_executive_summary(
    process_id: int,
    revenue_per_unit: float | None = None,
    db: Session = Depends(get_db),
):
    """Export executive summary as PDF."""
    process = db.query(Process).filter(Process.id == process_id).first()
    if not process:
        raise HTTPException(404, "Process not found")
    if not process.steps:
        raise HTTPException(400, "Process has no steps to export")

    steps = _steps_for_analysis(process)
    deps = _get_dependencies(db, process_id)
    analysis = analyze_process(steps, deps, revenue_per_unit=revenue_per_unit)
    recommendations = generate_recommendations(analysis)
    risk = classify_risk(analysis)

    pdf_bytes = generate_executive_summary_pdf(
        process_name=process.name,
        process_description=process.description,
        analysis=analysis,
        recommendations=recommendations,
        simulation_result=None,
        risk=risk,
    )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{process.name.replace(" ", "_")}_summary.pdf"',
        },
    )
