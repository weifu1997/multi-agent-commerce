# Error Handling

> How this API reports failures to HTTP clients.

---

## Overview

Agents degrade in-process via `BaseAgent._fallback` (`success=false`, `error` set, still a 200 recommend body). Route-level failures that mean “cannot perform the operation” use FastAPI `HTTPException`.

---

## API Error Responses

FastAPI default body: `{"detail": "<message>"}`.

| Condition | Status | detail |
|---|---|---|
| LangGraph not compiled / `rec_graph is None` | 503 | `Graph not initialized` |
| `POST /experiments/{id}/outcome` unknown experiment | 404 | `experiment not found` |
| Same route, unknown `group` query | 404 | `group not found` |

Unknown outcome ids must **not** return `{"status": "recorded"}`. `ABTestEngine.record_outcome` still no-ops internally; the HTTP layer checks membership first.

Full recommend/outcome contract: [recommendation-http-contract.md](./recommendation-http-contract.md).

---

## Error Handling Patterns

- Agent timeout/LLM failure: catch in `BaseAgent.run`, return fallback `AgentResult`. Recommend endpoint stays 200 with `agent_results.*.success=false`.
- Missing graph / unknown experiment: `HTTPException` at the route.

---

## Common Mistakes

### Fake 200 error objects

**Symptom**: Client treats the call as success; dashboard never shows failure.

**Cause**: `return {"error": "Graph not initialized"}` with implicit 200.

**Fix**: `raise HTTPException(status_code=503, detail="Graph not initialized")`.
