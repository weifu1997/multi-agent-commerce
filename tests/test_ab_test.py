"""A/B测试引擎单元测试"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.ab_test import ABTestEngine, Experiment, ExperimentGroup


def test_consistent_assignment():
    """Same user always gets the same group."""
    engine = ABTestEngine()
    group1 = engine.assign("user_001")
    group2 = engine.assign("user_001")
    assert group1["group"] == group2["group"]


def test_distribution():
    """Check rough distribution balance across many users."""
    engine = ABTestEngine()
    counts: dict[str, int] = {}
    for i in range(1000):
        result = engine.assign(f"user_{i}")
        grp = result["group"]
        counts[grp] = counts.get(grp, 0) + 1

    for grp, count in counts.items():
        assert 300 < count < 700, f"Group {grp} has {count} users — too skewed"


def test_thompson_sampling():
    """Thompson sampling updates posterior correctly."""
    engine = ABTestEngine()
    for _ in range(100):
        engine.record_outcome("rec_strategy", "treatment_llm", True)
    for _ in range(100):
        engine.record_outcome("rec_strategy", "control", False)

    exp = engine.experiments["rec_strategy"]
    treatment = next(g for g in exp.groups if g.name == "treatment_llm")
    control = next(g for g in exp.groups if g.name == "control")
    assert treatment.successes > control.successes


def test_custom_experiment():
    engine = ABTestEngine()
    engine.register_experiment(
        Experiment(
            id="prompt_test",
            name="Prompt模板实验",
            groups=[
                ExperimentGroup(name="template_a", weight=30),
                ExperimentGroup(name="template_b", weight=70),
            ],
        )
    )
    result = engine.assign("user_999", "prompt_test")
    assert result["group"] in ("template_a", "template_b")


def test_metrics_recording():
    engine = ABTestEngine()
    engine.record_metric("rec_strategy", "control", "ctr", 0.05, "user_001")
    engine.record_metric("rec_strategy", "control", "ctr", 0.08, "user_002")
    engine.record_metric("rec_strategy", "treatment_llm", "ctr", 0.12, "user_003")

    stats = engine.get_stats("rec_strategy")
    assert "control" in stats
    assert stats["control"]["ctr"]["count"] == 2


def test_assign_pipeline_hash_only_when_thompson_prob_zero():
    engine = ABTestEngine()
    result = engine.assign_pipeline("user_001", thompson_prob=0.0)
    assert result["rec_strategy"]["assign"] == "hash"
    assert result["copy_style"]["assign"] == "hash"
    assert result["rec_strategy"]["group"] == engine.assign("user_001", "rec_strategy")["group"]
    assert result["copy_style"]["group"] == engine.assign("user_001", "copy_style")["group"]


def test_assign_pipeline_thompson_when_prob_one():
    engine = ABTestEngine()
    result = engine.assign_pipeline("user_001", thompson_prob=1.0)
    assert result["rec_strategy"]["assign"] == "thompson"
    assert result["copy_style"]["assign"] == "hash"


def test_outcome_unknown_ids_return_404_and_valid_pair_records():
    from fastapi.testclient import TestClient

    import main as main_mod

    with TestClient(main_mod.app) as client:
        missing_exp = client.post(
            "/api/v1/experiments/no_such/outcome?group=control&success=true"
        )
        assert missing_exp.status_code == 404

        missing_group = client.post(
            "/api/v1/experiments/rec_strategy/outcome?group=no_such&success=true"
        )
        assert missing_group.status_code == 404

        control = next(
            g for g in main_mod.ab_engine.experiments["rec_strategy"].groups if g.name == "control"
        )
        before = control.successes
        ok = client.post(
            "/api/v1/experiments/rec_strategy/outcome?group=control&success=true"
        )
        assert ok.status_code == 200
        assert ok.json() == {"status": "recorded"}
        assert control.successes == before + 1


def test_graph_uninitialized_returns_503():
    from fastapi.testclient import TestClient

    import main as main_mod

    with TestClient(main_mod.app) as client:
        original = main_mod.rec_graph
        main_mod.rec_graph = None
        try:
            resp = client.post("/api/v1/recommend/graph", json={"user_id": "u1"})
            assert resp.status_code == 503
        finally:
            main_mod.rec_graph = original


if __name__ == "__main__":
    test_consistent_assignment()
    test_distribution()
    test_thompson_sampling()
    test_custom_experiment()
    test_metrics_recording()
    test_assign_pipeline_hash_only_when_thompson_prob_zero()
    test_assign_pipeline_thompson_when_prob_one()
    print("All A/B test engine tests passed!")
