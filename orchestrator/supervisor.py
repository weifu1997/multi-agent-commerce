"""
Supervisor编排器 — 并行分发 + 聚合模式

                    ┌──────────────┐
                    │  Supervisor   │
                    └──────┬───────┘
           ┌───────┬───────┼───────┬────────┐
           ▼       ▼       ▼       ▼        │
      UserProfile  ProdRec  MktCopy  Inventory │
           │       │       │       │        │
           └───────┴───────┴───────┘        │
                    │                        │
                    ▼                        │
               Aggregator ◄─────────────────┘
                    │
                    ▼
              A/B Test Engine
"""

from __future__ import annotations

import asyncio
import time
import uuid

import structlog

from agents import (
    InventoryAgent,
    MarketingCopyAgent,
    ProductRecAgent,
    UserProfileAgent,
)
from models.schemas import (
    ExperimentAssignment,
    Product,
    RecommendationRequest,
    RecommendationResponse,
    UserProfile,
)
from services.ab_test import ABTestEngine

logger = structlog.get_logger()


def select_final_products(
    ranked: list[Product],
    available_ids: set[str],
    candidates: list[Product],
    num_items: int,
) -> list[Product]:
    """库存过滤 + 补齐：在「有货候选集」内保序选出 num_items 个商品。

    ranked 必须来自 candidates 的重排结果；这里只用 available_ids 做剔除，
    不足 num_items 时用有货候选按 candidates 原始顺序补齐，保证返回数量稳定。
    """
    chosen: list[Product] = []
    seen: set[str] = set()

    for p in ranked:
        if p.product_id in available_ids and p.product_id not in seen:
            chosen.append(p)
            seen.add(p.product_id)
        if len(chosen) >= num_items:
            break

    for p in candidates:
        if len(chosen) >= num_items:
            break
        if p.product_id in available_ids and p.product_id not in seen:
            chosen.append(p)
            seen.add(p.product_id)

    return chosen[:num_items]


class SupervisorOrchestrator:
    """Coordinates four agents in parallel-then-aggregate pattern."""

    def __init__(
        self,
        ab_engine: ABTestEngine | None = None,
        thompson_prob: float = 0.1,
    ):
        self.user_profile_agent = UserProfileAgent()
        self.product_rec_agent = ProductRecAgent()
        self.marketing_copy_agent = MarketingCopyAgent()
        self.inventory_agent = InventoryAgent()
        self.ab_engine = ab_engine or ABTestEngine()
        # 10% 请求走 Thompson Sampling 动态分配，其余走稳定哈希分桶
        self.thompson_prob = thompson_prob

    async def recommend(self, request: RecommendationRequest) -> RecommendationResponse:
        request_id = str(uuid.uuid4())
        start = time.perf_counter()

        logger.info(
            "supervisor.start",
            request_id=request_id,
            user_id=request.user_id,
            scene=request.scene,
        )

        # A/B 分流：rec_strategy 实验组决定用 rule_based 还是 llm 重排
        assignments = self.ab_engine.assign_pipeline(request.user_id, self.thompson_prob)
        rec_assignment = assignments["rec_strategy"]
        copy_assignment = assignments["copy_style"]
        rerank_strategy = (rec_assignment.get("config") or {}).get("rerank", "llm")
        copy_style = (copy_assignment.get("config") or {}).get("style", "")

        # Phase 1: parallel — user profile + product recall（产出候选集）
        profile_result, rec_result = await asyncio.gather(
            self.user_profile_agent.run(
                user_id=request.user_id,
                context=request.context,
            ),
            self.product_rec_agent.run(
                user_profile=None,
                num_items=request.num_items * 2,
            ),
        )

        user_profile: UserProfile | None = getattr(profile_result, "profile", None)
        candidates: list[Product] = getattr(rec_result, "products", [])

        # Phase 2: parallel — 在候选集上重排 + 对同一候选集做库存校验
        rerank_task = self.product_rec_agent.run(
            user_profile=user_profile,
            num_items=request.num_items,
            candidates=candidates,      # 重排只读候选集，不再内部二次召回
            strategy=rerank_strategy,   # A/B 组决定 rule_based 还是 llm
        )
        inventory_task = self.inventory_agent.run(products=candidates)

        rerank_result, inventory_result = await asyncio.gather(
            rerank_task, inventory_task
        )

        ranked_products: list[Product] = getattr(rerank_result, "products", candidates)
        available_ids = set(getattr(inventory_result, "available_products", []))
        final_products = select_final_products(
            ranked_products, available_ids, candidates, request.num_items
        )
        if not final_products and ranked_products:
            final_products = ranked_products[: request.num_items]

        # Phase 3: marketing copy generation with final product list
        copy_result = await self.marketing_copy_agent.run(
            user_profile=user_profile,
            products=final_products,
            style=copy_style,
        )
        copies = getattr(copy_result, "copies", [])

        total_latency = (time.perf_counter() - start) * 1000

        logger.info(
            "supervisor.complete",
            request_id=request_id,
            total_latency_ms=round(total_latency, 1),
            product_count=len(final_products),
            copy_count=len(copies),
        )

        return RecommendationResponse(
            request_id=request_id,
            user_id=request.user_id,
            products=final_products,
            marketing_copies=copies,
            experiment_group=rec_assignment.get("group", "control"),
            experiments={
                "rec_strategy": ExperimentAssignment(**rec_assignment),
                "copy_style": ExperimentAssignment(**copy_assignment),
            },
            agent_results={
                "user_profile": profile_result,
                "product_recall": rec_result,
                "product_rec": rerank_result,
                "marketing_copy": copy_result,
                "inventory": inventory_result,
            },
            total_latency_ms=total_latency,
        )
