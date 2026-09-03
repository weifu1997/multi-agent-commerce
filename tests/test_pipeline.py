"""
编排流程结构测试（全部离线，不调用真实 LLM/Redis/MySQL）。

覆盖修复的三个结构问题：
1. 重排只读召回候选集（不再内部二次召回）
2. 库存 Agent 校验与重排同一批候选集，返回数量稳定 == min(num_items, 有货数)
3. A/B 实验组 config 真正驱动 rule_based / llm 分支
"""

from __future__ import annotations

import asyncio

from fastapi.encoders import jsonable_encoder

from agents.inventory_agent import InventoryAgent
from agents.product_rec_agent import MOCK_PRODUCTS, ProductRecAgent
from models.schemas import (
    ExperimentAssignment,
    InventoryResult,
    MarketingCopyResult,
    Product,
    ProductRecResult,
    RecommendationRequest,
    RecommendationResponse,
    UserProfile,
    UserProfileResult,
)
from orchestrator.graph import build_recommendation_graph, graph_state_to_response
from orchestrator.supervisor import SupervisorOrchestrator, select_final_products

from services.ab_test import ABTestEngine


# --------------------------------------------------------------------------- #
# helpers / fakes
# --------------------------------------------------------------------------- #

def _p(product_id: str, category: str = "手机", stock: int = 100) -> Product:
    return Product(
        product_id=product_id,
        name=f"商品{product_id}",
        category=category,
        price=100.0,
        stock=stock,
        tags=[],
    )


class _FakeUserProfileAgent:
    async def run(self, **kwargs):
        return UserProfileResult(
            profile=UserProfile(
                user_id=kwargs.get("user_id", "u1"),
                preferred_categories=["手机"],
            ),
            success=True,
            latency_ms=1.0,
        )


class _FakeRecAgent:
    """记录每次调用参数，行为模仿真实 Agent（候选集 → 截断 num_items）。"""

    def __init__(self):
        self.calls: list[dict] = []

    async def run(self, **kwargs):
        self.calls.append(kwargs)
        candidates = kwargs.get("candidates") or list(MOCK_PRODUCTS)
        num = kwargs.get("num_items", 10)
        return ProductRecResult(success=True, products=candidates[:num], latency_ms=1.0)


class _FakeInventoryAgent:
    def __init__(self, available: set[str] | None = None):
        self.available = available

    async def run(self, products, **kwargs):
        avail = self.available or {p.product_id for p in products if p.stock > 0}
        return InventoryResult(
            success=True, available_products=list(avail), latency_ms=1.0
        )


class _FakeCopyAgent:
    async def run(self, user_profile=None, products=None, style="", **kwargs):
        return MarketingCopyResult(
            success=True,
            copies=[{"product_id": p.product_id, "copy": f"文案-{p.product_id}"} for p in (products or [])],
            latency_ms=1.0,
        )


# --------------------------------------------------------------------------- #
# 1. 库存 Agent：缺货剔除
# --------------------------------------------------------------------------- #

def test_inventory_agent_filters_out_of_stock():
    agent = InventoryAgent()
    in_stock = _p("P1", stock=10)
    out_of_stock = _p("P2", stock=0)
    low_stock = _p("P3", stock=50)

    result = asyncio.run(agent.run(products=[in_stock, out_of_stock, low_stock]))

    assert "P2" not in result.available_products
    assert "P1" in result.available_products
    assert "P3" in result.available_products
    # stock=50 触发 critical 预警（<= SAFETY_STOCK_THRESHOLD=50）
    assert any(a["product_id"] == "P3" for a in result.low_stock_alerts)


# --------------------------------------------------------------------------- #
# 2. select_final_products：缺货剔除 + 有货候选补齐，数量稳定
# --------------------------------------------------------------------------- #

def test_select_final_products_pads_to_requested_count():
    ranked = [_p("OOS", stock=0), _p("A", stock=10)]      # OOS 排第一但应被剔除
    candidates = [_p("OOS", stock=0), _p("A", stock=10), _p("B", stock=5), _p("C", stock=3)]
    available_ids = {"A", "B", "C"}

    final = select_final_products(ranked, available_ids, candidates, num_items=3)

    assert [p.product_id for p in final] == ["A", "B", "C"]  # 剔除 OOS、按序补齐
    assert len(final) == 3


def test_select_final_products_never_exceeds_available():
    candidates = [_p("A", stock=10), _p("B", stock=5)]
    final = select_final_products(candidates, {"A", "B"}, candidates, num_items=5)
    assert len(final) == 2                 # 有货只有 2 个，不能凭空凑到 5


def test_select_final_products_empty_candidates():
    assert select_final_products([], set(), [], 5) == []


# --------------------------------------------------------------------------- #
# 3. ProductRecAgent：给定候选集时绝不二次召回
# --------------------------------------------------------------------------- #

