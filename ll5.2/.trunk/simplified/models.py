"""
Simplified Architecture Models - 统一数据模型

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 1.1)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: All classes inherit from BaseModel

Rule: PYDANTIC-002 (Optional 字段必须显式指定默认值)
  - Evidence: All Optional fields have explicit `= None` or `= Field(default=...)`

Rule: PYDANTIC-004 (使用 ConfigDict 替代 class Config)
  - Evidence: `model_config = ConfigDict(strict=True, extra="forbid")`

Rule: PYDANTIC-006 (应使用 Field() 添加验证约束)
  - Evidence: `Field(ge=0.0, le=1.0)`, `Field(min_length=1)`, `Field(pattern=...)`

Rule: ERR-005 (自定义异常继承 Exception)
  - Evidence: `class SimplifiedArchitectureError(Exception)`

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit None checks in all validation logic
===================================

Requirements: REQ-1, REQ-2, REQ-3, REQ-4, REQ-5, REQ-6, REQ-7, REQ-10
"""

from __future__ import annotations

import hashlib
from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


# =============================================================================
# Exceptions (ERR-005: 自定义异常继承 Exception)
# =============================================================================


class SimplifiedArchitectureError(Exception):
    """简化架构基础异常"""

    def __init__(
        self,
        message: str,
        cause: Optional[Exception] = None,
    ) -> None:
        super().__init__(message)
        self.__cause__ = cause  # ERR-004: 保留异常链
        self.cause = cause
        self.timestamp = datetime.now(tz=None).isoformat()


class ScenarioNotFoundError(SimplifiedArchitectureError):
    """场景未找到"""

    pass


class RuleSetNotFoundError(SimplifiedArchitectureError):
    """规则集未找到"""

    pass


class ValidationError(SimplifiedArchitectureError):
    """验证执行错误"""

    pass


class FalseGreenRecordError(SimplifiedArchitectureError):
    """假绿记录错误"""

    pass


# =============================================================================
# Enums
# =============================================================================


class RiskLevel(str, Enum):
    """
    风险等级 - 三级分类 (REQ-3)

    - LOW: 可试用，但不保证业务完全正确
    - MEDIUM: 需谨慎，有具体风险点
    - HIGH: 强烈不建议运行
    """

    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"


class RuleCategory(str, Enum):
    """规则类别 (REQ-1)"""

    SYNTAX = "syntax"  # 语法检查
    SECURITY = "security"  # 安全检查
    ERROR_HANDLING = "error"  # 错误处理
    TYPE_SAFETY = "type"  # 类型安全
    DANGEROUS_CALL = "dangerous"  # 危险调用
    NETWORK = "network"  # 网络请求
    FILE_OPERATION = "file"  # 文件操作
    DATABASE = "database"  # 数据库操作


class RuleMaturity(str, Enum):
    """
    规则成熟度 (REQ-13 动态规则扩展)

    - EXPERIMENTAL: 新规则，需要验证
    - STABLE: 稳定规则，已验证有效
    - DEPRECATED: 已废弃，计划移除
    """

    EXPERIMENTAL = "experimental"
    STABLE = "stable"
    DEPRECATED = "deprecated"


class HumanReviewReason(str, Enum):
    """人工复核原因 (REQ-5)"""

    FILE_OPERATION = "file_operation"  # 文件操作
    NETWORK_REQUEST = "network_request"  # 网络请求
    DATABASE_OPERATION = "database"  # 数据库操作
    SENSITIVE_DOMAIN = "sensitive_domain"  # 敏感领域（金融/认证/加密）


# =============================================================================
# Scenario & Rule Models (REQ-1, REQ-2)
# =============================================================================


class Scenario(BaseModel):
    """
    使用场景 (REQ-2)

    用户选择的业务场景，如"CLI工具"、"API客户端"。
    系统自动将场景映射到对应的固定规则集。
    """

    id: str = Field(min_length=1, description="场景ID，如 'cli_tool'")
    name: str = Field(min_length=1, description="场景名称，如 'CLI工具'")
    description: str = Field(default="", description="场景描述")
    ruleset_id: str = Field(min_length=1, description="关联的规则集ID")

    # PYDANTIC-004: 使用 ConfigDict 替代 class Config
    model_config = ConfigDict(strict=True, extra="forbid")


