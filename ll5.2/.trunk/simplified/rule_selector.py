"""
Rule Selector - 动态规则选择器

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 1.4)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: RuleSet inherits from BaseModel

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit None checks
===================================

Requirements: REQ-3 (动态规则选择)
"""

from __future__ import annotations

import logging
from collections import defaultdict
from pathlib import Path
from typing import Dict, List, Optional, Set

from pydantic import BaseModel, ConfigDict, Field

from .models import Rule, RuleCategory, RuleMaturity, RuleSet
from .rule_registry import RuleRegistry
from .skill_mapping import SkillMappingManager
from .skill_parser import SkillDeclaration

logger = logging.getLogger(__name__)


# =============================================================================
# Data Models
# =============================================================================


class RuleSelectionResult(BaseModel):
    """
    规则选择结果

    包含选中的规则和选择过程的元数据。
    """

    model_config = ConfigDict(strict=True, extra="forbid")

    rules: List[Rule] = Field(
        default_factory=list,
        description="选中的规则列表",
    )
    skill_tags_used: List[str] = Field(
        default_factory=list,
        description="用于选择的skill_tags",
    )
    scenario_id: Optional[str] = Field(
        default=None,
        description="使用的场景ID（如果有）",
    )
    is_fallback: bool = Field(
        default=False,
        description="是否使用了回退机制",
    )
    fallback_reason: Optional[str] = Field(
        default=None,
        description="回退原因",
    )

    def get_rule_ids(self) -> List[str]:
        """获取所有规则ID"""
        return [rule.id for rule in self.rules]


# =============================================================================
# Implementation
# =============================================================================


