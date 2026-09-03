# Recommendation HTTP Contract

> Cross-layer contract for Supervisor and LangGraph recommend APIs.
> Frontend and tests must consume this JSON, not in-memory Pydantic subclasses.

---

## Scenario: Agent traces and A/B assignment on the wire

### 1. Scope / Trigger

`RecommendationResponse.agent_results` is typed as `AgentResult`. FastAPI/`jsonable_encoder` dump the **declared** type, so subclass fields (`profile`, recall `products`, inventory alerts, `prompt_template_used`) vanish unless serialization is `SerializeAsAny`.

Supervisor and Graph must share one `ABTestEngine` and the same response shape.

### 2. Signatures

```
POST /api/v1/recommend          → RecommendationResponse
POST /api/v1/recommend/graph    → RecommendationResponse
GET  /api/v1/experiments
POST /api/v1/experiments/{experiment_id}/outcome?group=<name>&success=<bool>
GET  /api/v1/metrics
GET  /health
```

`build_recommendation_graph(ab_engine: ABTestEngine | None = None, thompson_prob: float = 0.1)`

`ABTestEngine.assign_pipeline(user_id: str, thompson_prob: float = 0.1) -> dict`

### 3. Contracts

**Request** (`RecommendationRequest`): `user_id` required; `scene` default `homepage` (logged only); `num_items` default 10; `context` free dict.

**Response** (`RecommendationResponse`):

| Field | Notes |
|---|---|
| `experiment_group` | Same as `experiments.rec_strategy.group` (kept for compatibility) |
| `experiments` | `rec_strategy` and `copy_style`; each `{group, config, assign}` where `assign` is `hash` \| `thompson` |
| `agent_results` | `dict[str, SerializeAsAny[AgentResult]]` |

`agent_results` keys (both orchestrators): `user_profile`, `product_recall`, `product_rec`, `inventory`, `marketing_copy`. Never `rerank`.

Per-key extras that **must** appear in HTTP JSON on success:

- `user_profile.profile`
- `product_recall.products`, `recall_strategy`
- `product_rec.products`, `data.strategy` = `rule_based` \| `llm` (branch that **ran**, not A/B intent)
- `inventory.available_products`, `low_stock_alerts`, `purchase_limits`
- `marketing_copy.copies`, `prompt_template_used`

Fallback traces may be bare `AgentResult` (`success=false`, `error` set).

Assignment policy: `rec_strategy` hash with 10% Thompson; `copy_style` hash-only. `groups.weight` is static 50/50.

### 4. Validation & Error Matrix

| Condition | HTTP |
|---|---|
| Graph not initialized | 503 `{"detail": "Graph not initialized"}` |
| Outcome unknown `experiment_id` | 404 `{"detail": "experiment not found"}` |
| Outcome unknown `group` | 404 `{"detail": "group not found"}` |
| Outcome valid pair | 200 `{"status": "recorded"}` |

Do not return HTTP 200 with `{"error": "..."}` for those cases.

### 5. Good / Base / Bad Cases

- **Good**: Supervisor and Graph JSON both include `profile` and `experiments.copy_style`.
- **Base**: `thompson_prob=0` → `assign` is `hash`; `experiment_group == experiments.rec_strategy.group`.
- **Bad**: `agent_results: dict[str, AgentResult]` without `SerializeAsAny` — extras stripped. Graph module-level `ABTestEngine()` — outcomes on `/experiments` do not affect Graph.

### 6. Tests Required

- `jsonable_encoder(RecommendationResponse)` keeps subclass extras (`tests/test_pipeline.py`).
- `data.strategy` is `rule_based` without profile even if `strategy=llm`; `llm` when `_rerank_llm` actually runs.
- Graph factory `ainvoke` uses the injected engine; mapper has `product_rec` not `rerank`.
- TestClient: unknown outcome → 404; valid → Beta increment; graph `None` → 503.
- No live LLM.

### 7. Wrong vs Correct

#### Wrong

```python
agent_results: dict[str, AgentResult]
# Graph: ab_engine = ABTestEngine()  # second instance
return {"products": [...], "experiment_group": "control"}  # thin dict
```

#### Correct

```python
from pydantic import SerializeAsAny
agent_results: dict[str, SerializeAsAny[AgentResult]]
# lifespan: rec_graph = build_recommendation_graph(ab_engine=ab_engine)
# graph route: return graph_state_to_response(result)
```

---

## Frontend Integration Contracts

### 1. Reverse Proxy
Vite development server proxies `/api` and `/health` to `http://localhost:8000`.

### 2. Outcome Reporting for A/B Experiments
When converting or skipping a recommended item, outcomes must be submitted as query parameters for both `rec_strategy` and `copy_style` using the assigned group names in `response.experiments`:
```
POST /api/v1/experiments/{experiment_id}/outcome?group={group}&success={bool}
```

### 3. Trace Parallel Timing Display
Phase durations for parallel executions (`user_profile` ∥ `product_recall`, `product_rec` ∥ `inventory`) must be computed as `max(member_latencies)`, not the arithmetic sum.