class Rule(BaseModel):
    """
    规则定义 (REQ-1, REQ-13 动态规则扩展)

    单条可检测的代码质量/安全要求，是系统的一等公民。
    扩展支持 skill_tags 和 scenario_tags 用于动态规则选择。
    """

    # PYDANTIC-006: 使用 Field() 添加验证约束
    id: str = Field(
        pattern=r"^[A-Z]+-\d{3}$",
        description="规则ID，格式如 'SEC-001'",
    )
    category: RuleCategory = Field(description="规则类别")
    description: str = Field(min_length=1, description="规则描述（技术语言）")
    human_description: str = Field(
        min_length=1,
        description="人话描述（非程序员能看懂）",
    )
    severity: str = Field(
        pattern=r"^(mandatory|recommended)$",
        description="严重级别: mandatory/recommended",
    )
    # PYDANTIC-002: Optional 字段必须显式指定默认值
    fix_suggestion: Optional[str] = Field(
        default=None,
        description="修复建议",
    )
    detector: str = Field(
        default="grep",
        description="检测器类型: grep/ast/manual",
    )

    # === 动态规则扩展字段 (REQ-13) ===
    # 这些字段支持 Skill 声明驱动的动态规则选择
    # 默认值确保向后兼容现有 YAML 规则文件

    skill_tags: List[str] = Field(
        default_factory=list,
        description="Skill标签，用于 Skill 声明匹配，如 ['type-safety', 'error-handling']",
    )
    scenario_tags: List[str] = Field(
        default_factory=list,
        description="场景标签，用于场景匹配，如 ['cli_tool', 'api_client']",
    )
    maturity: RuleMaturity = Field(
        default=RuleMaturity.STABLE,
        description="规则成熟度: experimental/stable/deprecated",
    )

    # === 需求覆盖追踪字段 (REQUIREMENT-COVERAGE-TRACKING 6.1) ===
    # requirement_ids 提供 Rule → Requirement 的反向指针，
    # 支持后续的双向追踪与覆盖统计。
    # 默认使用空列表以保持对现有 YAML 规则文件的向后兼容。
    requirement_ids: List[str] = Field(
        default_factory=list,
        description="关联需求ID列表，如 ['REQ-NET-001']",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


class RuleSet(BaseModel):
    """
    规则集 (REQ-1, REQ-2)

    一组相关规则的集合，按场景组织。
    """

    id: str = Field(min_length=1, description="规则集ID")
    name: str = Field(min_length=1, description="规则集名称")
    version: str = Field(
        default="1.0.0",
        pattern=r"^\d+\.\d+\.\d+$",
        description="版本号",
    )
    rules: List[Rule] = Field(default_factory=list, description="规则列表")

    model_config = ConfigDict(strict=True, extra="forbid")

    def get_rule_ids(self) -> List[str]:
        """获取所有规则ID"""
        return [rule.id for rule in self.rules]


# =============================================================================
# Validation Result Models (REQ-1)
# =============================================================================


class RuleViolation(BaseModel):
    """
    规则违规 (REQ-1.2)

    当规则检测到违规时，返回此结构。
    """

    rule_id: str = Field(min_length=1, description="违规的规则ID")
    rule_description: str = Field(min_length=1, description="规则描述")
    human_description: str = Field(
        min_length=1,
        description="人话描述（非程序员能看懂）",
    )
    severity: str = Field(description="严重级别")
    # PYDANTIC-002: Optional 默认值
    evidence: Optional[str] = Field(
        default=None,
        description="违规证据（代码片段）",
    )
    line_number: Optional[int] = Field(
        default=None,
        ge=1,
        description="违规行号",
    )
    fix_suggestion: Optional[str] = Field(
        default=None,
        description="修复建议",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


class ValidationResult(BaseModel):
    """
    验证结果 (REQ-1.4, REQ-6.1)

    验证完成后的完整结果，包含所有违规记录。
    """

    code_hash: str = Field(min_length=1, description="代码hash（SHA256）")
    ruleset_id: str = Field(min_length=1, description="使用的规则集ID")
    ruleset_version: str = Field(min_length=1, description="规则集版本")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(tz=None),
        description="验证时间",
    )

    # PYDANTIC-006: Field 约束
    total_rules: int = Field(ge=0, description="总规则数")
    passed_rules: int = Field(ge=0, description="通过的规则数")
    failed_rules: int = Field(ge=0, description="失败的规则数")
    violations: List[RuleViolation] = Field(
        default_factory=list,
        description="违规列表",
    )

    # 未覆盖的代码模式 (REQ-4.4)
    uncovered_patterns: List[str] = Field(
        default_factory=list,
        description="未被规则覆盖的代码模式",
    )

    model_config = ConfigDict(strict=True, extra="forbid")

    @staticmethod
    def compute_code_hash(code: str) -> str:
        """计算代码的SHA256哈希"""
        return hashlib.sha256(code.encode("utf-8")).hexdigest()


# =============================================================================
# Risk Assessment Models (REQ-3, REQ-5)
# =============================================================================


class HumanReviewTrigger(BaseModel):
    """
    人工复核触发 (REQ-5)

    当检测到高风险操作时，触发人工复核提醒。
    """

    reason: HumanReviewReason = Field(description="触发原因")
    description: str = Field(min_length=1, description="触发原因描述")
    # PYDANTIC-002: Optional 默认值
    evidence: Optional[str] = Field(
        default=None,
        description="触发证据（代码片段）",
    )
    line_number: Optional[int] = Field(
        default=None,
        ge=1,
        description="触发行号",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


class RiskAssessment(BaseModel):
    """
    风险评估结果 (REQ-3)

    验证完成后的风险等级评估。
    """

    level: RiskLevel = Field(description="风险等级: LOW/MEDIUM/HIGH")
    one_line_summary: str = Field(
        min_length=1,
        description="一句话结论",
    )

    # 风险详情（MEDIUM/HIGH时必填）(REQ-3.3, REQ-3.4)
    risk_points: List[str] = Field(
        default_factory=list,
        description="具体风险点",
    )

    # 人工复核触发 (REQ-5)
    human_review_triggers: List[HumanReviewTrigger] = Field(
        default_factory=list,
        description="人工复核触发列表",
    )
    requires_human_review: bool = Field(
        default=False,
        description="是否需要人工复核",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


# =============================================================================
# Human Readable Report Models (REQ-4, REQ-7)
# =============================================================================


class CoverageBoundary(BaseModel):
    """
    覆盖边界 (REQ-4.1)

    明确"本次检查能防范"和"本次检查不能保证"。
    """

    can_detect: List[str] = Field(
        default_factory=list,
        description="本次检查能防范的问题",
    )
    cannot_guarantee: List[str] = Field(
        default_factory=list,
        description="本次检查不能保证的问题",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


class UsageAdvice(BaseModel):
    """
    使用建议 (REQ-7.3)

    给用户的具体使用建议。
    """

    can_use_for: List[str] = Field(
        default_factory=list,
        description="可以用于的场景",
    )
    should_not_use_for: List[str] = Field(
        default_factory=list,
        description="不要用于的场景",
    )
    next_steps: List[str] = Field(
        default_factory=list,
        description="建议的下一步操作",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


class HumanReadableReport(BaseModel):
    """
    人话报告 (REQ-7)

    非程序员能看懂的验证报告，像"判决书摘要"。
    """

    # 摘要区（顶部醒目）(REQ-7.1)
    risk_level: RiskLevel = Field(description="风险等级")
    one_line_conclusion: str = Field(
        min_length=1,
        description="一句话结论",
    )

    # 人工复核提示（顶部醒目）(REQ-5.5)
    human_review_required: bool = Field(
        default=False,
        description="是否需要人工复核",
    )
    human_review_message: Optional[str] = Field(
        default=None,
        description="人工复核提示信息",
    )

    # 风险边界区 (REQ-4.1)
    coverage_boundary: CoverageBoundary = Field(
        default_factory=CoverageBoundary,
        description="覆盖边界",
    )

    # 使用建议区 (REQ-7.3)
    usage_advice: UsageAdvice = Field(
        default_factory=UsageAdvice,
        description="使用建议",
    )

    # 详细信息区（折叠）(REQ-7.4)
    technical_details: Optional[ValidationResult] = Field(
        default=None,
        description="技术细节（可折叠）",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


# =============================================================================
# False Green Tracking Models (REQ-6)
# =============================================================================


class ValidationRecord(BaseModel):
    """
    验证记录 (REQ-6.1)

    记录每次验证的元数据，用于假绿率追踪。
    """

    id: str = Field(min_length=1, description="记录ID")
    code_hash: str = Field(min_length=1, description="代码hash")
    ruleset_version: str = Field(min_length=1, description="规则集版本")
    timestamp: datetime = Field(
        default_factory=lambda: datetime.now(tz=None),
        description="验证时间",
    )
    risk_level: RiskLevel = Field(description="风险等级")
    passed: bool = Field(description="是否通过验证")

    model_config = ConfigDict(strict=True, extra="forbid")


class FalseGreenEvent(BaseModel):
    """
    假绿事件 (REQ-6.2)

    当用户报告"通过验证但实际有问题"时记录。
    """

    id: str = Field(min_length=1, description="事件ID")
    validation_id: str = Field(
        min_length=1,
        description="关联的验证记录ID",
    )
    reported_at: datetime = Field(
        default_factory=lambda: datetime.now(tz=None),
        description="报告时间",
    )
    issue_description: str = Field(
        min_length=1,
        description="问题描述",
    )

    # 分析结果 (REQ-6.4)
    missing_rule: Optional[str] = Field(
        default=None,
        description="缺失的规则（如果是规则缺失）",
    )
    rule_too_loose: Optional[str] = Field(
        default=None,
        description="过于宽松的规则（如果是规则太宽松）",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


class FalseGreenStats(BaseModel):
    """
    假绿率统计 (REQ-6.3)

    指定时间段内的假绿率统计。
    """

    period_start: datetime = Field(description="统计开始时间")
    period_end: datetime = Field(description="统计结束时间")
    # PYDANTIC-006: Field 约束
    total_validations: int = Field(ge=0, description="总验证次数")
    total_passed: int = Field(ge=0, description="通过验证的次数")
    false_green_count: int = Field(ge=0, description="假绿事件数")
    false_green_rate: float = Field(
        ge=0.0,
        le=1.0,
        description="假绿率 (0.0-1.0)",
    )

    model_config = ConfigDict(strict=True, extra="forbid")

    @staticmethod
    def calculate_rate(false_green_count: int, total_passed: int) -> float:
        """
        计算假绿率 (Property 10)

        DEF-002: 防止除零错误
        """
        if total_passed == 0:
            return 0.0
        return false_green_count / total_passed


# =============================================================================
# Rule Quality Tracking Models (REQ-6, REQ-16 动态规则扩展)
# =============================================================================


class RuleMetrics(BaseModel):
    """
    规则质量指标 (REQ-6, REQ-16)

    简化版，聚焦触发频次和误报率。
    用于追踪规则的使用情况和质量。
    """

    rule_id: str = Field(min_length=1, description="规则ID")
    trigger_count: int = Field(default=0, ge=0, description="触发次数")
    false_positive_count: int = Field(default=0, ge=0, description="误报次数")
    last_triggered: Optional[datetime] = Field(
        default=None,
        description="最后触发时间",
    )
    is_disabled: bool = Field(default=False, description="是否已禁用")
    disable_reason: Optional[str] = Field(
        default=None,
        description="禁用原因",
    )

    model_config = ConfigDict(strict=True, extra="forbid")

    @property
    def false_positive_rate(self) -> float:
        """
        计算误报率

        DEF-002: 防止除零错误
        """
        if self.trigger_count == 0:
            return 0.0
        return self.false_positive_count / self.trigger_count

    def should_auto_disable(self, min_triggers: int = 5, max_fp_rate: float = 0.5) -> bool:
        """
        判断是否应自动禁用 (REQ-6.5, REQ-16.3)

        条件：误报率>50% 且 触发>5次
        """
        if self.trigger_count < min_triggers:
            return False
        return self.false_positive_rate > max_fp_rate


class RuleQualityError(SimplifiedArchitectureError):
    """规则质量追踪错误"""

    pass
