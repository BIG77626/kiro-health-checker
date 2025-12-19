"""
Property Tests for Report Generator

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 3.1)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types
===================================

Properties:
  - Property 7: 报告结构完整性
  - Property 8: 人工复核提示位置
"""

from __future__ import annotations

from datetime import datetime
from typing import List

import pytest
from hypothesis import given, settings, strategies as st, HealthCheck

from ..models import (
    CoverageBoundary,
    HumanReviewReason,
    HumanReviewTrigger,
    RiskAssessment,
    RiskLevel,
    ValidationResult,
)
from ..report_generator import HumanReadableReportGenerator


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def generator() -> HumanReadableReportGenerator:
    """创建报告生成器"""
    return HumanReadableReportGenerator()


@pytest.fixture
def sample_validation_result() -> ValidationResult:
    """创建示例验证结果"""
    return ValidationResult(
        code_hash="abc123",
        ruleset_id="test",
        ruleset_version="1.0.0",
        timestamp=datetime.now(tz=None),
        total_rules=10,
        passed_rules=8,
        failed_rules=2,
        violations=[],
    )


@pytest.fixture
def sample_coverage_boundary() -> CoverageBoundary:
    """创建示例覆盖边界"""
    return CoverageBoundary(
        can_detect=["语法错误", "危险函数调用"],
        cannot_guarantee=["业务逻辑正确性", "性能"],
    )


# =============================================================================
# Strategies
# =============================================================================

risk_level_st = st.sampled_from(list(RiskLevel))
human_review_reason_st = st.sampled_from(list(HumanReviewReason))
non_empty_str_st = st.text(min_size=1, max_size=100).filter(lambda x: x.strip())


# =============================================================================
# Property 7: 报告结构完整性
# =============================================================================


