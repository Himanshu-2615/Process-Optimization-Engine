"use client";

import type { Recommendation } from "@/lib/api";
import { AlertTriangle, AlertCircle, Info, ArrowRight } from "lucide-react";

interface RecommendationsListProps {
  recommendations: Recommendation[];
}

const PRIORITY_CONFIG = {
  high: {
    badge: "bg-red-100 text-red-700 border-red-200",
    border: "border-l-red-500",
    icon: AlertTriangle,
    iconColor: "text-red-500",
    label: "HIGH",
  },
  medium: {
    badge: "bg-amber-100 text-amber-700 border-amber-200",
    border: "border-l-amber-500",
    icon: AlertCircle,
    iconColor: "text-amber-500",
    label: "MEDIUM",
  },
  low: {
    badge: "bg-slate-100 text-slate-600 border-slate-200",
    border: "border-l-slate-400",
    icon: Info,
    iconColor: "text-slate-400",
    label: "LOW",
  },
};

export function RecommendationsList({ recommendations }: RecommendationsListProps) {
  if (recommendations.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <div className="text-2xl mb-2">✓</div>
        <p className="font-medium text-emerald-700">Process looks healthy</p>
        <p className="text-sm text-emerald-600 mt-1">No bottlenecks or issues detected.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
        <h3 className="font-semibold text-slate-900">Recommendations</h3>
        <div className="flex items-center gap-2">
          {["high", "medium", "low"].map((p) => {
            const count = recommendations.filter((r) => r.priority === p).length;
            if (!count) return null;
            const cfg = PRIORITY_CONFIG[p as keyof typeof PRIORITY_CONFIG];
            return (
              <span key={p} className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.badge}`}>
                {count} {cfg.label}
              </span>
            );
          })}
        </div>
      </div>

      <ul className="divide-y divide-slate-100">
        {recommendations.map((r, i) => {
          const cfg = PRIORITY_CONFIG[r.priority as keyof typeof PRIORITY_CONFIG] ?? PRIORITY_CONFIG.low;
          const Icon = cfg.icon;
          return (
            <li key={i} className={`border-l-4 ${cfg.border} px-5 py-4`}>
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0">
                  <Icon size={16} className={cfg.iconColor} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-slate-900">{r.title}</span>
                    {r.step_name && (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                        {r.step_name}
                      </span>
                    )}
                    <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.badge}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mb-2">{r.description}</p>
                  <div className="flex items-start gap-1.5 rounded-lg bg-indigo-50 px-3 py-2">
                    <ArrowRight size={13} className="mt-0.5 flex-shrink-0 text-indigo-500" />
                    <p className="text-sm text-indigo-700">{r.suggested_action}</p>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
