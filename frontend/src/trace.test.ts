import test from "node:test";
import assert from "node:assert/strict";
import { computePhaseDurations, computeOOS } from "./trace.ts";

test("computePhaseDurations computes max latency per phase", () => {
  const agentResults = {
    user_profile: {
      agent_name: "user_profile",
      success: true,
      latency_ms: 120,
    },
    product_recall: {
      agent_name: "product_recall",
      success: true,
      latency_ms: 350,
    },
    product_rec: {
      agent_name: "product_rec",
      success: true,
      latency_ms: 800,
    },
    inventory: {
      agent_name: "inventory",
      success: true,
      latency_ms: 200,
    },
    marketing_copy: {
      agent_name: "marketing_copy",
      success: true,
      latency_ms: 600,
    },
  };

  const durations = computePhaseDurations(agentResults);
  assert.equal(durations.phase1Ms, 350, "Phase 1 max(120, 350) should be 350");
  assert.equal(durations.phase2Ms, 800, "Phase 2 max(800, 200) should be 800");
  assert.equal(durations.phase3Ms, 600, "Phase 3 should be 600");
  assert.equal(
    durations.effectiveTotalMs,
    350 + 800 + 600,
    "Effective total should be sum of phase maximums (1750ms)"
  );
});

test("computeOOS identifies recalled products that are not available", () => {
  const recallResult = {
    agent_name: "product_recall",
    success: true,
    latency_ms: 100,
    products: [
      { product_id: "P001", name: "手机", category: "手机", price: 5999 },
      { product_id: "P002", name: "耳机", category: "数码", price: 999 },
      { product_id: "P016", name: "缺货商品", category: "配件", price: 99 },
    ],
  };

  const inventoryResult = {
    agent_name: "inventory",
    success: true,
    latency_ms: 50,
    available_products: ["P001", "P002"],
  };

  const oos = computeOOS(recallResult, inventoryResult);
  assert.deepEqual(oos.oosProductIds, ["P016"]);
  assert.equal(oos.oosProducts.length, 1);
  assert.equal(oos.oosProducts[0].product_id, "P016");
  assert.equal(oos.totalRecalled, 3);
  assert.equal(oos.availableCount, 2);
});
