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
import random
import time
import uuid
from typing import Any

import structlog

from agents import (
    InventoryAgent,
    MarketingCopyAgent,
    ProductRecAgent,
    UserProfileAgent,
)
from models.schemas import (
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
        experiment = self._assign_rec_experiment(request.user_id)
        rerank_strategy = (experiment.get("config") or {}).get("rerank", "llm")

        # copy_style 实验组决定文案风格变体（formal / casual / 空=按分群默认）
        copy_exp = self.ab_engine.assign(request.user_id, "copy_style")
        copy_style = (copy_exp.get("config") or {}).get("style", "")

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
            experiment_group=experiment.get("group", "control"),
            agent_results={
                "user_profile": profile_result,
                "product_recall": rec_result,
                "product_rec": rerank_result,
                "marketing_copy": copy_result,
                "inventory": inventory_result,
            },
            total_latency_ms=total_latency,
        )

    def _assign_rec_experiment(self, user_id: str) -> dict[str, Any]:
        """稳定哈希分桶为主，小概率走 Thompson Sampling 动态分配流量。"""
        if random.random() < self.thompson_prob:
            return self.ab_engine.assign_thompson(user_id, "rec_strategy")
        return self.ab_engine.assign(user_id, "rec_strategy")
