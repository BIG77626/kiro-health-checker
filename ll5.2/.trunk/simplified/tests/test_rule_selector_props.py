"""
Property Tests for RuleSelector

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 1.4)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types
===================================

Property 2: 规则选择确定性
Property 3: 规则合并去重
"""

from __future__ import annotations

from pathlib import Path
from typing import List

import pytest
import yaml
from hypothesis import given, settings, strategies as st

from ..models import Rule, RuleCategory, RuleMaturity
from ..rule_registry import RuleRegistry
from ..rule_selector import (
    RuleSelectionResult,
    RuleSelector,
    create_rule_selector,
    select_rules_for_code,
)
from ..skill_mapping import SkillMappingManager, SkillRuleMapping
from ..skill_parser import SkillDeclaration


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def temp_rules_dir(tmp_path: Path) -> Path:
    """创建临时规则目录"""
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()

    # 创建测试规则文件
    rules_data = {
        "rules": [
            {
                "id": "SEC-001",
                "category": "security",
                "description": "Security rule 1",
                "human_description": "Security check",
                "severity": "mandatory",
                "skill_tags": ["security", "safety"],
                "scenario_tags": ["cli_tool", "api_client"],
            },
            {
                "id": "ERR-001",
                "category": "error",
                "description": "Error handling rule",
                "human_description": "Error check",
                "severity": "mandatory",
                "skill_tags": ["error-handling", "defensive"],
                "scenario_tags": ["cli_tool"],
            },
            {
                "id": "TYP-001",
                "category": "type",
                "description": "Type safety rule",
                "human_description": "Type check",
                "severity": "recommended",
                "skill_tags": ["type-safety", "pydantic"],
                "scenario_tags": ["api_client"],
            },
            {
                "id": "NET-001",
                "category": "network",
                "description": "Network rule",
                "human_description": "Network check",
                "severity": "recommended",
                "skill_tags": ["network", "timeout"],
                "scenario_tags": ["api_client"],
                "maturity": "deprecated",  # 已废弃
            },
        ]
    }

    with open(rules_dir / "test_rules.yml", "w", encoding="utf-8") as f:
        yaml.dump(rules_data, f)

    return rules_dir


@pytest.fixture
def temp_mappings_file(tmp_path: Path) -> Path:
    """创建临时映射文件"""
    mappings_file = tmp_path / "skill_mappings.yml"
    data = {
        "version": "1.0.0",
        "mappings": [
            {
                "skill_name": "SECURITY",
                "rule_ids": ["SEC-001"],
                "skill_tags": ["security", "safety"],
            },
            {
                "skill_name": "ERROR-HANDLING",
                "rule_ids": ["ERR-001"],
                "skill_tags": ["error-handling", "defensive"],
            },
            {
                "skill_name": "PYDANTIC-TYPE-SAFETY",
                "rule_ids": ["TYP-001"],
                "skill_tags": ["type-safety", "pydantic"],
            },
        ],
    }
    with open(mappings_file, "w", encoding="utf-8") as f:
        yaml.dump(data, f)
    return mappings_file


@pytest.fixture
def rule_selector(temp_rules_dir: Path, temp_mappings_file: Path) -> RuleSelector:
    """创建测试用的 RuleSelector"""
    rule_registry = RuleRegistry(rules_dir=temp_rules_dir)
    skill_mapping_manager = SkillMappingManager(mappings_file=temp_mappings_file)
    return RuleSelector(
        rule_registry=rule_registry,
        skill_mapping_manager=skill_mapping_manager,
    )


# =============================================================================
# Property 2: 规则选择确定性
# =============================================================================


