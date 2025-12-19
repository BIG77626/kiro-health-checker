from __future__ import annotations

"""
Stage 3 PR3 - 性能基线与可观测性行为级测试

目的：
- 验证 coverage/traceability 计算复杂度为 O(n+m)
- 验证打印开销不超过计算开销的 2x
- 不追求绝对速度，只验证复杂度线性和 overhead 可控

设计原则：
- 行为级测试：验证复杂度特性，不检查绝对耗时
- 使用 @pytest.mark.slow 标记，默认不运行
- 不引入 pytest-benchmark 依赖，保持简洁
"""

import io
import time
from contextlib import redirect_stdout
from typing import Any, Dict, List

import pytest

from ..models import Rule, RuleCategory, RiskLevel
from ..requirement_models import Requirement
from ..health_config_models import HealthConfig, get_default_config


# =============================================================================
# Benchmark Dataset Fixture
# =============================================================================


@pytest.fixture
def benchmark_dataset() -> Dict[str, Any]:
    """
    固定数据集：100 REQ, 100 Rules, 20% HIGH risk

    用于性能基线测试，确保可重复验证。
    """
    requirements: Dict[str, Requirement] = {}
    rules: List[Rule] = []

    for i in range(100):
        req_id = f"REQ-BEN-{i:03d}"
        risk = RiskLevel.HIGH if i < 20 else RiskLevel.MEDIUM
        requirements[req_id] = Requirement(
            id=req_id,
            title=f"Benchmark requirement {i}",
            risk_level=risk,
        )

    for i in range(100):
        rule_id = f"BEN-{i:03d}"
        # 每个 rule 引用 1-2 个 REQ
        req_refs = [f"REQ-BEN-{i:03d}"]
        if i > 0:
            req_refs.append(f"REQ-BEN-{i-1:03d}")

        rules.append(
            Rule(
                id=rule_id,
                category=RuleCategory.SECURITY,
                description=f"Benchmark rule {i}",
                human_description=f"基准规则 {i}",
                severity="mandatory",
                requirement_ids=req_refs,
            )
        )

    return {
        "requirements": requirements,
        "rules": rules,
    }


@pytest.fixture
def doubled_dataset(benchmark_dataset: Dict[str, Any]) -> Dict[str, Any]:
    """
    2x 规模数据集：200 REQ, 200 Rules

    用于验证线性复杂度。
    """
    requirements = dict(benchmark_dataset["requirements"])
    rules = list(benchmark_dataset["rules"])

    # 复制并重命名
    for i in range(100, 200):
        req_id = f"REQ-BEN-{i:03d}"
        risk = RiskLevel.HIGH if i < 120 else RiskLevel.MEDIUM
        requirements[req_id] = Requirement(
            id=req_id,
            title=f"Benchmark requirement {i}",
            risk_level=risk,
        )

    for i in range(100, 200):
        rule_id = f"BEN-{i:03d}"
        req_refs = [f"REQ-BEN-{i:03d}"]
        if i > 100:
            req_refs.append(f"REQ-BEN-{i-1:03d}")

        rules.append(
            Rule(
                id=rule_id,
                category=RuleCategory.SECURITY,
                description=f"Benchmark rule {i}",
                human_description=f"基准规则 {i}",
                severity="mandatory",
                requirement_ids=req_refs,
            )
        )

    return {
        "requirements": requirements,
        "rules": rules,
    }


# =============================================================================
# Mock Summary for Coverage Tests
# =============================================================================


class MockRuleTestSummary:
    """模拟 RuleTestSummary，用于性能测试"""

    def __init__(self, total_rules: int = 100, missing_tests: List[str] | None = None):
        self.total_rules = total_rules
        self.rules_with_tests = total_rules
        self.coverage_percentage = 100.0
        self.passed_rules = total_rules
        self.failed_rules = 0
        self.missing_tests = missing_tests or []
        self.invalid_tests: List[str] = []
        self.results: List[Any] = []


# =============================================================================
# Performance Tests (marked as slow)
# =============================================================================


@pytest.mark.slow
def test_coverage_calculation_scaling_linear(
    benchmark_dataset: Dict[str, Any],
    doubled_dataset: Dict[str, Any],
) -> None:
    """
    验证 coverage 计算复杂度为 O(n+m)：规模翻倍，耗时 < 2.5x

    行为契约：线性复杂度，不会因数据量增加而指数级变慢。
    """
    from ..requirement_coverage import check_requirement_coverage

    # 1x 规模
    summary_1x = MockRuleTestSummary(total_rules=100)
    start = time.perf_counter()
    check_requirement_coverage(
        requirements=benchmark_dataset["requirements"],
        rule_summary=summary_1x,
        rules=benchmark_dataset["rules"],
    )
    t1 = time.perf_counter() - start

    # 2x 规模
    summary_2x = MockRuleTestSummary(total_rules=200)
    start = time.perf_counter()
    check_requirement_coverage(
        requirements=doubled_dataset["requirements"],
        rule_summary=summary_2x,
        rules=doubled_dataset["rules"],
    )
    t2 = time.perf_counter() - start

    # 线性复杂度验证：2x 数据量，耗时应 < 2.5x
    assert t2 < t1 * 2.5, f"非线性复杂度: 1x={t1:.4f}s, 2x={t2:.4f}s, ratio={t2/t1:.2f}"


