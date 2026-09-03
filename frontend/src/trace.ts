import type { AgentResult, Product } from "./types";

export interface PhaseInfo {
  id: number;
  name: string;
  title: string;
  description: string;
  latencyMs: number;
  keys: string[];
}

export interface OOSInfo {
  oosProductIds: string[];
  oosProducts: Product[];
  totalRecalled: number;
  availableCount: number;
}

export function computePhaseDurations(agentResults: Record<string, AgentResult>): {
  phase1Ms: number;
  phase2Ms: number;
  phase3Ms: number;
  effectiveTotalMs: number;
} {
  const profileMs = agentResults.user_profile?.latency_ms || 0;
  const recallMs = agentResults.product_recall?.latency_ms || 0;
  const phase1Ms = Math.max(profileMs, recallMs);

  const recMs = agentResults.product_rec?.latency_ms || 0;
  const invMs = agentResults.inventory?.latency_ms || 0;
  const phase2Ms = Math.max(recMs, invMs);

  const phase3Ms = agentResults.marketing_copy?.latency_ms || 0;

  const effectiveTotalMs = phase1Ms + phase2Ms + phase3Ms;

  return {
    phase1Ms,
    phase2Ms,
    phase3Ms,
    effectiveTotalMs,
  };
}

export function computeOOS(
  recallResult?: AgentResult,
  inventoryResult?: AgentResult
): OOSInfo {
  const recallProducts = recallResult?.products || [];
  const recallIds = recallProducts.map((p) => p.product_id);
  const availableSet = new Set(inventoryResult?.available_products || []);

  const oosProductIds = recallIds.filter((id) => !availableSet.has(id));
  const oosProducts = recallProducts.filter((p) => oosProductIds.includes(p.product_id));

  return {
    oosProductIds,
    oosProducts,
    totalRecalled: recallIds.length,
    availableCount: availableSet.size,
  };
}
