from __future__ import annotations

"""
Stage 3 Review Verification - Traceability 行为级测试

目的：
- 验证 requirement_traceability.py 的核心行为
- 检测 orphan_requirements 和 dangling_rule_refs 两类问题

设计原则：
- 行为级测试：构造输入，验证输出，不检查内部实现
- 边界覆盖：空输入、正常输入、异常输入
- 职责分离：只测 traceability，不测 coverage
"""

from typing import Dict, List

import pytest


def test_traceability_module_exists() -> None:
    """阶段三：traceability 模块存在且可导入"""
    from ..requirement_traceability import (
        TraceabilityResult,
        check_traceability,
    )

    # 行为验证：模块可导入
    assert TraceabilityResult is not None
    assert check_traceability is not None


def test_traceability_result_default_values() -> None:
    """TraceabilityResult 默认值正确"""
    from ..requirement_traceability import TraceabilityResult

    result = TraceabilityResult()

    assert result.orphan_requirements == []
    assert result.dangling_rule_refs == {}
    assert result.has_issues is False
    assert result.orphan_count == 0
    assert result.dangling_count == 0


def test_traceability_result_to_dict() -> None:
    """TraceabilityResult.to_dict() 输出结构正确"""
    from ..requirement_traceability import TraceabilityResult

    result = TraceabilityResult(
        orphan_requirements=["REQ-NET-001"],
        dangling_rule_refs={"SEC-001": ["REQ-DELETED-001"]},
    )

    d = result.to_dict()

    assert d["orphan_requirements"] == ["REQ-NET-001"]
    assert d["dangling_rule_refs"] == {"SEC-001": ["REQ-DELETED-001"]}
    assert d["orphan_count"] == 1
    assert d["dangling_count"] == 1
    assert d["has_issues"] is True


def test_check_traceability_empty_inputs() -> None:
    """空输入时返回空结果（不报错）"""
    from ..requirement_traceability import check_traceability

    result = check_traceability(requirements={}, rules=[])

    assert result.orphan_requirements == []
    assert result.dangling_rule_refs == {}
    assert result.has_issues is False


def test_check_traceability_no_issues() -> None:
    """所有 REQ 都被引用，所有引用都有效 → 无问题"""
    from ..requirement_traceability import check_traceability
    from ..requirement_models import Requirement
    from ..models import Rule, RuleCategory, RiskLevel

    # 构造 REQ
    req = Requirement(
        id="REQ-NET-001",
        title="网络需求",
        risk_level=RiskLevel.HIGH,
    )
    requirements = {req.id: req}

    # 构造 Rule，引用该 REQ
    rule = Rule(
        id="NET-001",
        category=RuleCategory.NETWORK,
        description="Network rule",
        human_description="网络规则",
        severity="mandatory",
        requirement_ids=["REQ-NET-001"],
    )

    result = check_traceability(requirements=requirements, rules=[rule])

    assert result.orphan_requirements == []
    assert result.dangling_rule_refs == {}
    assert result.has_issues is False


def test_check_traceability_orphan_requirement() -> None:
    """REQ 存在但没有 Rule 引用 → orphan_requirements"""
    from ..requirement_traceability import check_traceability
    from ..requirement_models import Requirement
    from ..models import Rule, RuleCategory, RiskLevel

    # 构造两个 REQ
    req1 = Requirement(id="REQ-NET-001", title="网络需求1", risk_level=RiskLevel.HIGH)
    req2 = Requirement(id="REQ-NET-002", title="网络需求2", risk_level=RiskLevel.MEDIUM)
    requirements = {req1.id: req1, req2.id: req2}

    # Rule 只引用 REQ-NET-001，REQ-NET-002 成为孤儿
    rule = Rule(
        id="NET-001",
        category=RuleCategory.NETWORK,
        description="Network rule",
        human_description="网络规则",
        severity="mandatory",
        requirement_ids=["REQ-NET-001"],
    )

    result = check_traceability(requirements=requirements, rules=[rule])

    assert result.orphan_requirements == ["REQ-NET-002"]
    assert result.dangling_rule_refs == {}
    assert result.has_issues is True
    assert result.orphan_count == 1


