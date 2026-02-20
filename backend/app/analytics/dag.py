"""DAG validation and critical path analysis."""
from collections import defaultdict, deque

from app.schemas.analytics import BottleneckType


def detect_cycle(step_ids: set[int], dependencies: list[tuple[int, int]]) -> bool:
    """
    Detect cycle in dependency graph using Kahn's algorithm / DFS.
    Returns True if cycle exists.
    """
    if not step_ids or not dependencies:
        return False

    # Build adjacency list and in-degree count
    graph: dict[int, list[int]] = defaultdict(list)
    in_degree: dict[int, int] = {sid: 0 for sid in step_ids}

    for source, target in dependencies:
        graph[source].append(target)
        in_degree[target] = in_degree.get(target, 0) + 1

    # Kahn's algorithm - topological sort
    queue = deque([sid for sid in step_ids if in_degree[sid] == 0])
    sorted_count = 0

    while queue:
        node = queue.popleft()
        sorted_count += 1
        for neighbor in graph[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    return sorted_count != len(step_ids)


def get_critical_path(
    steps: dict[int, tuple[str, float]],
    dependencies: list[tuple[int, int]],
) -> tuple[list[str], float]:
    """
    Compute critical path (longest path) and total cycle time.
    Returns (list of step names on critical path, total cycle time in minutes).
    """
    if not steps:
        return [], 0.0

    step_ids = set(steps.keys())
    # Build reverse graph (for topological order) and forward graph
    graph: dict[int, list[int]] = defaultdict(list)
    in_degree: dict[int, int] = {sid: 0 for sid in step_ids}

    for source, target in dependencies:
        graph[source].append(target)
        in_degree[target] = in_degree.get(target, 0) + 1

    # Topological sort
    queue = deque([sid for sid in step_ids if in_degree[sid] == 0])
    topo_order: list[int] = []

    while queue:
        node = queue.popleft()
        topo_order.append(node)
        for neighbor in graph[node]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    # Longest path (critical path) using DP
    # earliest_start[node] = max finish time of all predecessors
    earliest_finish: dict[int, float] = {}
    predecessor: dict[int, int | None] = {sid: None for sid in step_ids}

    for node in topo_order:
        _, duration = steps[node]
        best_pred_finish = 0.0
        best_pred = None
        for src, tgt in dependencies:
            if tgt == node:
                pred_finish = earliest_finish.get(src, 0.0)
                if pred_finish > best_pred_finish:
                    best_pred_finish = pred_finish
                    best_pred = src
        earliest_finish[node] = best_pred_finish + duration
        predecessor[node] = best_pred

    # Find the node with max finish time (end of critical path)
    if not earliest_finish:
        return [], 0.0

    end_node = max(earliest_finish, key=earliest_finish.get)
    cycle_time = earliest_finish[end_node]

    # Backtrack to get critical path
    path: list[str] = []
    current: int | None = end_node
    while current is not None:
        name, _ = steps[current]
        path.insert(0, name)
        current = predecessor.get(current)

    return path, cycle_time