class TestRuleSelectionDeterminism:
    """Property 2: 相同的skill_tags输入，RuleSelector应返回相同的规则集"""

    def test_same_tags_same_result(self, rule_selector: RuleSelector) -> None:
        """相同标签应返回相同结果"""
        tags = ["security", "safety"]

        result1 = rule_selector.select_by_tags(tags)
        result2 = rule_selector.select_by_tags(tags)

        assert result1.get_rule_ids() == result2.get_rule_ids()

    def test_same_declaration_same_result(self, rule_selector: RuleSelector) -> None:
        """相同声明应返回相同结果"""
        declaration = SkillDeclaration(
            skills=["SECURITY"],
            skill_tags=["security"],
        )

        result1 = rule_selector.select(declaration)
        result2 = rule_selector.select(declaration)

        assert result1.get_rule_ids() == result2.get_rule_ids()

    @given(st.lists(st.sampled_from(["security", "error-handling", "type-safety"]), min_size=1, max_size=3))
    @settings(max_examples=20)
    def test_determinism_property(self, tags: List[str]) -> None:
        """Property: 规则选择是确定性的"""
        # 创建简单的 RuleSelector（使用默认配置）
        selector = RuleSelector()

        result1 = selector.select_by_tags(tags)
        result2 = selector.select_by_tags(tags)

        assert result1.get_rule_ids() == result2.get_rule_ids()


# =============================================================================
# Property 3: 规则合并去重
# =============================================================================


class TestRuleMergeDeduplication:
    """Property 3: 多个规则集的合并结果，不应包含重复的规则ID"""

    def test_merge_removes_duplicates(self, rule_selector: RuleSelector) -> None:
        """合并应去除重复"""
        # 创建包含重复规则的规则集
        rule1 = Rule(
            id="SEC-001",
            category=RuleCategory.SECURITY,
            description="Test",
            human_description="Test",
            severity="mandatory",
        )
        rule2 = Rule(
            id="ERR-001",
            category=RuleCategory.ERROR_HANDLING,
            description="Test",
            human_description="Test",
            severity="mandatory",
        )
        rule3 = Rule(
            id="SEC-001",  # 重复
            category=RuleCategory.SECURITY,
            description="Test",
            human_description="Test",
            severity="mandatory",
        )

        rule_sets = [[rule1, rule2], [rule3]]
        merged = rule_selector.merge_rules(rule_sets)

        # 应该只有2个规则
        assert len(merged) == 2
        rule_ids = [r.id for r in merged]
        assert len(rule_ids) == len(set(rule_ids))

    @given(
        st.lists(
            st.lists(
                st.sampled_from(["SEC-001", "ERR-001", "TYP-001"]),
                min_size=0,
                max_size=3,
            ),
            min_size=1,
            max_size=3,
        )
    )
    @settings(max_examples=30)
    def test_merge_no_duplicates_property(self, rule_id_sets: List[List[str]]) -> None:
        """Property: 合并后无重复"""
        selector = RuleSelector()

        # 创建规则集
        rule_sets = []
        for rule_ids in rule_id_sets:
            rules = []
            for rule_id in rule_ids:
                rules.append(
                    Rule(
                        id=rule_id,
                        category=RuleCategory.SECURITY,
                        description="Test",
                        human_description="Test",
                        severity="mandatory",
                    )
                )
            rule_sets.append(rules)

        merged = selector.merge_rules(rule_sets)

        # 验证无重复
        rule_ids = [r.id for r in merged]
        assert len(rule_ids) == len(set(rule_ids))


# =============================================================================
# 基本功能测试
# =============================================================================


class TestBasicSelection:
    """基本选择功能测试"""

    def test_select_by_skill_declaration(self, rule_selector: RuleSelector) -> None:
        """根据Skill声明选择规则"""
        declaration = SkillDeclaration(
            skills=["SECURITY"],
            skill_tags=["security"],
        )

        result = rule_selector.select(declaration)

        assert not result.is_fallback
        assert "SEC-001" in result.get_rule_ids()

    def test_select_by_tags(self, rule_selector: RuleSelector) -> None:
        """根据标签选择规则"""
        result = rule_selector.select_by_tags(["security"])

        assert "SEC-001" in result.get_rule_ids()

    def test_select_multiple_tags(self, rule_selector: RuleSelector) -> None:
        """多个标签选择（OR语义）"""
        result = rule_selector.select_by_tags(["security", "error-handling"])

        rule_ids = result.get_rule_ids()
        assert "SEC-001" in rule_ids
        assert "ERR-001" in rule_ids

    def test_select_skips_deprecated_rules(self, rule_selector: RuleSelector) -> None:
        """跳过已废弃的规则"""
        result = rule_selector.select_by_tags(["network"])

        # NET-001 是 deprecated，不应该被选中
        assert "NET-001" not in result.get_rule_ids()


