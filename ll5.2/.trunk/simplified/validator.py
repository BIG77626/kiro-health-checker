"""
Simplified Validator - 简化版验证器

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 4.2)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: Uses all models from models.py

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: ERR-004 (异常链必须使用 from)
  - Evidence: `raise ValidationError(...) from e`

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit `is None` checks
===================================

一站式代码验证入口，整合所有组件。
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Optional

from .models import (
    HumanReadableReport,
    RiskLevel,
    Scenario,
    ValidationError,
    ValidationRecord,
    ValidationResult,
)
from .false_green_tracker import FalseGreenTracker
from .report_generator import HumanReadableReportGenerator
from .risk_calculator import RiskLevelCalculator
from .rule_registry import RuleRegistry
from .rule_selector import RuleSelector
from .rule_validator import RuleBasedValidator
from .scenario_mapper import ScenarioMapper
from .skill_mapping import SkillMappingManager
from .skill_parser import SkillParser

logger = logging.getLogger(__name__)


class SimplifiedValidator:
    """
    简化版验证器

    一站式代码验证入口，整合：
    - 场景映射
    - 规则验证
    - 风险计算
    - 报告生成
    - 假绿追踪

    使用示例:
    ```python
    validator = SimplifiedValidator()

    # 验证代码
    report = validator.validate(code, scenario_id="cli_tool")

    # 导出 Markdown 报告
    markdown = validator.export_markdown(report)

    # 报告假绿事件
    validator.report_false_green(
        validation_id="xxx",
        issue_description="代码有bug"
    )
    ```
    """

    def __init__(
        self,
        config_dir: Optional[Path] = None,
        db_path: Optional[Path] = None,
    ) -> None:
        """
        初始化验证器。

        Args:
            config_dir: 配置目录
            db_path: 假绿追踪数据库路径
        """
        # DEF-001: 显式检查 None
        if config_dir is None:
            config_dir = Path(__file__).parent

        self._config_dir = config_dir

        # 初始化组件
        self._scenario_mapper = ScenarioMapper(config_dir=config_dir)
        self._rule_registry = RuleRegistry(rules_dir=config_dir / "rules")
        self._rule_validator = RuleBasedValidator()
        self._risk_calculator = RiskLevelCalculator()
        self._report_generator = HumanReadableReportGenerator()
        self._false_green_tracker = FalseGreenTracker(db_path=db_path)

        # === 动态规则扩展组件 (REQ-3) ===
        self._skill_parser = SkillParser()
        self._skill_mapping_manager = SkillMappingManager(
            mappings_file=config_dir / "skill_mappings.yml"
        )
        self._rule_selector = RuleSelector(
            rule_registry=self._rule_registry,
            skill_mapping_manager=self._skill_mapping_manager,
        )

        # 最后一次验证的ID（用于报告假绿）
        self._last_validation_id: Optional[str] = None

    def validate(
        self,
        code: str,
        scenario_id: Optional[str] = None,
        filename: Optional[str] = None,
        record_validation: bool = True,
        use_skill_declaration: bool = True,
    ) -> HumanReadableReport:
        """
        验证代码

        支持两种规则选择模式：
        1. Skill声明驱动（默认）：解析代码头部的Skill声明，动态选择规则
        2. 场景驱动（回退）：使用scenario_id选择固定规则集

        Args:
            code: 要验证的代码
            scenario_id: 场景ID，如果为 None 则使用默认场景
            filename: 文件名（可选，用于日志）
            record_validation: 是否记录验证结果（用于假绿追踪）
            use_skill_declaration: 是否使用Skill声明驱动规则选择（默认True）

        Returns:
            HumanReadableReport: 人话报告

        Raises:
            ValidationError: 验证失败
        """
        try:
            # 1. 获取规则集
            ruleset = self._get_ruleset(code, scenario_id, use_skill_declaration)

            # 2. 执行规则验证
            validation_result = self._rule_validator.validate(
                code=code,
                ruleset=ruleset,
                filename=filename,
            )

            # 3. 计算风险等级
            risk_assessment = self._risk_calculator.calculate(
                validation_result=validation_result,
                code=code,
            )

            # 4. 获取覆盖边界
            coverage_boundary = self._rule_registry.get_rule_coverage_boundary()

            # 5. 生成报告
            report = self._report_generator.generate(
                risk_assessment=risk_assessment,
                validation_result=validation_result,
                coverage_boundary=coverage_boundary,
            )

            # 6. 记录验证结果（用于假绿追踪）
            if record_validation:
                validation_id = str(uuid.uuid4())
                self._last_validation_id = validation_id

                try:
                    record = ValidationRecord(
                        id=validation_id,
                        code_hash=validation_result.code_hash,
                        ruleset_version=validation_result.ruleset_version,
                        timestamp=datetime.now(tz=None),
                        risk_level=risk_assessment.level,
                        passed=(risk_assessment.level == RiskLevel.LOW),
                    )
                    self._false_green_tracker.record_validation(record)
                # ERR-001: 指定具体异常类型
                except (OSError, ValueError) as e:
                    logger.warning(f"Failed to record validation: {e}")

            return report

        # ERR-001: 指定具体异常类型
        except (OSError, ValueError, TypeError) as e:
            # ERR-004: 异常链使用 from
            raise ValidationError(
                f"Validation failed: {e}",
                cause=e,
            ) from e

    def _get_ruleset(
        self,
        code: str,
        scenario_id: Optional[str],
        use_skill_declaration: bool,
    ):
        """
        获取规则集（支持Skill声明驱动和场景驱动）

        优先级：
        1. 如果 use_skill_declaration=True，尝试解析Skill声明
        2. 如果Skill声明为空或解析失败，回退到场景选择
        3. 如果场景也未指定，使用默认规则集
        """
        from .models import RuleSet

        # 尝试使用Skill声明驱动
        if use_skill_declaration:
            skill_declaration = self._skill_parser.parse_tolerant(code)

            if not skill_declaration.is_empty():
                # 使用RuleSelector动态选择规则
                selection_result = self._rule_selector.select(
                    skill_declaration=skill_declaration,
                    scenario_id=scenario_id,
                )

                if not selection_result.is_fallback and selection_result.rules:
                    logger.debug(
                        f"Using skill-based rules: {selection_result.get_rule_ids()}"
                    )
                    return RuleSet(
                        id="skill-based",
                        name="Skill-Based RuleSet",
                        rules=selection_result.rules,
                    )

                # 如果是回退，记录原因
                if selection_result.is_fallback:
                    logger.debug(
                        f"Skill selection fallback: {selection_result.fallback_reason}"
                    )

        # 回退到场景选择
        # DEF-001: 显式检查 None
        if scenario_id is None:
            return self._scenario_mapper.get_default_ruleset()
        else:
            return self._scenario_mapper.map_to_ruleset(scenario_id)

    def get_scenarios(self) -> List[Scenario]:
        """
        获取可用场景列表

        Returns:
            List[Scenario]: 场景列表
        """
        return self._scenario_mapper.list_scenarios()

    def get_scenario_summary(self, scenario_id: str) -> str:
        """
        获取场景摘要

        Args:
            scenario_id: 场景ID

        Returns:
            str: 场景摘要
        """
        return self._scenario_mapper.get_scenario_summary(scenario_id)

    def export_markdown(self, report: HumanReadableReport) -> str:
        """
        导出 Markdown 报告

        Args:
            report: 人话报告

        Returns:
            str: Markdown 格式的报告
        """
        return self._report_generator.export_markdown(report)

    def report_false_green(
        self,
        validation_id: Optional[str] = None,
        issue_description: str = "",
        missing_rule: Optional[str] = None,
        rule_too_loose: Optional[str] = None,
    ) -> None:
        """
        报告假绿事件

        Args:
            validation_id: 验证ID，如果为 None 则使用最后一次验证的ID
            issue_description: 问题描述
            missing_rule: 缺失的规则
            rule_too_loose: 过于宽松的规则
        """
        # DEF-001: 显式检查 None
        if validation_id is None:
            validation_id = self._last_validation_id

        if validation_id is None:
            logger.warning("No validation ID available for false green report")
            return

        try:
            self._false_green_tracker.report_false_green(
                validation_id=validation_id,
                issue_description=issue_description,
                missing_rule=missing_rule,
                rule_too_loose=rule_too_loose,
            )
        # ERR-001: 指定具体异常类型
        except (OSError, ValueError) as e:
            logger.warning(f"Failed to report false green: {e}")

    @property
    def last_validation_id(self) -> Optional[str]:
        """获取最后一次验证的ID"""
        return self._last_validation_id


# =============================================================================
# Convenience Functions (公开API，不包含"skill"命名)
# =============================================================================


def validate_code(
    code: str,
    scenario_id: Optional[str] = None,
) -> HumanReadableReport:
    """
    验证代码（便捷函数）

    Args:
        code: 要验证的代码
        scenario_id: 场景ID

    Returns:
        HumanReadableReport: 人话报告
    """
    validator = SimplifiedValidator()
    return validator.validate(code, scenario_id=scenario_id)


def get_scenarios() -> List[Scenario]:
    """
    获取可用场景列表（便捷函数）

    Returns:
        List[Scenario]: 场景列表
    """
    mapper = ScenarioMapper()
    return mapper.list_scenarios()


def get_coverage_boundary():
    """
    获取覆盖边界（便捷函数）

    Returns:
        CoverageBoundary: 覆盖边界
    """
    registry = RuleRegistry()
    return registry.get_rule_coverage_boundary()
