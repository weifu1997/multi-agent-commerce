# Implement: Agent playground frontend

## Ordered checklist

1. Scaffold `frontend/` with Vite React-TS, Tailwind, Lucide. `vite.config.ts` proxy `/api` and `/health` → `http://localhost:8000`.
2. `src/types.ts` matching `RecommendationResponse` / `AgentResult` extras / `ExperimentAssignment`.
3. `src/api.ts` — recommend, recommendGraph, experiments, outcome (query string), health; pass `AbortSignal` on recommend.
4. `src/presets.ts` — four chips with real context keys and `user_id`s from design.md.
5. `src/trace.ts` — group five keys into phases; OOS = recall ids − `available_products`; phase latency = max of members.
6. `Composer` + `Header` (health pill, open experiments).
7. `TraceView` / `StepCard` — Phase 1/2 two-up, Phase 3 full width; skeleton while `loading`.
8. `ArtifactList` — cards, copy, limit tag, convert/skip.
9. `ExperimentDrawer` — α/β and posterior; highlight last-run groups; refresh after outcome.
10. `JsonPanel` collapsed by default.
11. Dark `index.css` / Tailwind theme; Chinese copy.

Do not edit Python, README beyond a one-line “前端: cd frontend && npm run dev” if needed — prefer leaving README unless the checklist is otherwise done and a single startup line is missing.

## Validation

```bash
cd frontend && npm install && npm run build
```

With API on `:8000`:

```bash
cd frontend && npm run dev
```

Manual (required — this is UI):

1. Preset 新用户, num_items=5, Supervisor Run → five trace cards fill; artifacts render.
2. Convert one card → experiment drawer α/β changes for both experiments.
3. Toggle Graph, same user, Run → same five keys (or 503 banner if graph down).
4. Cancel in-flight Run (abort) → not stuck loading.
5. Desktop 1280 and ~375 width: no overlap of composer/trace.

No live LLM in unit tests. Optional: vitest `trace.ts` OOS/phase-max only. Do not add a browser E2E harness in this task.

## Risky files

| Path | Risk |
|---|---|
| `frontend/vite.config.ts` | Proxy miss → CORS or 404 |
| `src/api.ts` | Outcome must be query params, not JSON body |
| `src/trace.ts` | Serial five-row layout would violate AC2 |

Rollback: remove `frontend/`.

## Follow-up before `task.py start`

- [x] User chose shell A
- [x] PRD / design / implement written
- [ ] jsonl has real spec entries
- [ ] User approved this planning summary

## Out of this checklist

SSE, chat, canvas, metrics tab, backend changes, treating `weight` as live traffic.