def test_check_traceability_dangling_reference() -> None:
    """Rule 引用不存在的 REQ → dangling_rule_refs"""
    from ..requirement_traceability import check_traceability
    from ..requirement_models import Requirement
    from ..models import Rule, RuleCategory, RiskLevel

    # 只有一个 REQ
    req = Requirement(id="REQ-NET-001", title="网络需求", risk_level=RiskLevel.HIGH)
    requirements = {req.id: req}

    # Rule 引用了不存在的 REQ
    rule = Rule(
        id="NET-001",
        category=RuleCategory.NETWORK,
        description="Network rule",
        human_description="网络规则",
        severity="mandatory",
        requirement_ids=["REQ-NET-001", "REQ-DELETED-001"],  # REQ-DELETED-001 不存在
    )

    result = check_traceability(requirements=requirements, rules=[rule])

    assert result.orphan_requirements == []  # REQ-NET-001 被引用，不是孤儿
    assert result.dangling_rule_refs == {"NET-001": ["REQ-DELETED-001"]}
    assert result.has_issues is True
    assert result.dangling_count == 1


def test_check_traceability_multiple_issues() -> None:
    """同时存在 orphan 和 dangling"""
    from ..requirement_traceability import check_traceability
    from ..requirement_models import Requirement
    from ..models import Rule, RuleCategory, RiskLevel

    # 两个 REQ
    req1 = Requirement(id="REQ-NET-001", title="网络需求1", risk_level=RiskLevel.HIGH)
    req2 = Requirement(id="REQ-SEC-001", title="安全需求", risk_level=RiskLevel.HIGH)
    requirements = {req1.id: req1, req2.id: req2}

    # Rule 1 引用 REQ-NET-001 + 不存在的 REQ
    # Rule 2 不引用任何 REQ
    # 结果：REQ-SEC-001 是孤儿，REQ-GHOST-001 是悬空引用
    rule1 = Rule(
        id="NET-001",
        category=RuleCategory.NETWORK,
        description="Network rule",
        human_description="网络规则",
        severity="mandatory",
        requirement_ids=["REQ-NET-001", "REQ-GHOST-001"],
    )
    rule2 = Rule(
        id="SEC-001",
        category=RuleCategory.SECURITY,
        description="Security rule",
        human_description="安全规则",
        severity="mandatory",
        requirement_ids=[],  # 不引用任何 REQ
    )

    result = check_traceability(requirements=requirements, rules=[rule1, rule2])

    assert result.orphan_requirements == ["REQ-SEC-001"]
    assert result.dangling_rule_refs == {"NET-001": ["REQ-GHOST-001"]}
    assert result.has_issues is True
    assert result.orphan_count == 1
    assert result.dangling_count == 1


def test_check_traceability_rule_without_requirement_ids() -> None:
    """Rule 没有 requirement_ids 字段（向后兼容）"""
    from ..requirement_traceability import check_traceability
    from ..requirement_models import Requirement
    from ..models import Rule, RuleCategory, RiskLevel

    req = Requirement(id="REQ-NET-001", title="网络需求", risk_level=RiskLevel.HIGH)
    requirements = {req.id: req}

    # Rule 使用默认空 requirement_ids
    rule = Rule(
        id="NET-001",
        category=RuleCategory.NETWORK,
        description="Network rule",
        human_description="网络规则",
        severity="mandatory",
        # requirement_ids 默认为 []
    )

    result = check_traceability(requirements=requirements, rules=[rule])

    # REQ 没有被引用，成为孤儿
    assert result.orphan_requirements == ["REQ-NET-001"]
    assert result.dangling_rule_refs == {}


