import React from "react";
import {
  FlaskConical,
  Info,
  RefreshCw,
  Sparkles,
  X,
} from "lucide-react";
import type { ExperimentAssignment, ExperimentsResponse } from "../types";

interface ExperimentDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  experiments: ExperimentsResponse | null;
  loading: boolean;
  onRefresh: () => void;
  assignedExperiments?: Record<string, ExperimentAssignment>;
  onSimulateOutcome: (expId: string, group: string, success: boolean) => Promise<void>;
}

export const ExperimentDrawer: React.FC<ExperimentDrawerProps> = ({
  isOpen,
  onClose,
  experiments,
  loading,
  onRefresh,
  assignedExperiments = {},
  onSimulateOutcome,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-zinc-900 border-l border-zinc-800 p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
          {/* Header */}
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                  <FlaskConical className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100 m-0">
                    A/B 实验状态与后验分布
                  </h2>
                  <p className="text-[11px] text-zinc-400 m-0">
                    Thompson Sampling (Beta 分布)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={onRefresh}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
                  title="刷新实验指标"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Static Hash Weight Note */}
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-zinc-950/80 border border-zinc-800/80 text-[11px] text-zinc-400 leading-relaxed">
              <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
              <div>
                <span>哈希权重 50/50（静态配置）。</span>
                <span className="text-zinc-400 ml-1">
                  每次 Run 按 user_id 确定性哈希分流；探索阶段引入 10% Thompson Sampling 动态微调。
                </span>
              </div>
            </div>

            {/* Experiments List */}
            {loading && !experiments ? (
              <div className="py-12 text-center text-zinc-500 text-xs animate-pulse">
                加载实验配置与后验数据...
              </div>
            ) : !experiments || Object.keys(experiments).length === 0 ? (
              <div className="py-12 text-center text-zinc-500 text-xs">
                暂未加载到活跃实验配置
              </div>
            ) : (
              <div className="space-y-6">
                {Object.entries(experiments).map(([expId, exp]) => {
                  const assigned = assignedExperiments[expId];

                  return (
                    <div
                      key={expId}
                      className="rounded-xl bg-zinc-950/60 border border-zinc-800/90 p-4 space-y-3"
                    >
                      {/* Exp Title */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-zinc-200">
                              {exp.name}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                              {expId}
                            </span>
                          </div>
                        </div>
                        {assigned && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 flex items-center gap-1">
                            <Sparkles className="w-2.5 h-2.5" /> 本次命中: {assigned.group}
                          </span>
                        )}
                      </div>

                      {/* Groups */}
                      <div className="space-y-2.5 pt-1">
                        {exp.groups.map((group) => {
                          const isAssignedGroup = assigned?.group === group.name;
                          // posterior mean from stats if available, otherwise computed
                          const mean =
                            exp.stats?.[group.name]?.mean ??
                            (group.successes + 1) /
                              (group.successes + group.failures + 2);
                          const total = group.successes + group.failures;

                          return (
                            <div
                              key={group.name}
                              className={`p-3 rounded-lg border transition-all space-y-2 ${
                                isAssignedGroup
                                  ? "bg-cyan-950/20 border-cyan-500/40"
                                  : "bg-zinc-900/70 border-zinc-800/80"
                              }`}
                            >
                              <div className="flex items-center justify-between text-xs">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-semibold text-zinc-100">
                                    {group.name}
                                  </span>
                                  {isAssignedGroup && (
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono">
                                      当前组
                                    </span>
                                  )}
                                </div>
                                <span className="text-[11px] font-mono text-zinc-400">
                                  静态权重: {(group.weight * 100).toFixed(0)}%
                                </span>
                              </div>

                              {/* Config summary */}
                              {group.config && Object.keys(group.config).length > 0 && (
                                <div className="text-[10px] font-mono text-zinc-400 bg-zinc-950/60 px-2 py-1 rounded border border-zinc-800/60 truncate">
                                  配置: {JSON.stringify(group.config)}
                                </div>
                              )}

                              {/* Beta Posterior stats */}
                              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-zinc-800/50">
                                <div>
                                  <span className="text-zinc-400">后验期望转化率:</span>{" "}
                                  <span className="font-mono font-bold text-cyan-400">
                                    {(mean * 100).toFixed(1)}%
                                  </span>
                                </div>
                                <div className="text-right">
                                  <span className="text-zinc-400">样本量:</span>{" "}
                                  <span className="font-mono text-zinc-200">
                                    {total}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                                <span>
                                  成功 (α): <strong className="text-emerald-400">{group.successes}</strong>
                                </span>
                                <span>
                                  失败 (β): <strong className="text-rose-400">{group.failures}</strong>
                                </span>
                              </div>

                              {/* Quick Test simulator buttons */}
                              <div className="flex items-center justify-end gap-1.5 pt-1 border-t border-zinc-800/40">
                                <span className="text-[10px] text-zinc-400 mr-auto">单组测试:</span>
                                <button
                                  type="button"
                                  onClick={() => onSimulateOutcome(expId, group.name, false)}
                                  className="px-2 py-0.5 rounded text-[10px] text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/60 cursor-pointer"
                                  title="模拟此组 +1 失败"
                                >
                                  +1 失败
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onSimulateOutcome(expId, group.name, true)}
                                  className="px-2 py-0.5 rounded text-[10px] text-cyan-300 hover:text-cyan-100 bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 cursor-pointer"
                                  title="模拟此组 +1 转化"
                                >
                                  +1 转化
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
            <span>数据源: /api/v1/experiments</span>
            <button
              type="button"
              onClick={onClose}
              className="text-cyan-400 hover:text-cyan-300 cursor-pointer font-medium"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
