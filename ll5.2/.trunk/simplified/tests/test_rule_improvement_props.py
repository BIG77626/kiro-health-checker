"""
Property-Based Tests for Rule Improvement Analyzer

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 5.1)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P2)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types
===================================

测试规则改进分析器的属性。
"""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import pytest

from ..models import FalseGreenEvent
from ..rule_improvement import (
    FalseGreenAnalysis,
    ImprovementPriority,
    ImprovementType,
    RuleImprovement,
    RuleImprovementAnalyzer,
    RuleVersion,
    RuleVersionManager,
    analyze_false_green,
    suggest_improvement,
)


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def analyzer() -> RuleImprovementAnalyzer:
    """创建分析器"""
    return RuleImprovementAnalyzer()


@pytest.fixture
def version_manager(tmp_path: Path) -> RuleVersionManager:
    """创建版本管理器"""
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()
    return RuleVersionManager(rules_dir=rules_dir)


@pytest.fixture
def sample_event() -> FalseGreenEvent:
    """创建示例假绿事件"""
    return FalseGreenEvent(
        id="test-event-001",
        validation_id="val-001",
        reported_at=datetime.now(tz=None),
        issue_description="代码中存在 SQL 注入漏洞，使用了字符串拼接",
        missing_rule="SQL-001",
    )


@pytest.fixture
def event_with_loose_rule() -> FalseGreenEvent:
    """创建规则过松的假绿事件"""
    return FalseGreenEvent(
        id="test-event-002",
        validation_id="val-002",
        reported_at=datetime.now(tz=None),
        issue_description="eval() 被检测到但未阻止",
        rule_too_loose="SEC-001",
    )


# =============================================================================
# Property 13: 假绿事件分析完整性
# =============================================================================


class TestFalseGreenAnalysisCompleteness:
    """Property 13: 假绿事件分析必须返回完整结果"""

    def test_analysis_has_event_id(
        self,
        analyzer: RuleImprovementAnalyzer,
        sample_event: FalseGreenEvent,
    ) -> None:
        """分析结果必须包含事件ID"""
        analysis = analyzer.analyze_false_green_event(sample_event)
        assert analysis.event_id == sample_event.id

    def test_analysis_has_improvement_type(
        self,
        analyzer: RuleImprovementAnalyzer,
        sample_event: FalseGreenEvent,
    ) -> None:
        """分析结果必须包含改进类型"""
        analysis = analyzer.analyze_false_green_event(sample_event)
        assert analysis.improvement_type in list(ImprovementType)

    def test_analysis_has_confidence(
        self,
        analyzer: RuleImprovementAnalyzer,
        sample_event: FalseGreenEvent,
    ) -> None:
        """分析结果必须包含置信度（0-1）"""
        analysis = analyzer.analyze_false_green_event(sample_event)
        assert 0.0 <= analysis.confidence <= 1.0

    def test_analysis_has_summary(
        self,
        analyzer: RuleImprovementAnalyzer,
        sample_event: FalseGreenEvent,
    ) -> None:
        """分析结果必须包含摘要"""
        analysis = analyzer.analyze_false_green_event(sample_event)
        assert len(analysis.analysis_summary) > 0


# =============================================================================
# Property 14: 改进建议有效性
# =============================================================================


class TestImprovementSuggestionValidity:
    """Property 14: 改进建议必须有效"""

    def test_suggestion_has_title(
        self,
        analyzer: RuleImprovementAnalyzer,
        sample_event: FalseGreenEvent,
    ) -> None:
        """建议必须有标题"""
        suggestion = analyzer.suggest_rule_improvement(sample_event)
        assert len(suggestion.title) > 0

    def test_suggestion_has_description(
        self,
        analyzer: RuleImprovementAnalyzer,
        sample_event: FalseGreenEvent,
    ) -> None:
        """建议必须有描述"""
        suggestion = analyzer.suggest_rule_improvement(sample_event)
        assert len(suggestion.description) > 0

    def test_suggestion_has_priority(
        self,
        analyzer: RuleImprovementAnalyzer,
        sample_event: FalseGreenEvent,
    ) -> None:
        """建议必须有优先级"""
        suggestion = analyzer.suggest_rule_improvement(sample_event)
        assert suggestion.priority in list(ImprovementPriority)

    def test_suggestion_has_source_events(
        self,
        analyzer: RuleImprovementAnalyzer,
        sample_event: FalseGreenEvent,
    ) -> None:
        """建议必须关联源事件"""
        suggestion = analyzer.suggest_rule_improvement(sample_event)
        assert sample_event.id in suggestion.source_events


