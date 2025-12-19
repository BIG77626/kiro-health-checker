from __future__ import annotations

from typing import List

from simplified.models import RiskLevel, Rule
from simplified.requirement_coverage import (
    RequirementCoverageResult,
    RuleTestSummaryLike,
    check_requirement_coverage,
)
from simplified.requirement_models import Requirement


class _FakeSummary:
    """简单的 RuleTestSummary 替身，用于单元测试。"""

    def __init__(
        self,
        total_rules: int,
        missing_tests: List[str] | None = None,
        invalid_tests: List[str] | None = None,
        results: List[object] | None = None,
    ) -> None:
        self.total_rules = total_rules
        self.passed_rules = 0
        self.failed_rules = 0
        self.missing_tests = list(missing_tests or [])
        self.invalid_tests = list(invalid_tests or [])
        self.results = list(results or [])
        self.coverage_percentage = 0.0


class _Result:
    def __init__(self, rule_id: str, passed: bool) -> None:
        self.rule_id = rule_id
        self.passed = passed


def test_no_requirements_returns_100_percent() -> None:
    """当没有任何需求时，覆盖率应为 100%（风险雷达关闭）。"""

    summary = _FakeSummary(total_rules=0)
    rules: List[Rule] = []

    result: RequirementCoverageResult = check_requirement_coverage(
        requirements={},
        rule_summary=summary,
        verbose=False,
        rules=rules,
    )

    assert result.total_requirements == 0
    assert result.coverage_percentage == 100.0


def test_single_requirement_with_rule_and_samples() -> None:
    """单个需求被规则覆盖且有样本时，应计入 samples 和 rules。"""

    req = Requirement(
        id="REQ-NET-001",
        title="所有外部 HTTP 请求必须启用证书校验",
        risk_level=RiskLevel.HIGH,
        covered_by_rules=["NET-007"],
    )
    requirements = {req.id: req}

    rule = Rule(
        id="NET-007",
        category="network",  # type: ignore[arg-type]
        description="dummy",
        human_description="dummy",
        severity="mandatory",
        requirement_ids=["REQ-NET-001"],
    )
    rules = [rule]

    summary = _FakeSummary(
        total_rules=1,
        missing_tests=[],
        invalid_tests=[],
        results=[_Result(rule_id="NET-007", passed=True)],
    )

    result = check_requirement_coverage(
        requirements=requirements,
        rule_summary=summary,
        verbose=True,
        rules=rules,
    )

    assert result.total_requirements == 1
    assert result.requirements_with_rules == 1
    assert result.requirements_with_samples == 1
    assert result.coverage_percentage == 100.0
    assert len(result.requirement_stats) == 1
    stat = result.requirement_stats[0]
    assert stat.requirement_id == "REQ-NET-001"
    assert stat.has_rules is True
    assert stat.has_samples is True
    assert stat.tests_passed is True


def test_requirement_with_rule_but_no_samples() -> None:
    """有规则但缺少样本时，只计入 with_rules，不计入 with_samples。"""

    req = Requirement(
        id="REQ-SEC-001",
        title="安全相关示例",
        risk_level=RiskLevel.HIGH,
        covered_by_rules=["SEC-001"],
    )
    requirements = {req.id: req}

    rule = Rule(
        id="SEC-001",
        category="security",  # type: ignore[arg-type]
        description="dummy",
        human_description="dummy",
        severity="mandatory",
        requirement_ids=["REQ-SEC-001"],
    )
    rules = [rule]

    # 缺少样本：missing_tests 包含 SEC-001
    summary = _FakeSummary(
        total_rules=1,
        missing_tests=["SEC-001"],
        invalid_tests=[],
        results=[],
    )

    result = check_requirement_coverage(
        requirements=requirements,
        rule_summary=summary,
        verbose=True,
        rules=rules,
    )

    assert result.total_requirements == 1
    assert result.requirements_with_rules == 1
    assert result.requirements_with_samples == 0
    assert 0.0 <= result.coverage_percentage < 100.0


