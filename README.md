# Process Optimization & Impact Simulation Engine

A full-stack business analytics system for modeling workflows, detecting bottlenecks, simulating process improvements, and quantifying ROI — built to replace gut-feel operational decisions with quantitative analysis.

---

## 💡 What It Does

You model a business process as a directed acyclic graph (DAG) of steps — each with duration, cost, resource count, SLA limits, and daily execution frequency. The engine then:

- Computes **cycle time** via critical path analysis (topological sort + dynamic programming)
- Detects **bottlenecks** by type — duration, SLA breach, resource over-utilization, cost impact
- Simulates **interventions** like automation or headcount addition and shows exact before/after impact
- Quantifies **ROI and payback period** for each proposed change
- Runs **probabilistic analysis** to understand how variability affects outcomes

---

## ✨ Features

### 📊 Core Analytics
- Cycle time and throughput from critical path across any DAG topology
- Bottleneck detection across 4 types: duration (throughput limiter), SLA breach/warning, resource utilization >85%, cost impact (top 80th percentile)
- Per-step resource utilization as `(executions × duration) / (480 min × resources)`
- Daily/monthly cost breakdown with revenue impact and delay loss given revenue per unit
- Risk scoring 0–100 across Critical / High / Medium / Low with per-step breakdown

### 🎯 Optimization Simulation
- **Reduce Duration** — model a % reduction from process redesign
- **Add Resource** — model headcount addition and utilization impact
- **Automate Step** — set new duration and cost to reflect automation
- **Remove Step** — eliminate a step and recompute the DAG
- **Merge Steps** — combine two steps and see throughput impact
- ROI = `(Annual Savings − Implementation Cost) / Implementation Cost` with payback period

### 🔬 Advanced Analytics
- **Sensitivity Analysis** — sweep any step parameter (duration, cost, resources, executions) across a multiplier range; plots how cycle time and daily cost respond
- **Monte Carlo Simulation** — N iterations with ±X% independent random variation on both duration and cost; returns P10/P50/P90/P95 distributions with Low/Medium/High volatility classification
- **Multi-Scenario Comparison** — run multiple simulations side by side, compare time saved, cost saved, annual savings, ROI, and payback; highlights best-ROI scenario

### 🛠️ Process Management
- Add, edit, and delete steps inline with a live form
- Add and remove dependencies with automatic cycle detection (prevents invalid DAGs)
- Drag-and-drop CSV upload to create a process from a spreadsheet instantly
- PDF executive summary export with KPI table, bottleneck breakdown, cost analysis, and prioritized recommendations (ReportLab)

### 🖥️ Frontend
- Sidebar navigation across 8 sections: Editor, Workflow, KPIs, Utilization, Risk, Recommendations, Simulation, Advanced
- React Flow workflow graph with topological left-to-right layout, bottleneck highlighting, critical path highlighting, and SLA indicators on nodes
- 6-card KPI dashboard, color-coded utilization chart with 70%/85% reference lines, risk score bar with per-step progress bars

---

## 🛠️ Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | Next.js 15, TypeScript, Tailwind CSS |
| Workflow Graph | React Flow with topological DAG layout |
| Charts | Recharts |
| Backend | FastAPI, SQLAlchemy, Pydantic v2 |
| Database | SQLite (default) / PostgreSQL |
| Analytics | NumPy (Monte Carlo), pure Python (DAG, engine) |
| PDF | ReportLab |
| Tests | pytest — 44 tests, 100% pass |

---

## 🚀 Quick Start

```bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install && npm run dev
```

Open `http://localhost:3000`. Click **Sample** to load a demo process, then hit **Analyze**.

API docs available at `http://localhost:8000/docs`.

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/processes` | List all processes |
| POST | `/api/processes` | Create process with steps and dependencies |
| PATCH | `/api/processes/{id}` | Update name / description |
| DELETE | `/api/processes/{id}` | Delete process and all steps |
| POST | `/api/processes/{id}/steps` | Add a new step |
| PATCH | `/api/processes/{id}/steps/{step_id}` | Edit a step |
| DELETE | `/api/processes/{id}/steps/{step_id}` | Delete a step |
| POST | `/api/processes/{id}/dependencies` | Add dependency (with cycle check) |
| DELETE | `/api/processes/{id}/dependencies/{dep_id}` | Remove a dependency |
| POST | `/api/processes/{id}/analyze` | Full analysis: KPIs, bottlenecks, recommendations |
| POST | `/api/processes/{id}/simulate` | Run an optimization scenario |
| POST | `/api/processes/{id}/sensitivity` | Sensitivity analysis on a step parameter |
| POST | `/api/processes/{id}/monte-carlo` | Monte Carlo variability simulation |
| POST | `/api/processes/{id}/multi-scenario` | Compare multiple scenarios |
| POST | `/api/processes/upload-csv` | Create process from CSV |
| GET | `/api/processes/{id}/export-pdf` | Download executive summary PDF |

---

## 🧪 Tests

```bash
cd backend
pytest tests/test_all.py -v
# 44 passed in 0.47s
```

Covers DAG cycle detection, critical path correctness, SLA breach/warning detection, utilization thresholds, simulation ROI formula verification, Monte Carlo percentile ordering and seeded reproducibility, risk score bounds, recommendation priority sorting, and CSV parsing with flexible column names.

---

## 📁 Project Structure

```
backend/app/
├── analytics/
│   ├── dag.py              # Cycle detection (Kahn's), critical path (topo sort + DP)
│   ├── engine.py           # Bottlenecks, utilization, cost, risk score
│   ├── simulation.py       # 5 simulation types + ROI
│   ├── sensitivity.py      # Parameter sweep
│   ├── monte_carlo.py      # NumPy Monte Carlo, dual variability
│   ├── risk.py             # Risk classification
│   └── recommendations.py  # Rule-based recommendation engine
├── routes/processes.py     # All 17 API endpoints
├── models/process.py       # SQLAlchemy: Process, ProcessStep, Dependency
└── services/
    ├── csv_parser.py       # CSV → process
    └── pdf_export.py       # ReportLab executive summary

frontend/src/
├── app/page.tsx            # Main dashboard, sidebar nav
├── components/
│   ├── ProcessEditor/      # Step + dependency CRUD
│   ├── WorkflowBuilder/    # React Flow graph + StepNode
│   ├── KPIOverview/        # 6-card KPI dashboard
│   ├── Dashboard/          # Utilization, risk, recommendations
│   ├── SimulationPanel/    # Simulation form + results
│   └── Advanced/           # Sensitivity, Monte Carlo, multi-scenario, CSV
└── lib/api.ts              # Typed API client
```