def test_check_traceability_multiple_rules_same_req() -> None:
    """多个 Rule 引用同一个 REQ → REQ 不是孤儿"""
    from ..requirement_traceability import check_traceability
    from ..requirement_models import Requirement
    from ..models import Rule, RuleCategory, RiskLevel

    req = Requirement(id="REQ-SEC-001", title="安全需求", risk_level=RiskLevel.HIGH)
    requirements = {req.id: req}

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

    result = check_traceability(requirements=requirements, rules=[rule1, rule2])

    assert result.orphan_requirements == []
    assert result.dangling_rule_refs == {}
    assert result.has_issues is False


def test_check_traceability_does_not_affect_coverage() -> None:
    """
    traceability 检查不影响 coverage 计算（职责分离验证）。

    验证方式：同样的输入，coverage 和 traceability 各自独立计算。
    """
    from ..requirement_traceability import check_traceability
    from ..requirement_coverage import check_requirement_coverage
    from ..requirement_models import Requirement
    from ..models import Rule, RuleCategory, RiskLevel
    from ..tests.test_review_cross_stage import FakeRuleTestSummary

    # 构造有问题的数据：REQ 存在但 Rule 引用了不存在的 REQ
    req = Requirement(id="REQ-NET-001", title="网络需求", risk_level=RiskLevel.HIGH)
    requirements = {req.id: req}

    rule = Rule(
        id="NET-001",
        category=RuleCategory.NETWORK,
        description="Network rule",
        human_description="网络规则",
        severity="mandatory",
        requirement_ids=["REQ-NET-001", "REQ-GHOST-001"],  # 悬空引用
    )

    summary = FakeRuleTestSummary(total_rules=1, missing_tests=[])

    # 分别调用两个模块
    trace_result = check_traceability(requirements=requirements, rules=[rule])
    cov_result = check_requirement_coverage(
        requirements=requirements,
        rule_summary=summary,
        rules=[rule],
    )

    # traceability 检测到悬空引用
    assert trace_result.dangling_rule_refs == {"NET-001": ["REQ-GHOST-001"]}

    # coverage 正常计算（悬空引用不影响覆盖统计）
    assert cov_result.total_requirements == 1
    assert cov_result.requirements_with_rules == 1  # REQ-NET-001 被 NET-001 覆盖


# =============================================================================
# Health Check 集成测试
# =============================================================================


def test_health_check_report_has_traceability_field() -> None:
    """HealthCheckReport 包含 traceability 字段"""
    from ..health_check import HealthCheckReport
    from datetime import datetime

    report = HealthCheckReport(generated_at=datetime.now().isoformat())

    # 行为验证：字段存在且默认为 None
    assert hasattr(report, "traceability")
    assert report.traceability is None


def test_health_check_report_traceability_in_to_dict() -> None:
    """HealthCheckReport.to_dict() 包含 traceability 字段"""
    from ..health_check import HealthCheckReport
    from datetime import datetime

    report = HealthCheckReport(
        generated_at=datetime.now().isoformat(),
        traceability={
            "orphan_requirements": ["REQ-NET-001"],
            "dangling_rule_refs": {},
            "has_issues": True,
        },
    )

    d = report.to_dict()

    assert "traceability" in d
    assert d["traceability"]["orphan_requirements"] == ["REQ-NET-001"]
    assert d["traceability"]["has_issues"] is True


def test_traceability_config_enabled_field() -> None:
    """TraceabilityPolicy 包含 enabled 字段"""
    from ..health_config_models import TraceabilityPolicy, HealthConfig

    # 默认启用
    policy = TraceabilityPolicy()
    assert policy.enabled is True

    # 可以禁用
    policy_disabled = TraceabilityPolicy(enabled=False)
    assert policy_disabled.enabled is False

    # 通过 HealthConfig 访问
    cfg = HealthConfig()
    assert cfg.traceability.enabled is True


# =============================================================================
# Requirement Status 行为测试（风险 1 修复验证）
# =============================================================================


