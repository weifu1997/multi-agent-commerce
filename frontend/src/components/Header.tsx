import React from "react";
import { Cpu, FlaskConical, Sparkles } from "lucide-react";
import type { HealthResponse } from "../types";

interface HeaderProps {
  health: HealthResponse | null;
  healthLoading: boolean;
  onOpenExperiments: () => void;
  experimentsCount?: number;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  healthLoading,
  onOpenExperiments,
}) => {
  const isHealthy = health?.status === "healthy";

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-zinc-900/80 backdrop-blur border-b border-zinc-800/80">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30 text-cyan-400">
          <Sparkles className="w-4 h-4" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-tight text-zinc-100 m-0">
              Agent Playground
            </h1>
            <span className="px-1.5 py-0.5 text-[10px] font-mono tracking-wider font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded">
              RUN TRACE
            </span>
          </div>
          <p className="text-xs text-zinc-400 m-0 hidden sm:block">
            多智能体电商协同推荐流水线
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Health Status Pill */}
        <div className="flex items-center gap-2 px-2.5 py-1 text-xs rounded-full bg-zinc-800/70 border border-zinc-700/60 text-zinc-300">
          <span
            className={`w-2 h-2 rounded-full ${
              healthLoading
                ? "bg-amber-400 animate-pulse"
                : isHealthy
                ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"
                : "bg-rose-500"
            }`}
          />
          <span className="font-mono text-[11px]">
            {healthLoading
              ? "检测服务..."
              : isHealthy
              ? "服务正常"
              : "服务离线"}
          </span>
          {health?.model && (
            <>
              <span className="text-zinc-600">|</span>
              <div className="flex items-center gap-1 text-zinc-400 font-mono text-[11px]">
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>{health.model}</span>
              </div>
            </>
          )}
        </div>

        {/* Experiment Drawer Toggle Button */}
        <button
          type="button"
          onClick={onOpenExperiments}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-200 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/80 hover:border-zinc-600 rounded-lg transition-colors cursor-pointer"
        >
          <FlaskConical className="w-3.5 h-3.5 text-cyan-400" />
          <span>A/B 实验</span>
        </button>
      </div>
    </header>
  );
};
