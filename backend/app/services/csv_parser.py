"""Parse CSV process data into ProcessCreate format."""
import csv
import io


def parse_process_csv(
    content: str | bytes,
    process_name: str = "Imported Process",
    description: str | None = None,
) -> dict:
    """
    Parse CSV with columns:
    name, duration_minutes, cost_per_execution, resource_count, sla_limit_minutes, executions_per_day
    Optional: next_step (index) or dependencies (0->1,1->2)
    Steps are sequential by default (0->1->2->3...)
    """
    if isinstance(content, bytes):
        content = content.decode("utf-8")

    reader = csv.DictReader(io.StringIO(content))
    rows = list(reader)
    if not rows:
        raise ValueError("CSV is empty")

    headers = [h.strip().lower().replace(" ", "_") for h in (reader.fieldnames or [])]
    steps = []
    dependencies: list[tuple[int, int]] = []

    # Build lowercase key map for flexible matching
    key_map: dict[str, str] = {}
    for orig in (reader.fieldnames or []):
        norm = orig.strip().lower().replace(" ", "_")
        key_map[norm] = orig

    def g(row: dict, *keys: str, default: str = "") -> str:
        for k in keys:
            norm = k.lower().replace(" ", "_")
            orig = key_map.get(norm) or k
            v = row.get(orig) or row.get(k)
            if v is not None and str(v).strip():
                return str(v).strip()
        return default

    for i, row in enumerate(rows):
        name = g(row, "name", "step") or f"Step {i + 1}"
        duration = float(g(row, "duration_minutes", "duration") or 0)
        cost = float(g(row, "cost_per_execution", "cost") or 0)
        resources = int(float(g(row, "resource_count", "resources") or 1))
        sla_raw = g(row, "sla_limit_minutes", "sla")
        sla_val = float(sla_raw) if sla_raw else None
        execs = int(float(g(row, "executions_per_day", "executions") or 1))

        steps.append({
            "name": str(name).strip(),
            "duration_minutes": max(0, duration),
            "cost_per_execution": max(0, cost),
            "resource_count": max(1, resources),
            "sla_limit_minutes": max(0, sla_val) if sla_val is not None else None,
            "executions_per_day": max(1, execs),
        })

        next_step = g(row, "next_step", "next")
        if next_step:
            try:
                tgt = int(float(next_step))
                if 0 <= tgt < len(rows) and tgt != i:
                    dependencies.append((i, tgt))
            except (ValueError, TypeError):
                pass

    if not dependencies and len(steps) > 1:
        dependencies = [(i, i + 1) for i in range(len(steps) - 1)]

    deps_col = next((h for h in headers if "depend" in h or "link" in h), None)
    if deps_col and rows:
        orig_key = key_map.get(deps_col, deps_col)
        val = str(rows[0].get(orig_key, "") or "")
        for part in val.split(","):
            part = part.strip()
            if "->" in part:
                a, b = part.split("->", 1)
                try:
                    src, tgt = int(a.strip()), int(b.strip())
                    if 0 <= src < len(steps) and 0 <= tgt < len(steps):
                        dependencies.append((src, tgt))
                except (ValueError, TypeError):
                    pass

    return {
        "name": process_name,
        "description": description,
        "steps": steps,
        "dependencies": [{"source_step_id": a, "target_step_id": b} for a, b in dependencies],
    }
