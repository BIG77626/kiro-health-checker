from __future__ import annotations

"""
Cross-Stage Review Verification - 设计 ↔ 实现一致性（行为级）

目的：
- 确认阶段一关于「双向追踪基础」的设计在阶段二实现中被真正使用
- 重点验证：Rule.requirement_ids 在需求覆盖计算中产生正确效果

设计原则：
- 不用字符串匹配源码来验证设计
- 通过构造有/无 requirement_ids 的规则，比较统计结果差异
- 测试的是「行为差异」而非「代码存在性」
"""

from typing import Dict, List

import pytest


class FakeRuleTestSummary:
    """
    用于测试的 RuleTestSummary 替身。
    
    实现 RuleTestSummaryLike 协议的最小接口。
    """

    def __init__(
        self,
        total_rules: int = 0,
        rules_with_tests: int = 0,
        coverage_percentage: float = 0.0,
        passed_rules: int = 0,
        failed_rules: int = 0,
        missing_tests: List[str] | None = None,
        invalid_tests: List[str] | None = None,
    ) -> None:
        self.total_rules = total_rules
        self.rules_with_tests = rules_with_tests
        self.coverage_percentage = coverage_percentage
        self.passed_rules = passed_rules
        self.failed_rules = failed_rules
        self.missing_tests = missing_tests or []
        self.invalid_tests = invalid_tests or []
        self.results: List = []


def test_rule_requirement_ids_affects_coverage_calculation() -> None:
    """
    跨阶段行为验证：Rule.requirement_ids 影响需求覆盖计算结果。
    
    验证方式：
    1. 构造有 requirement_ids 的规则 → 需求应被标记为「有规则覆盖」
    2. 构造无 requirement_ids 的规则 → 需求应被标记为「无规则覆盖」
    3. 比较两种情况的 requirements_with_rules 差异
    """
    from ..requirement_coverage import check_requirement_coverage
    from ..requirement_models import Requirement
    from ..models import Rule, RuleCategory, RiskLevel

    # 构造一个需求
    req = Requirement(
        id="REQ-NET-001",
        title="测试需求",
        risk_level=RiskLevel.HIGH,
    )
    requirements = {req.id: req}

    # 场景 1：规则有 requirement_ids 指向该需求
    rule_with_req_ids = Rule(
        id="NET-001",
        category=RuleCategory.NETWORK,
        description="Test rule with requirement_ids",
        human_description="带需求ID的测试规则",
        severity="mandatory",
        requirement_ids=["REQ-NET-001"],  # 关键：指向需求
    )

    summary = FakeRuleTestSummary(
        total_rules=1,
        rules_with_tests=1,
        coverage_percentage=100.0,
        passed_rules=1,
        missing_tests=[],  # 规则有测试
    )

    result_with = check_requirement_coverage(
        requirements=requirements,
        rule_summary=summary,
        rules=[rule_with_req_ids],
    )

    # 场景 2：规则无 requirement_ids
    rule_without_req_ids = Rule(
        id="NET-001",
        category=RuleCategory.NETWORK,
        description="Test rule without requirement_ids",
        human_description="无需求ID的测试规则",
        severity="mandatory",
        requirement_ids=[],  # 关键：空列表
    )

    result_without = check_requirement_coverage(
        requirements=requirements,
        rule_summary=summary,
        rules=[rule_without_req_ids],
    )

    # 行为验证：requirement_ids 影响 requirements_with_rules 统计
    assert result_with.requirements_with_rules == 1, (
        "有 requirement_ids 时，requirements_with_rules 应为 1"
    )
    assert result_without.requirements_with_rules == 0, (
        "无 requirement_ids 时，requirements_with_rules 应为 0"
    )

    # 行为验证：覆盖率差异
    assert result_with.coverage_percentage > result_without.coverage_percentage, (
        "有 requirement_ids 的覆盖率应高于无 requirement_ids"
    )


def test_multiple_rules_covering_same_requirement() -> None:
    """
    跨阶段行为验证：多条规则覆盖同一需求时，需求只计数一次。
    
    验证方式：构造两条规则都指向同一需求，检查 requirements_with_rules 为 1。
    """
    from ..requirement_coverage import check_requirement_coverage
    from ..requirement_models import Requirement
    from ..models import Rule, RuleCategory, RiskLevel

    req = Requirement(
        id="REQ-SEC-001",
        title="安全需求",
        risk_level=RiskLevel.HIGH,
    )
    requirements = {req.id: req}

    # 两条规则都指向同一需求
    rule1 = Rule(
        id="SEC-001",
        category=RuleCategory.SECURITY,
        description="Security rule 1",
        human_description="安全规则1",
        severity="mandatory",
        requirement_ids=["REQ-SEC-001"],
    )
    rule2 = Rule(
        id="SEC-002",
        category=RuleCategory.SECURITY,
        description="Security rule 2",
        human_description="安全规则2",
        severity="mandatory",
        requirement_ids=["REQ-SEC-001"],
    )

    summary = FakeRuleTestSummary(
        total_rules=2,
        rules_with_tests=2,
        missing_tests=[],
    )

    result = check_requirement_coverage(
        requirements=requirements,
        rule_summary=summary,
        rules=[rule1, rule2],
    )

    # 行为验证：需求只计数一次
    assert result.total_requirements == 1
    assert result.requirements_with_rules == 1, (
        "多条规则覆盖同一需求时，requirements_with_rules 应为 1"
    )