def test_rec_agent_does_not_rerecall_when_candidates_given(monkeypatch):
    async def run():
        agent = ProductRecAgent()
        agent.llm = None  # 确保 rule 分支不碰 LLM

        async def _boom_recall(*args, **kwargs):
            raise AssertionError("不应在已有候选集时再次召回！")

        monkeypatch.setattr(agent, "_recall", _boom_recall)

        profile = UserProfile(user_id="u1", preferred_categories=["手机"])
        result = await agent.run(
            user_profile=profile,
            num_items=1,
            candidates=[_p("手机1", category="手机"), _p("耳机1", category="耳机")],
            strategy="rule_based",
        )
        return result

    result = asyncio.run(run())
    assert [p.product_id for p in result.products] == ["手机1"]  # 偏好类目排第一


def test_rec_agent_rule_rerank_deterministic():
    async def run():
        agent = ProductRecAgent()
        agent.llm = None

        profile = UserProfile(user_id="u1", preferred_categories=["耳机"])
        candidates = [_p("手机1", category="手机"), _p("耳机1", category="耳机"), _p("耳机2", category="耳机")]
        r1 = await agent.run(user_profile=profile, num_items=2, candidates=candidates, strategy="rule_based")
        r2 = await agent.run(user_profile=profile, num_items=2, candidates=candidates, strategy="rule_based")
        return r1, r2

    r1, r2 = asyncio.run(run())
    assert [p.product_id for p in r1.products] == [p.product_id for p in r2.products]
    assert len(r1.products) == 2
    assert r1.products[0].category == "耳机"
    assert r1.data["strategy"] == "rule_based"
    assert r2.data["strategy"] == "rule_based"


def test_rec_agent_llm_without_profile_uses_rule_strategy():
    async def run():
        agent = ProductRecAgent()
        agent.llm = None
        return await agent.run(
            user_profile=None,
            num_items=1,
            candidates=[_p("A")],
            strategy="llm",
        )

    result = asyncio.run(run())
    assert result.data["strategy"] == "rule_based"


def test_rec_agent_llm_branch_sets_llm_strategy(monkeypatch):
    async def run():
        agent = ProductRecAgent()

        async def fake_llm(profile, candidates):
            return list(candidates)

        monkeypatch.setattr(agent, "_rerank_llm", fake_llm)
        profile = UserProfile(user_id="u1", preferred_categories=["手机"])
        return await agent.run(
            user_profile=profile,
            num_items=1,
            candidates=[_p("A")],
            strategy="llm",
        )

    result = asyncio.run(run())
    assert result.data["strategy"] == "llm"


# --------------------------------------------------------------------------- #
# 4. A/B config 真正驱动策略 + 端到端数量稳定（离线，全程 fake agents）
# --------------------------------------------------------------------------- #

def test_supervisor_a_b_drives_strategy_and_count_stable(monkeypatch):
    import orchestrator.supervisor as sup

    monkeypatch.setattr(sup, "UserProfileAgent", _FakeUserProfileAgent)
    fake_rec = _FakeRecAgent()
    monkeypatch.setattr(sup, "ProductRecAgent", lambda: fake_rec)
    # inventory 默认按传入候选集的 stock 计算可用集合（stock=0 的 P016 会被剔除）
    monkeypatch.setattr(sup, "InventoryAgent", _FakeInventoryAgent)
    monkeypatch.setattr(sup, "MarketingCopyAgent", _FakeCopyAgent)

    engine = ABTestEngine()
    orch = SupervisorOrchestrator(ab_engine=engine, thompson_prob=0.0)

    resp = asyncio.run(
        orch.recommend(RecommendationRequest(user_id="user_001", num_items=5, context={}))
    )

    # (a) 重排调用带上了候选集 + 实验组决定的重排策略
    rerank_call = fake_rec.calls[-1]
    assert rerank_call.get("candidates") is not None
    expected_strategy = engine.assign("user_001", "rec_strategy")["config"]["rerank"]
    assert rerank_call["strategy"] == expected_strategy

    # (b) 返回数量与 num_items 一致，且不含缺货商品
    assert len(resp.products) == 5
    rerank_ids = {c.product_id for c in rerank_call["candidates"]}
    assert all(p.product_id in rerank_ids for p in resp.products)
    assert all(p.stock > 0 for p in resp.products)
    # 实验组出现在响应里，且确实来自实验引擎
    assert resp.experiment_group in {"control", "treatment_llm"}
    assert "rec_strategy" in resp.experiments
    assert "copy_style" in resp.experiments
    assert resp.experiments["rec_strategy"].assign == "hash"
    assert resp.experiments["copy_style"].assign == "hash"
    assert resp.experiment_group == resp.experiments["rec_strategy"].group


# --------------------------------------------------------------------------- #
# 5. LangGraph 版本同样接线（能编译出预期节点）
# --------------------------------------------------------------------------- #

