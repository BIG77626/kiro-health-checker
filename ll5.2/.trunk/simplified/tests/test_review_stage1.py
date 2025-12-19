from __future__ import annotations

"""
Stage 1 Review Verification - 范围 & 映射基础检查（行为级）

目的：
- 确认阶段一锁定的审查范围文件真实存在
- 核心映射条目通过「行为」验证，而非检查内部 API

设计原则：
- 不检查 Pydantic 内部 API（如 model_fields）
- 通过构造实例、访问字段、验证默认值来验证行为
- 测试的是「契约」而非「实现细节」
"""

from pathlib import Path

import pytest


def test_review_scope_files_exist() -> None:
    """阶段一：审查范围文件存在性."""

    scope_files = [
        ".kiro/specs/requirement-coverage-tracking/requirements.md",
        ".kiro/specs/requirement-coverage-tracking/design.md",
        ".kiro/specs/requirement-coverage-tracking/tasks.md",
        ".trunk/simplified/requirement_models.py",
        ".trunk/simplified/health_check.py",
        ".trunk/simplified/health_config_models.py",
        ".trunk/simplified/health_config.yml",
        ".trunk/simplified/models.py",
        ".trunk/simplified/THIS_FILE_DOES_NOT_EXIST.py",  # 故意破坏：验证 CI 阻塞
    ]

    for path in scope_files:
        assert Path(path).exists(), f"审查范围文件缺失: {path}"


def test_rule_requirement_ids_field_behavior() -> None:
    """
    Task 6.1 行为验证：Rule.requirement_ids 字段可访问且默认为空列表。
    
    验证方式：构造 Rule 实例，检查字段行为，而非检查 model_fields。
    """
    from ..models import Rule, RuleCategory

    # 构造一个最小有效 Rule（不提供 requirement_ids）
    rule = Rule(
        id="TEST-001",
        category=RuleCategory.SECURITY,
        description="Test rule for review verification",
        human_description="测试规则",
        severity="mandatory",
    )

    # 行为验证：字段可访问
    assert hasattr(rule, "requirement_ids"), "Rule 缺少 requirement_ids 属性"

    # 行为验证：默认值为空列表
    assert rule.requirement_ids == [], (
        f"Rule.requirement_ids 默认值应为空列表，实际为 {rule.requirement_ids}"
    )

    # 行为验证：可以设置值
    rule_with_reqs = Rule(
        id="TEST-002",
        category=RuleCategory.SECURITY,
        description="Test rule with requirements",
        human_description="带需求的测试规则",
        severity="mandatory",
        requirement_ids=["REQ-NET-001", "REQ-SEC-001"],
    )
    assert rule_with_reqs.requirement_ids == ["REQ-NET-001", "REQ-SEC-001"]


def test_requirement_coverage_result_field_behavior() -> None:
    """
    Task 8.1 行为验证：RequirementCoverageResult 字段可访问且有正确默认值。
    
    验证方式：构造实例，检查字段行为，而非检查 model_fields。
    """
    from ..requirement_coverage import RequirementCoverageResult

    # 构造默认实例
    result = RequirementCoverageResult()

    # 行为验证：核心字段可访问且有正确默认值
    assert hasattr(result, "coverage_percentage"), (
        "RequirementCoverageResult 缺少 coverage_percentage 属性"
    )
    assert result.coverage_percentage == 0.0, (
        f"coverage_percentage 默认值应为 0.0，实际为 {result.coverage_percentage}"
    )

    assert hasattr(result, "total_requirements"), (
        "RequirementCoverageResult 缺少 total_requirements 属性"
    )
    assert result.total_requirements == 0

    assert hasattr(result, "requirements_with_rules"), (
        "RequirementCoverageResult 缺少 requirements_with_rules 属性"
    )
    assert result.requirements_with_rules == 0

    assert hasattr(result, "requirements_with_samples"), (
        "RequirementCoverageResult 缺少 requirements_with_samples 属性"
    )
    assert result.requirements_with_samples == 0

    # 行为验证：可以设置值
    result_with_data = RequirementCoverageResult(
        total_requirements=10,
        requirements_with_rules=8,
        requirements_with_samples=5,
        coverage_percentage=50.0,
    )
    assert result_with_data.coverage_percentage == 50.0
    assert result_with_data.total_requirements == 10


def test_requirement_model_field_behavior() -> None:
    """
    Task 3.1 行为验证：Requirement 模型字段可访问且有正确默认值。
    
    验证方式：构造实例，检查字段行为。
    """
    from ..models import RiskLevel
    from ..requirement_models import Requirement

    # 构造最小有效 Requirement
    req = Requirement(
        id="REQ-NET-001",
        title="测试需求",
    )

    # 行为验证：必填字段可访问
    assert req.id == "REQ-NET-001"
    assert req.title == "测试需求"

    # 行为验证：默认值正确
    assert req.risk_level == RiskLevel.MEDIUM, (
        f"risk_level 默认值应为 MEDIUM，实际为 {req.risk_level}"
    )
    assert req.covered_by_rules == [], (
        f"covered_by_rules 默认值应为空列表，实际为 {req.covered_by_rules}"
    )
    assert req.description == ""
    assert req.tags == []
    assert req.min_positive_samples == 3
    assert req.min_negative_samples == 3


def test_requirement_id_format_validation() -> None:
    """
    Task 3.1 行为验证：Requirement.id 格式校验生效。
    
    验证方式：构造无效 ID，期望抛出 ValidationError。
    """
    from pydantic import ValidationError

    from ..requirement_models import Requirement

    # 无效格式应该被拒绝
    invalid_ids = [
        "NET-001",       # 缺少 REQ- 前缀
        "REQ-N-001",     # DOMAIN 太短（需要 2-4 字符）
        "REQ-NETWORK-001",  # DOMAIN 太长（超过 4 字符）
        "REQ-NET-01",    # 数字不足 3 位
        "REQ-net-001",   # 小写 DOMAIN
        "req-NET-001",   # 小写 REQ
    ]

    for invalid_id in invalid_ids:
        with pytest.raises(ValidationError):
            Requirement(id=invalid_id, title="测试")