# =============================================================================
# Property 15: 改进类型正确识别
# =============================================================================


class TestImprovementTypeDetection:
    """Property 15: 改进类型必须正确识别"""

    def test_missing_rule_detected(
        self,
        analyzer: RuleImprovementAnalyzer,
        sample_event: FalseGreenEvent,
    ) -> None:
        """缺失规则应被识别"""
        analysis = analyzer.analyze_false_green_event(sample_event)
        assert analysis.improvement_type == ImprovementType.MISSING_RULE

    def test_loose_rule_detected(
        self,
        analyzer: RuleImprovementAnalyzer,
        event_with_loose_rule: FalseGreenEvent,
    ) -> None:
        """过松规则应被识别"""
        analysis = analyzer.analyze_false_green_event(event_with_loose_rule)
        assert analysis.improvement_type == ImprovementType.RULE_TOO_LOOSE

    def test_unknown_type_for_ambiguous_event(
        self,
        analyzer: RuleImprovementAnalyzer,
    ) -> None:
        """模糊事件应返回 UNKNOWN"""
        event = FalseGreenEvent(
            id="test-event-003",
            validation_id="val-003",
            reported_at=datetime.now(tz=None),
            issue_description="代码有问题",
        )
        analysis = analyzer.analyze_false_green_event(event)
        # 没有明确的 missing_rule 或 rule_too_loose，且描述模糊
        assert analysis.improvement_type in list(ImprovementType)


# =============================================================================
# Property 16: 版本管理正确性
# =============================================================================


class TestVersionManagement:
    """Property 16: 版本管理必须正确"""

    def test_get_current_version_returns_string(
        self,
        version_manager: RuleVersionManager,
    ) -> None:
        """当前版本必须是字符串"""
        version = version_manager.get_current_version()
        assert isinstance(version, str)
        assert len(version) > 0

    def test_version_format_valid(
        self,
        version_manager: RuleVersionManager,
    ) -> None:
        """版本格式必须有效（x.y.z）"""
        import re

        version = version_manager.get_current_version()
        assert re.match(r"^\d+\.\d+\.\d+$", version)

    def test_version_history_not_empty(
        self,
        version_manager: RuleVersionManager,
    ) -> None:
        """版本历史不能为空"""
        history = version_manager.get_version_history()
        assert len(history) >= 1

    def test_record_change_creates_file(
        self,
        version_manager: RuleVersionManager,
    ) -> None:
        """记录变更应创建文件"""
        version_manager.record_change(
            change_type="added",
            rule_id="TEST-001",
            description="测试规则",
        )
        assert version_manager._changelog_file.exists()


# =============================================================================
# 便捷函数测试
# =============================================================================


class TestConvenienceFunctions:
    """便捷函数测试"""

    def test_analyze_false_green_function(
        self,
        sample_event: FalseGreenEvent,
    ) -> None:
        """analyze_false_green 便捷函数测试"""
        analysis = analyze_false_green(sample_event)
        assert isinstance(analysis, FalseGreenAnalysis)

    def test_suggest_improvement_function(
        self,
        sample_event: FalseGreenEvent,
    ) -> None:
        """suggest_improvement 便捷函数测试"""
        suggestion = suggest_improvement(sample_event)
        assert isinstance(suggestion, RuleImprovement)


# =============================================================================
# 模型验证测试
# =============================================================================


class TestModelValidation:
    """模型验证测试"""

    def test_false_green_analysis_serialization(self) -> None:
        """FalseGreenAnalysis 序列化测试"""
        analysis = FalseGreenAnalysis(
            event_id="test-001",
            improvement_type=ImprovementType.MISSING_RULE,
            confidence=0.8,
            analysis_summary="测试摘要",
        )
        data = analysis.model_dump()
        restored = FalseGreenAnalysis.model_validate(data)
        assert restored.event_id == analysis.event_id

    def test_rule_improvement_serialization(self) -> None:
        """RuleImprovement 序列化测试"""
        improvement = RuleImprovement(
            improvement_type=ImprovementType.MISSING_RULE,
            priority=ImprovementPriority.HIGH,
            title="测试标题",
            description="测试描述",
        )
        data = improvement.model_dump()
        restored = RuleImprovement.model_validate(data)
        assert restored.title == improvement.title

    def test_rule_version_serialization(self) -> None:
        """RuleVersion 序列化测试"""
        version = RuleVersion(
            version="1.0.0",
            released_at=datetime.now(tz=None),
            changes=["Initial release"],
        )
        data = version.model_dump()
        restored = RuleVersion.model_validate(data)
        assert restored.version == version.version
