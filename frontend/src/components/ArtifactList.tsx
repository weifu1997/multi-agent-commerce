import React, { useState } from "react";
import {
  Check,
  CheckCircle,
  Flame,
  Headphones,
  Laptop,
  Package,
  Smartphone,
  Sparkles,
  Watch,
  X,
} from "lucide-react";
import type { RecommendationResponse } from "../types";

interface ArtifactListProps {
  response: RecommendationResponse | null;
  loading: boolean;
  onConvert: (productId: string, success: boolean) => Promise<void>;
}

function getCategoryIcon(category: string, name: string) {
  const text = `${category} ${name}`.toLowerCase();
  if (text.includes("手机") || text.includes("phone")) return Smartphone;
  if (text.includes("耳机") || text.includes("audio") || text.includes("sound")) return Headphones;
  if (text.includes("电脑") || text.includes("笔记本") || text.includes("pad") || text.includes("平板")) return Laptop;
  if (text.includes("手表") || text.includes("手环") || text.includes("watch")) return Watch;
  return Package;
}

export const ArtifactList: React.FC<ArtifactListProps> = ({
  response,
  loading,
  onConvert,
}) => {
  // Track action state per product: undefined | 'converted' | 'skipped'
  const [actions, setActions] = useState<Record<string, "converted" | "skipped">>({});
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
          <div className="h-5 w-32 bg-zinc-800 rounded animate-pulse" />
          <div className="h-4 w-16 bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4 space-y-3 animate-pulse"
            >
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-lg bg-zinc-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 bg-zinc-800 rounded" />
                  <div className="h-3 w-1/3 bg-zinc-800/60 rounded" />
                </div>
              </div>
              <div className="h-10 bg-zinc-800/40 rounded-lg" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!response) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center rounded-2xl bg-zinc-900/20 border border-zinc-800/60 text-zinc-400 text-xs">
        <Package className="w-8 h-8 text-zinc-500 mb-2" />
        <span>运行推荐后，最终输出的候选商品与文案将展示在此处</span>
      </div>
    );
  }

  const products = response.products || [];
  const inventoryLimits = response.agent_results?.inventory?.purchase_limits || {};
  const lowStockAlerts = response.agent_results?.inventory?.low_stock_alerts || [];
  const lowStockSet = new Set(lowStockAlerts.map((a) => a.product_id));

  // Build copy map by product_id
  const copyMap: Record<string, string> = {};
  if (response.marketing_copies) {
    for (const c of response.marketing_copies) {
      if (c.product_id) {
        copyMap[c.product_id] = c.copy || c.headline || "";
      }
    }
  }
  if (response.agent_results?.marketing_copy?.copies) {
    for (const c of response.agent_results.marketing_copy.copies) {
      if (c.product_id && !copyMap[c.product_id]) {
        copyMap[c.product_id] = c.copy || c.headline || "";
      }
    }
  }

  const handleAction = async (productId: string, success: boolean) => {
    setSubmittingId(productId);
    try {
      await onConvert(productId, success);
      setActions((prev) => ({
        ...prev,
        [productId]: success ? "converted" : "skipped",
      }));
    } finally {
      setSubmittingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Artifacts Header */}
      <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-cyan-400" />
          <h2 className="text-xs font-semibold text-zinc-200 m-0">
            推荐生成产物 (Artifacts)
          </h2>
        </div>
        <span className="text-[11px] font-mono text-zinc-400">
          Top {products.length} 款推荐
        </span>
      </div>

      {/* Product Cards List */}
      <div className="space-y-3.5">
        {products.map((product, idx) => {
          const Icon = getCategoryIcon(product.category, product.name);
          const copy = copyMap[product.product_id];
          const limit = inventoryLimits[product.product_id];
          const isLowStock = lowStockSet.has(product.product_id);
          const actionState = actions[product.product_id];
          const isSubmitting = submittingId === product.product_id;

          return (
            <div
              key={product.product_id}
              className="rounded-xl bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700/90 transition-all p-4 space-y-3 shadow-sm relative group"
            >
              {/* Product Info Row */}
              <div className="flex items-start gap-3">
                {/* Category Icon Placeholder (AC6: no empty image_url) */}
                <div className="flex items-center justify-center w-11 h-11 rounded-lg bg-zinc-800/90 border border-zinc-700/60 text-zinc-300 shrink-0">
                  <Icon className="w-5 h-5 text-cyan-400" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-amber-400">
                        #{idx + 1}
                      </span>
                      <span className="text-[10px] font-mono text-zinc-400">
                        [{product.product_id}]
                      </span>
                      <h3 className="text-xs font-medium text-zinc-100 truncate m-0">
                        {product.name}
                      </h3>
                    </div>
                    {/* Price */}
                    <div className="text-sm font-semibold text-cyan-400 font-mono shrink-0">
                      ¥{product.price.toFixed(2)}
                    </div>
                  </div>

                  {/* Badges: Category, Limit, Low Stock */}
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                      {product.category}
                    </span>
                    {limit !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/15 border border-blue-500/30 text-blue-300 font-mono">
                        限购 {limit} 件
                      </span>
                    )}
                    {isLowStock && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-mono flex items-center gap-0.5">
                        <Flame className="w-2.5 h-2.5" /> 库存紧俏
                      </span>
                    )}
                    {product.brand && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800/70 text-zinc-400 font-mono">
                        {product.brand}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Generated Marketing Copy Box */}
              {copy && (
                <div className="p-2.5 rounded-lg bg-zinc-950/70 border border-zinc-800/70 text-[11px] text-zinc-300 italic font-sans flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400 shrink-0 mt-0.5 not-italic" />
                  <span className="leading-relaxed">"{copy}"</span>
                </div>
              )}

              {/* Action Buttons / Outcome Conversion */}
              <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-xs">
                <span className="text-[11px] text-zinc-400">模拟用户反馈:</span>

                {actionState ? (
                  <div className="flex items-center gap-1.5 font-mono text-[11px]">
                    {actionState === "converted" ? (
                      <span className="flex items-center gap-1 text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                        <CheckCircle className="w-3 h-3" /> 已转化下单 (Success=true)
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-zinc-400 bg-zinc-800/80 px-2 py-0.5 rounded border border-zinc-700">
                        <X className="w-3 h-3" /> 已跳过 (Success=false)
                      </span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleAction(product.product_id, false)}
                      className="px-2.5 py-1 text-[11px] text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700/80 border border-zinc-700/60 rounded transition-colors cursor-pointer"
                    >
                      跳过
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleAction(product.product_id, true)}
                      className="flex items-center gap-1 px-3 py-1 text-[11px] font-medium text-zinc-950 bg-cyan-400 hover:bg-cyan-300 rounded shadow-xs shadow-cyan-500/20 transition-all cursor-pointer"
                    >
                      <Check className="w-3 h-3" />
                      <span>转化下单</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