class RuleSelector:
    """
    动态规则选择器 (REQ-3)

    根据Skill声明动态选择规则，采用倒排索引实现O(1)查询。
    """

    def __init__(
        self,
        rule_registry: Optional[RuleRegistry] = None,
        skill_mapping_manager: Optional[SkillMappingManager] = None,
    ) -> None:
        """
        初始化 RuleSelector。

        Args:
            rule_registry: 规则注册表
            skill_mapping_manager: Skill映射管理器
        """
        # DEF-001: 显式检查 None
        if rule_registry is None:
            rule_registry = RuleRegistry()
        if skill_mapping_manager is None:
            skill_mapping_manager = SkillMappingManager()

        self._rule_registry = rule_registry
        self._skill_mapping_manager = skill_mapping_manager

        # 构建倒排索引：tag → rule_ids
        self._inverted_index: Dict[str, Set[str]] = defaultdict(set)
        self._build_inverted_index()

    def _build_inverted_index(self) -> None:
        """
        构建倒排索引（借鉴Prometheus的label-index机制）

        索引结构：tag → Set[rule_id]
        """
        for rule in self._rule_registry.get_all_rules():
            # 索引 skill_tags
            for tag in rule.skill_tags:
                self._inverted_index[tag.lower()].add(rule.id)

            # 索引 scenario_tags
            for tag in rule.scenario_tags:
                self._inverted_index[tag.lower()].add(rule.id)

            # 索引 category（作为隐式tag）
            self._inverted_index[rule.category.value].add(rule.id)

        logger.debug(f"Built inverted index with {len(self._inverted_index)} tags")

    def select(
        self,
        skill_declaration: SkillDeclaration,
        scenario_id: Optional[str] = None,
    ) -> RuleSelectionResult:
        """
        根据Skill声明选择规则 (REQ-3.1)

        Args:
            skill_declaration: Skill声明
            scenario_id: 场景ID（可选，用于回退）

        Returns:
            RuleSelectionResult: 选择结果
        """
        # 1. 收集所有skill_tags
        skill_tags = self._collect_skill_tags(skill_declaration)

        # 2. 如果没有skill_tags，使用回退机制
        if not skill_tags:
            return self._fallback_selection(scenario_id, "No skill tags found")

        # 3. 使用倒排索引查询候选规则
        candidate_ids = self._query_by_tags(skill_tags)

        # 4. 如果没有候选规则，使用回退机制
        if not candidate_ids:
            return self._fallback_selection(
                scenario_id,
                f"No rules found for tags: {skill_tags}",
            )

        # 5. 加载规则并排序
        rules = self._load_and_sort_rules(candidate_ids)

        # 6. 添加显式引用的规则
        rules = self._add_explicit_rules(rules, skill_declaration.rule_ids)

        return RuleSelectionResult(
            rules=rules,
            skill_tags_used=skill_tags,
            scenario_id=scenario_id,
            is_fallback=False,
        )

    def select_by_tags(self, tags: List[str]) -> RuleSelectionResult:
        """
        根据标签选择规则（简化接口）

        Args:
            tags: 标签列表

        Returns:
            RuleSelectionResult: 选择结果
        """
        if not tags:
            return self._fallback_selection(None, "Empty tags")

        candidate_ids = self._query_by_tags(tags)
        rules = self._load_and_sort_rules(candidate_ids)

        return RuleSelectionResult(
            rules=rules,
            skill_tags_used=tags,
            is_fallback=len(rules) == 0,
        )

    def _collect_skill_tags(self, skill_declaration: SkillDeclaration) -> List[str]:
        """收集所有skill_tags"""
        tags: Set[str] = set()

        # 从声明中直接获取的tags
        tags.update(t.lower() for t in skill_declaration.skill_tags)

        # 从Skill名称通过映射获取的tags
        for skill_name in skill_declaration.skills:
            mapping_tags = self._skill_mapping_manager.get_skill_tags(skill_name)
            tags.update(t.lower() for t in mapping_tags)

        return sorted(list(tags))

    def _query_by_tags(self, tags: List[str]) -> Set[str]:
        """
        使用倒排索引查询规则ID (O(1)查询)

        采用OR语义：任意tag匹配即可
        """
        candidate_ids: Set[str] = set()

        for tag in tags:
            tag_lower = tag.lower()
            if tag_lower in self._inverted_index:
                candidate_ids.update(self._inverted_index[tag_lower])

        return candidate_ids

    def _load_and_sort_rules(self, rule_ids: Set[str]) -> List[Rule]:
        """加载规则并按severity排序"""
        rules: List[Rule] = []

        for rule_id in rule_ids:
            rule = self._rule_registry.get_rule_by_id(rule_id)
            if rule is not None:
                # 跳过已废弃的规则
                if rule.maturity == RuleMaturity.DEPRECATED:
                    logger.debug(f"Skipping deprecated rule: {rule_id}")
                    continue
                rules.append(rule)

        # 按severity排序：mandatory > recommended
        severity_order = {"mandatory": 0, "recommended": 1}
        rules.sort(key=lambda r: severity_order.get(r.severity, 2))

        return rules

    def _add_explicit_rules(
        self,
        rules: List[Rule],
        explicit_rule_ids: List[str],
    ) -> List[Rule]:
        """添加显式引用的规则"""
        existing_ids = {r.id for r in rules}
        added_any = False

        for rule_id in explicit_rule_ids:
            if rule_id not in existing_ids:
                rule = self._rule_registry.get_rule_by_id(rule_id)
                if rule is not None:
                    rules.append(rule)
                    existing_ids.add(rule_id)
                    added_any = True
                else:
                    logger.warning(f"Explicit rule not found: {rule_id}")

        # 重新排序以保持 mandatory 优先级
        if added_any:
            severity_order = {"mandatory": 0, "recommended": 1}
            rules.sort(key=lambda r: (severity_order.get(r.severity, 2), r.id))

        return rules

    def _fallback_selection(
        self,
        scenario_id: Optional[str],
        reason: str,
    ) -> RuleSelectionResult:
        """
        回退机制 (REQ-3.3)

        当无法根据Skill声明选择规则时，使用核心规则集。
        """
        logger.warning(f"Using fallback selection: {reason}")

        # 获取核心规则（mandatory规则）
        fallback_rules = self._rule_registry.get_mandatory_rules()

        return RuleSelectionResult(
            rules=fallback_rules,
            skill_tags_used=[],
            scenario_id=scenario_id,
            is_fallback=True,
            fallback_reason=reason,
        )

    def merge_rules(self, rule_sets: List[List[Rule]]) -> List[Rule]:
        """
        合并多个规则集并去重 (REQ-3.2)

        Args:
            rule_sets: 规则集列表

        Returns:
            List[Rule]: 合并后的规则列表（去重）
        """
        seen_ids: Set[str] = set()
        merged: List[Rule] = []

        for rules in rule_sets:
            for rule in rules:
                if rule.id not in seen_ids:
                    seen_ids.add(rule.id)
                    merged.append(rule)

        # 按severity排序
        severity_order = {"mandatory": 0, "recommended": 1}
        merged.sort(key=lambda r: severity_order.get(r.severity, 2))

        return merged

    def get_fallback_rules(self) -> List[Rule]:
        """
        获取回退规则集 (REQ-3.3)

        Returns:
            List[Rule]: 核心规则集
        """
        return self._rule_registry.get_mandatory_rules()

    def rebuild_index(self) -> None:
        """重建倒排索引（热加载后调用）"""
        self._inverted_index.clear()
        self._build_inverted_index()


# =============================================================================
# Convenience Functions
# =============================================================================


def create_rule_selector(
    rule_registry: Optional[RuleRegistry] = None,
    skill_mapping_manager: Optional[SkillMappingManager] = None,
) -> RuleSelector:
    """创建 RuleSelector 实例的便捷函数"""
    return RuleSelector(
        rule_registry=rule_registry,
        skill_mapping_manager=skill_mapping_manager,
    )


def select_rules_for_code(code: str) -> RuleSelectionResult:
    """
    为代码选择规则的便捷函数

    Args:
        code: 源代码字符串

    Returns:
        RuleSelectionResult: 选择结果
    """
    from .skill_parser import parse_skill_declaration

    skill_declaration = parse_skill_declaration(code)
    selector = RuleSelector()
    return selector.select(skill_declaration)
