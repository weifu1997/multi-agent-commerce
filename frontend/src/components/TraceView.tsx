import React from "react";
import { ArrowDown, Cpu, Layers } from "lucide-react";
import type { RecommendationResponse } from "../types";
import { computePhaseDurations } from "../trace";
import { StepCard } from "./StepCard";

interface TraceViewProps {
  response: RecommendationResponse | null;
  loading: boolean;
}

export const TraceView: React.FC<TraceViewProps> = ({ response, loading }) => {
  const agentResults = response?.agent_results || {};
  const { phase1Ms, phase2Ms, phase3Ms, effectiveTotalMs } =
    computePhaseDurations(agentResults);

  const copyExpGroup = response?.experiments?.copy_style?.group;

  return (
    <div className="space-y-6">
      {/* Top Trace Bar: Timing & Overview */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-zinc-900/60 border border-zinc-800/80 rounded-xl">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-semibold text-zinc-200">
            Agent 执行流水线 (Trace)
          </span>
          <span className="text-[11px] text-zinc-400 font-mono">
            3 Phases · 5 Agents 协同
          </span>
        </div>

        {(response || loading) && (
          <div className="flex items-center gap-3 text-xs font-mono">
            {loading ? (
              <span className="text-cyan-400 animate-pulse">执行中...</span>
            ) : (
              <>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <span>总响应耗时:</span>
                  <span className="text-zinc-200 font-semibold">
                    {response?.total_latency_ms?.toFixed(0) || 0} ms
                  </span>
                </div>
                <span className="text-zinc-700">|</span>
                <div className="flex items-center gap-1.5 text-zinc-400">
                  <span>并行等效耗时:</span>
                  <span className="text-cyan-400 font-semibold">
                    {effectiveTotalMs.toFixed(0)} ms
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Empty State */}
      {!response && !loading && (
        <div className="flex flex-col items-center justify-center p-12 text-center rounded-2xl bg-zinc-900/20 border border-dashed border-zinc-800 space-y-3">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-zinc-300 m-0">
              就绪，等待触发 Run
            </h4>
            <p className="text-xs text-zinc-400 m-0 mt-1 max-w-sm">
              在上方选择用户画像预设与推荐引擎，点击“运行流水线”查看 4 个 Agent 的三阶段并行流水线与产物。
            </p>
          </div>
        </div>
      )}

      {/* Pipeline Phases - Layout 2 + 2 + 1 (AC2) */}
      {(response || loading) && (
        <div className="space-y-5">
          {/* Phase 1: Two-up parallel */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-blue-500/15 border border-blue-500/30 text-blue-300">
                  Phase 1
                </span>
                <span className="text-xs font-medium text-zinc-300">
                  画像特征提取 ∥ 多路商品召回 (并行)
                </span>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                耗时: {phase1Ms.toFixed(0)} ms (取并行最大值)
              </span>
            </div>

            {/* 2-column grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <StepCard
                cardKey="user_profile"
                result={agentResults.user_profile}
                loading={loading}
              />
              <StepCard
                cardKey="product_recall"
                result={agentResults.product_recall}
                loading={loading}
              />
            </div>
          </div>

          {/* Flow Connector Arrow */}
          <div className="flex justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400">
              <ArrowDown className="w-3 h-3 text-cyan-400" />
              <span>画像与召回候选注入下一阶段</span>
            </div>
          </div>

          {/* Phase 2: Two-up parallel */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-amber-500/15 border border-amber-500/30 text-amber-300">
                  Phase 2
                </span>
                <span className="text-xs font-medium text-zinc-300">
                  个性化精排 ∥ 库存与风控校验 (并行)
                </span>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                耗时: {phase2Ms.toFixed(0)} ms (取并行最大值)
              </span>
            </div>

            {/* 2-column grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              <StepCard
                cardKey="product_rec"
                result={agentResults.product_rec}
                loading={loading}
              />
              <StepCard
                cardKey="inventory"
                result={agentResults.inventory}
                recallResult={agentResults.product_recall}
                loading={loading}
              />
            </div>
          </div>

          {/* Flow Connector Arrow */}
          <div className="flex justify-center">
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[10px] font-mono text-zinc-400">
              <ArrowDown className="w-3 h-3 text-cyan-400" />
              <span>通过库存校验的 Top 商品进入文案生成</span>
            </div>
          </div>

          {/* Phase 3: One card full width */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-purple-500/15 border border-purple-500/30 text-purple-300">
                  Phase 3
                </span>
                <span className="text-xs font-medium text-zinc-300">
                  个性化卖点文案生成 (单卡执行)
                </span>
              </div>
              <span className="text-[11px] font-mono text-zinc-400">
                耗时: {phase3Ms.toFixed(0)} ms
              </span>
            </div>

            {/* 1-column full width */}
            <div className="grid grid-cols-1">
              <StepCard
                cardKey="marketing_copy"
                result={agentResults.marketing_copy}
                copyExperimentGroup={copyExpGroup}
                loading={loading}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
