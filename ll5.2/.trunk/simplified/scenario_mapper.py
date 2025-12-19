"""
Scenario Mapper - 场景映射器

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 2.1)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: Uses Scenario, RuleSet from models.py

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: ERR-004 (异常链必须使用 from)
  - Evidence: `raise ScenarioNotFoundError(...) from e`

Rule: ERR-005 (自定义异常继承 Exception)
  - Evidence: Uses ScenarioNotFoundError, RuleSetNotFoundError

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit `is None` checks
===================================

Requirements: REQ-2.1, REQ-2.2, REQ-2.3, REQ-2.4
Property 1: 场景映射确定性 - 多次调用返回相同结果
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Dict, List, Optional, Protocol

import yaml

from .models import (
    Rule,
    RuleCategory,
    RuleSet,
    Scenario,
    ScenarioNotFoundError,
    RuleSetNotFoundError,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Constants
# =============================================================================

DEFAULT_SCENARIO_ID = "general"
SCENARIOS_FILE = "scenarios.yml"
RULES_DIR = "rules"


# =============================================================================
# Protocol
# =============================================================================


class ScenarioMapperProtocol(Protocol):
    """场景映射器接口"""

    def list_scenarios(self) -> List[Scenario]:
        """列出所有可用场景"""
        ...

    def map_to_ruleset(self, scenario_id: str) -> RuleSet:
        """将场景映射到固定规则集"""
        ...

    def get_default_ruleset(self) -> RuleSet:
        """获取默认通用规则集"""
        ...


# =============================================================================
# Implementation
# =============================================================================


class ScenarioMapper:
    """
    场景映射器实现

    将用户选择的业务场景映射到固定的规则集。
    这替代了原来的"Skill智能选择"机制。

    Property 1 保证：场景映射是确定性的，多次调用返回相同结果。
    """

    def __init__(
        self,
        config_dir: Optional[Path] = None,
    ) -> None:
        """
        初始化场景映射器。

        Args:
            config_dir: 配置目录，默认为当前模块所在目录
        """
        # DEF-001: 显式检查 None
        if config_dir is None:
            config_dir = Path(__file__).parent

        self._config_dir = Path(config_dir)
        self._scenarios_file = self._config_dir / SCENARIOS_FILE
        self._rules_dir = self._config_dir / RULES_DIR

        # 缓存（保证 Property 1: 确定性）
        self._scenarios_cache: Optional[List[Scenario]] = None
        self._rulesets_cache: Dict[str, RuleSet] = {}

    def list_scenarios(self) -> List[Scenario]:
        """
        列出所有可用场景 (REQ-2.1)

        Returns:
            List[Scenario]: 可用场景列表

        Raises:
            ScenarioNotFoundError: 配置文件不存在或解析失败
        """
        # 使用缓存保证确定性
        if self._scenarios_cache is not None:
            return self._scenarios_cache

        try:
            # DEF-001: 显式检查文件是否存在
            if not self._scenarios_file.exists():
                logger.warning(
                    f"Scenarios file not found: {self._scenarios_file}"
                )
                return self._get_default_scenarios()

            with open(self._scenarios_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            # DEF-001: 显式检查 None
            if data is None:
                logger.warning("Scenarios file is empty")
                return self._get_default_scenarios()

            scenarios_data = data.get("scenarios", [])
            # DEF-001: 显式检查类型
            if not isinstance(scenarios_data, list):
                logger.warning("Invalid scenarios format")
                return self._get_default_scenarios()

            scenarios: List[Scenario] = []
            for item in scenarios_data:
                # DEF-001: 显式检查类型
                if not isinstance(item, dict):
                    continue
                try:
                    scenario = Scenario(
                        id=item.get("id", ""),
                        name=item.get("name", ""),
                        description=item.get("description", ""),
                        ruleset_id=item.get("ruleset_id", ""),
                    )
                    scenarios.append(scenario)
                except (ValueError, TypeError) as e:
                    logger.warning(f"Invalid scenario: {item}, error: {e}")
                    continue

            self._scenarios_cache = scenarios
            return scenarios

        # ERR-001: 指定具体异常类型
        except (OSError, yaml.YAMLError) as e:
            # ERR-004: 异常链使用 from
            raise ScenarioNotFoundError(
                f"Failed to load scenarios: {e}",
                cause=e,
            ) from e

    def map_to_ruleset(self, scenario_id: str) -> RuleSet:
        """
        将场景映射到固定规则集 (REQ-2.2)

        Property 1: 相同的 scenario_id 总是返回相同的 RuleSet。

        Args:
            scenario_id: 场景ID

        Returns:
            RuleSet: 对应的规则集

        Raises:
            ScenarioNotFoundError: 场景不存在
            RuleSetNotFoundError: 规则集不存在
        """
        # 使用缓存保证确定性
        if scenario_id in self._rulesets_cache:
            return self._rulesets_cache[scenario_id]

        # 查找场景
        scenarios = self.list_scenarios()
        target_scenario: Optional[Scenario] = None

        for scenario in scenarios:
            if scenario.id == scenario_id:
                target_scenario = scenario
                break

        # DEF-001: 显式检查 None
        if target_scenario is None:
            raise ScenarioNotFoundError(
                f"Scenario not found: {scenario_id}"
            )

        # 加载规则集
        ruleset = self._load_ruleset(target_scenario.ruleset_id)

        # 缓存结果
        self._rulesets_cache[scenario_id] = ruleset

        return ruleset

    def get_default_ruleset(self) -> RuleSet:
        """
        获取默认通用规则集 (REQ-2.4)

        Returns:
            RuleSet: 默认规则集
        """
        try:
            return self.map_to_ruleset(DEFAULT_SCENARIO_ID)
        # ERR-001: 指定具体异常类型
        except (ScenarioNotFoundError, RuleSetNotFoundError):
            # 返回内置的最小规则集
            return self._get_builtin_core_ruleset()

    def get_scenario_summary(self, scenario_id: str) -> str:
        """
        获取场景将检查的规则类别摘要 (REQ-2.3)

        Args:
            scenario_id: 场景ID

        Returns:
            str: 规则类别摘要
        """
        try:
            ruleset = self.map_to_ruleset(scenario_id)
            categories = set(rule.category for rule in ruleset.rules)
            category_names = [cat.value for cat in categories]
            return f"将检查: {', '.join(category_names)}"
        # ERR-001: 指定具体异常类型
        except (ScenarioNotFoundError, RuleSetNotFoundError) as e:
            return f"无法获取摘要: {e}"

    def _load_ruleset(self, ruleset_id: str) -> RuleSet:
        """加载规则集"""
        # 规则集ID到文件的映射
        ruleset_files = {
            # 核心规则集现在包含所有规则，确保默认场景能检测所有问题
            "ruleset_core": [
                "core_rules.yml",
                "network_rules.yml",
                "file_rules.yml",
                "database_rules.yml",
            ],
            "ruleset_cli": ["core_rules.yml", "file_rules.yml"],
            "ruleset_api": ["core_rules.yml", "network_rules.yml"],
            "ruleset_data": ["core_rules.yml"],
            "ruleset_web": [
                "core_rules.yml",
                "network_rules.yml",
                "database_rules.yml",
            ],
            "ruleset_network": ["network_rules.yml"],
            "ruleset_file": ["file_rules.yml"],
            "ruleset_database": ["database_rules.yml"],
        }

        files = ruleset_files.get(ruleset_id)
        # DEF-001: 显式检查 None
        if files is None:
            raise RuleSetNotFoundError(f"Unknown ruleset: {ruleset_id}")

        all_rules: List[Rule] = []

        for filename in files:
            rules_file = self._rules_dir / filename
            # DEF-001: 显式检查文件是否存在
            if not rules_file.exists():
                logger.warning(f"Rules file not found: {rules_file}")
                continue

            try:
                with open(rules_file, "r", encoding="utf-8") as f:
                    data = yaml.safe_load(f)

                # DEF-001: 显式检查 None
                if data is None:
                    continue

                rules_data = data.get("rules", [])
                # DEF-001: 显式检查类型
                if not isinstance(rules_data, list):
                    continue

                for item in rules_data:
                    # DEF-001: 显式检查类型
                    if not isinstance(item, dict):
                        continue
                    try:
                        rule = Rule(
                            id=item.get("id", ""),
                            category=RuleCategory(item.get("category", "syntax")),
                            description=item.get("description", ""),
                            human_description=item.get("human_description", ""),
                            severity=item.get("severity", "recommended"),
                            fix_suggestion=item.get("fix_suggestion"),
                            detector=item.get("detector", "grep"),
                        )
                        all_rules.append(rule)
                    except (ValueError, TypeError) as e:
                        logger.warning(f"Invalid rule: {item}, error: {e}")
                        continue

            # ERR-001: 指定具体异常类型
            except (OSError, yaml.YAMLError) as e:
                logger.warning(f"Failed to load rules from {filename}: {e}")
                continue

        return RuleSet(
            id=ruleset_id,
            name=f"RuleSet: {ruleset_id}",
            version="1.0.0",
            rules=all_rules,
        )

    def _get_default_scenarios(self) -> List[Scenario]:
        """获取默认场景列表"""
        return [
            Scenario(
                id="general",
                name="通用",
                description="通用Python代码场景",
                ruleset_id="ruleset_core",
            ),
        ]

    def _get_builtin_core_ruleset(self) -> RuleSet:
        """获取内置的核心规则集"""
        return RuleSet(
            id="ruleset_core_builtin",
            name="内置核心规则集",
            version="1.0.0",
            rules=[
                Rule(
                    id="SEC-001",
                    category=RuleCategory.DANGEROUS_CALL,
                    description="禁止使用 eval() 函数",
                    human_description="这段代码可能会执行任意代码，非常危险",
                    severity="mandatory",
                    fix_suggestion="使用 ast.literal_eval() 替代",
                ),
                Rule(
                    id="ERR-001",
                    category=RuleCategory.ERROR_HANDLING,
                    description="禁止裸 except",
                    human_description="这段代码会吞掉所有错误",
                    severity="mandatory",
                    fix_suggestion="使用 except (KeyError, ValueError) as e:",
                ),
            ],
        )


# =============================================================================
# Convenience Functions
# =============================================================================


def create_scenario_mapper(
    config_dir: Optional[Path] = None,
) -> ScenarioMapper:
    """创建 ScenarioMapper 实例的便捷函数"""
    return ScenarioMapper(config_dir=config_dir)