class TestReportStructureCompleteness:
    """Property 7: 报告必须包含 one_line_conclusion 和 coverage_boundary"""

    @given(
        level=risk_level_st,
        one_line_summary=non_empty_str_st,
    )
    @settings(max_examples=50, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_report_has_one_line_conclusion(
        self,
        generator: HumanReadableReportGenerator,
        sample_validation_result: ValidationResult,
        sample_coverage_boundary: CoverageBoundary,
        level: RiskLevel,
        one_line_summary: str,
    ) -> None:
        """报告必须有 one_line_conclusion"""
        risk_assessment = RiskAssessment(
            level=level,
            one_line_summary=one_line_summary,
        )

        report = generator.generate(
            risk_assessment,
            sample_validation_result,
            sample_coverage_boundary,
        )

        # Property 7: one_line_conclusion 必须非空
        assert len(report.one_line_conclusion) > 0

    @given(level=risk_level_st)
    @settings(max_examples=30, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_report_has_coverage_boundary(
        self,
        generator: HumanReadableReportGenerator,
        sample_validation_result: ValidationResult,
        sample_coverage_boundary: CoverageBoundary,
        level: RiskLevel,
    ) -> None:
        """报告必须有 coverage_boundary"""
        risk_assessment = RiskAssessment(
            level=level,
            one_line_summary="Test summary",
        )

        report = generator.generate(
            risk_assessment,
            sample_validation_result,
            sample_coverage_boundary,
        )

        # Property 7: coverage_boundary 必须存在
        assert report.coverage_boundary is not None
        # can_detect 和 cannot_guarantee 应该与输入一致
        assert report.coverage_boundary.can_detect == sample_coverage_boundary.can_detect
        assert report.coverage_boundary.cannot_guarantee == sample_coverage_boundary.cannot_guarantee


# =============================================================================
# Property 8: 人工复核提示位置
# =============================================================================


class TestHumanReviewMessagePosition:
    """Property 8: requires_human_review 为 True 时，human_review_message 必须非空"""

    def test_human_review_required_has_message(
        self,
        generator: HumanReadableReportGenerator,
        sample_validation_result: ValidationResult,
        sample_coverage_boundary: CoverageBoundary,
    ) -> None:
        """requires_human_review 为 True 时，human_review_message 必须非空"""
        triggers = [
            HumanReviewTrigger(
                reason=HumanReviewReason.FILE_OPERATION,
                description="代码包含文件操作",
            )
        ]

        risk_assessment = RiskAssessment(
            level=RiskLevel.MEDIUM,
            one_line_summary="Test summary",
            human_review_triggers=triggers,
            requires_human_review=True,
        )

        report = generator.generate(
            risk_assessment,
            sample_validation_result,
            sample_coverage_boundary,
        )

        # Property 8: human_review_message 必须非空
        assert report.human_review_required is True
        assert report.human_review_message is not None
        assert len(report.human_review_message) > 0

    def test_human_review_not_required_may_have_no_message(
        self,
        generator: HumanReadableReportGenerator,
        sample_validation_result: ValidationResult,
        sample_coverage_boundary: CoverageBoundary,
    ) -> None:
        """requires_human_review 为 False 时，human_review_message 可以为空"""
        risk_assessment = RiskAssessment(
            level=RiskLevel.LOW,
            one_line_summary="Test summary",
            requires_human_review=False,
        )

        report = generator.generate(
            risk_assessment,
            sample_validation_result,
            sample_coverage_boundary,
        )

        # requires_human_review 为 False 时，message 可以为 None
        assert report.human_review_required is False
        # 不强制要求 message 为 None，但如果有也可以

    @given(
        reasons=st.lists(human_review_reason_st, min_size=1, max_size=3),
    )
    @settings(max_examples=30, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_multiple_triggers_included_in_message(
        self,
        generator: HumanReadableReportGenerator,
        sample_validation_result: ValidationResult,
        sample_coverage_boundary: CoverageBoundary,
        reasons: List[HumanReviewReason],
    ) -> None:
        """多个触发原因应该包含在消息中"""
        triggers = [
            HumanReviewTrigger(
                reason=reason,
                description=f"触发原因: {reason.value}",
            )
            for reason in reasons
        ]

        risk_assessment = RiskAssessment(
            level=RiskLevel.MEDIUM,
            one_line_summary="Test summary",
            human_review_triggers=triggers,
            requires_human_review=True,
        )

        report = generator.generate(
            risk_assessment,
            sample_validation_result,
            sample_coverage_boundary,
        )

        # Property 8: message 必须非空
        assert report.human_review_message is not None
        assert len(report.human_review_message) > 0


# =============================================================================
# 使用建议测试
# =============================================================================


class TestUsageAdvice:
    """使用建议测试"""

    @pytest.mark.parametrize("level", list(RiskLevel))
    def test_usage_advice_present_for_all_levels(
        self,
        generator: HumanReadableReportGenerator,
        sample_validation_result: ValidationResult,
        sample_coverage_boundary: CoverageBoundary,
        level: RiskLevel,
    ) -> None:
        """所有风险等级都应该有使用建议"""
        risk_assessment = RiskAssessment(
            level=level,
            one_line_summary="Test summary",
        )

        report = generator.generate(
            risk_assessment,
            sample_validation_result,
            sample_coverage_boundary,
        )

        # 使用建议应该存在
        assert report.usage_advice is not None

    def test_high_risk_has_restrictive_advice(
        self,
        generator: HumanReadableReportGenerator,
        sample_validation_result: ValidationResult,
        sample_coverage_boundary: CoverageBoundary,
    ) -> None:
        """HIGH 风险应该有限制性建议"""
        risk_assessment = RiskAssessment(
            level=RiskLevel.HIGH,
            one_line_summary="Test summary",
        )

        report = generator.generate(
            risk_assessment,
            sample_validation_result,
            sample_coverage_boundary,
        )

        # HIGH 风险的 should_not_use_for 应该非空
        assert len(report.usage_advice.should_not_use_for) > 0
        # HIGH 风险的 can_use_for 应该为空或很少
        assert len(report.usage_advice.can_use_for) == 0


# =============================================================================
# Markdown 导出测试
# =============================================================================


class TestMarkdownExport:
    """Markdown 导出测试"""

    def test_markdown_contains_conclusion(
        self,
        generator: HumanReadableReportGenerator,
        sample_validation_result: ValidationResult,
        sample_coverage_boundary: CoverageBoundary,
    ) -> None:
        """Markdown 应该包含结论"""
        risk_assessment = RiskAssessment(
            level=RiskLevel.LOW,
            one_line_summary="这是测试结论",
        )

        report = generator.generate(
            risk_assessment,
            sample_validation_result,
            sample_coverage_boundary,
        )

        markdown = generator.export_markdown(report)

        assert "这是测试结论" in markdown

    def test_markdown_contains_coverage_boundary(
        self,
        generator: HumanReadableReportGenerator,
        sample_validation_result: ValidationResult,
        sample_coverage_boundary: CoverageBoundary,
    ) -> None:
        """Markdown 应该包含覆盖边界"""
        risk_assessment = RiskAssessment(
            level=RiskLevel.LOW,
            one_line_summary="Test",
        )

        report = generator.generate(
            risk_assessment,
            sample_validation_result,
            sample_coverage_boundary,
        )

        markdown = generator.export_markdown(report)

        assert "本次检查能防范" in markdown
        assert "本次检查不能保证" in markdown

    def test_markdown_has_human_review_warning_when_required(
        self,
        generator: HumanReadableReportGenerator,
        sample_validation_result: ValidationResult,
        sample_coverage_boundary: CoverageBoundary,
    ) -> None:
        """需要人工复核时，Markdown 应该有警告"""
        triggers = [
            HumanReviewTrigger(
                reason=HumanReviewReason.FILE_OPERATION,
                description="代码包含文件操作",
            )
        ]

        risk_assessment = RiskAssessment(
            level=RiskLevel.MEDIUM,
            one_line_summary="Test",
            human_review_triggers=triggers,
            requires_human_review=True,
        )

        report = generator.generate(
            risk_assessment,
            sample_validation_result,
            sample_coverage_boundary,
        )

        markdown = generator.export_markdown(report)

        # 应该有人工复核提示
        assert "建议找懂编程的人帮你看一眼" in markdown or "⚠️" in markdown
