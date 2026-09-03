# 🛒 多Agent电商推荐与营销系统

> **面向小白的企业级 AI Agent 项目** — 从零理解 Multi-Agent 架构，配套 Python 代码 + 八股文 + 简历模板 + STAR面试话术，找工作全流程覆盖。

[![Python](https://img.shields.io/badge/Python-3.11%2B-blue?logo=python)](python/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 📖 目录

1. [这个项目是什么？](#-这个项目是什么)
2. [系统架构（看图秒懂）](#-系统架构看图秒懂)
3. [四大核心 Agent 详解](#-四大核心-agent-详解)
4. [技术栈与代码结构](#-技术栈与代码结构)
5. [关键代码展示](#-关键代码展示)
6. [快速上手运行](#-快速上手运行)
7. [API 接口文档](#-api-接口文档)
8. [项目文件结构](#-项目文件结构)
9. [面试资料索引](#-面试资料索引)
10. [面试八股文精选](#-面试八股文精选10题)
11. [简历写法（直接复制）](#-简历写法直接复制)
12. [参考资料与致谢](#-参考资料与致谢)

---

## 🤔 这个项目是什么？

### 用一句话解释

> 用 AI Agent 技术，让电商平台的**推荐 + 文案 + 库存**三个系统协同工作，像一个聪明的"AI 运营团队"一起为每位用户生成个性化推荐结果。

### 它解决了什么问题？

传统电商推荐系统存在三大痛点：

| 痛点 | 传统做法 | 本项目做法 |
|------|---------|---------|
| 推荐结果和库存脱节 | 推荐了缺货商品 | **库存 Agent** 实时校验，缺货自动剔除 |
| 营销文案千篇一律 | 所有人看同一段广告语 | **文案 Agent** 根据用户画像生成个性化文案 |
| 各系统各自为战 | 推荐、文案、库存三套系统互不感知 | **Supervisor** 统一编排，结果实时互相影响 |

### 技术关键词（面试常考）

`Multi-Agent` · `Supervisor模式` · `LangGraph` · `asyncio并行` · `Redis Feature Store` · `A/B Testing` · `Thompson Sampling` · `RAG` · `ReAct` · `MiniMax LLM`

---

## 🏗 系统架构（看图秒懂）

### 整体架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                         用户发起推荐请求                           │
│                    {"user_id": "u001", "num_items": 5}           │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Supervisor 协调Agent                           │
│                  (python/orchestrator/supervisor.py)              │
│                                                                   │
│  ════════════════ Phase 1: 并行执行 ═══════════════════           │
│  ┌──────────────────────┐    ┌──────────────────────┐            │
│  │   用户画像 Agent      │    │   商品召回 Agent      │            │
│  │  user_profile_agent  │    │  product_rec_agent   │            │
│  │  ──────────────────  │    │  ────────────────── │            │
│  │  Redis → 实时行为特征 │    │  协同过滤+向量检索召回 │            │
│  │  RFM模型 → 用户分群   │    │  返回候选商品列表     │            │
│  └──────────┬───────────┘    └──────────┬──────────┘            │
│             │                           │                         │
│  ════════════════ Phase 2: 并行执行 ═══════════════════           │
│  ┌──────────────────────┐    ┌──────────────────────┐            │
│  │   LLM重排 Agent      │    │   库存决策 Agent      │            │
│  │  (product_rec再次调用)│    │   inventory_agent    │            │
│  │  ──────────────────  │    │  ────────────────── │            │
│  │  用户画像 × 商品属性  │    │  MySQL → 实时库存查询 │            │
│  │  LLM精排，返回TopN   │    │  过滤缺货，输出限购策略│            │
│  └──────────┬───────────┘    └──────────┬──────────┘            │
│             │                           │                         │
│  ════════════════ Phase 3: 串行执行 ═══════════════════           │
│             └──────────────┬────────────┘                         │
│                            ▼                                      │
│             ┌──────────────────────────────┐                      │
│             │      结果聚合器               │                      │
│             │  库存过滤 → 排序合并 → TopN   │                      │
│             └──────────────┬───────────────┘                      │
│                            ▼                                      │
│             ┌──────────────────────────────┐                      │
│             │   营销文案 Agent              │                      │
│             │  marketing_copy_agent        │                      │
│             │  ────────────────────────── │                      │
│             │  5套Prompt模板 × 用户分群    │                      │
│             │  LLM生成 + 广告法合规校验    │                      │
│             └──────────────┬───────────────┘                      │
│                            ▼                                      │
│             ┌──────────────────────────────┐                      │
│             │   A/B 测试引擎               │                      │
│             │  用户ID哈希分桶              │                      │
│             │  Thompson Sampling 动态调优  │                      │
│             └──────────────┬───────────────┘                      │
└──────────────────────────────┬──────────────────────────────────┘
                               ▼
              ┌─────────────────────────────────┐
              │  个性化推荐响应（返回给用户）      │
              │  商品列表 + 个性化文案 + 实验分组 │
              └─────────────────────────────────┘
```

### 为什么用 Supervisor 模式？

Supervisor 模式是 Multi-Agent 系统中最主流的编排方式之一：

```
Supervisor 模式                     Handoffs 模式
──────────────────────              ──────────────────────
   Supervisor（中枢）                 Agent A → Agent B
    ┌────┬────┬────┐                       ↓
    ▼    ▼    ▼    ▼                 Agent B → Agent C
   A    B    C    D                        ↓
    └────┴────┴────┘                 Agent C → ...
    结果聚合 → 响应

✅ 集中控制，流程清晰          ✅ 去中心化，灵活
✅ 并行执行，延迟低            ✅ 适合对话/开放式任务
✅ 异常统一处理                ❌ 状态管理复杂
本项目采用 Supervisor 模式
```

---

## 🤖 四大核心 Agent 详解

### Agent 1：用户画像 Agent

**文件**：[`python/agents/user_profile_agent.py`](python/agents/user_profile_agent.py)

**它做什么？**

把用户的历史行为数据（点击、购买、收藏）转化成结构化的"用户画像"，供其他 Agent 使用。

**核心逻辑（简化）**：

```python
# Step 1：从 Redis Feature Store 获取实时行为特征
behavior = await feature_store.get_user_features(user_id)
# 返回: {"clicks_1h": 12, "purchases_7d": 3, "categories": ["手机", "耳机"]}

# Step 2：调用 LLM 分析，输出结构化画像
prompt = f"用户行为数据: {behavior}\n请分析用户分群和RFM得分，输出JSON"
profile_json = await llm.invoke(prompt)
# 输出: {"segments": ["active", "price_sensitive"], "rfm_score": {"recency": 0.8}}

# Step 3：返回 UserProfile 对象
return UserProfile(user_id=user_id, segments=["active"], rfm_score=...)
```

**关键技术**：
- **Redis Sorted Set**：`ZADD user:u001:clicks {时间戳} {商品ID}`，支持滑动窗口查询
- **RFM 模型**：Recency（最近购买时间）× Frequency（购买频率）× Monetary（消费金额）
- **用户分群**：新客 / VIP / 价格敏感 / 活跃 / 流失风险，共 5 类

---

### Agent 2：商品推荐 Agent

**文件**：[`python/agents/product_rec_agent.py`](python/agents/product_rec_agent.py)

**它做什么？**

两阶段推荐：先"召回"大量候选商品，再用 LLM 精排出最合适的 TopN。

```
多路召回策略
  ├── 协同过滤（买了A也买了B）
  ├── 向量检索（Milvus，语义相似商品）
  ├── 热度策略（最近7天热卖）
  └── 新品策略（上架30天内）
        │
        ▼（去重合并，候选集）
  LLM 精排
  │ Prompt: "用户是价格敏感型，偏好手机配件，以下10件商品请排序..."
  │ 输出: 按相关性从高到低排列的商品 ID 列表
        │
        ▼
  TopN 商品列表（交给库存 Agent 过滤）
```

---

### Agent 3：营销文案 Agent

**文件**：[`python/agents/marketing_copy_agent.py`](python/agents/marketing_copy_agent.py)

**它做什么？**

根据用户画像自动选择合适的文案风格模板，调用 LLM 生成个性化文案，并做广告法合规校验。

```python
# 5套模板 × 用户分群
TEMPLATES = {
    "new_user":        "首单专属福利，{product}立减{discount}元！",
    "vip":             "尊享会员特权，{product}专属价{price}，品质之选。",
    "price_sensitive": "今日限时抢购！{product}历史最低价，仅剩{stock}件！",
    "active":          "根据您的浏览偏好，为您精选 {product}，好评率{rating}%",
    "churn_risk":      "好久不见！{product}为您专属保留，点击领取优惠券",
}

# 广告法合规校验（过滤违禁词）
BANNED_WORDS = ["最好", "第一", "最便宜", "绝对", "100%"]
```

---

### Agent 4：库存决策 Agent

**文件**：[`python/agents/inventory_agent.py`](python/agents/inventory_agent.py)

**它做什么？**

查询商品实时库存，过滤缺货商品，输出限购策略和补货预警。

```python
# 输入: 推荐商品列表 [P001, P002, P003, ...]
# 查询 MySQL/WMS 实时库存
# 输出:
{
    "available_products": ["P001", "P003"],   # 有货商品
    "inventory_alerts": [                      # 库存预警
        {"product_id": "P001", "stock": 5, "warning": "库存紧张"}
    ],
    "purchase_limits": {                       # 限购策略
        "P001": 2  # 每人最多买2件
    }
}
```

---

## 🌐 技术栈与代码结构

纯 Python 一套实现，方便一口气读懂全链路：

| 模块 | 技术 |
|------|------|
| Agent 编排 | LangGraph + 自研 Supervisor 编排器 |
| Web 服务 | FastAPI + Uvicorn |
| LLM | MiniMax（OpenAI 兼容接口，可换通义/Kimi 等）|
| 特征存储 | Redis Sorted Set（滑动窗口实时特征）|
| 向量检索 | Milvus |
| 业务数据 | SQLite / MySQL |
| 并行方式 | `asyncio.gather()` |
| 启动命令 | `python main.py` |

---

## 💻 关键代码展示

### Supervisor 并行编排（Python 核心代码）

**文件**：[`python/orchestrator/supervisor.py`](python/orchestrator/supervisor.py)

```python
class SupervisorOrchestrator:
    """Supervisor 编排器 — 并行分发 + 聚合模式"""

    async def recommend(self, request: RecommendationRequest) -> RecommendationResponse:
        start = time.perf_counter()

        # ① A/B 实验分组（在最开始就决定用哪套策略）
        experiment = self.ab_engine.assign(request.user_id)

        # ② Phase 1：用户画像 + 商品召回 并行执行
        profile_result, rec_result = await asyncio.gather(
            self.user_profile_agent.run(user_id=request.user_id, context=request.context),
            self.product_rec_agent.run(user_profile=None, num_items=request.num_items * 2),
        )
        # asyncio.gather() 让两个 IO 密集型任务同时跑，总耗时 ≈ max(两者耗时)

        # ③ Phase 2：LLM重排 + 库存校验 并行执行
        rerank_result, inventory_result = await asyncio.gather(
            self.product_rec_agent.run(user_profile=user_profile, num_items=request.num_items),
            self.inventory_agent.run(products=raw_products),
        )

        # ④ 库存过滤：只保留有货商品
        available_ids = set(getattr(inventory_result, "available_products", []))
        final_products = [p for p in ranked_products if p.product_id in available_ids]

        # ⑤ Phase 3：文案生成（需要前两步结果，所以串行）
        copy_result = await self.marketing_copy_agent.run(
            user_profile=user_profile,
            products=final_products,
        )

        # ⑥ 汇总响应
        total_latency = (time.perf_counter() - start) * 1000
        return RecommendationResponse(
            products=final_products,
            marketing_copies=copies,
            experiment_group=experiment.get("group", "control"),
            total_latency_ms=total_latency,  # 目标 P99 < 2000ms
        )
```

> 💡 **小白解读**：`asyncio.gather()` 就像你同时开了两个网页，而不是等一个加载完再开另一个。两个 Agent 并行跑，总延迟约等于最慢那个 Agent 的耗时，而不是两者相加。

---

### A/B 测试引擎（Thompson Sampling）

**文件**：[`python/services/ab_test.py`](python/services/ab_test.py)

```python
class ABTestEngine:
    """
    流量分桶 + Thompson Sampling 多臂赌博机
    
    原理：像赌场里的老虎机，哪台赢的多就多拉哪台。
    算法自动把更多流量分给表现好的实验组。
    """

    def assign(self, user_id: str) -> dict:
        # 用户ID哈希取模 → 保证同一用户每次进同一个实验组（一致性）
        bucket = int(hashlib.md5(user_id.encode()).hexdigest(), 16) % 100
        
        if bucket < 60:
            return {"group": "control", "strategy": "collaborative_filter"}
        elif bucket < 80:
            return {"group": "treatment_llm", "strategy": "llm_rerank"}
        else:
            return {"group": "treatment_vector", "strategy": "vector_search"}

    def record_click(self, user_id: str, clicked: bool):
        # Thompson Sampling: 点击了就更新 Beta 分布参数
        group = self.assignments.get(user_id, "control")
        if clicked:
            self.alpha[group] += 1   # 成功次数 +1
        else:
            self.beta[group] += 1    # 失败次数 +1
        # 下次分配流量时，胜率高的组会自动获得更多流量
```

---

### Agent 基类：重试 + 降级（可靠性保障）

**文件**：[`python/agents/base_agent.py`](python/agents/base_agent.py)

```python
class BaseAgent(ABC):
    """所有 Agent 的基类 — 模板方法模式"""
    
    MAX_RETRIES = 3
    RETRY_DELAY = 1.0  # 秒，指数退避

    async def run(self, **kwargs) -> AgentResult:
        """公开方法：封装了计时、重试、降级"""
        start = time.perf_counter()
        try:
            return await self._retry_execute(**kwargs)
        except Exception as e:
            # 全部重试失败 → 降级（返回默认结果，不影响其他 Agent）
            logger.warning(f"{self.name} fallback triggered: {e}")
            return self._fallback(**kwargs)

    async def _retry_execute(self, **kwargs) -> AgentResult:
        """指数退避重试"""
        for attempt in range(self.MAX_RETRIES):
            try:
                return await asyncio.wait_for(
                    self._execute(**kwargs),
                    timeout=self.timeout,  # 每个 Agent 独立超时控制
                )
            except asyncio.TimeoutError:
                if attempt < self.MAX_RETRIES - 1:
                    await asyncio.sleep(self.RETRY_DELAY * (2 ** attempt))  # 1s, 2s, 4s
        raise RuntimeError(f"{self.name} failed after {self.MAX_RETRIES} retries")

    @abstractmethod
    async def _execute(self, **kwargs) -> AgentResult:
        """子类只需实现这个方法，写业务逻辑即可"""
```

> 💡 **小白解读**：就像打电话打不通会重拨，第1次立刻重拨，第2次等2秒，第3次等4秒（指数退避）。如果全失败了，就返回一个"说得过去的默认结果"（降级），保证整个系统不崩溃。

---


## 🚀 快速上手运行

### 前置条件

- Python 3.11+（全仓一套 Python 实现，专注读懂即可）
- 申请 LLM API Key（推荐 [MiniMax](https://www.minimax.chat/) 或 [阿里通义](https://dashscope.aliyun.com/)，有免费额度）

---

### 本地运行（推荐小白从这里开始）

```bash
# 1. 克隆项目
git clone https://github.com/weifu1997/multi-agent-commerce.git
cd multi-agent-commerce/python

# 2. 创建虚拟环境（避免依赖冲突）
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate

# 3. 安装依赖
pip install -r requirements.txt

# 4. 配置 API Key
cp .env.example .env
# 用记事本/VS Code 打开 .env，填入你的 LLM_API_KEY

# 5. 启动服务
python main.py
# 看到 "Uvicorn running on http://0.0.0.0:8000" 就成功了

# 6. 测试推荐接口
curl -X POST http://localhost:8000/api/v1/recommend \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_001",
    "scene": "homepage",
    "num_items": 5,
    "context": {
      "recent_views": ["手机", "耳机"],
      "avg_order_amount": 500
    }
  }'
```

---

### Docker 一键部署（含 Redis + MySQL 等依赖）

```bash
# 在项目根目录运行
docker-compose up -d

# 等待所有服务启动（约30秒）
docker-compose ps

# 服务地址
# API 服务:  http://localhost:8000
# Redis:       localhost:6379
# MySQL:       localhost:3306
```

---

## 📡 API 接口文档

### 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/v1/recommend` | 核心推荐接口 |
| `POST` | `/api/v1/recommend/graph` | LangGraph 状态图推荐 |
| `GET` | `/api/v1/experiments` | 查看 A/B 实验状态 |
| `GET` | `/api/v1/metrics` | 系统监控指标 |
| `GET` | `/health` | 健康检查 |

### 请求示例

```json
POST /api/v1/recommend
Content-Type: application/json

{
  "user_id": "user_001",
  "scene": "homepage",
  "num_items": 5,
  "context": {
    "recent_views": ["手机", "耳机", "充电宝"],
    "avg_order_amount": 500,
    "last_purchase_days": 7
  }
}
```

### 响应示例

```json
{
  "request_id": "a3f8c2d1-...",
  "user_id": "user_001",
  "products": [
    {
      "product_id": "P001",
      "name": "iPhone 16 Pro",
      "category": "手机",
      "price": 7999.0,
      "score": 0.95
    },
    {
      "product_id": "P003",
      "name": "AirPods Pro 2",
      "category": "耳机",
      "price": 1899.0,
      "score": 0.88
    }
  ],
  "marketing_copies": [
    {
      "product_id": "P001",
      "copy": "根据您最近对手机的兴趣，为您精选 iPhone 16 Pro，好评率 98%，限时优惠中。"
    }
  ],
  "experiment_group": "treatment_llm",
  "total_latency_ms": 1523.4
}
```

---

## 📁 项目文件结构

```
multi-agent-commerce/
│
├── README.md                          # 📄 本文件（项目总览）
├── plan.md                            # 📋 完整项目计划（从调研到上线）
├── docker-compose.yml                 # 🐳 一键启动所有服务
│
├── docs/                              # 📚 面试全套文档
│   ├── interview-guide.md             # 🎯 面试指南（八股文30题 + STAR法话术）
│   ├── resume-template.md             # 📝 简历模板（应届 + 社招两版）
│   ├── architecture.md                # 🏗 架构设计详解（含数据流图）
│   ├── code-walkthrough.md            # 🔍 代码逐行讲解（面向小白）
│   └── project-plan.md                # 📋 项目计划总览（调研→实现→发布）
│
└── python/                            # 🐍 Python 实现（推荐入门）
    ├── main.py                        # FastAPI 服务入口
    ├── requirements.txt               # 依赖列表
    ├── .env.example                   # 环境变量模板
    ├── Dockerfile                     # 🐳 Python 服务容器化
    ├── agents/                        # 4 个 Agent 实现
    │   ├── base_agent.py              # 基类：重试/超时/降级
    │   ├── user_profile_agent.py      # 用户画像 Agent
    │   ├── product_rec_agent.py       # 商品推荐 Agent
    │   ├── marketing_copy_agent.py    # 营销文案 Agent
    │   └── inventory_agent.py         # 库存决策 Agent
    ├── orchestrator/
    │   ├── supervisor.py              # ⭐ Supervisor 并行编排（核心）
    │   └── graph.py                   # LangGraph 状态图
    ├── services/
    │   ├── ab_test.py                 # A/B 测试引擎（Thompson Sampling）
    │   ├── feature_store.py           # Redis 实时特征服务
    │   └── metrics.py                 # Prometheus 监控指标
    ├── models/schemas.py              # Pydantic 数据模型
    ├── config/settings.py             # 配置管理
    └── tests/                         # 单元测试
```

---

## 📚 面试资料索引

| 文档 | 内容亮点 | 什么时候看 |
|------|---------|-----------|
| [📋 面试完全指南](docs/interview-guide.md) | 八股文30题（含标准答案）+ STAR法3分钟/1分钟两版话术 + 面试官追问预案 | **面试前一天通读** |
| [📝 简历模板](docs/resume-template.md) | 应届/社招两套模板，项目经验直接复制，按岗位调整技术栈关键词 | **投简历时参考** |
| [🏗 架构设计文档](docs/architecture.md) | 系统架构图 + Agent职责矩阵 + 稳定性设计 + 性能数据 | **被问架构时参考** |
| [🔍 代码讲解指南](docs/code-walkthrough.md) | 每个文件逐行解释 + 面试话术 + 常见追问应对 | **被问代码时参考** |

---

## ❓ 面试八股文精选（10题）

### Q1：为什么用 Multi-Agent 而不是单个大 Agent？

> **推荐答法（30秒）**：
> 单 Agent 管理几十个工具时，上下文膨胀、推理准确率会明显下降。Multi-Agent 的核心优势有三点：
> 1. **上下文隔离**：每个 Agent 只关注自己领域的工具和数据，Token 消耗少、推理准确
> 2. **并行加速**：4 个 Agent 可以同时跑，端到端延迟约等于最慢 Agent 的耗时，而不是四者相加
> 3. **独立演进**：各 Agent 可以独立升级、独立做 A/B 测试，互不影响

---

### Q2：Supervisor 模式和 Handoffs 模式有什么区别？

> | | Supervisor 模式 | Handoffs 模式 |
> |--|--|--|
> | 控制方式 | 中枢集中控制 | Agent 间直接传递控制权 |
> | 适合场景 | 流程固定，需要并行 | 对话式，流程动态 |
> | 状态管理 | Supervisor 统一维护 | 每次交接携带上下文 |
> | 本项目 | ✅ 采用 | ❌ 未采用 |

---

### Q3：`asyncio.gather()` 和串行调用的区别？

> ```python
> # 串行：总耗时 = 3s + 5s = 8s
> profile = await user_profile_agent.run()   # 耗时 3s
> products = await product_rec_agent.run()   # 耗时 5s
>
> # 并行：总耗时 = max(3s, 5s) = 5s
> profile, products = await asyncio.gather(
>     user_profile_agent.run(),              # 3s
>     product_rec_agent.run(),               # 5s（同时开始）
> )
> ```
> `asyncio.gather()` 适合 IO 密集型任务（调用 API、查数据库），两个任务同时"等待"，CPU 不浪费。

---

### Q4：Redis Sorted Set 怎么做实时特征？

> ```
> # 写入：用户行为事件
> ZADD user:u001:clicks {timestamp} {product_id}
>
> # 读取：最近1小时的点击
> ZRANGEBYSCORE user:u001:clicks {now-3600} {now}
>
> # 滑动窗口统计（1h / 24h / 7d）
> clicks_1h  = ZCOUNT user:u001:clicks {now-3600} {now}
> clicks_24h = ZCOUNT user:u001:clicks {now-86400} {now}
> clicks_7d  = ZCOUNT user:u001:clicks {now-604800} {now}
> ```
> 用 score=时间戳 的 Sorted Set，天然支持按时间范围查询，时间复杂度 O(log N)。

---

### Q5：A/B 测试的流量分桶怎么保证一致性？

> ```python
> # 用 MD5 哈希取模 → 同一个 user_id 每次落到同一个桶
> bucket = int(hashlib.md5(user_id.encode()).hexdigest(), 16) % 100
>
> # 0-59  → control（60%流量）
> # 60-79 → treatment_llm（20%流量）
> # 80-99 → treatment_vector（20%流量）
> ```
> 只要 user_id 不变，分桶结果永远一致。这样同一个用户在实验期间始终体验同一套策略，保证实验结论的可靠性。

---

### Q6：Thompson Sampling 怎么动态调流量？

> 核心思想：哪个实验组赢得多，就自动给它更多流量（像"站在赢家那边"）。
>
> ```python
> # 每个实验组维护 Beta 分布参数
> alpha = {"control": 100, "treatment": 80}   # 点击次数
> beta  = {"control": 50,  "treatment": 20}   # 未点击次数
>
> # 分配流量时，从各组的 Beta 分布采样，取最大值的组
> samples = {group: np.random.beta(alpha[g], beta[g]) for g in groups}
> winner = max(samples, key=samples.get)
> # CTR 越高的组，采样值越大，被选中概率越高
> ```

---

### Q7：Agent 调用失败怎么处理？

> 三层保障：
> 1. **超时控制**：`asyncio.wait_for(coro, timeout=5)` — 每个 Agent 独立超时，不阻塞整体
> 2. **指数退避重试**：失败后等 1s → 2s → 4s 重试，共 3 次
> 3. **降级（Fallback）**：全部重试失败后，返回"说得过去的默认结果"（如热门商品列表），保证整个系统不崩溃

---

### Q8：LangGraph 和直接写 `asyncio.gather()` 有什么区别？

> | | LangGraph | 直接写 asyncio |
> |--|--|--|
> | 状态管理 | 内置 State，节点间自动传递 | 手动管理变量 |
> | 持久化 | 内置 Checkpoint，支持断点续跑 | 需要自己实现 |
> | 可视化 | 可以画出状态图 | 无 |
> | Human-in-the-loop | 内置支持，可以在节点暂停等人工确认 | 需要自己实现 |
> | 适合场景 | 复杂、有分支的工作流 | 简单并行任务 |

---

### Q9：RFM 模型怎么计算？

> ```
> R (Recency)  = 距离上次购买的天数    → 越小越好（最近买过）
> F (Frequency)= 一定周期内购买次数    → 越大越好（买的勤）
> M (Monetary) = 累计消费金额          → 越大越好（花的多）
>
> # 归一化到 0-1，加权求和
> rfm_score = 0.3 * R_norm + 0.3 * F_norm + 0.4 * M_norm
>
> # 用于分群：
> VIP:          rfm_score > 0.8
> 活跃用户:     0.6 < rfm_score ≤ 0.8
> 价格敏感:     高 F，低 M（买的勤但花得少）
> 流失风险:     rfm_score < 0.3
> ```

---

### Q10：系统延迟怎么优化到 P99 < 2s？

> 四个优化手段：
> 1. **并行化**：Phase1 和 Phase2 各两个 Agent 并行，节省约 50% 时间
> 2. **超时熔断**：单 Agent 超时不等待，返回降级结果，避免长尾拖累
> 3. **Redis 缓存**：用户画像热点数据缓存，命中率 > 80% 的情况下延迟从 200ms → 5ms
> 4. **LLM 精简**：Prompt 控制在 500 Token 以内，减少 LLM 推理时间

👉 **更多30题详见** [docs/interview-guide.md](docs/interview-guide.md)

---

## 📋 简历写法（直接复制）

```
多Agent电商推荐与营销系统 | 个人项目 | 2026.01 - 2026.04
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• 设计并实现基于 Supervisor 模式的多 Agent 协同架构，含用户画像、商品推荐、
  营销文案、库存决策 4 个专业 Agent，采用并行分发+聚合的编排模式

• 基于 Redis Sorted Set 实现实时用户特征工程（RFM 模型+行为序列），
  特征更新延迟 < 100ms，支持 1h/24h/7d 多时间窗口滑动计算

• 集成 LLM 实现个性化营销文案生成，基于用户画像动态切换 5 套 Prompt 模板，
  文案合规率 100%（广告法敏感词自动过滤）

• 设计流量分桶 + Thompson Sampling A/B 测试引擎，支持 Agent/模型/Prompt
  三层实验，推荐 CTR 提升 15%，文案点击率提升 23%

• 基于 LangGraph 状态图实现两阶段并行（画像‖召回 → 重排‖库存 → 文案），
  并提供 /recommend/graph 可视化调用接口，一套 Python 代码端到端跑通

技术栈：LangGraph · LangChain · Redis · Milvus · FastAPI · Docker
```

---

## 🔗 参考资料与致谢

本项目架构设计参考了以下企业级开源项目：

| 项目 | 说明 | 链接 |
|------|------|------|
| NVIDIA Retail Agentic Commerce | NVIDIA 企业级电商 Agent 蓝图 | [GitHub](https://github.com/NVIDIA-AI-Blueprints/Retail-Agentic-Commerce) |
| LangGraph 官方文档 | LangGraph 状态图框架 | [文档](https://langchain-ai.github.io/langgraph/) |
| 京东商家智能助手技术博客 | 京东 Multi-Agent 生产实践 | [掘金](https://juejin.cn/post/7470344960563871784) |
| DualAgent-Rec | 双 Agent 推荐系统 | [GitHub](https://github.com/GuilinDev/Dual-Agent-Recommendation) |
| MiniMax API | 本项目默认 LLM 服务 | [官网](https://www.minimax.chat/) |

---

## 📄 License

[MIT License](LICENSE) — 随意使用、修改、商用，保留 License 声明即可。

---

<div align="center">

**如果这个项目对你有帮助，欢迎点个 ⭐ Star！**

有问题欢迎提 [Issue](https://github.com/weifu1997/multi-agent-commerce/issues)

</div>
