# Design: Agent playground frontend

## Shell

Desktop (~1280+):

```
┌ header: 产品名 | Supervisor/Graph 已在 composer | health pill | 实验 ─┐
├ composer: 预设 chips | num_items | Run / 取消                         ┤
├─────────────────────────────┬────────────────────────────────────────┤
│ TRACE (hero)                │ ARTIFACTS                              │
│ Phase1: Profile │ Recall    │ 商品卡 + 文案 + 转化/跳过                │
│ Phase2: Rerank  │ Inventory │                                        │
│ Phase3: Copy                │                                        │
│ 每步 latency；总耗时        │ 可折叠 JSON                            │
└─────────────────────────────┴────────────────────────────────────────┘
实验 = 右侧抽屉，不占主栏
```

<900px: composer → trace → artifacts stacked.

Visual: `zinc-950` background, one accent (cyan or violet), step cards like tool-call blocks (status pip, agent name, latency, body). Lucide icons. No ecommerce chrome (no cart, no nav mall).

## Data flow

```
Composer state → POST /api/v1/recommend[|/graph]
                 → RecommendationResponse
                 → TraceView (agent_results)
                 → ArtifactList (products + marketing_copies + inventory.purchase_limits)
Convert → POST /api/v1/experiments/{id}/outcome?group=&success=
       → GET /api/v1/experiments → drawer
Mount: GET /health (pill). Drawer open: GET /experiments.
```

No global store. React state in `App` (or a thin `useRun` hook): `request`, `response`, `loading`, `error`, `experiments`, `health`.

## HTTP client

`frontend/src/api.ts` — `fetch` only.

| Call | Path |
|---|---|
| recommend | `POST /api/v1/recommend` |
| recommendGraph | `POST /api/v1/recommend/graph` |
| experiments | `GET /api/v1/experiments` |
| outcome | `POST /api/v1/experiments/${id}/outcome?group=${group}&success=${bool}` |
| health | `GET /health` |

Vite:

```ts
server: { proxy: { "/api": "http://localhost:8000", "/health": "http://localhost:8000" } }
```

Types in `frontend/src/types.ts` mirror the Python models (optional extras on `AgentResult`).

## Trace mapping

| Card | Source | Body |
|---|---|---|
| 画像 | `agent_results.user_profile` | `profile.segments`, `rfm_score`, `preferred_categories`, `price_range` |
| 召回 | `product_recall` | `products[].product_id/name`, `data.candidate_count` |
| 重排 | `product_rec` | `data.strategy` (actual branch), ranked ids |
| 库存 | `inventory` | `available_products` vs recall ids → OOS; `low_stock_alerts`; `purchase_limits` |
| 文案 | `marketing_copy` | `prompt_template_used` + `experiments.copy_style.group` |

Phase duration: `max(latency_ms)` of the two parallel cards. Do not sum five serial bars.

If `success===false` or extras missing: show `error` / “无明细”.

## Presets

Hard-code in `frontend/src/presets.ts`. `user_id` is the A/B hash key.

| Chip | user_id | context (only keys the profile agent reads) |
|---|---|---|
| 新用户 | `user_new` | `purchase_count_30d: 0`, empty purchases, low AOV, few views |
| 高客单 VIP | `user_vip` | high AOV, recent purchases, 旗舰/手机 views |
| 价格敏感 | `user_price` | low AOV, 配件/性价比 views |
| 流失风险 | `user_churn` | `purchase_count_30d: 0`, `view_count_7d` very low |

`num_items` default **5** (recall covers P016; `N>=3` required).

Do not expose `scene`.

## Artifacts / outcome

Join `products` with `marketing_copies` by `product_id`. Limit badge from `inventory.purchase_limits[id]`.

Convert: `success=true` for `rec_strategy` and `copy_style` using `response.experiments[id].group`. Skip: `success=false` both. Then `GET /experiments`.

Do not display `score` (always 0). Category icon instead of `image_url`.

## Experiments drawer

For each of `rec_strategy`, `copy_style`: group name, `config`, `successes`, `failures`, posterior `α/(α+β)`, caption “哈希权重 50/50（静态）”. Highlight groups from the last run.

Optional tiny “模拟转化” in the drawer hitting the same outcome API — not a second source of truth.

## Directory

```
frontend/
  package.json
  vite.config.ts
  tailwind.config.js
  index.html
  src/main.tsx
  src/App.tsx
  src/index.css
  src/api.ts
  src/types.ts
  src/presets.ts
  src/trace.ts          # phase grouping + OOS diff
  src/components/Header.tsx
  src/components/Composer.tsx
  src/components/TraceView.tsx
  src/components/StepCard.tsx
  src/components/ArtifactList.tsx
  src/components/ExperimentDrawer.tsx
  src/components/JsonPanel.tsx
```

## Compatibility / rollback

Frontend-only. Delete `frontend/` to roll back. Do not change Python.

## Trade-offs

| Choice | Why |
|---|---|
| No Recharts in MVP | Trace timings as text/bar on the step card; avoid a chart dep |
| No React Query | One-shot POST + occasional GET |
| Skeleton not fake stream | Backend has no SSE; fake stream would lie in an interview |
| Both experiment outcomes | Response now has both groups; reporting one would strand `copy_style` |

## Risks

- LLM latency: Run must be cancellable; show elapsed time.
- Feature store on: presets’ `context` is ignored — caption “无 Redis 时预设才进画像”.
- Graph 503: composer error banner, not a blank page.
