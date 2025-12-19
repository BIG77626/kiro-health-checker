"""
Simplified Architecture - 简化架构核心模块

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: All models in models.py inherit from BaseModel

Rule: ERR-005 (自定义异常继承 Exception)
  - Evidence: SimplifiedArchitectureError inherits from Exception

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit None checks throughout
===================================

简化架构的核心目标：
1. 规则为一等公民：用固定规则集替代Skill智能选择
2. 场景化配置：用户选择业务场景，系统自动映射规则集
3. 三级风险等级：LOW/MEDIUM/HIGH
4. 可解释的风险边界：明确"能防什么"和"不能防什么"
5. 假绿率度量：追踪验证失效，驱动规则迭代

公开API（不包含任何"skill"相关命名）：
- validate_code: 一站式代码验证
- get_scenarios: 获取可用场景列表
- get_rules: 获取规则列表
- get_coverage_boundary: 获取覆盖边界
"""

from .models import (
    # 枚举
    RiskLevel,
    RuleCategory,
    HumanReviewReason,
    # 场景与规则
    Scenario,
    Rule,
    RuleSet,
    # 验证结果
    RuleViolation,
    ValidationResult,
    # 风险评估
    HumanReviewTrigger,
    RiskAssessment,
    # 报告
    CoverageBoundary,
    UsageAdvice,
    HumanReadableReport,
    # 假绿追踪
    ValidationRecord,
    FalseGreenEvent,
    FalseGreenStats,
    # 异常
    SimplifiedArchitectureError,
    ScenarioNotFoundError,
    RuleSetNotFoundError,
    ValidationError,
    FalseGreenRecordError,
)

from .validator import (
    SimplifiedValidator,
    validate_code,
    get_scenarios,
    get_coverage_boundary,
)

from .rule_improvement import (
    # 分析模型
    ImprovementType,
    ImprovementPriority,
    FalseGreenAnalysis,
    RuleImprovement,
    RuleVersion,
    # 分析器
    RuleImprovementAnalyzer,
    RuleVersionManager,
    # 便捷函数
    analyze_false_green,
    suggest_improvement,
)

__all__ = [
    # 公开API（不包含"skill"命名）
    "SimplifiedValidator",
    "validate_code",
    "get_scenarios",
    "get_coverage_boundary",
    # 枚举
    "RiskLevel",
    "RuleCategory",
    "HumanReviewReason",
    # 场景与规则
    "Scenario",
    "Rule",
    "RuleSet",
    # 验证结果
    "RuleViolation",
    "ValidationResult",
    # 风险评估
    "HumanReviewTrigger",
    "RiskAssessment",
    # 报告
    "CoverageBoundary",
    "UsageAdvice",
    "HumanReadableReport",
    # 假绿追踪
    "ValidationRecord",
    "FalseGreenEvent",
    "FalseGreenStats",
    # 异常
    "SimplifiedArchitectureError",
    "ScenarioNotFoundError",
    "RuleSetNotFoundError",
    "ValidationError",
    "FalseGreenRecordError",
    # 规则改进 (Phase 5)
    "ImprovementType",
    "ImprovementPriority",
    "FalseGreenAnalysis",
    "RuleImprovement",
    "RuleVersion",
    "RuleImprovementAnalyzer",
    "RuleVersionManager",
    "analyze_false_green",
    "suggest_improvement",
]
