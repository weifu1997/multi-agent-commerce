# Agent playground frontend

## Goal

Ship a single-page **agent run playground** for this demo: pick a user, hit Run, watch the four agents as a Phase 1/2/3 trace, then convert on product artifacts.

Value: a visitor should understand collaboration, A/B assignment, and inventory decisions from one run — the way LangSmith / OpenAI Agent playground / Manus show a run — not from an admin console or a mall.

## Background

Backend P0/P1 contract is live (`09-04-rec-api-contract`, `.trellis/spec/backend/recommendation-http-contract.md`):

- `POST /api/v1/recommend` and `POST /api/v1/recommend/graph` return the same `RecommendationResponse`
- `agent_results` keys: `user_profile`, `product_recall`, `product_rec`, `inventory`, `marketing_copy`
- Wire extras: `profile`, recall/rerank `products`, `data.strategy` (`rule_based`|`llm`), inventory alerts/limits, `prompt_template_used`
- `experiments.rec_strategy` + `experiments.copy_style` (`group`, `config`, `assign`); `experiment_group` equals rec group
- Outcome: `POST /api/v1/experiments/{id}/outcome?group=&success=` (query params; 404 if unknown)
- No SSE. One POST, 2–8s, then the full trace
- Profile `context` actually read: `recent_views`, `recent_purchases`, `view_count_7d`, `purchase_count_30d`, `avg_order_amount`, `active_hours`
- `scene` is logged only; experiment `weight` is static 50/50; `copy_style` is hash-only; Graph traffic is not in `/metrics`; `business` / `recent_errors` are usually empty
- No `frontend/` yet; CORS `*`; API `:8000`

Original three-tab dashboard is a valid **feature inventory**. It is the wrong **shell**: equal 体验/实验/Metrics tabs look like Grafana, not a popular agent product.

User decision: **shell A** — run composer + agent trace + artifacts. Not chat. Not an editable Dify canvas.

## Requirements

- **R1** Consume the P0/P1 JSON as-is. Do not invent agent fields, scores, images, or live `weight`.
- **R2** One primary surface: composer → trace (hero) → product artifacts. Experiments are a drawer. Health/model is a status pill. No three equal tabs.
- **R3** Composer: four presets (新用户 / 高客单 VIP / 价格敏感 / 流失风险) filling real `context` keys + stable `user_id`; Supervisor vs Graph; `num_items` (default 5, min 3 so P016 can appear); Run / cancel.
- **R4** Trace shows five result nodes in three phases (profile ∥ recall → rerank ∥ inventory → copy). Each card uses real extras: segments/RFM/price band; candidate ids; `data.strategy`; OOS intercept + alerts + limits; template + copy style. Per-node `latency_ms`; phase time = max of parallel members.
- **R5** Artifacts: product cards (category icon, not empty `image_url`), copy text, limit tag from `purchase_limits`. Convert / skip posts outcome for `rec_strategy` and `copy_style` using returned groups, then refreshes experiment drawer.
- **R6** Experiment drawer: α/β, `α/(α+β)` labeled as posterior (not raw CVR), static hash `weight` caption. Do not draw `weight` as live traffic share.
- **R7** Loading: DAG skeleton until the POST returns. No fake token stream.
- **R8** Collapsible raw JSON of the last response.
- **R9** Vite app in `frontend/`; proxy `/api` and `/health` to `http://localhost:8000`. React 18 + Vite + Tailwind + Lucide. Chinese UI. Dark theme.

## Acceptance Criteria

- [ ] **AC1**: After Run, the five trace cards show subclass extras from HTTP (profile segments, recall product ids, `data.strategy`, inventory available/alerts/limits, `prompt_template_used`). Mapping: R1, R4.
- [ ] **AC2**: Trace layout is Phase 1 two-up, Phase 2 two-up, Phase 3 one card — not five serial rows. Mapping: R4.
- [ ] **AC3**: Switching Supervisor/Graph hits `/api/v1/recommend` vs `/api/v1/recommend/graph` and still fills the same five keys. Mapping: R3.
- [ ] **AC4**: Convert on a card calls outcome with query `group` + `success=true` for both experiment ids from `experiments`; skip uses `success=false`; drawer numbers change after refresh. Mapping: R5, R6.
- [ ] **AC5**: Preset chips send the documented `context` keys (not `last_purchase_days`). Mapping: R3.
- [ ] **AC6**: Empty `image_url` / `score===0` are not shown as missing images or fake ranking scores. Mapping: R1.
- [ ] **AC7**: No peer Metrics tab; header shows `/health` model + status. Mapping: R2.
- [ ] **AC8**: `npm run dev` in `frontend/` loads the playground and reaches the API through the Vite proxy. Mapping: R9.

## Out of Scope

- Mall, cart, real product CDN images, login
- SSE / WebSocket / fake token streaming
- Chat thread or multi-turn shopping agent
- Editable LangGraph canvas
- Grafana-style metrics, error log, CTR/GMV (backend empty)
- Treating `groups.weight` as Thompson traffic
- Wiring `scene` as a user-facing control
- Next.js, Redux, Ant Design / MUI
- Backend contract changes

## Constraints

- Desktop-first (~1280px). Stack columns under ~900px; do not block MVP on a mobile design.
- Recommend is a long request: disable double-Run, support AbortController, keep the experiment drawer usable while waiting.
- Fallback `agent_results` entries may lack extras (`success=false`); cards must show error, not crash.

## Key Decisions

| Decision | Choice |
|---|---|
| Shell | A — composer + trace + artifacts |
| Experiments / metrics | Drawer + header pill, not equal tabs |
| Theme | Dark, Chinese copy |
| Stack | React 18 + Vite + Tailwind + Lucide in `frontend/` |
| Streaming | Honest skeleton; no fake stream |
| Conversion | Both `rec_strategy` and `copy_style` when groups are present |
