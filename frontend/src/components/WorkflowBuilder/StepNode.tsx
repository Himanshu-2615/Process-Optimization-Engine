"use client";

import { memo } from "react";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export interface StepNodeData extends Record<string, unknown> {
  name: string;
  duration_minutes: number;
  cost_per_execution: number;
  executions_per_day: number;
  resource_count: number;
  sla_limit_minutes: number | null;
  isBottleneck?: boolean;
  isCritical?: boolean;
}

type StepNodeType = Node<StepNodeData, "step">;

function StepNodeComponent({ data }: NodeProps<StepNodeType>) {
  const {
    name,
    duration_minutes,
    cost_per_execution,
    executions_per_day,
    resource_count,
    sla_limit_minutes,
    isBottleneck,
    isCritical,
  } = data;

  const borderClass = isBottleneck
    ? "border-red-500 shadow-red-100 shadow-lg"
    : isCritical
    ? "border-amber-400 shadow-amber-100 shadow-md"
    : "border-slate-200 shadow-sm";

  const headerClass = isBottleneck
    ? "text-red-700 bg-red-50"
    : isCritical
    ? "text-amber-700 bg-amber-50"
    : "text-slate-800 bg-slate-50";

  const slaViolation = sla_limit_minutes != null && duration_minutes > sla_limit_minutes;

  return (
    <>
      <Handle type="target" position={Position.Left} className="!h-3 !w-3 !bg-slate-400 !border-2 !border-white" />
      <div className={`min-w-[180px] max-w-[220px] rounded-xl border-2 bg-white ${borderClass} overflow-hidden`}>
        {/* Header */}
        <div className={`px-3 py-2 ${headerClass}`}>
          <div className="font-semibold text-sm leading-tight">{name}</div>
          {isBottleneck && (
            <div className="mt-0.5 flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-xs font-medium text-red-600">Bottleneck</span>
            </div>
          )}
          {isCritical && !isBottleneck && (
            <div className="mt-0.5 text-xs font-medium text-amber-600">Critical Path</div>
          )}
        </div>
        {/* Body */}
        <div className="px-3 py-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Duration</span>
            <span className="font-medium text-slate-800">{duration_minutes} min</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Cost</span>
            <span className="font-medium text-slate-800">₹{cost_per_execution}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Resources</span>
            <span className="font-medium text-slate-800">{resource_count}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">Exec/day</span>
            <span className="font-medium text-slate-800">{executions_per_day}</span>
          </div>
          {sla_limit_minutes != null && (
            <div className={`flex justify-between text-xs rounded px-1 -mx-1 ${slaViolation ? "bg-red-50 text-red-600" : "text-slate-500"}`}>
              <span>SLA</span>
              <span className="font-medium">{sla_limit_minutes} min{slaViolation ? " ⚠" : ""}</span>
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-3 !w-3 !bg-slate-400 !border-2 !border-white" />
    </>
  );
}

export const StepNode = memo(StepNodeComponent);
