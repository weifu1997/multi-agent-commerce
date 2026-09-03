# Implement: P0/P1 recommendation API contract

## Ordered checklist

1. **Schema** (`models/schemas.py`)
   - Add `ExperimentAssignment`.
   - `agent_results: dict[str, SerializeAsAny[AgentResult]]`.
   - Add `experiments: dict[str, ExperimentAssignment]`.
2. **AB helper** (`services/ab_test.py`)
   - Add `assign_pipeline(user_id, thompson_prob=0.1) -> dict[str, dict]`.
   - Keep `record_outcome` silent internally; HTTP layer maps miss → 404 (or add `bool` return if that is cleaner — prefer HTTP check against `experiments` / group names so engine stays side-effect free).
3. **Product rec** (`agents/product_rec_agent.py`)
   - Set `data["strategy"]` to `"llm"` or `"rule_based"` from the `use_llm` branch actually taken.
4. **Supervisor** (`orchestrator/supervisor.py`)
   - Replace inline rec/copy assign with `assign_pipeline`.
   - Fill `experiments` and keep `experiment_group`.
5. **Graph** (`orchestrator/graph.py`)
   - `build_recommendation_graph(ab_engine=None, thompson_prob=0.1)` closes over engine; remove module-level `ABTestEngine()`.
   - `init_node` uses `assign_pipeline`; store `experiments` on state.
   - Write rerank trace as `agent_results["product_rec"]` (not `rerank`).
   - Add `graph_state_to_response(state) -> RecommendationResponse` (timestamp at map time).
6. **HTTP** (`main.py`)
   - Lifespan: `build_recommendation_graph(ab_engine=ab_engine)`.
   - Graph route: `response_model=RecommendationResponse`; 503 if `rec_graph` is None.
   - Outcome: 404 if experiment or group missing.
7. **Tests** (`tests/test_pipeline.py`, `tests/test_ab_test.py`)
   - Serialization: subclass fields survive `jsonable_encoder`.
   - Supervisor fake-agent: `experiments` + `experiment_group` consistency.
   - `data.strategy` on rule path (existing rule-rerank test).
   - Graph compile still has the same node names; mapper emits `product_rec` key.
   - Shared engine: Graph factory receives the same instance.
   - Outcome 404 via FastAPI `TestClient` (or `HTTPException` unit if lifespan is heavy — prefer TestClient).
8. **Docs** (`README.md` API example)
   - Show `experiments` and one rich `agent_results` entry.

## Validation

```bash
.venv/bin/python -m pytest tests/test_pipeline.py tests/test_ab_test.py -q
```

Plus a one-off encoder assertion in tests (AC1). No live LLM.

## Risky files / rollback

| File | Risk |
|---|---|
| `models/schemas.py` | Serialization regression if `SerializeAsAny` omitted |
| `orchestrator/graph.py` | Factory refactor; tests that import module-level `ab_engine` (grep first) |
| `main.py` | Lifespan graph wiring; outcome status code |

Rollback: `git checkout --` those files. No DB/migration.

Grep before edit: `ab_engine = ABTestEngine`, `agent_results["rerank"]`, `experiment_group`, `recommend/graph`.

## Follow-up before `task.py start`

- [x] PRD/design/implement written
- [ ] User approved this planning summary
- [ ] jsonl manifests have real spec entries (not only `_example`)
- [ ] Do not start until that approval

## Out of this checklist

Metrics Graph collection, frontend, Thompson probability, `copy_style` Thompson, Feature Store on Graph.
