"""
Rule Improvement Analyzer - 规则改进分析器

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 5.1)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P2)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: All models inherit from BaseModel

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit `is None` checks
===================================

分析假绿事件，生成规则改进建议。
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field

from .models import FalseGreenEvent, Rule, RuleCategory

logger = logging.getLogger(__name__)


# =============================================================================
# Data Models
# =============================================================================


class ImprovementType(str, Enum):
    """改进类型"""

    MISSING_RULE = "missing_rule"  # 缺失规则
    RULE_TOO_LOOSE = "rule_too_loose"  # 规则太宽松
    PATTERN_INCOMPLETE = "pattern_incomplete"  # 模式不完整
    UNKNOWN = "unknown"  # 未知


class ImprovementPriority(str, Enum):
    """改进优先级"""

    HIGH = "high"  # 高优先级（频繁出现）
    MEDIUM = "medium"  # 中优先级
    LOW = "low"  # 低优先级


class FalseGreenAnalysis(BaseModel):
    """假绿事件分析结果"""

    event_id: str = Field(min_length=1, description="事件ID")
    improvement_type: ImprovementType = Field(description="改进类型")
    confidence: float = Field(ge=0.0, le=1.0, description="置信度")
    analysis_summary: str = Field(min_length=1, description="分析摘要")

    # 详细分析
    detected_patterns: List[str] = Field(
        default_factory=list,
        description="检测到的代码模式",
    )
    related_rules: List[str] = Field(
        default_factory=list,
        description="相关规则ID",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


class RuleImprovement(BaseModel):
    """规则改进建议"""

    rule_id: Optional[str] = Field(
        default=None,
        description="现有规则ID（如果是改进现有规则）",
    )
    improvement_type: ImprovementType = Field(description="改进类型")
    priority: ImprovementPriority = Field(description="优先级")

    # 建议内容
    title: str = Field(min_length=1, description="建议标题")
    description: str = Field(min_length=1, description="建议描述")
    suggested_pattern: Optional[str] = Field(
        default=None,
        description="建议的检测模式",
    )
    suggested_category: Optional[RuleCategory] = Field(
        default=None,
        description="建议的规则类别",
    )

    # 来源
    source_events: List[str] = Field(
        default_factory=list,
        description="来源事件ID列表",
    )
    created_at: datetime = Field(
        default_factory=lambda: datetime.now(tz=None),
        description="创建时间",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


class RuleVersion(BaseModel):
    """规则版本信息"""

    version: str = Field(
        pattern=r"^\d+\.\d+\.\d+$",
        description="版本号",
    )
    released_at: datetime = Field(description="发布时间")
    changes: List[str] = Field(
        default_factory=list,
        description="变更列表",
    )
    added_rules: List[str] = Field(
        default_factory=list,
        description="新增规则ID",
    )
    modified_rules: List[str] = Field(
        default_factory=list,
        description="修改规则ID",
    )
    deprecated_rules: List[str] = Field(
        default_factory=list,
        description="弃用规则ID",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


# =============================================================================
# Pattern Detection
# =============================================================================


# 常见危险模式（用于分析假绿事件）
DANGEROUS_PATTERNS = {
    "sql_injection": [
        r'execute\s*\(\s*["\'].*%s',
        r'execute\s*\(\s*f["\']',
        r'cursor\.execute\s*\(\s*["\'].*\+',
    ],
    "command_injection": [
        r"subprocess\..*shell\s*=\s*True",
        r"os\.system\s*\(",
        r"os\.popen\s*\(",
    ],
    "path_traversal": [
        r'open\s*\(\s*["\']\.\./',
        r"os\.path\.join\s*\(.*\.\.",
    ],
    "hardcoded_secrets": [
        r'password\s*=\s*["\'][^"\']+["\']',
        r'api_key\s*=\s*["\'][^"\']+["\']',
        r'secret\s*=\s*["\'][^"\']+["\']',
    ],
    "insecure_deserialization": [
        r"pickle\.loads?\s*\(",
        r"yaml\.load\s*\([^,]+\)",  # 没有 Loader 参数
    ],
    "missing_error_handling": [
        r"except\s*:\s*\n\s*pass",
        r"except\s+Exception\s*:\s*\n\s*pass",
    ],
}


# =============================================================================
# Rule Improvement Analyzer
# =============================================================================


class RuleImprovementAnalyzer:
    """
    规则改进分析器

    分析假绿事件，识别规则缺失或过于宽松的情况，
    生成规则改进建议。
    """

    def __init__(
        self,
        rules_dir: Optional[Path] = None,
    ) -> None:
        """
        初始化分析器。

        Args:
            rules_dir: 规则目录
        """
        # DEF-001: 显式检查 None
        if rules_dir is None:
            rules_dir = Path(__file__).parent / "rules"

        self._rules_dir = rules_dir
        self._existing_rules: List[Rule] = []
        self._load_existing_rules()

    def _load_existing_rules(self) -> None:
        """加载现有规则"""
        try:
            from .rule_registry import RuleRegistry

            registry = RuleRegistry(rules_dir=self._rules_dir)
            self._existing_rules = registry.get_all_rules()
        # ERR-001: 指定具体异常类型
        except (OSError, ValueError, ImportError) as e:
            logger.warning(f"Failed to load existing rules: {e}")
            self._existing_rules = []

    def analyze_false_green_event(
        self,
        event: FalseGreenEvent,
    ) -> FalseGreenAnalysis:
        """
        分析假绿事件。

        Args:
            event: 假绿事件

        Returns:
            FalseGreenAnalysis: 分析结果
        """
        # 1. 确定改进类型
        improvement_type = self._determine_improvement_type(event)

        # 2. 检测代码模式
        detected_patterns = self._detect_patterns(event.issue_description)

        # 3. 查找相关规则
        related_rules = self._find_related_rules(event, detected_patterns)

        # 4. 计算置信度
        confidence = self._calculate_confidence(
            improvement_type,
            detected_patterns,
            related_rules,
        )

        # 5. 生成分析摘要
        analysis_summary = self._generate_analysis_summary(
            improvement_type,
            detected_patterns,
            related_rules,
        )

        return FalseGreenAnalysis(
            event_id=event.id,
            improvement_type=improvement_type,
            confidence=confidence,
            analysis_summary=analysis_summary,
            detected_patterns=detected_patterns,
            related_rules=related_rules,
        )

    def suggest_rule_improvement(
        self,
        event: FalseGreenEvent,
        analysis: Optional[FalseGreenAnalysis] = None,
    ) -> RuleImprovement:
        """
        生成规则改进建议。

        Args:
            event: 假绿事件
            analysis: 分析结果（可选，如果没有则自动分析）

        Returns:
            RuleImprovement: 改进建议
        """
        # DEF-001: 显式检查 None
        if analysis is None:
            analysis = self.analyze_false_green_event(event)

        # 根据改进类型生成建议
        if analysis.improvement_type == ImprovementType.MISSING_RULE:
            return self._suggest_new_rule(event, analysis)
        elif analysis.improvement_type == ImprovementType.RULE_TOO_LOOSE:
            return self._suggest_rule_tightening(event, analysis)
        elif analysis.improvement_type == ImprovementType.PATTERN_INCOMPLETE:
            return self._suggest_pattern_extension(event, analysis)
        else:
            return self._suggest_manual_review(event, analysis)

    def _determine_improvement_type(
        self,
        event: FalseGreenEvent,
    ) -> ImprovementType:
        """确定改进类型"""
        # DEF-001: 显式检查 None
        if event.missing_rule is not None:
            return ImprovementType.MISSING_RULE
        elif event.rule_too_loose is not None:
            return ImprovementType.RULE_TOO_LOOSE
        else:
            # 尝试从描述中推断
            description_lower = event.issue_description.lower()
            if "missing" in description_lower or "no rule" in description_lower:
                return ImprovementType.MISSING_RULE
            elif "loose" in description_lower or "not strict" in description_lower:
                return ImprovementType.RULE_TOO_LOOSE
            elif "pattern" in description_lower or "not detected" in description_lower:
                return ImprovementType.PATTERN_INCOMPLETE
            else:
                return ImprovementType.UNKNOWN

    def _detect_patterns(self, description: str) -> List[str]:
        """检测代码模式"""
        detected = []

        for pattern_name, patterns in DANGEROUS_PATTERNS.items():
            for pattern in patterns:
                try:
                    if re.search(pattern, description, re.IGNORECASE):
                        detected.append(pattern_name)
                        break
                # ERR-001: 指定具体异常类型
                except re.error:
                    continue

        return list(set(detected))

    def _find_related_rules(
        self,
        event: FalseGreenEvent,
        detected_patterns: List[str],
    ) -> List[str]:
        """查找相关规则"""
        related = []

        # 从事件中获取
        # DEF-001: 显式检查 None
        if event.missing_rule is not None:
            related.append(event.missing_rule)
        if event.rule_too_loose is not None:
            related.append(event.rule_too_loose)

        # 从现有规则中匹配
        for rule in self._existing_rules:
            rule_desc_lower = rule.description.lower()
            for pattern in detected_patterns:
                if pattern.replace("_", " ") in rule_desc_lower:
                    related.append(rule.id)
                    break

        return list(set(related))

    def _calculate_confidence(
        self,
        improvement_type: ImprovementType,
        detected_patterns: List[str],
        related_rules: List[str],
    ) -> float:
        """计算置信度"""
        confidence = 0.5  # 基础置信度

        # 有明确的改进类型
        if improvement_type != ImprovementType.UNKNOWN:
            confidence += 0.2

        # 检测到危险模式
        if len(detected_patterns) > 0:
            confidence += 0.1 * min(len(detected_patterns), 3)

        # 找到相关规则
        if len(related_rules) > 0:
            confidence += 0.1

        return min(confidence, 1.0)

    def _generate_analysis_summary(
        self,
        improvement_type: ImprovementType,
        detected_patterns: List[str],
        related_rules: List[str],
    ) -> str:
        """生成分析摘要"""
        parts = []

        # 改进类型
        type_descriptions = {
            ImprovementType.MISSING_RULE: "需要新增规则",
            ImprovementType.RULE_TOO_LOOSE: "现有规则过于宽松",
            ImprovementType.PATTERN_INCOMPLETE: "检测模式不完整",
            ImprovementType.UNKNOWN: "需要人工分析",
        }
        parts.append(type_descriptions[improvement_type])

        # 检测到的模式
        if len(detected_patterns) > 0:
            parts.append(f"检测到模式: {', '.join(detected_patterns)}")

        # 相关规则
        if len(related_rules) > 0:
            parts.append(f"相关规则: {', '.join(related_rules)}")

        return "。".join(parts)

    def _suggest_new_rule(
        self,
        event: FalseGreenEvent,
        analysis: FalseGreenAnalysis,
    ) -> RuleImprovement:
        """建议新增规则"""
        # 根据检测到的模式确定类别
        category = RuleCategory.SECURITY
        if "sql" in " ".join(analysis.detected_patterns).lower():
            category = RuleCategory.DATABASE
        elif "path" in " ".join(analysis.detected_patterns).lower():
            category = RuleCategory.FILE_OPERATION
        elif "command" in " ".join(analysis.detected_patterns).lower():
            category = RuleCategory.DANGEROUS_CALL

        return RuleImprovement(
            rule_id=None,
            improvement_type=ImprovementType.MISSING_RULE,
            priority=ImprovementPriority.HIGH,
            title=f"新增规则: {event.issue_description[:50]}",
            description=f"基于假绿事件 {event.id}，建议新增规则检测此类问题。",
            suggested_category=category,
            source_events=[event.id],
        )

    def _suggest_rule_tightening(
        self,
        event: FalseGreenEvent,
        analysis: FalseGreenAnalysis,
    ) -> RuleImprovement:
        """建议收紧规则"""
        rule_id = event.rule_too_loose

        return RuleImprovement(
            rule_id=rule_id,
            improvement_type=ImprovementType.RULE_TOO_LOOSE,
            priority=ImprovementPriority.MEDIUM,
            title=f"收紧规则: {rule_id or '未知'}",
            description=f"规则 {rule_id} 过于宽松，未能检测到问题。建议增加更严格的检测模式。",
            source_events=[event.id],
        )

    def _suggest_pattern_extension(
        self,
        event: FalseGreenEvent,
        analysis: FalseGreenAnalysis,
    ) -> RuleImprovement:
        """建议扩展模式"""
        return RuleImprovement(
            rule_id=analysis.related_rules[0] if analysis.related_rules else None,
            improvement_type=ImprovementType.PATTERN_INCOMPLETE,
            priority=ImprovementPriority.MEDIUM,
            title="扩展检测模式",
            description=f"现有检测模式不完整，建议添加新的模式变体。检测到的模式: {', '.join(analysis.detected_patterns)}",
            source_events=[event.id],
        )

    def _suggest_manual_review(
        self,
        event: FalseGreenEvent,
        analysis: FalseGreenAnalysis,
    ) -> RuleImprovement:
        """建议人工审查"""
        return RuleImprovement(
            rule_id=None,
            improvement_type=ImprovementType.UNKNOWN,
            priority=ImprovementPriority.LOW,
            title="需要人工审查",
            description=f"无法自动确定改进方向，建议人工审查假绿事件: {event.issue_description}",
            source_events=[event.id],
        )


# =============================================================================
# Rule Version Manager
# =============================================================================


class RuleVersionManager:
    """
    规则版本管理器

    管理规则的版本历史和变更日志。
    """

    def __init__(
        self,
        rules_dir: Optional[Path] = None,
    ) -> None:
        """
        初始化版本管理器。

        Args:
            rules_dir: 规则目录
        """
        # DEF-001: 显式检查 None
        if rules_dir is None:
            rules_dir = Path(__file__).parent / "rules"

        self._rules_dir = rules_dir
        self._version_file = rules_dir / "VERSION.yml"
        self._changelog_file = rules_dir / "CHANGELOG.md"

    def get_current_version(self) -> str:
        """获取当前版本"""
        try:
            if self._version_file.exists():
                import yaml

                with open(self._version_file, encoding="utf-8") as f:
                    data = yaml.safe_load(f)
                    return data.get("version", "1.0.0")
        # ERR-001: 指定具体异常类型
        except (OSError, ValueError) as e:
            logger.warning(f"Failed to read version file: {e}")

        return "1.0.0"

    def get_version_history(self) -> List[RuleVersion]:
        """获取版本历史"""
        # 简化实现：返回当前版本
        current = self.get_current_version()
        return [
            RuleVersion(
                version=current,
                released_at=datetime.now(tz=None),
                changes=["Initial release"],
            )
        ]

    def record_change(
        self,
        change_type: str,
        rule_id: str,
        description: str,
    ) -> None:
        """
        记录规则变更。

        Args:
            change_type: 变更类型 (added/modified/deprecated)
            rule_id: 规则ID
            description: 变更描述
        """
        try:
            # 追加到 CHANGELOG
            with open(self._changelog_file, "a", encoding="utf-8") as f:
                timestamp = datetime.now(tz=None).isoformat()
                f.write(f"\n## [{timestamp}] {change_type.upper()}: {rule_id}\n")
                f.write(f"{description}\n")

            logger.info(f"Recorded change: {change_type} {rule_id}")
        # ERR-001: 指定具体异常类型
        except OSError as e:
            logger.warning(f"Failed to record change: {e}")


# =============================================================================
# Convenience Functions
# =============================================================================


def analyze_false_green(event: FalseGreenEvent) -> FalseGreenAnalysis:
    """
    分析假绿事件（便捷函数）。

    Args:
        event: 假绿事件

    Returns:
        FalseGreenAnalysis: 分析结果
    """
    analyzer = RuleImprovementAnalyzer()
    return analyzer.analyze_false_green_event(event)


def suggest_improvement(event: FalseGreenEvent) -> RuleImprovement:
    """
    生成规则改进建议（便捷函数）。

    Args:
        event: 假绿事件

    Returns:
        RuleImprovement: 改进建议
    """
    analyzer = RuleImprovementAnalyzer()
    return analyzer.suggest_rule_improvement(event)
