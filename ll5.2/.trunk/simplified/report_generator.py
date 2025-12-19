"""
Human Readable Report Generator - 人话报告生成器

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 3.1)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: Uses HumanReadableReport, CoverageBoundary, UsageAdvice from models.py

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit `is None` checks
===================================

Requirements: REQ-7.1, REQ-7.2, REQ-7.3, REQ-7.4, REQ-4.1
Properties:
  - Property 7: 报告结构完整性
  - Property 8: 人工复核提示位置
"""

from __future__ import annotations

import logging
from typing import List, Optional, Protocol

from .models import (
    CoverageBoundary,
    HumanReadableReport,
    HumanReviewTrigger,
    RiskAssessment,
    RiskLevel,
    UsageAdvice,
    ValidationResult,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Constants
# =============================================================================

# 风险等级对应的一句话结论模板 (REQ-7.1)
RISK_LEVEL_CONCLUSIONS = {
    RiskLevel.LOW: "这段代码可以试着用，但不保证业务完全正确",
    RiskLevel.MEDIUM: "这段代码存在一些风险，建议修复后再使用",
    RiskLevel.HIGH: "这段代码风险较高，强烈不建议直接运行",
}

# 人工复核提示模板 (REQ-5.5)
HUMAN_REVIEW_MESSAGE_TEMPLATE = (
    "⚠️ 建议找懂编程的人帮你看一眼：{reasons}"
)


# =============================================================================
# Protocol
# =============================================================================


class HumanReadableReportGeneratorProtocol(Protocol):
    """人话报告生成器接口"""

    def generate(
        self,
        risk_assessment: RiskAssessment,
        validation_result: ValidationResult,
        coverage_boundary: CoverageBoundary,
    ) -> HumanReadableReport:
        """生成人话报告"""
        ...


# =============================================================================
# Implementation
# =============================================================================


class HumanReadableReportGenerator:
    """
    人话报告生成器实现

    生成非程序员能看懂的验证报告，像"判决书摘要"。

    Properties:
    - Property 7: 报告必须包含 one_line_conclusion 和 coverage_boundary
    - Property 8: requires_human_review 为 True 时，human_review_message 必须非空
    """

    def generate(
        self,
        risk_assessment: RiskAssessment,
        validation_result: ValidationResult,
        coverage_boundary: CoverageBoundary,
    ) -> HumanReadableReport:
        """
        生成人话报告 (REQ-7)

        Property 7: 报告结构完整性
        Property 8: 人工复核提示位置

        Args:
            risk_assessment: 风险评估结果
            validation_result: 验证结果
            coverage_boundary: 覆盖边界

        Returns:
            HumanReadableReport: 人话报告
        """
        # 生成一句话结论 (REQ-7.1)
        one_line_conclusion = self._generate_conclusion(risk_assessment)

        # 生成人工复核提示 (REQ-5.5, Property 8)
        human_review_message: Optional[str] = None
        if risk_assessment.requires_human_review:
            human_review_message = self._generate_human_review_message(
                risk_assessment.human_review_triggers
            )

        # 生成使用建议 (REQ-7.3)
        usage_advice = self._generate_usage_advice(risk_assessment)

        # Property 7: 确保报告结构完整
        return HumanReadableReport(
            risk_level=risk_assessment.level,
            one_line_conclusion=one_line_conclusion,
            human_review_required=risk_assessment.requires_human_review,
            human_review_message=human_review_message,
            coverage_boundary=coverage_boundary,
            usage_advice=usage_advice,
            technical_details=validation_result,
        )

    def _generate_conclusion(self, risk_assessment: RiskAssessment) -> str:
        """
        生成一句话结论 (REQ-7.1)

        Args:
            risk_assessment: 风险评估结果

        Returns:
            str: 一句话结论
        """
        # 优先使用风险评估中的结论
        if risk_assessment.one_line_summary:
            return risk_assessment.one_line_summary

        # 使用模板
        return RISK_LEVEL_CONCLUSIONS.get(
            risk_assessment.level,
            "风险等级未知，建议谨慎使用"
        )

    def _generate_human_review_message(
        self,
        triggers: List[HumanReviewTrigger],
    ) -> str:
        """
        生成人工复核提示 (REQ-5.5)

        Property 8: 当 requires_human_review 为 True 时，此消息必须非空

        Args:
            triggers: 人工复核触发列表

        Returns:
            str: 人工复核提示信息
        """
        if len(triggers) == 0:
            return "⚠️ 建议找懂编程的人帮你看一眼"

        reasons = [trigger.description for trigger in triggers[:3]]
        return HUMAN_REVIEW_MESSAGE_TEMPLATE.format(
            reasons="；".join(reasons)
        )

    def _generate_usage_advice(
        self,
        risk_assessment: RiskAssessment,
    ) -> UsageAdvice:
        """
        生成使用建议 (REQ-7.3)

        Args:
            risk_assessment: 风险评估结果

        Returns:
            UsageAdvice: 使用建议
        """
        can_use_for: List[str] = []
        should_not_use_for: List[str] = []
        next_steps: List[str] = []

        if risk_assessment.level == RiskLevel.LOW:
            can_use_for = [
                "测试环境验证",
                "个人学习项目",
                "非关键业务场景",
            ]
            should_not_use_for = [
                "生产环境（未经充分测试）",
                "涉及真实用户数据的场景",
            ]
            next_steps = [
                "在测试环境运行，观察日志",
                "编写单元测试验证功能",
            ]

        elif risk_assessment.level == RiskLevel.MEDIUM:
            can_use_for = [
                "测试环境验证（需关注风险点）",
            ]
            should_not_use_for = [
                "生产环境",
                "涉及真实用户数据的场景",
                "金融/支付相关场景",
            ]
            next_steps = [
                "修复报告中指出的风险点",
                "找有经验的开发者帮忙审查",
                "在隔离环境中测试",
            ]

        else:  # HIGH
            can_use_for = []
            should_not_use_for = [
                "任何生产环境",
                "任何涉及真实数据的场景",
                "任何涉及金钱/权限的场景",
            ]
            next_steps = [
                "不要运行这段代码",
                "找专业开发者重写或修复",
                "如果必须使用，先彻底理解每一行代码",
            ]

        return UsageAdvice(
            can_use_for=can_use_for,
            should_not_use_for=should_not_use_for,
            next_steps=next_steps,
        )

    def export_markdown(self, report: HumanReadableReport) -> str:
        """
        导出为 Markdown 格式

        Args:
            report: 人话报告

        Returns:
            str: Markdown 格式的报告
        """
        lines: List[str] = []

        # 标题和风险等级
        risk_emoji = {
            RiskLevel.LOW: "✅",
            RiskLevel.MEDIUM: "⚠️",
            RiskLevel.HIGH: "🚫",
        }
        emoji = risk_emoji.get(report.risk_level, "❓")

        lines.append(f"# {emoji} 代码验证报告")
        lines.append("")

        # 一句话结论（顶部醒目）
        lines.append(f"**结论**: {report.one_line_conclusion}")
        lines.append("")

        # 人工复核提示（顶部醒目）(REQ-5.5)
        if report.human_review_required:
            # DEF-001: 显式检查 None
            message = report.human_review_message
            if message is None:
                message = "⚠️ 建议找懂编程的人帮你看一眼"
            lines.append(f"> {message}")
            lines.append("")

        # 风险等级
        lines.append(f"**风险等级**: {report.risk_level.value}")
        lines.append("")

        # 覆盖边界 (REQ-4.1)
        lines.append("## 本次检查能防范")
        lines.append("")
        for item in report.coverage_boundary.can_detect:
            lines.append(f"- ✅ {item}")
        lines.append("")

        lines.append("## 本次检查不能保证")
        lines.append("")
        for item in report.coverage_boundary.cannot_guarantee:
            lines.append(f"- ❌ {item}")
        lines.append("")

        # 使用建议 (REQ-7.3)
        lines.append("## 使用建议")
        lines.append("")

        if report.usage_advice.can_use_for:
            lines.append("**可以用于**:")
            for item in report.usage_advice.can_use_for:
                lines.append(f"- {item}")
            lines.append("")

        if report.usage_advice.should_not_use_for:
            lines.append("**不要用于**:")
            for item in report.usage_advice.should_not_use_for:
                lines.append(f"- {item}")
            lines.append("")

        if report.usage_advice.next_steps:
            lines.append("**建议下一步**:")
            for item in report.usage_advice.next_steps:
                lines.append(f"- {item}")
            lines.append("")

        # 技术细节（折叠）(REQ-7.4)
        # DEF-001: 显式检查 None
        if report.technical_details is not None:
            lines.append("<details>")
            lines.append("<summary>技术细节（点击展开）</summary>")
            lines.append("")
            lines.append(f"- 规则集: {report.technical_details.ruleset_id}")
            lines.append(f"- 版本: {report.technical_details.ruleset_version}")
            lines.append(f"- 总规则数: {report.technical_details.total_rules}")
            lines.append(f"- 通过: {report.technical_details.passed_rules}")
            lines.append(f"- 失败: {report.technical_details.failed_rules}")

            if report.technical_details.violations:
                lines.append("")
                lines.append("**违规详情**:")
                for v in report.technical_details.violations:
                    lines.append(f"- [{v.rule_id}] {v.human_description}")

            lines.append("")
            lines.append("</details>")

        return "\n".join(lines)


# =============================================================================
# Convenience Functions
# =============================================================================


def create_report_generator() -> HumanReadableReportGenerator:
    """创建 HumanReadableReportGenerator 实例的便捷函数"""
    return HumanReadableReportGenerator()
