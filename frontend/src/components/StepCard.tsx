import React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Filter,
  PackageCheck,
  ShieldAlert,
  Sparkles,
  UserCheck,
  Zap,
} from "lucide-react";
import type { AgentResult } from "../types";
import { computeOOS } from "../trace";

interface StepCardProps {
  cardKey: "user_profile" | "product_recall" | "product_rec" | "inventory" | "marketing_copy";
  result?: AgentResult;
  loading?: boolean;
  recallResult?: AgentResult; // passed to inventory card for OOS diff
  copyExperimentGroup?: string; // passed to marketing_copy card
}

const CARD_CONFIG: Record<
  string,
  {
    name: string;
    role: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
  }
> = {
  user_profile: {
    name: "用户画像 Agent",
    role: "动态特征聚类与 RFM 分群",
    icon: UserCheck,
    accentColor: "text-blue-400",
  },
  product_recall: {
    name: "多路召回 Agent",
    role: "向量相似度 + 热门协同召回",
    icon: Filter,
    accentColor: "text-indigo-400",
  },
  product_rec: {
    name: "推荐排序 Agent",
    role: "A/B 策略路由与精排得分",
    icon: Zap,
    accentColor: "text-amber-400",
  },
  inventory: {
    name: "库存风控 Agent",
    role: "可用性校验 / 缺货拦截 / 限购",
    icon: PackageCheck,
    accentColor: "text-emerald-400",
  },
  marketing_copy: {
    name: "营销文案 Agent",
    role: "个性化卖点提炼与风格适配",
    icon: Sparkles,
    accentColor: "text-purple-400",
  },
};