def test_rule_with_nonexistent_requirement_id_ignored() -> None:
    """
    跨阶段行为验证：规则引用不存在的需求ID时，不影响统计。
    
    验证方式：规则的 requirement_ids 指向不存在的需求，检查不会报错且不计入统计。
    """
    from ..requirement_coverage import check_requirement_coverage
    from ..requirement_models import Requirement
    from ..models import Rule, RuleCategory, RiskLevel

    # 只有一个需求
    req = Requirement(
        id="REQ-NET-001",
        title="网络需求",
        risk_level=RiskLevel.MEDIUM,
    )
    requirements = {req.id: req}

    # 规则指向不存在的需求
    rule = Rule(
        id="NET-001",
        category=RuleCategory.NETWORK,
        description="Rule with dangling reference",
        human_description="悬空引用规则",
        severity="mandatory",
        requirement_ids=["REQ-NONEXISTENT-001"],  # 不存在的需求
    )

    summary = FakeRuleTestSummary(total_rules=1, missing_tests=[])

    # 不应抛出异常
    result = check_requirement_coverage(
        requirements=requirements,
        rule_summary=summary,
        rules=[rule],
    )

    # 行为验证：悬空引用不影响统计
    assert result.total_requirements == 1
    assert result.requirements_with_rules == 0, (
        "悬空引用不应计入 requirements_with_rules"
    )


def test_empty_requirements_returns_100_percent_coverage() -> None:
    """
    跨阶段行为验证：无需求时，覆盖率为 100%（设计文档约定）。
    
    验证方式：传入空需求字典，检查 coverage_percentage 为 100.0。
    """
    from ..requirement_coverage import check_requirement_coverage
    from ..models import Rule, RuleCategory

    rule = Rule(
        id="NET-001",
        category=RuleCategory.NETWORK,
        description="Test rule",
        human_description="测试规则",
        severity="mandatory",
    )

    summary = FakeRuleTestSummary(total_rules=1)

    result = check_requirement_coverage(
        requirements={},  # 空需求
        rule_summary=summary,
        rules=[rule],
    )

    # 行为验证：无需求时覆盖率为 100%
    assert result.total_requirements == 0
    assert result.coverage_percentage == 100.0, (
        f"无需求时覆盖率应为 100.0，实际为 {result.coverage_percentage}"
    )


def test_risk_level_grouping_in_coverage_result() -> None:
    """
    跨阶段行为验证：需求按 risk_level 正确分组。
    
    验证方式：构造不同风险等级的需求，检查 by_risk_level 分组正确。
    """
    from ..requirement_coverage import check_requirement_coverage
    from ..requirement_models import Requirement
    from ..models import Rule, RuleCategory, RiskLevel

    # 构造不同风险等级的需求
    req_high = Requirement(
        id="REQ-SEC-001",
        title="高风险需求",
        risk_level=RiskLevel.HIGH,
    )
    req_medium = Requirement(
        id="REQ-NET-001",
        title="中风险需求",
        risk_level=RiskLevel.MEDIUM,
    )
    req_low = Requirement(
        id="REQ-LOG-001",
        title="低风险需求",
        risk_level=RiskLevel.LOW,
    )

    requirements = {
        req_high.id: req_high,
        req_medium.id: req_medium,
        req_low.id: req_low,
    }

    summary = FakeRuleTestSummary(total_rules=0)

    result = check_requirement_coverage(
        requirements=requirements,
        rule_summary=summary,
        rules=[],
    )

    # 行为验证：by_risk_level 包含所有风险等级
    assert RiskLevel.HIGH in result.by_risk_level
    assert RiskLevel.MEDIUM in result.by_risk_level
    assert RiskLevel.LOW in result.by_risk_level

    # 行为验证：每个等级的 total 正确
    assert result.by_risk_level[RiskLevel.HIGH]["total"] == 1
    assert result.by_risk_level[RiskLevel.MEDIUM]["total"] == 1
    assert result.by_risk_level[RiskLevel.LOW]["total"] == 1
