"use client";

import type { RiskClassification } from "@/lib/api";
import { ShieldAlert, Shield } from "lucide-react";

interface RiskBadgeProps {
  risk: RiskClassification | null;
}

const RISK_CONFIG = {
  low: { label: "Low Risk", color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-500", icon: Shield },
  medium: { label: "Medium Risk", color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200", bar: "bg-amber-500", icon: ShieldAlert },
  high: { label: "High Risk", color: "text-orange-700", bg: "bg-orange-50", border: "border-orange-200", bar: "bg-orange-500", icon: ShieldAlert },
  critical: { label: "Critical Risk", color: "text-red-700", bg: "bg-red-50", border: "border-red-200", bar: "bg-red-500", icon: ShieldAlert },
};

const STEP_LEVEL_CONFIG = {
  low: "text-emerald-700 bg-emerald-50",
  medium: "text-amber-700 bg-amber-50",
  high: "text-red-700 bg-red-50",
};

export function RiskBadge({ risk }: RiskBadgeProps) {
  if (!risk) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h3 className="mb-3 font-semibold text-slate-700">Risk Classification</h3>
        <p className="text-sm text-slate-400">Run analysis to see risk classification.</p>
      </div>
    );
  }

  const cfg = RISK_CONFIG[risk.overall_risk] ?? RISK_CONFIG.medium;
  const Icon = cfg.icon;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 font-semibold text-slate-700">Risk Classification</h3>

      {/* Overall badge */}
      <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 mb-4 ${cfg.bg} ${cfg.border}`}>
        <Icon size={20} className={cfg.color} />
        <div className="flex-1">
          <div className={`text-base font-bold ${cfg.color}`}>{cfg.label}</div>
          <div className="text-xs text-slate-500">Score: {risk.risk_score}/100</div>
        </div>
        <div className="text-2xl font-black text-slate-700">{risk.risk_score}</div>
      </div>

      {/* Score bar */}
      <div className="mb-4">
        <div className="mb-1 flex justify-between text-xs text-slate-400">
          <span>Low (0)</span>
          <span>Medium (25)</span>
          <span>High (50)</span>
          <span>Critical (75)</span>
        </div>
        <div className="relative h-3 rounded-full bg-slate-100 overflow-hidden">
          {/* Background segments */}
          <div className="absolute inset-0 flex">
            <div className="flex-1 bg-emerald-100" />
            <div className="flex-1 bg-amber-100" />
            <div className="flex-1 bg-orange-100" />
            <div className="flex-1 bg-red-100" />
          </div>
          {/* Score indicator */}
          <div
            className={`absolute top-0 left-0 h-full rounded-full ${cfg.bar} transition-all duration-500`}
            style={{ width: `${risk.risk_score}%` }}
          />
        </div>
      </div>

      {/* Per-step breakdown */}
      {Object.keys(risk.step_risks).length > 0 && (
        <div>
          <div className="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wide">Per-Step Risk</div>
          <div className="space-y-1.5">
            {Object.entries(risk.step_risks)
              .sort(([, a], [, b]) => b.score - a.score)
              .map(([step, r]) => {
                const levelCfg = STEP_LEVEL_CONFIG[r.level as keyof typeof STEP_LEVEL_CONFIG] ?? STEP_LEVEL_CONFIG.low;
                return (
                  <div key={step} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs text-slate-700 truncate">{step}</span>
                        <span className={`ml-2 flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${levelCfg}`}>
                          {r.level}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            r.level === "high" ? "bg-red-400" : r.level === "medium" ? "bg-amber-400" : "bg-emerald-400"
                          }`}
                          style={{ width: `${r.score}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 w-7 text-right">{r.score}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
