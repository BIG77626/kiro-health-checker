"""
Skill Rule Mapping - Skill到规则的映射管理

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 1.3)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: SkillRuleMapping inherits from BaseModel

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit None checks
===================================

Requirements: REQ-5 (Skill到规则的映射管理)
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Optional, Set

import yaml
from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)


# =============================================================================
# Data Models
# =============================================================================


class SkillRuleMapping(BaseModel):
    """
    Skill到规则的映射 (REQ-5.1)

    定义一个Skill应该检查哪些规则。
    """

    model_config = ConfigDict(strict=True, extra="forbid")

    skill_name: str = Field(
        min_length=1,
        description="Skill名称，如 'PYDANTIC-TYPE-SAFETY'",
    )
    rule_ids: List[str] = Field(
        default_factory=list,
        description="关联的规则ID列表",
    )
    inherits_from: Optional[str] = Field(
        default=None,
        description="继承的父Skill名称",
    )
    skill_tags: List[str] = Field(
        default_factory=list,
        description="Skill标签，用于规则匹配",
    )
    description: str = Field(
        default="",
        description="Skill描述",
    )


class SkillMappingRegistry(BaseModel):
    """
    Skill映射注册表

    管理所有Skill到规则的映射。
    """

    model_config = ConfigDict(strict=True, extra="forbid")

    mappings: Dict[str, SkillRuleMapping] = Field(
        default_factory=dict,
        description="Skill名称到映射的字典",
    )
    version: str = Field(
        default="1.0.0",
        description="映射版本",
    )


# =============================================================================
# Implementation
# =============================================================================


class SkillMappingManager:
    """
    Skill映射管理器 (REQ-5)

    管理Skill到规则的映射，支持继承机制。
    """

    def __init__(
        self,
        mappings_file: Optional[Path] = None,
    ) -> None:
        """
        初始化 SkillMappingManager。

        Args:
            mappings_file: 映射文件路径，默认为当前模块所在目录下的 skill_mappings.yml
        """
        # DEF-001: 显式检查 None
        if mappings_file is None:
            mappings_file = Path(__file__).parent / "skill_mappings.yml"

        self._mappings_file = Path(mappings_file)
        self._mappings: Dict[str, SkillRuleMapping] = {}
        self._load_mappings()

    def _load_mappings(self) -> None:
        """从文件加载映射"""
        if not self._mappings_file.exists():
            logger.warning(f"Skill mappings file not found: {self._mappings_file}")
            return

        try:
            with open(self._mappings_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            # DEF-001: 显式检查 None
            if data is None:
                return

            mappings_data = data.get("mappings", [])
            if not isinstance(mappings_data, list):
                return

            for item in mappings_data:
                if not isinstance(item, dict):
                    continue
                try:
                    mapping = SkillRuleMapping(
                        skill_name=item.get("skill_name", ""),
                        rule_ids=item.get("rule_ids", []),
                        inherits_from=item.get("inherits_from"),
                        skill_tags=item.get("skill_tags", []),
                        description=item.get("description", ""),
                    )
                    self._mappings[mapping.skill_name] = mapping
                except (ValueError, TypeError) as e:
                    logger.warning(f"Invalid skill mapping: {item}, error: {e}")
                    continue

        except (OSError, yaml.YAMLError) as e:
            logger.warning(f"Failed to load skill mappings: {e}")

    def get_mapping(self, skill_name: str) -> Optional[SkillRuleMapping]:
        """
        获取Skill映射 (REQ-5.1)

        Args:
            skill_name: Skill名称

        Returns:
            Optional[SkillRuleMapping]: 映射，如果不存在返回 None
        """
        # 标准化名称（大写）
        normalized = skill_name.strip().upper()
        return self._mappings.get(normalized)

    def get_rule_ids(self, skill_name: str) -> List[str]:
        """
        获取Skill关联的规则ID（包含继承）(REQ-5.2)

        Args:
            skill_name: Skill名称

        Returns:
            List[str]: 规则ID列表（去重）
        """
        rule_ids: Set[str] = set()
        visited: Set[str] = set()

        self._collect_rule_ids(skill_name, rule_ids, visited)

        return sorted(list(rule_ids))

    def _collect_rule_ids(
        self,
        skill_name: str,
        rule_ids: Set[str],
        visited: Set[str],
    ) -> None:
        """递归收集规则ID（处理继承）"""
        normalized = skill_name.strip().upper()

        # 防止循环继承
        if normalized in visited:
            logger.warning(f"Circular inheritance detected for skill: {normalized}")
            return
        visited.add(normalized)

        mapping = self._mappings.get(normalized)
        if mapping is None:
            return

        # 添加当前Skill的规则
        rule_ids.update(mapping.rule_ids)

        # 递归处理继承
        if mapping.inherits_from is not None:
            self._collect_rule_ids(mapping.inherits_from, rule_ids, visited)

    def get_skill_tags(self, skill_name: str) -> List[str]:
        """
        获取Skill的标签（包含继承）(REQ-5.3)

        Args:
            skill_name: Skill名称

        Returns:
            List[str]: 标签列表（去重）
        """
        tags: Set[str] = set()
        visited: Set[str] = set()

        self._collect_skill_tags(skill_name, tags, visited)

        return sorted(list(tags))

    def _collect_skill_tags(
        self,
        skill_name: str,
        tags: Set[str],
        visited: Set[str],
    ) -> None:
        """递归收集标签（处理继承）"""
        normalized = skill_name.strip().upper()

        # 防止循环继承
        if normalized in visited:
            return
        visited.add(normalized)

        mapping = self._mappings.get(normalized)
        if mapping is None:
            return

        # 添加当前Skill的标签
        tags.update(mapping.skill_tags)

        # 递归处理继承
        if mapping.inherits_from is not None:
            self._collect_skill_tags(mapping.inherits_from, tags, visited)

    def get_all_mappings(self) -> List[SkillRuleMapping]:
        """
        获取所有映射

        Returns:
            List[SkillRuleMapping]: 所有映射列表
        """
        return list(self._mappings.values())

    def get_all_skill_names(self) -> List[str]:
        """
        获取所有Skill名称

        Returns:
            List[str]: Skill名称列表
        """
        return sorted(list(self._mappings.keys()))

    def add_mapping(self, mapping: SkillRuleMapping) -> None:
        """
        添加映射

        Args:
            mapping: Skill映射
        """
        normalized = mapping.skill_name.strip().upper()
        self._mappings[normalized] = mapping

    def remove_mapping(self, skill_name: str) -> bool:
        """
        移除映射

        Args:
            skill_name: Skill名称

        Returns:
            bool: 是否成功移除
        """
        normalized = skill_name.strip().upper()
        if normalized in self._mappings:
            del self._mappings[normalized]
            return True
        return False


# =============================================================================
# Convenience Functions
# =============================================================================


def create_skill_mapping_manager(
    mappings_file: Optional[Path] = None,
) -> SkillMappingManager:
    """创建 SkillMappingManager 实例的便捷函数"""
    return SkillMappingManager(mappings_file=mappings_file)


def get_rule_ids_for_skill(skill_name: str) -> List[str]:
    """
    获取Skill关联的规则ID的便捷函数

    Args:
        skill_name: Skill名称

    Returns:
        List[str]: 规则ID列表
    """
    manager = SkillMappingManager()
    return manager.get_rule_ids(skill_name)
