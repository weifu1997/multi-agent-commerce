# P0/P1 recommendation API contract

## Goal

Make Supervisor and LangGraph recommendation HTTP responses carry the agent traces, dual experiment assignment, and rerank strategy that a dashboard needs, without changing recommendation ranking behavior.

Value: the next frontend can render Phase 1/2/3, A/B group, and conversion reporting from one contract instead of guessing from stripped JSON.

## Background

Confirmed against current code (no frontend exists; curl/README are the only clients):

- `POST /api/v1/recommend` uses `response_model=RecommendationResponse`. `agent_results` is typed `dict[str, AgentResult]` (`models/schemas.py` L86–94). FastAPI/`jsonable_encoder` therefore drops subclass fields: `profile`, recall/rerank `products`, `recall_strategy`, `available_products`, `low_stock_alerts`, `purchase_limits`, `copies`, `prompt_template_used`.
- Remaining per-agent HTTP fields are `agent_name`, `success`, `latency_ms`, `error`, `data`, `confidence`. `data` only has counts / raw LLM text (`agents/user_profile_agent.py` L73, `agents/product_rec_agent.py` L121–126, `agents/inventory_agent.py` L73–77, `agents/marketing_copy_agent.py` L104–109).
- Supervisor in-memory keys are `user_profile`, `product_recall`, `product_rec`, `marketing_copy`, `inventory` (`orchestrator/supervisor.py` L173–179). Graph internal key for rerank is `rerank` (`orchestrator/graph.py` L115).
- `POST /api/v1/recommend/graph` returns a thin dict: no `agent_results`, no `timestamp` (`main.py` L108–115). Graph holds a **second** `ABTestEngine()` (`orchestrator/graph.py` L59), so outcomes on `/experiments` do not apply to Graph traffic.
- Response `experiment_group` is only `rec_strategy` (`orchestrator/supervisor.py` L172). `copy_style` is assigned (`L110–111`) but never returned. `copy_style` is hash-only; `rec_strategy` is hash with 10% Thompson (`L183–187`).
- `ProductRecResult.recall_strategy` is hardcoded `"collaborative_filter+vector+hot"` (`agents/product_rec_agent.py` L124). Actual rerank branch is `rule_based` vs `llm` (`L101–105`) and is not in `data`.
- `POST /experiments/{id}/outcome` always returns `{"status":"recorded"}` even when experiment or group is missing (`main.py` L150–154, `services/ab_test.py` L100–111).
- Graph uninitialized returns `{"error": "..."}` with HTTP 200 (`main.py` L99–100).

## Requirements

- **R1 (P0)** HTTP JSON for `agent_results` must keep subclass fields for both success and fallback traces (empty/null extras allowed on fallback).
- **R2 (P0)** `POST /api/v1/recommend/graph` must return the same `RecommendationResponse` shape as Supervisor, including `agent_results` and `timestamp`.
- **R3 (P0)** Graph rerank trace key must be `product_rec` (same as Supervisor), not `rerank`.
- **R4 (P0)** Supervisor and Graph must share the `ABTestEngine` instance created in `main.py`. Outcome posted to `/experiments/{id}/outcome` must update that shared engine.
- **R5 (P0)** Graph and Supervisor must use the same assignment helper: `rec_strategy` hash with existing 10% Thompson; `copy_style` hash-only. Ranking math must not change.
- **R6 (P1)** Response must include `experiments` with both `rec_strategy` and `copy_style`. Each entry: `group`, `config`, `assign` (`hash` | `thompson`). Keep `experiment_group` as `rec_strategy.group` for compatibility.
- **R7 (P1)** Rerank `agent_results.product_rec.data.strategy` must be `"rule_based"` or `"llm"` matching the branch actually executed (including the “llm requested but profile missing → rule” case).
- **R8 (P1)** Unknown `experiment_id` or unknown `group` on outcome must return HTTP 404, not a fake recorded success.
- **R9 (P1)** Graph not initialized must return HTTP 503, not 200 with an error object.
- **R10** README API examples must match the new response (including `agent_results` extras and `experiments`).

## Acceptance Criteria

- [ ] **AC1**: `jsonable_encoder(RecommendationResponse)` (and FastAPI `response_model` path) includes `agent_results.user_profile.profile`, `product_recall.products`, `product_rec.products`, `inventory.available_products` / `low_stock_alerts` / `purchase_limits`, `marketing_copy.prompt_template_used`. Mapping: R1.
- [ ] **AC2**: Graph endpoint returns `agent_results` with the five Supervisor keys, `products`, `marketing_copies`, `experiments`, `experiment_group`, `total_latency_ms`, `timestamp`. Mapping: R2, R3, R6.
- [ ] **AC3**: Recording an outcome on `ab_engine` in `main.py` changes Graph assignment when Thompson is used (same object identity / same Beta state). Mapping: R4, R5.
- [ ] **AC4**: A Supervisor fake-agent recommend response contains `experiments.rec_strategy` and `experiments.copy_style` with `assign` in `{hash, thompson}`; `experiment_group == experiments.rec_strategy.group`. Mapping: R6.
- [ ] **AC5**: `product_rec.data.strategy` equals `"llm"` only when the LLM rerank branch ran; otherwise `"rule_based"`. Mapping: R7.
- [ ] **AC6**: `POST /api/v1/experiments/no_such/outcome?group=control&success=true` → 404. Unknown group on a real experiment → 404. Valid pair → 200 `{"status":"recorded"}` and Beta counters increment. Mapping: R8.
- [ ] **AC7**: Existing pipeline tests still pass (recall-not-rerecalled, inventory OOS filter, A/B drives strategy, graph node names). Mapping: R5.
- [ ] **AC8**: README response example includes `experiments` and at least one non-base `agent_results` field. Mapping: R10.

## Out of Scope

- Frontend (`frontend/`) and Vite proxy.
- Metrics: Graph `_collect_metrics`, passing `error` into `record_agent_call`, `record_business_event`.
- Changing Thompson probability, making `copy_style` use Thompson, or mutating `groups.weight`.
- Wiring `scene` into agents; Feature Store injection into Graph agents.
- Guaranteeing P016 in every recall; changing mock catalog.
- New endpoints or auth.

## Constraints

- Additive JSON only: existing fields stay; new fields may appear.
- No live LLM in tests (keep fake-agent / `jsonable_encoder` style from `tests/test_pipeline.py`).
- Outcome query signature (`group`, `success` as query params) stays; only status codes change on invalid ids.

## Key Decisions

| Decision | Choice |
|---|---|
| Polymorphism | `SerializeAsAny[AgentResult]` so subclass instances dump extra fields; do not rebuild fallback as a discriminated union |
| Compatibility | Keep `experiment_group`; add `experiments` |
| Graph vs Supervisor assignment | Same helper and same 10% Thompson on `rec_strategy` so dashboard conversion hits both paths |
| Graph error | 503 when graph is missing |
| Outcome miss | 404 for unknown experiment **or** group |
