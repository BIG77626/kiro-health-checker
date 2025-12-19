"""
Property Tests for UnifiedRuleIndex

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 2.1)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types
===================================

Property 4: 标签检索正确性
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml
from hypothesis import given, settings, strategies as st

from ..models import Rule, RuleCategory, RuleMaturity
from ..rule_index import IndexStats, UnifiedRuleIndex, create_rule_index
from ..rule_registry import RuleRegistry


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def temp_rules_dir(tmp_path: Path) -> Path:
    """创建临时规则目录"""
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()

    rules_data = {
        "rules": [
            {
                "id": "SEC-001",
                "category": "security",
                "description": "Security rule 1",
                "human_description": "Security check",
                "severity": "mandatory",
                "skill_tags": ["security", "safety"],
                "scenario_tags": ["cli_tool"],
            },
            {
                "id": "ERR-001",
                "category": "error",
                "description": "Error handling rule",
                "human_description": "Error check",
                "severity": "mandatory",
                "skill_tags": ["error-handling", "defensive"],
                "scenario_tags": ["cli_tool", "api_client"],
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
        ]
    }

    with open(rules_dir / "test_rules.yml", "w", encoding="utf-8") as f:
        yaml.dump(rules_data, f)

    return rules_dir


@pytest.fixture
def rule_index(temp_rules_dir: Path) -> UnifiedRuleIndex:
    """创建测试用的 UnifiedRuleIndex"""
    rule_registry = RuleRegistry(rules_dir=temp_rules_dir)
    return UnifiedRuleIndex(rule_registry=rule_registry)


# =============================================================================
# Property 4: 标签检索正确性
# =============================================================================


class TestTagSearchCorrectness:
    """Property 4: 返回的规则应全部包含查询的标签"""

    def test_search_by_single_tag(self, rule_index: UnifiedRuleIndex) -> None:
        """单标签搜索"""
        rule_ids = rule_index.search_by_tags(["security"])

        assert "SEC-001" in rule_ids
        # ERR-001 没有 security 标签
        assert "ERR-001" not in rule_ids

    def test_search_by_multiple_tags_union(self, rule_index: UnifiedRuleIndex) -> None:
        """多标签搜索（并集）"""
        rule_ids = rule_index.search_by_tags(["security", "error-handling"], mode="union")

        assert "SEC-001" in rule_ids
        assert "ERR-001" in rule_ids

    def test_search_by_multiple_tags_intersection(self, rule_index: UnifiedRuleIndex) -> None:
        """多标签搜索（交集）"""
        # cli_tool 同时被 SEC-001 和 ERR-001 使用
        rule_ids = rule_index.search_by_tags(["cli_tool", "mandatory"], mode="intersection")

        assert "SEC-001" in rule_ids
        assert "ERR-001" in rule_ids
        # TYP-001 是 recommended，不在结果中
        assert "TYP-001" not in rule_ids

    def test_search_empty_tags_returns_empty(self, rule_index: UnifiedRuleIndex) -> None:
        """空标签返回空结果"""
        rule_ids = rule_index.search_by_tags([])
        assert rule_ids == []

    def test_search_unknown_tag_returns_empty(self, rule_index: UnifiedRuleIndex) -> None:
        """未知标签返回空结果"""
        rule_ids = rule_index.search_by_tags(["unknown-tag-xyz"])
        assert rule_ids == []

    def test_search_case_insensitive(self, rule_index: UnifiedRuleIndex) -> None:
        """搜索大小写不敏感"""
        rule_ids_lower = rule_index.search_by_tags(["security"])
        rule_ids_upper = rule_index.search_by_tags(["SECURITY"])

        assert rule_ids_lower == rule_ids_upper


# =============================================================================
# 延迟加载测试
# =============================================================================


class TestLazyLoading:
    """测试延迟加载功能"""

    def test_get_rule_returns_rule(self, rule_index: UnifiedRuleIndex) -> None:
        """获取规则"""
        rule = rule_index.get_rule("SEC-001")

        assert rule is not None
        assert rule.id == "SEC-001"

    def test_get_rule_caches_result(self, rule_index: UnifiedRuleIndex) -> None:
        """获取规则后缓存"""
        # 第一次获取
        rule1 = rule_index.get_rule("SEC-001")
        # 第二次获取（应该从缓存）
        rule2 = rule_index.get_rule("SEC-001")

        assert rule1 is rule2  # 同一个对象

    def test_get_rule_not_found(self, rule_index: UnifiedRuleIndex) -> None:
        """获取不存在的规则"""
        rule = rule_index.get_rule("NON-EXISTENT")
        assert rule is None

    def test_get_rules_batch(self, rule_index: UnifiedRuleIndex) -> None:
        """批量获取规则"""
        rules = rule_index.get_rules(["SEC-001", "ERR-001", "NON-EXISTENT"])

        assert len(rules) == 2
        rule_ids = [r.id for r in rules]
        assert "SEC-001" in rule_ids
        assert "ERR-001" in rule_ids


# =============================================================================
# 增量更新测试
# =============================================================================


class TestIncrementalUpdate:
    """测试增量更新功能"""

    def test_incremental_update_adds_rule(self, rule_index: UnifiedRuleIndex) -> None:
        """增量更新添加新规则"""
        new_rule = Rule(
            id="NEW-001",
            category=RuleCategory.SECURITY,
            description="New rule",
            human_description="New check",
            severity="mandatory",
            skill_tags=["new-tag"],
        )

        rule_index.incremental_update(new_rule)

        assert rule_index.has_rule("NEW-001")
        assert "NEW-001" in rule_index.search_by_tags(["new-tag"])

    def test_incremental_update_modifies_rule(self, rule_index: UnifiedRuleIndex) -> None:
        """增量更新修改现有规则"""
        # 修改 SEC-001 的标签
        # 注意：category=SECURITY 会将 "security" 作为隐式标签索引
        # 所以我们测试 skill_tags 中的 "safety" 标签被移除
        modified_rule = Rule(
            id="SEC-001",
            category=RuleCategory.SECURITY,
            description="Modified rule",
            human_description="Modified check",
            severity="mandatory",
            skill_tags=["modified-tag"],  # 新标签，移除了原来的 "safety"
        )

        rule_index.incremental_update(modified_rule)

        # 旧的 skill_tag "safety" 不再匹配
        assert "SEC-001" not in rule_index.search_by_tags(["safety"])
        # 新标签匹配
        assert "SEC-001" in rule_index.search_by_tags(["modified-tag"])
        # category 隐式标签仍然匹配
        assert "SEC-001" in rule_index.search_by_tags(["security"])

    def test_remove_rule(self, rule_index: UnifiedRuleIndex) -> None:
        """移除规则"""
        assert rule_index.has_rule("SEC-001")

        result = rule_index.remove_rule("SEC-001")

        assert result is True
        assert not rule_index.has_rule("SEC-001")
        assert "SEC-001" not in rule_index.search_by_tags(["security"])


# =============================================================================
# 统计信息测试
# =============================================================================


class TestIndexStats:
    """测试索引统计信息"""

    def test_get_stats(self, rule_index: UnifiedRuleIndex) -> None:
        """获取统计信息"""
        stats = rule_index.get_stats()

        assert isinstance(stats, IndexStats)
        assert stats.total_rules == 3
        assert stats.total_tags > 0

    def test_get_all_tags(self, rule_index: UnifiedRuleIndex) -> None:
        """获取所有标签"""
        tags = rule_index.get_all_tags()

        assert "security" in tags
        assert "error-handling" in tags
        assert "type-safety" in tags

    def test_get_all_rule_ids(self, rule_index: UnifiedRuleIndex) -> None:
        """获取所有规则ID"""
        rule_ids = rule_index.get_all_rule_ids()

        assert "SEC-001" in rule_ids
        assert "ERR-001" in rule_ids
        assert "TYP-001" in rule_ids

    def test_get_tags_for_rule(self, rule_index: UnifiedRuleIndex) -> None:
        """获取规则的标签"""
        tags = rule_index.get_tags_for_rule("SEC-001")

        assert "security" in tags
        assert "safety" in tags
        assert "mandatory" in tags  # severity 也被索引


# =============================================================================
# 缓存管理测试
# =============================================================================


class TestCacheManagement:
    """测试缓存管理"""

    def test_clear_cache(self, rule_index: UnifiedRuleIndex) -> None:
        """清除缓存"""
        # 先加载一些规则到缓存
        rule_index.get_rule("SEC-001")
        rule_index.get_rule("ERR-001")

        stats_before = rule_index.get_stats()
        assert stats_before.cache_size > 0

        rule_index.clear_cache()

        stats_after = rule_index.get_stats()
        assert stats_after.cache_size == 0

    def test_rebuild(self, rule_index: UnifiedRuleIndex) -> None:
        """重建索引"""
        # 先加载一些规则到缓存
        rule_index.get_rule("SEC-001")

        rule_index.rebuild()

        # 索引应该仍然有效
        assert rule_index.has_rule("SEC-001")
        # 缓存应该被清除
        assert rule_index.get_stats().cache_size == 0


# =============================================================================
# 便捷函数测试
# =============================================================================


class TestConvenienceFunctions:
    """测试便捷函数"""

    def test_create_rule_index(self, temp_rules_dir: Path) -> None:
        """create_rule_index 便捷函数"""
        registry = RuleRegistry(rules_dir=temp_rules_dir)
        index = create_rule_index(rule_registry=registry)

        assert index is not None
        assert index.has_rule("SEC-001")


# =============================================================================
# Property-Based Tests
# =============================================================================


class TestPropertyBased:
    """Property-based tests"""

    @given(st.lists(st.sampled_from(["security", "error-handling", "type-safety", "cli_tool"]), min_size=1, max_size=3))
    @settings(max_examples=30)
    def test_search_determinism(self, tags: list) -> None:
        """搜索是确定性的"""
        index = UnifiedRuleIndex()

        result1 = index.search_by_tags(tags)
        result2 = index.search_by_tags(tags)

        assert result1 == result2

    @given(st.lists(st.text(min_size=1, max_size=20), min_size=0, max_size=5))
    @settings(max_examples=30)
    def test_search_always_returns_list(self, tags: list) -> None:
        """搜索总是返回列表"""
        index = UnifiedRuleIndex()

        result = index.search_by_tags(tags)

        assert isinstance(result, list)
