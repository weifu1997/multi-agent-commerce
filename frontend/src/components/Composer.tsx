import React from "react";
import {
  AlertCircle,
  Clock,
  Layers,
  Network,
  Play,
  Square,
  Users,
  X,
  Info,
} from "lucide-react";
import { PRESET_PROFILES } from "../presets";
import type { OrchestratorType, PresetProfile } from "../types";

interface ComposerProps {
  selectedPreset: PresetProfile;
  onSelectPreset: (preset: PresetProfile) => void;
  orchestrator: OrchestratorType;
  onChangeOrchestrator: (type: OrchestratorType) => void;
  numItems: number;
  onChangeNumItems: (num: number) => void;
  loading: boolean;
  elapsedSeconds: number;
  onRun: () => void;
  onCancel: () => void;
  error: string | null;
  onClearError: () => void;
}

export const Composer: React.FC<ComposerProps> = ({
  selectedPreset,
  onSelectPreset,
  orchestrator,
  onChangeOrchestrator,
  numItems,
  onChangeNumItems,
  loading,
  elapsedSeconds,
  onRun,
  onCancel,
  error,
  onClearError,
}) => {
  return (
    <div className="bg-zinc-900/40 border-b border-zinc-800/80 px-6 py-4 space-y-3.5">
      {/* Top Row: Presets & Orchestrator */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Presets Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-zinc-400 flex items-center gap-1.5 mr-1">
            <Users className="w-3.5 h-3.5 text-zinc-400" />
            用户预设:
          </span>
          {PRESET_PROFILES.map((preset) => {
            const isSelected = preset.id === selectedPreset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={loading}
                onClick={() => onSelectPreset(preset)}
                className={`group relative flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg transition-all border cursor-pointer ${
                  isSelected
                    ? "bg-cyan-500/15 border-cyan-500/50 text-cyan-200 shadow-sm shadow-cyan-500/10"
                    : "bg-zinc-900/80 hover:bg-zinc-800/90 border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200"
                } ${loading ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <span className="font-medium">{preset.name}</span>
                <span
                  className={`text-[10px] px-1 py-0.2 rounded font-mono ${
                    isSelected
                      ? "bg-cyan-500/20 text-cyan-300"
                      : "bg-zinc-800 text-zinc-500 group-hover:text-zinc-400"
                  }`}
                >
                  {preset.badge}
                </span>
              </button>
            );
          })}
        </div>

        {/* Right side controls: Orchestrator + NumItems + Run */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Orchestrator Toggle */}
          <div className="flex items-center p-0.5 rounded-lg bg-zinc-900 border border-zinc-800 text-xs">
            <button
              type="button"
              disabled={loading}
              onClick={() => onChangeOrchestrator("supervisor")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                orchestrator === "supervisor"
                  ? "bg-zinc-800 text-cyan-300 font-medium shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="Supervisor 生产编排器 (FastAPI 直接编排，推荐生产使用)"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Supervisor</span>
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => onChangeOrchestrator("graph")}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                orchestrator === "graph"
                  ? "bg-zinc-800 text-cyan-300 font-medium shadow-xs"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
              title="LangGraph 状态图引擎 (/api/v1/recommend/graph)"
            >
              <Network className="w-3.5 h-3.5" />
              <span>LangGraph</span>
            </button>
          </div>

          {/* Num Items Input */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-300">
            <span className="text-zinc-400">数量:</span>
            <input
              type="number"
              min={3}
              max={20}
              disabled={loading}
              value={numItems}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  onChangeNumItems(Math.max(3, Math.min(20, val)));
                }
              }}
              className="w-12 bg-transparent text-center font-mono text-zinc-100 focus:outline-none focus:ring-1 focus:ring-cyan-500 rounded"
              title="推荐召回商品数 (默认 5，≥3 可查看缺货拦截与更多精排候选)"
            />
          </div>

          {/* Run / Cancel Button */}
          {loading ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-cyan-400 font-mono">
                <Clock className="w-3.5 h-3.5 animate-spin" />
                <span>{elapsedSeconds.toFixed(1)}s</span>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 transition-colors cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                <span>取消</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onRun}
              className="flex items-center gap-1.5 px-5 py-1.5 text-xs font-semibold rounded-lg bg-cyan-500 hover:bg-cyan-400 text-zinc-950 shadow-sm shadow-cyan-500/25 transition-all cursor-pointer hover:shadow-cyan-500/40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>运行流水线 (Run)</span>
            </button>
          )}
        </div>
      </div>

      {/* Preset Details & Notice Banner */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-zinc-400 bg-zinc-900/60 px-3 py-1.5 rounded-lg border border-zinc-800/60">
        <div className="flex items-center gap-2">
          <span className="font-mono text-zinc-300 font-medium">
            user_id: {selectedPreset.id}
          </span>
          <span className="text-zinc-600">·</span>
          <span>{selectedPreset.description}</span>
        </div>
        <div className="flex items-center gap-1 text-zinc-400">
          <Info className="w-3 h-3 text-zinc-400" />
          <span>注：未开启 Redis 时预设 context 参数才生效注入画像；开启后自动读取特征库</span>
        </div>
      </div>

      {/* Error Alert Banner */}
      {error && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={onClearError}
            className="text-rose-400 hover:text-rose-200 p-0.5 rounded cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
