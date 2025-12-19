"""
Unified Rule Index - 统一规则索引

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 2.1)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: IndexStats inherits from BaseModel

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit None checks
===================================

Requirements: REQ-4 (规则索引与高效检索)
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Dict, List, Optional, Set

from pydantic import BaseModel, ConfigDict, Field

from .models import Rule, RuleMaturity
from .rule_registry import RuleRegistry

logger = logging.getLogger(__name__)


# =============================================================================
# Data Models
# =============================================================================


class IndexStats(BaseModel):
    """索引统计信息"""

    model_config = ConfigDict(strict=True, extra="forbid")

    total_rules: int = Field(ge=0, description="总规则数")
    total_tags: int = Field(ge=0, description="总标签数")
    avg_rules_per_tag: float = Field(ge=0.0, description="每个标签平均规则数")
    cache_size: int = Field(ge=0, description="规则缓存大小")


# =============================================================================
# Implementation
# =============================================================================


class UnifiedRuleIndex:
    """
    统一规则索引 - 单层倒排索引 (REQ-4)

    合并三层索引为单层：标签→规则ID（移除Embedding层）
    设计目标：O(1)查询，<10ms响应

    使用示例:
    ```python
    index = UnifiedRuleIndex(rule_registry)

    # 按标签搜索
    rule_ids = index.search_by_tags(["security", "error-handling"])

    # 获取规则（延迟加载）
    rule = index.get_rule("SEC-001")

    # 增量更新（热加载时调用）
    index.incremental_update(new_rule)
    ```
    """

    def __init__(
        self,
        rule_registry: Optional[RuleRegistry] = None,
    ) -> None:
        """
        初始化 UnifiedRuleIndex。

        Args:
            rule_registry: 规则注册表
        """
        # DEF-001: 显式检查 None
        if rule_registry is None:
            rule_registry = RuleRegistry()

        self._rule_registry = rule_registry

        # 1. 标签倒排索引（主索引）: tag → Set[rule_id]
        self._tag_index: Dict[str, Set[str]] = defaultdict(set)

        # 2. 规则ID→Rule的映射（副索引，延迟加载）
        self._rule_cache: Dict[str, Rule] = {}

        # 3. 规则ID集合（用于快速检查存在性）
        self._rule_ids: Set[str] = set()

        # 构建索引
        self._build_index()

    def _build_index(self) -> None:
        """
        初始化时一次性构建索引（100条规则，<10ms）
        """
        rules = self._rule_registry.get_all_rules()

        for rule in rules:
            self._index_rule(rule)

        logger.debug(
            f"Built index: {len(self._rule_ids)} rules, "
            f"{len(self._tag_index)} tags"
        )

    def _index_rule(self, rule: Rule) -> None:
        """索引单条规则"""
        # 记录规则ID
        self._rule_ids.add(rule.id)

        # 索引 skill_tags
        for tag in rule.skill_tags:
            self._tag_index[tag.lower()].add(rule.id)

        # 索引 scenario_tags
        for tag in rule.scenario_tags:
            self._tag_index[tag.lower()].add(rule.id)

        # 索引 category（作为隐式tag）
        self._tag_index[rule.category.value].add(rule.id)

        # 索引 severity（作为隐式tag）
        self._tag_index[rule.severity].add(rule.id)

    def search_by_tags(
        self,
        tags: List[str],
        mode: str = "union",
    ) -> List[str]:
        """
        按标签搜索规则ID (O(1)查询) (REQ-4.1)

        Args:
            tags: 标签列表
            mode: 搜索模式
                - "union": 取并集（任意tag匹配即可，默认）
                - "intersection": 取交集（所有tag都必须匹配）

        Returns:
            List[str]: 匹配的规则ID列表
        """
        if not tags:
            return []

        # 标准化标签
        normalized_tags = [t.lower() for t in tags]

        if mode == "intersection":
            return self._search_intersection(normalized_tags)
        else:
            return self._search_union(normalized_tags)

    def _search_union(self, tags: List[str]) -> List[str]:
        """取并集搜索"""
        result: Set[str] = set()

        for tag in tags:
            if tag in self._tag_index:
                result.update(self._tag_index[tag])

        return sorted(list(result))

    def _search_intersection(self, tags: List[str]) -> List[str]:
        """取交集搜索"""
        if not tags:
            return []

        # 从第一个tag开始取集合
        first_tag = tags[0]
        if first_tag not in self._tag_index:
            return []

        result = self._tag_index[first_tag].copy()

        # 与后续tag取交集
        for tag in tags[1:]:
            if tag not in self._tag_index:
                return []
            result.intersection_update(self._tag_index[tag])

        return sorted(list(result))

    def get_rule(self, rule_id: str) -> Optional[Rule]:
        """
        获取规则（延迟加载，首次访问后缓存）(REQ-4.3)

        Args:
            rule_id: 规则ID

        Returns:
            Optional[Rule]: 规则，如果不存在返回 None
        """
        # 检查缓存
        if rule_id in self._rule_cache:
            return self._rule_cache[rule_id]

        # 从 RuleRegistry 加载
        rule = self._rule_registry.get_rule_by_id(rule_id)

        # DEF-001: 显式检查 None
        if rule is not None:
            self._rule_cache[rule_id] = rule

        return rule

    def get_rules(self, rule_ids: List[str]) -> List[Rule]:
        """
        批量获取规则

        Args:
            rule_ids: 规则ID列表

        Returns:
            List[Rule]: 规则列表（跳过不存在的）
        """
        rules: List[Rule] = []

        for rule_id in rule_ids:
            rule = self.get_rule(rule_id)
            if rule is not None:
                rules.append(rule)

        return rules

    def incremental_update(self, rule: Rule) -> None:
        """
        增量更新索引（热加载时调用）(REQ-4.2)

        Args:
            rule: 新规则或更新的规则
        """
        # 如果规则已存在，先移除旧索引
        if rule.id in self._rule_ids:
            self._remove_rule_from_index(rule.id)

        # 添加新索引
        self._index_rule(rule)

        # 更新缓存
        self._rule_cache[rule.id] = rule

        logger.debug(f"Incremental update: {rule.id}")

    def _remove_rule_from_index(self, rule_id: str) -> None:
        """从索引中移除规则"""
        # 从所有标签索引中移除
        for tag_set in self._tag_index.values():
            tag_set.discard(rule_id)

        # 从规则ID集合中移除
        self._rule_ids.discard(rule_id)

        # 从缓存中移除
        self._rule_cache.pop(rule_id, None)

    def remove_rule(self, rule_id: str) -> bool:
        """
        移除规则

        Args:
            rule_id: 规则ID

        Returns:
            bool: 是否成功移除
        """
        if rule_id not in self._rule_ids:
            return False

        self._remove_rule_from_index(rule_id)
        return True

    def has_rule(self, rule_id: str) -> bool:
        """
        检查规则是否存在

        Args:
            rule_id: 规则ID

        Returns:
            bool: 是否存在
        """
        return rule_id in self._rule_ids

    def get_tags_for_rule(self, rule_id: str) -> List[str]:
        """
        获取规则的所有标签

        Args:
            rule_id: 规则ID

        Returns:
            List[str]: 标签列表
        """
        tags: List[str] = []

        for tag, rule_ids in self._tag_index.items():
            if rule_id in rule_ids:
                tags.append(tag)

        return sorted(tags)

    def get_all_tags(self) -> List[str]:
        """
        获取所有标签

        Returns:
            List[str]: 标签列表
        """
        return sorted(list(self._tag_index.keys()))

    def get_all_rule_ids(self) -> List[str]:
        """
        获取所有规则ID

        Returns:
            List[str]: 规则ID列表
        """
        return sorted(list(self._rule_ids))

    def get_stats(self) -> IndexStats:
        """
        获取索引统计信息

        Returns:
            IndexStats: 统计信息
        """
        total_rules = len(self._rule_ids)
        total_tags = len(self._tag_index)

        # 计算每个标签平均规则数
        if total_tags > 0:
            total_mappings = sum(len(ids) for ids in self._tag_index.values())
            avg_rules_per_tag = total_mappings / total_tags
        else:
            avg_rules_per_tag = 0.0

        return IndexStats(
            total_rules=total_rules,
            total_tags=total_tags,
            avg_rules_per_tag=round(avg_rules_per_tag, 2),
            cache_size=len(self._rule_cache),
        )

    def clear_cache(self) -> None:
        """清除规则缓存"""
        self._rule_cache.clear()

    def rebuild(self) -> None:
        """重建索引"""
        # 清除现有索引
        self._tag_index.clear()
        self._rule_cache.clear()
        self._rule_ids.clear()

        # 重新构建
        self._rule_registry.clear_cache()
        self._build_index()


# =============================================================================
# Convenience Functions
# =============================================================================


def create_rule_index(
    rule_registry: Optional[RuleRegistry] = None,
) -> UnifiedRuleIndex:
    """创建 UnifiedRuleIndex 实例的便捷函数"""
    return UnifiedRuleIndex(rule_registry=rule_registry)
