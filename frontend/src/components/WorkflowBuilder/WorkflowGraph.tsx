"use client";

import { useEffect, useCallback } from "react";
import {
  ReactFlow, Background, Controls, MiniMap,
  Node, Edge, useNodesState, useEdgesState,
  BackgroundVariant, MarkerType, NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { StepNode, type StepNodeData } from "./StepNode";
import type { Process } from "@/lib/api";

const nodeTypes: NodeTypes = { step: StepNode };

interface WorkflowGraphProps {
  process: Process;
  bottleneckStepIds?: Set<number>;
  criticalPathSteps?: Set<string>;
}

function buildLayout(steps: Process["steps"], deps: Process["dependencies"]): Map<number, { x: number; y: number }> {
  // Topological layout: place steps by their topological level
  const adjOut: Map<number, number[]> = new Map();
  const inDeg: Map<number, number> = new Map();

  for (const s of steps) { adjOut.set(s.id, []); inDeg.set(s.id, 0); }
  for (const d of deps) {
    adjOut.get(d.source_step_id)?.push(d.target_step_id);
    inDeg.set(d.target_step_id, (inDeg.get(d.target_step_id) ?? 0) + 1);
  }

  const queue: number[] = [];
  for (const [id, deg] of inDeg.entries()) { if (deg === 0) queue.push(id); }

  const level: Map<number, number> = new Map();
  const levelGroups: Map<number, number[]> = new Map();
  let head = 0;

  while (head < queue.length) {
    const id = queue[head++];
    const lvl = level.get(id) ?? 0;
    const grp = levelGroups.get(lvl) ?? [];
    grp.push(id);
    levelGroups.set(lvl, grp);
    for (const next of (adjOut.get(id) ?? [])) {
      inDeg.set(next, (inDeg.get(next) ?? 1) - 1);
      level.set(next, Math.max(level.get(next) ?? 0, lvl + 1));
      if (inDeg.get(next) === 0) queue.push(next);
    }
  }

  // Position nodes
  const NODE_W = 200;
  const NODE_H = 100;
  const GAP_X = 60;
  const GAP_Y = 60;
  const positions: Map<number, { x: number; y: number }> = new Map();

  const maxLevel = Math.max(...Array.from(levelGroups.keys()), 0);
  for (let lvl = 0; lvl <= maxLevel; lvl++) {
    const group = levelGroups.get(lvl) ?? [];
    const totalH = group.length * (NODE_H + GAP_Y) - GAP_Y;
    group.forEach((id, i) => {
      positions.set(id, {
        x: lvl * (NODE_W + GAP_X),
        y: i * (NODE_H + GAP_Y) - totalH / 2,
      });
    });
  }

  // Fallback: place any unstated nodes
  let fallbackIdx = 0;
  for (const s of steps) {
    if (!positions.has(s.id)) {
      positions.set(s.id, { x: (maxLevel + 1 + fallbackIdx) * (NODE_W + GAP_X), y: 0 });
      fallbackIdx++;
    }
  }

  return positions;
}

export function WorkflowGraph({
  process,
  bottleneckStepIds = new Set(),
  criticalPathSteps = new Set(),
}: WorkflowGraphProps) {
  const positions = buildLayout(process.steps, process.dependencies);

  const nodes: Node<StepNodeData>[] = process.steps.map((s) => {
    const pos = positions.get(s.id) ?? { x: 0, y: 0 };
    return {
      id: String(s.id),
      type: "step",
      position: pos,
      data: {
        name: s.name,
        duration_minutes: s.duration_minutes,
        cost_per_execution: s.cost_per_execution,
        executions_per_day: s.executions_per_day,
        resource_count: s.resource_count,
        sla_limit_minutes: s.sla_limit_minutes,
        isBottleneck: bottleneckStepIds.has(s.id),
        isCritical: criticalPathSteps.has(s.name),
      } satisfies StepNodeData,
    };
  });

  const edges: Edge[] = process.dependencies.map((d) => {
    const isBotEdge = bottleneckStepIds.has(d.source_step_id);
    return {
      id: `e-${d.source_step_id}-${d.target_step_id}`,
      source: String(d.source_step_id),
      target: String(d.target_step_id),
      type: "smoothstep",
      markerEnd: { type: MarkerType.ArrowClosed, color: isBotEdge ? "#dc2626" : "#94a3b8" },
      animated: isBotEdge,
      style: {
        stroke: isBotEdge ? "#dc2626" : "#94a3b8",
        strokeWidth: isBotEdge ? 2.5 : 1.5,
      },
    };
  });

  const [nodesState, setNodes, onNodesChange] = useNodesState(nodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(edges);

  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [
    process.steps.map((s) => `${s.id}:${s.name}:${s.duration_minutes}`).join("|"),
    process.dependencies.map((d) => `${d.source_step_id}->${d.target_step_id}`).join("|"),
    [...bottleneckStepIds].sort().join(","),
    [...criticalPathSteps].sort().join(","),
  ]);

  return (
    <div className="h-[480px] w-full rounded-xl border border-slate-200 overflow-hidden bg-slate-50">
      <ReactFlow
        nodes={nodesState}
        edges={edgesState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
        attributionPosition="bottom-left"
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#e2e8f0" />
        <Controls className="!bottom-4 !left-4" />
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          className="!bottom-4 !right-4"
          nodeColor={(n) => {
            const d = n.data as StepNodeData;
            if (d.isBottleneck) return "#ef4444";
            if (d.isCritical) return "#f59e0b";
            return "#6366f1";
          }}
        />
      </ReactFlow>
      {/* Legend */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-4 rounded-lg bg-white/90 backdrop-blur px-3 py-1.5 shadow text-xs text-slate-500 pointer-events-none">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />Normal</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Critical Path</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-red-500" />Bottleneck</span>
      </div>
    </div>
  );
}