def test_deprecated_requirement_not_counted_as_orphan() -> None:
    """
    deprecated 状态的 REQ 不应计入 orphan_requirements。

    业务场景：已废弃的需求即使没有 Rule 引用，也不应报警。
    """
    from ..requirement_traceability import check_traceability
    from ..requirement_models import Requirement, RequirementStatus
    from ..models import RiskLevel

    # 构造一个 deprecated 状态的 REQ
    deprecated_req = Requirement(
        id="REQ-OLD-001",
        title="已废弃的需求",
        risk_level=RiskLevel.LOW,
        status=RequirementStatus.DEPRECATED,
    )
    requirements = {deprecated_req.id: deprecated_req}

    # 没有任何 Rule 引用它
    result = check_traceability(requirements=requirements, rules=[])

    # 行为验证：deprecated REQ 不应出现在 orphan_requirements
    assert "REQ-OLD-001" not in result.orphan_requirements
    assert result.orphan_count == 0
    assert result.has_issues is False


def test_active_requirement_counted_as_orphan_when_not_referenced() -> None:
    """
    active 状态的 REQ 如果没有 Rule 引用，应计入 orphan_requirements。

    对比测试：确保 status 过滤逻辑正确。
    """
    from ..requirement_traceability import check_traceability
    from ..requirement_models import Requirement, RequirementStatus
    from ..models import RiskLevel

    # 构造一个 active 状态的 REQ
    active_req = Requirement(
        id="REQ-NEW-001",
        title="新需求",
        risk_level=RiskLevel.HIGH,
        status=RequirementStatus.ACTIVE,
    )
    requirements = {active_req.id: active_req}

    # 没有任何 Rule 引用它
    result = check_traceability(requirements=requirements, rules=[])

    # 行为验证：active REQ 应出现在 orphan_requirements
    assert "REQ-NEW-001" in result.orphan_requirements
    assert result.orphan_count == 1
    assert result.has_issues is True


def test_mixed_status_requirements_only_active_counted_as_orphan() -> None:
    """
    混合状态场景：只有 active 状态的未引用 REQ 计入 orphan。
    """
    from ..requirement_traceability import check_traceability
    from ..requirement_models import Requirement, RequirementStatus
    from ..models import RiskLevel

    # 构造两个 REQ：一个 active，一个 deprecated
    active_req = Requirement(
        id="REQ-ACT-001",
        title="活跃需求",
        risk_level=RiskLevel.HIGH,
        status=RequirementStatus.ACTIVE,
    )
    deprecated_req = Requirement(
        id="REQ-DEP-001",
        title="废弃需求",
        risk_level=RiskLevel.LOW,
        status=RequirementStatus.DEPRECATED,
    )
    requirements = {
        active_req.id: active_req,
        deprecated_req.id: deprecated_req,
    }

    # 没有任何 Rule 引用它们
    result = check_traceability(requirements=requirements, rules=[])

    # 行为验证：只有 active REQ 计入 orphan
    assert result.orphan_requirements == ["REQ-ACT-001"]
    assert result.orphan_count == 1


def test_requirement_status_default_is_active() -> None:
    """Requirement.status 默认值为 active"""
    from ..requirement_models import Requirement, RequirementStatus
    from ..models import RiskLevel

    req = Requirement(
        id="REQ-NET-001",
        title="网络需求",
        risk_level=RiskLevel.HIGH,
        # 不指定 status
    )

    assert req.status == RequirementStatus.ACTIVE


def test_dangling_ref_does_not_raise_by_default() -> None:
    """
    悬空引用不应抛出异常，只记录到 dangling_rule_refs。

    验证风险 2 的默认容错行为。
    """
    from ..requirement_traceability import check_traceability
    from ..models import Rule, RuleCategory

    # 构造一个引用不存在 REQ 的 Rule
    rule_with_dangling = Rule(
        id="RULE-001",
        category=RuleCategory.SECURITY,
        description="Rule with dangling reference",
        human_description="悬空引用规则",
        severity="mandatory",
        requirement_ids=["REQ-NOT-EXIST"],
    )

    # 不应抛异常
    result = check_traceability(requirements={}, rules=[rule_with_dangling])

    # 行为验证：悬空引用被记录
    assert result.dangling_rule_refs == {"RULE-001": ["REQ-NOT-EXIST"]}
    assert result.dangling_count == 1
    assert result.has_issues is True
