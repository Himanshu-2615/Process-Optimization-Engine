"use client";

import type { AnalysisResult } from "@/lib/api";
import { Clock, Zap, DollarSign, AlertTriangle, TrendingUp, Target } from "lucide-react";

interface KPICardsProps {
  analysis: AnalysisResult | null;
}

export function KPICards({ analysis }: KPICardsProps) {
  if (!analysis) {
    return (
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm animate-pulse">
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="mt-3 h-7 w-14 rounded bg-slate-200" />
            <div className="mt-2 h-3 w-24 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    );
  }

  const bottleneckCount = analysis.bottlenecks.length;
  const overUtilized = Object.values(analysis.resource_utilization).filter((v) => v > 85).length;
  const avgUtil = Object.values(analysis.resource_utilization).length > 0
    ? Object.values(analysis.resource_utilization).reduce((a, b) => a + b, 0) / Object.values(analysis.resource_utilization).length
    : 0;

  const cards = [
    {
      label: "Cycle Time",
      value: `${analysis.cycle_time_minutes.toFixed(0)} min`,
      sub: `${(analysis.cycle_time_minutes / 60).toFixed(1)} hours`,
      icon: Clock,
      color: "border-l-blue-500",
      iconColor: "text-blue-500",
      bg: "bg-blue-50",
    },
    {
      label: "Throughput",
      value: `${analysis.throughput_per_hour.toFixed(3)}`,
      sub: "units per hour",
      icon: Zap,
      color: "border-l-emerald-500",
      iconColor: "text-emerald-500",
      bg: "bg-emerald-50",
    },
    {
      label: "Daily Cost",
      value: `₹${analysis.cost_breakdown.daily_cost.toLocaleString("en-IN")}`,
      sub: `₹${analysis.cost_breakdown.monthly_cost.toLocaleString("en-IN")}/mo`,
      icon: DollarSign,
      color: "border-l-amber-500",
      iconColor: "text-amber-500",
      bg: "bg-amber-50",
    },
    {
      label: "SLA Risk",
      value: `${analysis.sla_risk_score.toFixed(0)}/100`,
      sub: analysis.sla_risk_score > 50 ? "⚠ High risk" : analysis.sla_risk_score > 25 ? "~ Medium" : "✓ Low risk",
      icon: AlertTriangle,
      color: analysis.sla_risk_score > 50 ? "border-l-red-500" : analysis.sla_risk_score > 25 ? "border-l-amber-400" : "border-l-green-500",
      iconColor: analysis.sla_risk_score > 50 ? "text-red-500" : analysis.sla_risk_score > 25 ? "text-amber-400" : "text-green-500",
      bg: analysis.sla_risk_score > 50 ? "bg-red-50" : "bg-green-50",
    },
    {
      label: "Bottlenecks",
      value: String(bottleneckCount),
      sub: bottleneckCount === 0 ? "None detected" : `${overUtilized} over-utilized`,
      icon: Target,
      color: bottleneckCount > 0 ? "border-l-orange-500" : "border-l-green-500",
      iconColor: bottleneckCount > 0 ? "text-orange-500" : "text-green-500",
      bg: bottleneckCount > 0 ? "bg-orange-50" : "bg-green-50",
    },
    {
      label: "Avg Utilization",
      value: `${avgUtil.toFixed(1)}%`,
      sub: `${Object.keys(analysis.resource_utilization).length} steps`,
      icon: TrendingUp,
      color: avgUtil > 85 ? "border-l-red-500" : avgUtil > 70 ? "border-l-amber-500" : "border-l-indigo-500",
      iconColor: avgUtil > 85 ? "text-red-500" : avgUtil > 70 ? "text-amber-500" : "text-indigo-500",
      bg: "bg-indigo-50",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.label} className={`rounded-xl border-l-4 border border-slate-200 bg-white p-4 shadow-sm ${card.color}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{card.label}</span>
              <span className={`rounded-lg p-1.5 ${card.bg}`}>
                <Icon size={14} className={card.iconColor} />
              </span>
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{card.value}</div>
            <div className="mt-0.5 text-xs text-slate-400">{card.sub}</div>
          </div>
        );
      })}
    </div>
  );
}