export const StepCard: React.FC<StepCardProps> = ({
  cardKey,
  result,
  loading,
  recallResult,
  copyExperimentGroup,
}) => {
  const config = CARD_CONFIG[cardKey];
  const Icon = config.icon;

  if (loading) {
    return (
      <div className="rounded-xl bg-zinc-900/70 border border-zinc-800/80 p-4 space-y-3 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-zinc-800" />
            <div className="space-y-1">
              <div className="h-3.5 w-24 bg-zinc-800 rounded" />
              <div className="h-2.5 w-36 bg-zinc-800/60 rounded" />
            </div>
          </div>
          <div className="h-5 w-14 bg-zinc-800 rounded-full" />
        </div>
        <div className="h-20 bg-zinc-800/40 rounded-lg" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-xl bg-zinc-900/40 border border-zinc-800/50 p-4 text-center text-zinc-500 text-xs py-8">
        等待运行...
      </div>
    );
  }

  const isSuccess = result.success;

  return (
    <div className="rounded-xl bg-zinc-900/80 border border-zinc-800/90 hover:border-zinc-700/80 transition-all p-4 space-y-3.5 shadow-sm">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-zinc-800 border border-zinc-700/60">
            <Icon className={`w-4 h-4 ${config.accentColor}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-semibold text-zinc-200 m-0">
                {config.name}
              </h3>
              {isSuccess ? (
                <span className="flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded font-mono">
                  <CheckCircle2 className="w-2.5 h-2.5" /> 正常
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.2 rounded font-mono">
                  <AlertTriangle className="w-2.5 h-2.5" /> 降级
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 m-0">{config.role}</p>
          </div>
        </div>

        {/* Latency Badge */}
        <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-zinc-800/80 border border-zinc-700/60 text-[11px] font-mono text-zinc-400">
          <Clock className="w-3 h-3 text-cyan-400" />
          <span>{result.latency_ms.toFixed(0)} ms</span>
        </div>
      </div>

      {/* Error Fallback display if not success */}
      {!isSuccess && (
        <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
          <div className="font-semibold text-[11px] mb-0.5">Agent 降级警告</div>
          <p className="text-[11px] text-rose-200 m-0 font-mono">
            {result.error || "Agent 内部错误，已使用规则降级机制"}
          </p>
        </div>
      )}

      {/* Content Area By Agent */}
      {isSuccess && (
        <div className="text-xs space-y-2.5">
          {/* 1. User Profile Agent */}
          {cardKey === "user_profile" && (
            <div className="space-y-2 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
              {result.profile ? (
                <>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-zinc-400 text-[11px]">用户分群:</span>
                    {result.profile.segments.map((seg) => (
                      <span
                        key={seg}
                        className="px-2 py-0.5 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300 text-[11px] font-mono"
                      >
                        {seg}
                      </span>
                    ))}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-zinc-400 text-[11px]">
                    <span>偏好类目:</span>
                    <div className="flex flex-wrap gap-1">
                      {result.profile.preferred_categories?.length ? (
                        result.profile.preferred_categories.map((c) => (
                          <span
                            key={c}
                            className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono"
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="text-zinc-400 font-mono">通用偏好</span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-zinc-800/70">
                    <div>
                      <span className="text-zinc-400">价格预算:</span>{" "}
                      <span className="text-zinc-200 font-mono">
                        ¥{result.profile.price_range?.[0] ?? 0} - ¥
                        {result.profile.price_range?.[1] ?? 10000}
                      </span>
                    </div>
                    <div>
                      <span className="text-zinc-400">RFM 分值:</span>{" "}
                      <span className="text-zinc-200 font-mono">
                        {Object.entries(result.profile.rfm_score || {})
                          .map(([k, v]) => `${k}:${Number(v).toFixed(1)}`)
                          .join(" ") || "默认"}
                      </span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-zinc-400">无画像明细</div>
              )}
            </div>
          )}

          {/* 2. Product Recall Agent */}
          {cardKey === "product_recall" && (
            <div className="space-y-2 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-zinc-400">
                  召回策略:{" "}
                  <span className="text-zinc-200 font-mono">
                    {result.recall_strategy || result.data?.recall_strategy || "多路融合召回"}
                  </span>
                </span>
                <span className="text-cyan-400 font-mono font-medium">
                  共召回 {result.products?.length ?? result.data?.candidate_count ?? 0} 款候选商品
                </span>
              </div>

              {/* Product Candidates Pills */}
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                {result.products?.map((p) => (
                  <span
                    key={p.product_id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/90 border border-zinc-700/60 text-[11px] text-zinc-300 font-mono"
                  >
                    <span className="text-cyan-400 font-semibold">[{p.product_id}]</span>
                    <span>{p.name}</span>
                    <span className="text-zinc-400">¥{p.price}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 3. Product Rec (Rerank) Agent */}
          {cardKey === "product_rec" && (
            <div className="space-y-2 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
              {/* Actual branch strategy highlight */}
              <div className="flex items-center justify-between text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400">实际执行分支:</span>
                  <span
                    className={`px-2 py-0.5 rounded font-mono font-semibold text-[11px] ${
                      result.data?.strategy === "llm"
                        ? "bg-purple-500/20 text-purple-300 border border-purple-500/40"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                    }`}
                  >
                    {result.data?.strategy === "llm"
                      ? "LLM 深度意图精排 (llm)"
                      : "规则启发式重排 (rule_based)"}
                  </span>
                </div>
                {result.confidence !== undefined && (
                  <span className="text-zinc-400 font-mono">
                    置信度: {(result.confidence * 100).toFixed(0)}%
                  </span>
                )}
              </div>

              {/* Ranked outcome order */}
              <div className="space-y-1 pt-1">
                <span className="text-[11px] text-zinc-400">精排Top输出顺序:</span>
                <div className="flex flex-wrap gap-1.5">
                  {result.products?.map((p, idx) => (
                    <span
                      key={p.product_id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-800/90 border border-zinc-700/60 text-[11px] text-zinc-300 font-mono"
                    >
                      <span className="text-amber-400 font-bold">#{idx + 1}</span>
                      <span className="text-zinc-200">[{p.product_id}]</span>
                      <span>{p.name}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 4. Inventory Agent */}
          {cardKey === "inventory" && (
            <div className="space-y-2.5 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
              {(() => {
                const oos = computeOOS(recallResult, result);
                return (
                  <>
                    {/* OOS Intercept status */}
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-400">库存可用校验:</span>
                      <span className="text-emerald-400 font-mono">
                        {result.available_products?.length ?? 0} 款可售
                      </span>
                    </div>

                    {oos.oosProductIds.length > 0 ? (
                      <div className="flex items-center gap-2 px-2.5 py-1.5 rounded bg-rose-500/15 border border-rose-500/30 text-rose-300 text-[11px]">
                        <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
                        <div>
                          <span className="font-semibold">拦截缺货商品 (OOS Intercept):</span>{" "}
                          <span className="font-mono">
                            {oos.oosProductIds.join(", ")}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                        <span>全部候选商品库存充足，无缺货拦截</span>
                      </div>
                    )}

                    {/* Low stock alerts & purchase limits */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1 border-t border-zinc-800/70">
                      <div>
                        <span className="text-zinc-400">低库存预警:</span>{" "}
                        {result.low_stock_alerts && result.low_stock_alerts.length > 0 ? (
                          <span className="text-amber-400 font-mono">
                            {result.low_stock_alerts.map((a) => `${a.product_id}(余${a.current_stock})`).join(", ")}
                          </span>
                        ) : (
                          <span className="text-zinc-400 font-mono">无</span>
                        )}
                      </div>
                      <div>
                        <span className="text-zinc-400">限购规则:</span>{" "}
                        {result.purchase_limits && Object.keys(result.purchase_limits).length > 0 ? (
                          <span className="text-cyan-400 font-mono">
                            {Object.entries(result.purchase_limits)
                              .map(([id, lim]) => `${id}限${lim}件`)
                              .join(", ")}
                          </span>
                        ) : (
                          <span className="text-zinc-400 font-mono">无特殊限购</span>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* 5. Marketing Copy Agent */}
          {cardKey === "marketing_copy" && (
            <div className="space-y-2 bg-zinc-950/60 p-3 rounded-lg border border-zinc-800/60">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <div className="flex items-center gap-1.5">
                  <span className="text-zinc-400">调用模板:</span>
                  <span className="px-1.5 py-0.2 rounded bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono">
                    {result.prompt_template_used || "templates/default.txt"}
                  </span>
                </div>
                {copyExperimentGroup && (
                  <div className="flex items-center gap-1 text-zinc-400">
                    <span>实验组风格:</span>
                    <span className="px-1.5 py-0.2 rounded bg-zinc-800 text-cyan-300 font-mono">
                      {copyExperimentGroup}
                    </span>
                  </div>
                )}
              </div>

              {/* Sample marketing copy tags */}
              {result.copies && result.copies.length > 0 ? (
                <div className="space-y-1 pt-1">
                  <span className="text-[11px] text-zinc-400">生成文案预览 (共 {result.copies.length} 条):</span>
                  <div className="space-y-1 max-h-20 overflow-y-auto">
                    {result.copies.slice(0, 3).map((item, i) => (
                      <div
                        key={i}
                        className="text-[11px] text-zinc-300 bg-zinc-900/90 px-2 py-1 rounded border border-zinc-800/80 font-sans italic"
                      >
                        <span className="text-purple-400 font-mono font-medium not-italic mr-1.5">
                          [{item.product_id}]
                        </span>
                        "{item.copy || item.headline || Object.values(item).find(v => typeof v === 'string')}"
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-zinc-400 text-[11px]">无文案内容</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
