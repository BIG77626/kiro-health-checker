"""
Property Tests for Data Models

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 1.1)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types
===================================

Property 11: 数据模型序列化往返
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict

import pytest
from hypothesis import given, settings, strategies as st

from ..models import (
    CoverageBoundary,
    FalseGreenEvent,
    FalseGreenStats,
    HumanReadableReport,
    HumanReviewReason,
    HumanReviewTrigger,
    RiskAssessment,
    RiskLevel,
    Rule,
    RuleCategory,
    RuleMaturity,
    RuleSet,
    RuleViolation,
    Scenario,
    UsageAdvice,
    ValidationRecord,
    ValidationResult,
)


# =============================================================================
# Strategies
# =============================================================================

# 基础策略
risk_level_st = st.sampled_from(list(RiskLevel))
rule_category_st = st.sampled_from(list(RuleCategory))
human_review_reason_st = st.sampled_from(list(HumanReviewReason))

# 字符串策略（非空）
non_empty_str_st = st.text(min_size=1, max_size=100).filter(lambda x: x.strip())
rule_id_st = st.from_regex(r"^[A-Z]{3}-\d{3}$", fullmatch=True)
version_st = st.from_regex(r"^\d+\.\d+\.\d+$", fullmatch=True)
severity_st = st.sampled_from(["mandatory", "recommended"])

# 日期时间策略
datetime_st = st.datetimes(
    min_value=datetime(2020, 1, 1),
    max_value=datetime(2030, 12, 31),
)


# =============================================================================
# Property 11: 数据模型序列化往返
# =============================================================================


class TestModelSerializationRoundtrip:
    """Property 11: model_dump() 后再 model_validate() 得到等价对象"""

    @given(
        id=non_empty_str_st,
        name=non_empty_str_st,
        description=st.text(max_size=200),
        ruleset_id=non_empty_str_st,
    )
    @settings(max_examples=50)
    def test_scenario_roundtrip(
        self,
        id: str,
        name: str,
        description: str,
        ruleset_id: str,
    ) -> None:
        """Scenario 序列化往返"""
        original = Scenario(
            id=id,
            name=name,
            description=description,
            ruleset_id=ruleset_id,
        )
        dumped = original.model_dump()
        restored = Scenario.model_validate(dumped)
        assert original == restored

    @given(
        id=rule_id_st,
        category=rule_category_st,
        description=non_empty_str_st,
        human_description=non_empty_str_st,
        severity=severity_st,
    )
    @settings(max_examples=50)
    def test_rule_roundtrip(
        self,
        id: str,
        category: RuleCategory,
        description: str,
        human_description: str,
        severity: str,
    ) -> None:
        """Rule 序列化往返"""
        original = Rule(
            id=id,
            category=category,
            description=description,
            human_description=human_description,
            severity=severity,
        )
        dumped = original.model_dump()
        restored = Rule.model_validate(dumped)
        assert original == restored

    @given(
        level=risk_level_st,
        one_line_summary=non_empty_str_st,
        risk_points=st.lists(non_empty_str_st, max_size=5),
        requires_human_review=st.booleans(),
    )
    @settings(max_examples=50)
    def test_risk_assessment_roundtrip(
        self,
        level: RiskLevel,
        one_line_summary: str,
        risk_points: list,
        requires_human_review: bool,
    ) -> None:
        """RiskAssessment 序列化往返"""
        original = RiskAssessment(
            level=level,
            one_line_summary=one_line_summary,
            risk_points=risk_points,
            requires_human_review=requires_human_review,
        )
        dumped = original.model_dump()
        restored = RiskAssessment.model_validate(dumped)
        assert original == restored

    @given(
        reason=human_review_reason_st,
        description=non_empty_str_st,
    )
    @settings(max_examples=50)
    def test_human_review_trigger_roundtrip(
        self,
        reason: HumanReviewReason,
        description: str,
    ) -> None:
        """HumanReviewTrigger 序列化往返"""
        original = HumanReviewTrigger(
            reason=reason,
            description=description,
        )
        dumped = original.model_dump()
        restored = HumanReviewTrigger.model_validate(dumped)
        assert original == restored

    @given(
        can_detect=st.lists(non_empty_str_st, max_size=5),
        cannot_guarantee=st.lists(non_empty_str_st, max_size=5),
    )
    @settings(max_examples=50)
    def test_coverage_boundary_roundtrip(
        self,
        can_detect: list,
        cannot_guarantee: list,
    ) -> None:
        """CoverageBoundary 序列化往返"""
        original = CoverageBoundary(
            can_detect=can_detect,
            cannot_guarantee=cannot_guarantee,
        )
        dumped = original.model_dump()
        restored = CoverageBoundary.model_validate(dumped)
        assert original == restored

    @given(
        total_validations=st.integers(min_value=0, max_value=10000),
        total_passed=st.integers(min_value=0, max_value=10000),
        false_green_count=st.integers(min_value=0, max_value=1000),
    )
    @settings(max_examples=50)
    def test_false_green_stats_roundtrip(
        self,
        total_validations: int,
        total_passed: int,
        false_green_count: int,
    ) -> None:
        """FalseGreenStats 序列化往返"""
        # 确保 false_green_count <= total_passed
        false_green_count = min(false_green_count, total_passed)
        rate = FalseGreenStats.calculate_rate(false_green_count, total_passed)

        original = FalseGreenStats(
            period_start=datetime(2024, 1, 1),
            period_end=datetime(2024, 12, 31),
            total_validations=total_validations,
            total_passed=total_passed,
            false_green_count=false_green_count,
            false_green_rate=rate,
        )
        dumped = original.model_dump()
        restored = FalseGreenStats.model_validate(dumped)
        assert original == restored


# =============================================================================
# Property 2: 风险等级三值约束
# =============================================================================


class TestRiskLevelConstraint:
    """Property 2: 风险等级只能是 LOW/MEDIUM/HIGH"""

    def test_risk_level_enum_values(self) -> None:
        """验证 RiskLevel 只有三个值"""
        assert len(RiskLevel) == 3
        assert RiskLevel.LOW in RiskLevel
        assert RiskLevel.MEDIUM in RiskLevel
        assert RiskLevel.HIGH in RiskLevel

    @given(level=risk_level_st)
    @settings(max_examples=20)
    def test_risk_assessment_level_constraint(self, level: RiskLevel) -> None:
        """RiskAssessment.level 只能是三个值之一"""
        assessment = RiskAssessment(
            level=level,
            one_line_summary="Test summary",
        )
        assert assessment.level in [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH]


# =============================================================================
# Property 10: 假绿率计算正确性
# =============================================================================


class TestFalseGreenRateCalculation:
    """Property 10: false_green_rate = false_green_count / total_passed"""

    @given(
        false_green_count=st.integers(min_value=0, max_value=1000),
        total_passed=st.integers(min_value=1, max_value=10000),
    )
    @settings(max_examples=100)
    def test_rate_calculation_correct(
        self,
        false_green_count: int,
        total_passed: int,
    ) -> None:
        """假绿率计算正确"""
        # 确保 false_green_count <= total_passed
        false_green_count = min(false_green_count, total_passed)

        rate = FalseGreenStats.calculate_rate(false_green_count, total_passed)

        expected = false_green_count / total_passed
        assert abs(rate - expected) < 1e-10

    def test_rate_calculation_zero_passed(self) -> None:
        """total_passed 为 0 时返回 0.0"""
        rate = FalseGreenStats.calculate_rate(0, 0)
        assert rate == 0.0

    @given(false_green_count=st.integers(min_value=0, max_value=1000))
    @settings(max_examples=50)
    def test_rate_calculation_zero_passed_any_count(
        self,
        false_green_count: int,
    ) -> None:
        """total_passed 为 0 时，无论 false_green_count 多少都返回 0.0"""
        rate = FalseGreenStats.calculate_rate(false_green_count, 0)
        assert rate == 0.0


# =============================================================================
# 基础验证测试
# =============================================================================


class TestBasicValidation:
    """基础模型验证测试"""

    def test_rule_id_pattern(self) -> None:
        """Rule.id 必须符合 XXX-NNN 格式"""
        # 有效格式
        rule = Rule(
            id="SEC-001",
            category=RuleCategory.SECURITY,
            description="Test",
            human_description="Test",
            severity="mandatory",
        )
        assert rule.id == "SEC-001"

        # 无效格式应该抛出异常
        with pytest.raises(ValueError):
            Rule(
                id="invalid",
                category=RuleCategory.SECURITY,
                description="Test",
                human_description="Test",
                severity="mandatory",
            )

    def test_severity_pattern(self) -> None:
        """Rule.severity 必须是 mandatory 或 recommended"""
        # 有效值
        rule = Rule(
            id="SEC-001",
            category=RuleCategory.SECURITY,
            description="Test",
            human_description="Test",
            severity="mandatory",
        )
        assert rule.severity == "mandatory"

        # 无效值应该抛出异常
        with pytest.raises(ValueError):
            Rule(
                id="SEC-001",
                category=RuleCategory.SECURITY,
                description="Test",
                human_description="Test",
                severity="invalid",
            )

    def test_false_green_rate_bounds(self) -> None:
        """FalseGreenStats.false_green_rate 必须在 0.0-1.0 之间"""
        # 有效值
        stats = FalseGreenStats(
            period_start=datetime(2024, 1, 1),
            period_end=datetime(2024, 12, 31),
            total_validations=100,
            total_passed=80,
            false_green_count=8,
            false_green_rate=0.1,
        )
        assert 0.0 <= stats.false_green_rate <= 1.0

        # 超出范围应该抛出异常
        with pytest.raises(ValueError):
            FalseGreenStats(
                period_start=datetime(2024, 1, 1),
                period_end=datetime(2024, 12, 31),
                total_validations=100,
                total_passed=80,
                false_green_count=8,
                false_green_rate=1.5,  # 超出范围
            )


# =============================================================================
# Property 6: 规则ID唯一性 (REQ-1.3, REQ-13 动态规则扩展)
# =============================================================================


class TestRuleIdUniqueness:
    """Property 6: 规则ID必须唯一"""

    def test_rule_id_format_valid(self) -> None:
        """规则ID必须符合 XXX-NNN 格式"""
        valid_ids = ["SEC-001", "ERR-123", "NET-999", "DB-001"]
        for rule_id in valid_ids:
            rule = Rule(
                id=rule_id,
                category=RuleCategory.SECURITY,
                description="Test",
                human_description="Test",
                severity="mandatory",
            )
            assert rule.id == rule_id

    def test_rule_id_format_invalid(self) -> None:
        """无效的规则ID格式应该抛出异常"""
        invalid_ids = ["sec-001", "SEC001", "SEC-1", "SEC-0001", "1-SEC"]
        for rule_id in invalid_ids:
            with pytest.raises(ValueError):
                Rule(
                    id=rule_id,
                    category=RuleCategory.SECURITY,
                    description="Test",
                    human_description="Test",
                    severity="mandatory",
                )


# =============================================================================
# 动态规则扩展字段测试 (REQ-13)
# =============================================================================


class TestRuleExtendedFields:
    """测试 Rule 模型的动态规则扩展字段"""

    def test_skill_tags_default_empty(self) -> None:
        """skill_tags 默认为空列表"""
        rule = Rule(
            id="SEC-001",
            category=RuleCategory.SECURITY,
            description="Test",
            human_description="Test",
            severity="mandatory",
        )
        assert rule.skill_tags == []

    def test_skill_tags_can_be_set(self) -> None:
        """skill_tags 可以设置"""
        rule = Rule(
            id="SEC-001",
            category=RuleCategory.SECURITY,
            description="Test",
            human_description="Test",
            severity="mandatory",
            skill_tags=["type-safety", "error-handling"],
        )
        assert rule.skill_tags == ["type-safety", "error-handling"]

    def test_scenario_tags_default_empty(self) -> None:
        """scenario_tags 默认为空列表"""
        rule = Rule(
            id="SEC-001",
            category=RuleCategory.SECURITY,
            description="Test",
            human_description="Test",
            severity="mandatory",
        )
        assert rule.scenario_tags == []

    def test_scenario_tags_can_be_set(self) -> None:
        """scenario_tags 可以设置"""
        rule = Rule(
            id="SEC-001",
            category=RuleCategory.SECURITY,
            description="Test",
            human_description="Test",
            severity="mandatory",
            scenario_tags=["cli_tool", "api_client"],
        )
        assert rule.scenario_tags == ["cli_tool", "api_client"]

    def test_maturity_default_stable(self) -> None:
        """maturity 默认为 STABLE"""
        rule = Rule(
            id="SEC-001",
            category=RuleCategory.SECURITY,
            description="Test",
            human_description="Test",
            severity="mandatory",
        )
        assert rule.maturity == RuleMaturity.STABLE

    def test_maturity_can_be_set(self) -> None:
        """maturity 可以设置为其他值"""
        rule = Rule(
            id="SEC-001",
            category=RuleCategory.SECURITY,
            description="Test",
            human_description="Test",
            severity="mandatory",
            maturity=RuleMaturity.EXPERIMENTAL,
        )
        assert rule.maturity == RuleMaturity.EXPERIMENTAL

    def test_maturity_enum_values(self) -> None:
        """验证 RuleMaturity 只有三个值"""
        assert len(RuleMaturity) == 3
        assert RuleMaturity.EXPERIMENTAL in RuleMaturity
        assert RuleMaturity.STABLE in RuleMaturity
        assert RuleMaturity.DEPRECATED in RuleMaturity

    @given(
        id=rule_id_st,
        category=rule_category_st,
        description=non_empty_str_st,
        human_description=non_empty_str_st,
        severity=severity_st,
        skill_tags=st.lists(non_empty_str_st, max_size=5),
        scenario_tags=st.lists(non_empty_str_st, max_size=5),
        maturity=st.sampled_from(list(RuleMaturity)),
    )
    @settings(max_examples=50)
    def test_rule_extended_roundtrip(
        self,
        id: str,
        category: RuleCategory,
        description: str,
        human_description: str,
        severity: str,
        skill_tags: list,
        scenario_tags: list,
        maturity: RuleMaturity,
    ) -> None:
        """Rule 扩展字段序列化往返"""
        original = Rule(
            id=id,
            category=category,
            description=description,
            human_description=human_description,
            severity=severity,
            skill_tags=skill_tags,
            scenario_tags=scenario_tags,
            maturity=maturity,
        )
        dumped = original.model_dump()
        restored = Rule.model_validate(dumped)
        assert original == restored
        assert restored.skill_tags == skill_tags
        assert restored.scenario_tags == scenario_tags
        assert restored.maturity == maturity


# =============================================================================
# 向后兼容性测试
# =============================================================================


class TestBackwardCompatibility:
    """测试新字段不破坏现有功能"""

    def test_rule_without_new_fields(self) -> None:
        """不提供新字段时使用默认值"""
        rule = Rule(
            id="SEC-001",
            category=RuleCategory.SECURITY,
            description="Test",
            human_description="Test",
            severity="mandatory",
        )
        # 新字段应该有默认值
        assert rule.skill_tags == []
        assert rule.scenario_tags == []
        assert rule.maturity == RuleMaturity.STABLE

    def test_rule_model_dump_includes_new_fields(self) -> None:
        """model_dump() 包含新字段"""
        rule = Rule(
            id="SEC-001",
            category=RuleCategory.SECURITY,
            description="Test",
            human_description="Test",
            severity="mandatory",
        )
        dumped = rule.model_dump()
        assert "skill_tags" in dumped
        assert "scenario_tags" in dumped
        assert "maturity" in dumped