# =============================================================================
# 回退机制测试
# =============================================================================


class TestFallbackMechanism:
    """回退机制测试"""

    def test_fallback_on_empty_declaration(self, rule_selector: RuleSelector) -> None:
        """空声明时使用回退"""
        declaration = SkillDeclaration()

        result = rule_selector.select(declaration)

        assert result.is_fallback
        assert result.fallback_reason is not None

    def test_fallback_on_unknown_tags(self, rule_selector: RuleSelector) -> None:
        """未知标签时使用回退"""
        result = rule_selector.select_by_tags(["unknown-tag-xyz"])

        # 应该返回空结果或回退
        assert len(result.rules) == 0 or result.is_fallback

    def test_get_fallback_rules(self, rule_selector: RuleSelector) -> None:
        """获取回退规则"""
        fallback_rules = rule_selector.get_fallback_rules()

        # 应该返回 mandatory 规则
        for rule in fallback_rules:
            assert rule.severity == "mandatory"


# =============================================================================
# 显式规则引用测试
# =============================================================================


class TestExplicitRuleReference:
    """显式规则引用测试"""

    def test_explicit_rule_ids_added(self, rule_selector: RuleSelector) -> None:
        """显式引用的规则应被添加"""
        declaration = SkillDeclaration(
            skills=["SECURITY"],
            skill_tags=["security"],
            rule_ids=["TYP-001"],  # 显式引用
        )

        result = rule_selector.select(declaration)

        rule_ids = result.get_rule_ids()
        assert "SEC-001" in rule_ids  # 通过标签选中
        assert "TYP-001" in rule_ids  # 显式引用


# =============================================================================
# RuleSelectionResult 模型测试
# =============================================================================


class TestRuleSelectionResultModel:
    """RuleSelectionResult 模型测试"""

    def test_get_rule_ids(self) -> None:
        """get_rule_ids 方法"""
        rule = Rule(
            id="SEC-001",
            category=RuleCategory.SECURITY,
            description="Test",
            human_description="Test",
            severity="mandatory",
        )
        result = RuleSelectionResult(rules=[rule])

        assert result.get_rule_ids() == ["SEC-001"]

    def test_model_serialization_roundtrip(self) -> None:
        """模型序列化往返"""
        original = RuleSelectionResult(
            rules=[],
            skill_tags_used=["security"],
            scenario_id="cli_tool",
            is_fallback=False,
        )
        dumped = original.model_dump()
        restored = RuleSelectionResult.model_validate(dumped)

        assert original.skill_tags_used == restored.skill_tags_used
        assert original.scenario_id == restored.scenario_id
        assert original.is_fallback == restored.is_fallback


# =============================================================================
# 便捷函数测试
# =============================================================================


class TestConvenienceFunctions:
    """便捷函数测试"""

    def test_create_rule_selector(self) -> None:
        """create_rule_selector 便捷函数"""
        selector = create_rule_selector()
        assert selector is not None

    def test_select_rules_for_code(self) -> None:
        """select_rules_for_code 便捷函数"""
        code = '''"""
=== SKILL COMPLIANCE DECLARATION ===
Skills: SECURITY
===================================
"""
'''
        result = select_rules_for_code(code)
        assert isinstance(result, RuleSelectionResult)


# =============================================================================
# 索引重建测试
# =============================================================================


class TestIndexRebuild:
    """索引重建测试"""

    def test_rebuild_index(self, rule_selector: RuleSelector) -> None:
        """重建索引"""
        # 重建前的结果
        result_before = rule_selector.select_by_tags(["security"])

        # 重建索引
        rule_selector.rebuild_index()

        # 重建后的结果应该相同
        result_after = rule_selector.select_by_tags(["security"])

        assert result_before.get_rule_ids() == result_after.get_rule_ids()
