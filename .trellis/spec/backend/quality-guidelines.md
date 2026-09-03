# Quality Guidelines

> Conventions for recommend-pipeline changes.

---

## Forbidden Patterns

- Typing `agent_results` as `dict[str, AgentResult]` without `SerializeAsAny` — FastAPI strips subclass fields.
- A second `ABTestEngine()` inside `orchestrator/graph.py`. Inject the instance from `main.py`.
- Graph `agent_results` key `rerank`. Use `product_rec` like Supervisor.
- Live LLM in unit tests. Fake agents or mock `_rerank_llm`.
- Asserting A/B “intent” as `data.strategy`. Strategy is the branch that **ran** (`llm` only if `use_llm` is true).

---

## Required Patterns

- Shared assignment: `ABTestEngine.assign_pipeline` (Supervisor + Graph).
- Keep `experiment_group` equal to `experiments["rec_strategy"].group`.
- Lock HTTP extras with `jsonable_encoder` tests, not only in-memory attribute access.

Details: [recommendation-http-contract.md](./recommendation-http-contract.md).

---

## Testing Requirements

- Offline: `tests/test_pipeline.py`, `tests/test_ab_test.py` (no API key).
- New response fields need an encoder or TestClient assertion.
- Outcome and uninitialized-graph status codes: TestClient against `main.app`.

```bash
.venv/bin/python -m pytest tests/test_pipeline.py tests/test_ab_test.py -q
```

---

## Code Review Checklist

- [ ] Subclass fields survive `jsonable_encoder` / `response_model`
- [ ] Graph and Supervisor share `ab_engine` and `agent_results` keys
- [ ] Unknown experiment/group → 404, not recorded
- [ ] No live LLM in the new test