@pytest.mark.slow
def test_traceability_check_scaling_linear(
    benchmark_dataset: Dict[str, Any],
    doubled_dataset: Dict[str, Any],
) -> None:
    """
    验证 traceability 检查复杂度为 O(n+m)：规模翻倍，耗时 < 2.5x

    行为契约：线性复杂度。
    """
    from ..requirement_traceability import check_traceability

    # 1x 规模
    start = time.perf_counter()
    check_traceability(
        requirements=benchmark_dataset["requirements"],
        rules=benchmark_dataset["rules"],
    )
    t1 = time.perf_counter() - start

    # 2x 规模
    start = time.perf_counter()
    check_traceability(
        requirements=doubled_dataset["requirements"],
        rules=doubled_dataset["rules"],
    )
    t2 = time.perf_counter() - start

    # 线性复杂度验证
    assert t2 < t1 * 2.5, f"非线性复杂度: 1x={t1:.4f}s, 2x={t2:.4f}s, ratio={t2/t1:.2f}"


@pytest.mark.slow
def test_print_overhead_reasonable(benchmark_dataset: Dict[str, Any]) -> None:
    """
    验证打印开销 < 计算开销的 2x

    行为契约：输出格式化不应成为性能瓶颈。
    """
    from ..health_check import HealthCheckReport, print_text_report

    # 构造带完整数据的报告
    report = HealthCheckReport(
        generated_at="2025-12-19T10:00:00",
        total_rules=100,
        rules_with_tests=80,
        coverage_percentage=80.0,
        coverage_threshold=70.0,
        coverage_meets_threshold=True,
        passed_rules=75,
        failed_rules=5,
        requirement_coverage={
            "total_requirements": 100,
            "requirements_with_rules": 80,
            "requirements_with_samples": 70,
            "coverage_percentage": 70.0,
            "fully_covered": 60,
            "requirement_stats": [
                {
                    "requirement_id": f"REQ-BEN-{i:03d}",
                    "risk_level": "HIGH" if i < 20 else "MEDIUM",
                    "has_rules": i < 80,
                    "has_samples": i < 70,
                    "tests_passed": i < 60,
                }
                for i in range(100)
            ],
        },
        traceability={
            "orphan_requirements": [f"REQ-ORPHAN-{i:03d}" for i in range(10)],
            "dangling_rule_refs": {f"RULE-{i:03d}": [f"REQ-GHOST-{i:03d}"] for i in range(5)},
            "orphan_count": 10,
            "dangling_count": 5,
            "has_issues": True,
        },
    )

    cfg = get_default_config()

    # 纯计算耗时（to_dict）
    start = time.perf_counter()
    _ = report.to_dict()
    calc_duration = time.perf_counter() - start

    # 打印耗时（捕获到 StringIO）
    buffer = io.StringIO()
    start = time.perf_counter()
    with redirect_stdout(buffer):
        print_text_report(report, quiet=False, verbose=True, cfg=cfg)
    print_duration = time.perf_counter() - start

    # 打印开销应 < 计算开销的 2x
    # 注意：如果 calc_duration 非常小，使用绝对值兜底
    max_allowed = max(calc_duration * 2.0, 0.1)  # 至少允许 100ms
    assert print_duration < max_allowed, (
        f"打印开销过大: calc={calc_duration:.4f}s, print={print_duration:.4f}s"
    )


# =============================================================================
# Non-slow Tests (always run)
# =============================================================================


def test_benchmark_dataset_fixture_valid(benchmark_dataset: Dict[str, Any]) -> None:
    """验证 benchmark_dataset fixture 数据结构正确"""
    assert len(benchmark_dataset["requirements"]) == 100
    assert len(benchmark_dataset["rules"]) == 100

    # 验证 20% HIGH risk
    high_risk_count = sum(
        1
        for req in benchmark_dataset["requirements"].values()
        if req.risk_level == RiskLevel.HIGH
    )
    assert high_risk_count == 20


def test_doubled_dataset_fixture_valid(doubled_dataset: Dict[str, Any]) -> None:
    """验证 doubled_dataset fixture 数据结构正确"""
    assert len(doubled_dataset["requirements"]) == 200
    assert len(doubled_dataset["rules"]) == 200