def test_graph_compiles_with_expected_nodes():
    graph = build_recommendation_graph()
    names = {name for name in graph.get_graph().nodes}
    assert {"init", "parallel_phase1", "parallel_phase2", "filter", "marketing_copy", "aggregate"} <= names


def test_jsonable_encoder_keeps_agent_result_subclass_fields():
    resp = RecommendationResponse(
        request_id="r1",
        user_id="u1",
        experiment_group="control",
        experiments={
            "rec_strategy": ExperimentAssignment(
                group="control", config={"rerank": "rule_based"}, assign="hash"
            ),
            "copy_style": ExperimentAssignment(
                group="formal", config={"style": "formal"}, assign="hash"
            ),
        },
        agent_results={
            "user_profile": UserProfileResult(
                profile=UserProfile(user_id="u1"), success=True
            ),
            "product_recall": ProductRecResult(
                products=[_p("P1")],
                recall_strategy="collaborative_filter+vector+hot",
            ),
            "product_rec": ProductRecResult(
                products=[_p("P1")],
                data={"strategy": "rule_based"},
            ),
            "inventory": InventoryResult(
                available_products=["P1"],
                low_stock_alerts=[{"product_id": "P3", "level": "critical"}],
                purchase_limits={"P1": 2},
            ),
            "marketing_copy": MarketingCopyResult(
                copies=[{"product_id": "P1", "copy": "x"}],
                prompt_template_used="tpl",
            ),
        },
    )
    encoded = jsonable_encoder(resp)
    ar = encoded["agent_results"]
    assert ar["user_profile"]["profile"]["user_id"] == "u1"
    assert ar["product_recall"]["products"][0]["product_id"] == "P1"
    assert ar["product_rec"]["products"][0]["product_id"] == "P1"
    assert ar["inventory"]["available_products"] == ["P1"]
    assert ar["inventory"]["low_stock_alerts"][0]["product_id"] == "P3"
    assert ar["inventory"]["purchase_limits"] == {"P1": 2}
    assert ar["marketing_copy"]["prompt_template_used"] == "tpl"


def test_graph_state_to_response_emits_product_rec_key():
    resp = graph_state_to_response(
        {
            "request_id": "r1",
            "user_id": "u1",
            "final_products": [_p("P1")],
            "marketing_copies": [{"product_id": "P1", "copy": "x"}],
            "experiment_group": "control",
            "experiments": {
                "rec_strategy": {
                    "group": "control",
                    "config": {"rerank": "rule_based"},
                    "assign": "hash",
                },
                "copy_style": {
                    "group": "formal",
                    "config": {"style": "formal"},
                    "assign": "hash",
                },
            },
            "agent_results": {
                "user_profile": UserProfileResult(profile=UserProfile(user_id="u1")),
                "product_recall": ProductRecResult(products=[_p("P1")]),
                "product_rec": ProductRecResult(products=[_p("P1")]),
                "inventory": InventoryResult(available_products=["P1"]),
                "marketing_copy": MarketingCopyResult(
                    copies=[{"product_id": "P1", "copy": "x"}]
                ),
            },
            "total_latency_ms": 1.0,
        }
    )
    assert "product_rec" in resp.agent_results
    assert "rerank" not in resp.agent_results
    assert resp.experiment_group == resp.experiments["rec_strategy"].group
    assert resp.timestamp is not None


def test_graph_factory_uses_shared_engine_and_writes_product_rec(monkeypatch):
    import orchestrator.graph as g

    engine = ABTestEngine()
    seen: list[object] = []
    original = engine.assign_pipeline

    def spy(user_id, thompson_prob=0.1):
        seen.append(engine)
        return original(user_id, thompson_prob)

    monkeypatch.setattr(engine, "assign_pipeline", spy)
    monkeypatch.setattr(g, "user_profile_agent", _FakeUserProfileAgent())
    monkeypatch.setattr(g, "product_rec_agent", _FakeRecAgent())
    monkeypatch.setattr(g, "inventory_agent", _FakeInventoryAgent())
    monkeypatch.setattr(g, "marketing_copy_agent", _FakeCopyAgent())

    compiled = build_recommendation_graph(ab_engine=engine, thompson_prob=0.0)
    result = asyncio.run(
        compiled.ainvoke(
            {
                "user_id": "user_001",
                "scene": "homepage",
                "num_items": 3,
                "context": {},
            }
        )
    )
    assert seen and seen[0] is engine
    resp = graph_state_to_response(result)
    assert set(resp.agent_results) >= {
        "user_profile",
        "product_recall",
        "product_rec",
        "inventory",
        "marketing_copy",
    }
    assert "rerank" not in resp.agent_results
    assert resp.experiments["rec_strategy"].assign == "hash"
    assert resp.experiments["copy_style"].assign == "hash"
    assert resp.experiment_group == resp.experiments["rec_strategy"].group
