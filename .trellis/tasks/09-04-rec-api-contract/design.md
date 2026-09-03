# Design: P0/P1 recommendation API contract

## Boundaries

```
HTTP (main.py)
  ├─ SupervisorOrchestrator.recommend → RecommendationResponse
  └─ rec_graph.ainvoke → map PipelineState → RecommendationResponse
           │
           ▼
    shared ABTestEngine (created in main.py lifespan/module)
```

Do not add a new service layer. Contract lives in `models/schemas.py`. Assignment policy lives on `ABTestEngine` so Supervisor and Graph cannot drift.

## Data flow

1. Request `{user_id, scene, num_items, context}` unchanged.
2. Orchestrator calls `ab_engine.assign_pipeline(user_id, thompson_prob)`:
   - `rec_strategy`: `assign_thompson` if `random() < thompson_prob` else `assign`; `assign` field `thompson`|`hash`
   - `copy_style`: always `assign`; `assign` field `hash`
3. Agents run as today. Product rec writes `data.strategy` to the branch actually taken.
4. Response built as `RecommendationResponse` with full subclass traces in `agent_results`.
5. FastAPI serializes via `response_model=RecommendationResponse` using `SerializeAsAny`.

## Contracts

### `ExperimentAssignment`

```python
class ExperimentAssignment(BaseModel):
    group: str
    config: dict[str, Any] = Field(default_factory=dict)
    assign: Literal["hash", "thompson"] = "hash"
```

### `RecommendationResponse` changes

```python
from pydantic import SerializeAsAny

experiment_group: str = "control"  # unchanged, == experiments["rec_strategy"].group
experiments: dict[str, ExperimentAssignment] = Field(default_factory=dict)
agent_results: dict[str, SerializeAsAny[AgentResult]] = Field(default_factory=dict)
```

Per-key shapes (unchanged models, now visible on the wire):

| key | runtime type | extra fields |
|---|---|---|
| `user_profile` | `UserProfileResult` | `profile` |
| `product_recall` | `ProductRecResult` | `products`, `recall_strategy` |
| `product_rec` | `ProductRecResult` | `products`, `recall_strategy`, `data.strategy` |
| `inventory` | `InventoryResult` | `available_products`, `low_stock_alerts`, `purchase_limits` |
| `marketing_copy` | `MarketingCopyResult` | `copies`, `prompt_template_used` |

Fallback remains `AgentResult` (`success=false`, `error` set). Extra keys absent; dashboard must tolerate that.

### Graph HTTP

`recommend_via_graph` uses `response_model=RecommendationResponse`.

Mapper (keep next to graph or in `main.py`):

- `products` ← `final_products`
- `agent_results` ← state traces; rename `rerank` → `product_rec` at write time inside `rerank_node` so state and HTTP share keys
- `experiments` / `experiment_group` ← `assign_pipeline` in `init_node`
- `timestamp` ← `datetime.now()` at map time if not stored in state
- missing graph → `HTTPException(503)`

`build_recommendation_graph(ab_engine: ABTestEngine | None = None, thompson_prob: float = 0.1)` closes over the engine. Module-level `ABTestEngine()` goes away.

`main.py` lifespan: `rec_graph = build_recommendation_graph(ab_engine=ab_engine)`.

### Outcome

```python
if experiment_id not in ab_engine.experiments:
    raise HTTPException(404, detail="experiment not found")
names = {g.name for g in ab_engine.experiments[experiment_id].groups}
if group not in names:
    raise HTTPException(404, detail="group not found")
ab_engine.record_outcome(...)
```

Keep query params. FastAPI 404 body is standard `{"detail": ...}`.

### Rerank strategy field

In `ProductRecAgent._execute`, after `use_llm` is resolved:

```python
data={"candidate_count": ..., "reranked": ..., "strategy": "llm" if use_llm else "rule_based"}
```

Do not put the A/B *intent* here; put the branch that ran.

## Compatibility

- Additive fields only (`experiments`, `data.strategy`, previously stripped subclass keys).
- `experiment_group` retained.
- Graph JSON grows to the Supervisor schema; old thin keys remain.
- Outcome success path unchanged; invalid ids change 200 → 404.

## Trade-offs

| Option | Why chosen / rejected |
|---|---|
| `SerializeAsAny[AgentResult]` | One-line fix; fallback stays generic `AgentResult`. OpenAPI still documents the base model; lock extras with tests + README. |
| Discriminated union on `agent_name` | Fails for fallback (`agent_name=user_profile` but type `AgentResult`) unless every `_fallback` returns a subclass. Too much behavior change. |
| `dict[str, Any]` | Drops OpenAPI `AgentResult` entirely. |
| Graph stays 100% hash | Dashboard conversion would not affect Graph path; rejected so both orchestrators share policy. |
| Drop `experiment_group` | Breaks README/curl samples. Keep. |

## Rollback

Revert the schema/orchestrator/main commits. No persistence; in-memory AB state is process-local. Clients that already parsed extra fields would need to ignore them after rollback — none exist yet.

## Risks

- `SerializeAsAny` + FastAPI version: pin behavior with a serialization unit test that fails on regression to base-only dump.
- Shallow-copy LangGraph phase nodes share `agent_results` dict today; renaming `rerank` → `product_rec` must not leave both keys.
- `jsonable_encoder` on `set` (`available_ids` in graph state) must not leak into the HTTP mapper; only dump Pydantic agent results and product lists.
