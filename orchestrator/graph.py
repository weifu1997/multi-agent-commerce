"""
LangGraph state graph for the multi-agent recommendation pipeline.

Visualises the DAG of agent execution:

  [start] -> fan_out -> {user_profile, product_recall}  (parallel)
          -> merge_phase1 -> {rerank, inventory}         (parallel)
          -> merge_phase2 -> marketing_copy
          -> aggregate -> [end]
"""

from __future__ import annotations

import asyncio
import time
import uuid
from datetime import datetime
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from agents import (
    InventoryAgent,
    MarketingCopyAgent,
    ProductRecAgent,
    UserProfileAgent,
)
from models.schemas import Product, RecommendationResponse, UserProfile
from services.ab_test import ABTestEngine

from .supervisor import select_final_products


class PipelineState(TypedDict, total=False):
    request_id: str
    user_id: str
    scene: str
    num_items: int
    context: dict[str, Any]
    experiment_group: str
    experiments: dict[str, Any]
    rerank_strategy: str  # rule_based / llm，来自 A/B 实验组 config
    copy_style: str       # formal / casual，来自 copy_style 实验组 config

    user_profile: UserProfile | None
    raw_products: list[Product]
    ranked_products: list[Product]
    available_ids: set[str]
    final_products: list[Product]
    marketing_copies: list[dict[str, str]]

    agent_results: dict[str, Any]
    total_latency_ms: float
    _start_time: float


user_profile_agent = UserProfileAgent()
product_rec_agent = ProductRecAgent()
marketing_copy_agent = MarketingCopyAgent()
inventory_agent = InventoryAgent()


def _make_init_node(engine: ABTestEngine, thompson_prob: float):
    async def init_node(state: PipelineState) -> PipelineState:
        state["request_id"] = str(uuid.uuid4())
        state["_start_time"] = time.perf_counter()
        state["agent_results"] = {}
        assignments = engine.assign_pipeline(state["user_id"], thompson_prob)
        rec = assignments["rec_strategy"]
        copy = assignments["copy_style"]
        state["experiments"] = assignments
        state["experiment_group"] = rec.get("group", "control")
        state["rerank_strategy"] = (rec.get("config") or {}).get("rerank", "llm")
        state["copy_style"] = (copy.get("config") or {}).get("style", "")
        return state

    return init_node


async def user_profile_node(state: PipelineState) -> PipelineState:
    result = await user_profile_agent.run(
        user_id=state["user_id"],
        context=state.get("context", {}),
    )
    state["user_profile"] = getattr(result, "profile", None)
    state["agent_results"]["user_profile"] = result
    return state


async def product_recall_node(state: PipelineState) -> PipelineState:
    result = await product_rec_agent.run(
        user_profile=None,
        num_items=state.get("num_items", 10) * 2,
    )
    state["raw_products"] = getattr(result, "products", [])
    state["agent_results"]["product_recall"] = result
    return state


async def parallel_phase1(state: PipelineState) -> PipelineState:
    """Run user_profile and product_recall in parallel."""
    profile_state, recall_state = await asyncio.gather(
        user_profile_node(dict(state)),
        product_recall_node(dict(state)),
    )
    state.update(profile_state)
    state.update(recall_state)
    return state


async def rerank_node(state: PipelineState) -> PipelineState:
    # 重排只读候选集（raw_products），不再内部二次召回
    result = await product_rec_agent.run(
        user_profile=state.get("user_profile"),
        num_items=state.get("num_items", 10),
        candidates=state.get("raw_products", []),
        strategy=state.get("rerank_strategy", "auto"),
    )
    state["ranked_products"] = getattr(result, "products", state.get("raw_products", []))
    state["agent_results"]["product_rec"] = result
    return state


async def inventory_node(state: PipelineState) -> PipelineState:
    result = await inventory_agent.run(
        products=state.get("raw_products", []),
    )
    state["available_ids"] = set(getattr(result, "available_products", []))
    state["agent_results"]["inventory"] = result
    return state


async def parallel_phase2(state: PipelineState) -> PipelineState:
    """Run rerank and inventory in parallel."""
    rerank_state, inv_state = await asyncio.gather(
        rerank_node(dict(state)),
        inventory_node(dict(state)),
    )
    state.update(rerank_state)
    state.update(inv_state)
    return state


async def filter_node(state: PipelineState) -> PipelineState:
    ranked = state.get("ranked_products", [])
    avail = state.get("available_ids", set())
    num = state.get("num_items", 10)
    final = select_final_products(ranked, avail, state.get("raw_products", []), num)
    if not final:
        final = ranked[:num]
    state["final_products"] = final
    return state


async def marketing_copy_node(state: PipelineState) -> PipelineState:
    result = await marketing_copy_agent.run(
        user_profile=state.get("user_profile"),
        products=state.get("final_products", []),
        style=state.get("copy_style", ""),
    )
    state["marketing_copies"] = getattr(result, "copies", [])
    state["agent_results"]["marketing_copy"] = result
    return state


async def aggregate_node(state: PipelineState) -> PipelineState:
    state["total_latency_ms"] = (time.perf_counter() - state.get("_start_time", 0)) * 1000
    return state


def graph_state_to_response(state: PipelineState) -> RecommendationResponse:
    """Map graph state onto the Supervisor RecommendationResponse contract."""
    experiments = state.get("experiments") or {}
    rec = experiments.get("rec_strategy") or {}
    if hasattr(rec, "group"):
        rec_group = rec.group
    else:
        rec_group = rec.get("group") or state.get("experiment_group", "control")
    return RecommendationResponse(
        request_id=state.get("request_id") or "",
        user_id=state.get("user_id") or "",
        products=list(state.get("final_products") or []),
        marketing_copies=list(state.get("marketing_copies") or []),
        experiment_group=rec_group,
        experiments=experiments,
        agent_results=dict(state.get("agent_results") or {}),
        total_latency_ms=float(state.get("total_latency_ms") or 0.0),
        timestamp=datetime.now(),
    )


def build_recommendation_graph(
    ab_engine: ABTestEngine | None = None,
    thompson_prob: float = 0.1,
):
    """Build and compile the LangGraph state graph."""
    engine = ab_engine or ABTestEngine()
    graph = StateGraph(PipelineState)

    graph.add_node("init", _make_init_node(engine, thompson_prob))
    graph.add_node("parallel_phase1", parallel_phase1)
    graph.add_node("parallel_phase2", parallel_phase2)
    graph.add_node("filter", filter_node)
    graph.add_node("marketing_copy", marketing_copy_node)
    graph.add_node("aggregate", aggregate_node)

    graph.set_entry_point("init")
    graph.add_edge("init", "parallel_phase1")
    graph.add_edge("parallel_phase1", "parallel_phase2")
    graph.add_edge("parallel_phase2", "filter")
    graph.add_edge("filter", "marketing_copy")
    graph.add_edge("marketing_copy", "aggregate")
    graph.add_edge("aggregate", END)

    return graph.compile()
