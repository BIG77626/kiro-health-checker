"""
Rule Registry - 规则注册表

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 2.2)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: Uses Rule, RuleSet, CoverageBoundary from models.py

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: ERR-005 (自定义异常继承 Exception)
  - Evidence: Uses RuleSetNotFoundError

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit `is None` checks
===================================

Requirements: REQ-1.3, REQ-4.1
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Optional, Protocol

import yaml

from .models import (
    CoverageBoundary,
    Rule,
    RuleCategory,
    RuleMaturity,
    RuleSet,
    RuleSetNotFoundError,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Constants
# =============================================================================

RULES_DIR = "rules"


# =============================================================================
# Protocol
# =============================================================================


class RuleRegistryProtocol(Protocol):
    """规则注册表接口"""

    def get_all_rules(self) -> List[Rule]:
        """获取所有规则"""
        ...

    def get_rules_by_category(self, category: RuleCategory) -> List[Rule]:
        """按类别获取规则"""
        ...

    def get_rule_coverage_boundary(self) -> CoverageBoundary:
        """获取规则覆盖边界"""
        ...


# =============================================================================
# Implementation
# =============================================================================


class RuleRegistry:
    """
    规则注册表实现

    管理所有规则的加载、查询和覆盖边界计算。
    """

    def __init__(
        self,
        rules_dir: Optional[Path] = None,
    ) -> None:
        """
        初始化规则注册表。

        Args:
            rules_dir: 规则目录，默认为当前模块所在目录下的 rules/
        """
        # DEF-001: 显式检查 None
        if rules_dir is None:
            rules_dir = Path(__file__).parent / RULES_DIR

        self._rules_dir = Path(rules_dir)

        # 缓存
        self._all_rules_cache: Optional[List[Rule]] = None
        self._rules_by_category_cache: Dict[RuleCategory, List[Rule]] = {}

    def _is_path_safe(self, path: Path) -> bool:
        """
        验证路径是否在允许的目录内 (安全修复 H3)

        防止路径穿越攻击。

        Args:
            path: 要验证的路径

        Returns:
            bool: 路径是否安全
        """
        try:
            resolved = path.resolve()
            allowed = self._rules_dir.resolve()
            # 检查解析后的路径是否以允许目录开头
            # 使用 os.path.commonpath 更安全
            import os
            common = os.path.commonpath([str(resolved), str(allowed)])
            return common == str(allowed)
        except (OSError, ValueError):
            return False

    def get_all_rules(self) -> List[Rule]:
        """
        获取所有规则 (REQ-1.3)

        Returns:
            List[Rule]: 所有规则列表
        """
        # 使用缓存
        if self._all_rules_cache is not None:
            return self._all_rules_cache

        all_rules: List[Rule] = []

        # DEF-001: 显式检查目录是否存在
        if not self._rules_dir.exists():
            logger.warning(f"Rules directory not found: {self._rules_dir}")
            return all_rules

        # 安全修复 H3: 验证规则目录路径
        if not self._is_path_safe(self._rules_dir):
            logger.error(f"Rules directory path validation failed: {self._rules_dir}")
            return all_rules

        # 遍历所有 YAML 文件
        for rules_file in self._rules_dir.glob("*.yml"):
            # 安全修复 H3: 验证每个规则文件路径
            if not self._is_path_safe(rules_file):
                logger.warning(f"Skipping unsafe path: {rules_file}")
                continue

            try:
                rules = self._load_rules_from_file(rules_file)
                all_rules.extend(rules)
            # ERR-001: 指定具体异常类型
            except (OSError, yaml.YAMLError, ValueError) as e:
                logger.warning(f"Failed to load rules from {rules_file}: {e}")
                continue

        # 去重（按 rule.id）
        seen_ids: set[str] = set()
        unique_rules: List[Rule] = []
        for rule in all_rules:
            if rule.id not in seen_ids:
                seen_ids.add(rule.id)
                unique_rules.append(rule)

        self._all_rules_cache = unique_rules
        return unique_rules

    def get_rules_by_category(self, category: RuleCategory) -> List[Rule]:
        """
        按类别获取规则

        Args:
            category: 规则类别

        Returns:
            List[Rule]: 该类别的规则列表
        """
        # 使用缓存
        if category in self._rules_by_category_cache:
            return self._rules_by_category_cache[category]

        all_rules = self.get_all_rules()
        filtered = [rule for rule in all_rules if rule.category == category]

        self._rules_by_category_cache[category] = filtered
        return filtered

    def get_rule_coverage_boundary(self) -> CoverageBoundary:
        """
        获取规则覆盖边界 (REQ-4.1)

        返回"本次检查能防范"和"本次检查不能保证"的明确边界。

        Returns:
            CoverageBoundary: 覆盖边界
        """
        all_rules = self.get_all_rules()

        # 根据规则类别生成"能防范"列表
        can_detect: List[str] = []
        categories_covered = set(rule.category for rule in all_rules)

        category_descriptions = {
            RuleCategory.SYNTAX: "语法错误",
            RuleCategory.SECURITY: "常见安全漏洞（硬编码密码、敏感信息泄露）",
            RuleCategory.ERROR_HANDLING: "错误处理缺失（裸except、静默吞异常）",
            RuleCategory.TYPE_SAFETY: "类型安全问题（Optional未设默认值）",
            RuleCategory.DANGEROUS_CALL: "危险函数调用（eval、exec、os.system）",
            RuleCategory.NETWORK: "网络请求问题（无超时、禁用SSL验证）",
            RuleCategory.FILE_OPERATION: "文件操作风险（路径注入、危险删除）",
            RuleCategory.DATABASE: "数据库安全（SQL注入、连接泄漏）",
        }

        for category in categories_covered:
            desc = category_descriptions.get(category)
            # DEF-001: 显式检查 None
            if desc is not None:
                can_detect.append(desc)

        # 固定的"不能保证"列表
        cannot_guarantee: List[str] = [
            "业务逻辑是否符合你的真实需求",
            "性能是否足够好",
            "在极端输入/极端环境下是否稳定",
            "第三方库的安全性",
            "运行时的资源消耗",
            "并发场景下的正确性",
            "与其他系统的兼容性",
        ]

        return CoverageBoundary(
            can_detect=can_detect,
            cannot_guarantee=cannot_guarantee,
        )

    def get_rule_by_id(self, rule_id: str) -> Optional[Rule]:
        """
        根据ID获取规则

        Args:
            rule_id: 规则ID

        Returns:
            Optional[Rule]: 规则，如果不存在返回 None
        """
        all_rules = self.get_all_rules()
        for rule in all_rules:
            if rule.id == rule_id:
                return rule
        return None

    def get_mandatory_rules(self) -> List[Rule]:
        """
        获取所有强制规则

        Returns:
            List[Rule]: 强制规则列表
        """
        all_rules = self.get_all_rules()
        return [rule for rule in all_rules if rule.severity == "mandatory"]

    def get_recommended_rules(self) -> List[Rule]:
        """
        获取所有推荐规则

        Returns:
            List[Rule]: 推荐规则列表
        """
        all_rules = self.get_all_rules()
        return [rule for rule in all_rules if rule.severity == "recommended"]

    def _load_rules_from_file(self, rules_file: Path) -> List[Rule]:
        """从文件加载规则"""
        with open(rules_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        # DEF-001: 显式检查 None
        if data is None:
            return []

        rules_data = data.get("rules", [])
        # DEF-001: 显式检查类型
        if not isinstance(rules_data, list):
            return []

        rules: List[Rule] = []
        for item in rules_data:
            # DEF-001: 显式检查类型
            if not isinstance(item, dict):
                continue
            try:
                # 处理 maturity 字段：字符串转枚举
                maturity_str = item.get("maturity", "stable")
                try:
                    maturity = RuleMaturity(maturity_str)
                except ValueError:
                    maturity = RuleMaturity.STABLE

                rule = Rule(
                    id=item.get("id", ""),
                    category=RuleCategory(item.get("category", "syntax")),
                    description=item.get("description", ""),
                    human_description=item.get("human_description", ""),
                    severity=item.get("severity", "recommended"),
                    fix_suggestion=item.get("fix_suggestion"),
                    detector=item.get("detector", "grep"),
                    # === 动态规则扩展字段 (REQ-13) ===
                    # 默认值确保向后兼容现有 YAML 规则文件
                    skill_tags=item.get("skill_tags", []),
                    scenario_tags=item.get("scenario_tags", []),
                    maturity=maturity,
                    # === 需求覆盖追踪字段 (REQUIREMENT-COVERAGE-TRACKING 6.1) ===
                    requirement_ids=item.get("requirement_ids", []),
                )
                rules.append(rule)
            except (ValueError, TypeError) as e:
                logger.warning(f"Invalid rule in {rules_file}: {item}, error: {e}")
                continue

        return rules

    def clear_cache(self) -> None:
        """清除缓存"""
        self._all_rules_cache = None
        self._rules_by_category_cache.clear()


# =============================================================================
# Convenience Functions
# =============================================================================


def create_rule_registry(
    rules_dir: Optional[Path] = None,
) -> RuleRegistry:
    """创建 RuleRegistry 实例的便捷函数"""
    return RuleRegistry(rules_dir=rules_dir)
