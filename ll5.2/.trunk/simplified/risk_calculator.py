"""
Risk Level Calculator - 风险等级计算器

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 2.4)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: Uses RiskAssessment, HumanReviewTrigger from models.py

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit `is None` checks

Rule: DEF-002 (数值计算必须防止除零)
  - Evidence: `_safe_divide()` function
===================================

Requirements: REQ-3.1, REQ-3.2, REQ-3.3, REQ-3.4, REQ-5.1-5.5
Properties:
  - Property 2: 风险等级三值约束
  - Property 3: 非LOW风险必须有详细说明
  - Property 5: 高风险操作触发人工复核
  - Property 6: 敏感领域强制HIGH风险
"""

from __future__ import annotations

import logging
import re
from typing import List, Optional, Protocol, Set

from .models import (
    HumanReviewReason,
    HumanReviewTrigger,
    RiskAssessment,
    RiskLevel,
    RuleViolation,
    ValidationResult,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Constants
# =============================================================================

# 敏感领域关键词 (REQ-5.4)
SENSITIVE_DOMAIN_KEYWORDS: Set[str] = {
    # 金融/支付
    "payment", "pay", "charge", "billing", "invoice", "transaction",
    "credit", "debit", "bank", "money", "currency", "wallet",
    # 认证/授权
    "auth", "login", "logout", "password", "credential", "token",
    "session", "jwt", "oauth", "permission", "role", "access",
    # 加密
    "encrypt", "decrypt", "hash", "sign", "verify", "certificate",
    "ssl", "tls", "secret", "key", "cipher",
    # 隐私/合规
    "gdpr", "pii", "personal", "privacy", "sensitive", "confidential",
}

# 文件操作模式 (REQ-5.1)
FILE_OPERATION_PATTERNS: List[str] = [
    r"open\s*\([^)]*['\"]w",  # 写入模式
    r"os\.remove\s*\(",
    r"os\.unlink\s*\(",
    r"shutil\.rmtree\s*\(",
    r"shutil\.move\s*\(",
    r"shutil\.copy\s*\(",
    r"Path\([^)]*\)\.write",
    r"Path\([^)]*\)\.unlink",
]

# 网络请求模式 (REQ-5.2)
NETWORK_REQUEST_PATTERNS: List[str] = [
    r"requests\.(get|post|put|delete|patch)\s*\(",
    r"aiohttp\.ClientSession",
    r"urllib\.request\.urlopen",
    r"httpx\.(get|post|put|delete|patch)",
    r"socket\.connect",
]

# 数据库操作模式 (REQ-5.3)
DATABASE_OPERATION_PATTERNS: List[str] = [
    r"\.execute\s*\(",
    r"\.executemany\s*\(",
    r"cursor\.",
    r"connection\.",
    r"session\.query",
    r"SELECT\s+.*\s+FROM",
    r"INSERT\s+INTO",
    r"UPDATE\s+.*\s+SET",
    r"DELETE\s+FROM",
]


# =============================================================================
# Protocol
# =============================================================================


class RiskLevelCalculatorProtocol(Protocol):
    """风险等级计算器接口"""

    def calculate(self, validation_result: ValidationResult) -> RiskAssessment:
        """计算风险等级"""
        ...

    def check_human_review_triggers(
        self,
        code: str,
        validation_result: ValidationResult,
    ) -> List[HumanReviewTrigger]:
        """检查是否触发人工复核"""
        ...


# =============================================================================
# Helper Functions
# =============================================================================


def _safe_divide(a: float, b: float, default: float = 0.0) -> float:
    """
    安全除法，防止除零错误 (DEF-002)

    Args:
        a: 被除数
        b: 除数
        default: 除数为零时的默认值

    Returns:
        除法结果或默认值
    """
    if b == 0:
        return default
    return a / b


def _clamp(value: float, min_val: float, max_val: float) -> float:
    """将值限制在指定范围内"""
    return max(min_val, min(max_val, value))


# =============================================================================
# Implementation
# =============================================================================


class RiskLevelCalculator:
    """
    风险等级计算器实现

    基于验证结果计算三级风险等级（LOW/MEDIUM/HIGH）。

    Properties:
    - Property 2: 风险等级只能是 LOW/MEDIUM/HIGH 三个值之一
    - Property 3: MEDIUM/HIGH 风险必须有 risk_points
    - Property 5: 文件/网络/数据库操作触发人工复核
    - Property 6: 敏感领域强制 HIGH 风险
    """

    def __init__(
        self,
        mandatory_violation_threshold: int = 1,
        recommended_violation_threshold: int = 3,
    ) -> None:
        """
        初始化风险计算器。

        Args:
            mandatory_violation_threshold: 强制规则违规阈值（超过则HIGH）
            recommended_violation_threshold: 推荐规则违规阈值（超过则MEDIUM）
        """
        self._mandatory_threshold = mandatory_violation_threshold
        self._recommended_threshold = recommended_violation_threshold

    def calculate(
        self,
        validation_result: ValidationResult,
        code: Optional[str] = None,
    ) -> RiskAssessment:
        """
        计算风险等级 (REQ-3.1)

        Property 2: 返回值的 level 只能是 LOW/MEDIUM/HIGH

        Args:
            validation_result: 验证结果
            code: 原始代码（用于敏感领域检测）

        Returns:
            RiskAssessment: 风险评估结果
        """
        # 统计违规
        mandatory_violations = [
            v for v in validation_result.violations
            if v.severity == "mandatory"
        ]
        recommended_violations = [
            v for v in validation_result.violations
            if v.severity == "recommended"
        ]

        # 检查人工复核触发
        human_review_triggers: List[HumanReviewTrigger] = []
        # DEF-001: 显式检查 None
        if code is not None:
            human_review_triggers = self.check_human_review_triggers(
                code, validation_result
            )

        # 检查敏感领域 (Property 6)
        is_sensitive_domain = False
        # DEF-001: 显式检查 None
        if code is not None:
            is_sensitive_domain = self._check_sensitive_domain(code)

        # 计算风险等级 (Property 2: 只能是三个值之一)
        level: RiskLevel
        risk_points: List[str] = []
        one_line_summary: str

        # 敏感领域强制 HIGH (Property 6)
        if is_sensitive_domain:
            level = RiskLevel.HIGH
            risk_points.append("涉及敏感领域（金融/认证/加密/隐私）")
            one_line_summary = "高风险：涉及敏感领域，强烈建议人工复核"

        # 有强制规则违规 -> HIGH
        elif len(mandatory_violations) >= self._mandatory_threshold:
            level = RiskLevel.HIGH
            for v in mandatory_violations[:3]:  # 最多显示3个
                risk_points.append(v.human_description)
            one_line_summary = "高风险：存在严重安全问题，强烈不建议运行"

        # 有推荐规则违规 -> MEDIUM
        elif len(recommended_violations) >= self._recommended_threshold:
            level = RiskLevel.MEDIUM
            for v in recommended_violations[:3]:
                risk_points.append(v.human_description)
            one_line_summary = "中风险：存在一些问题，建议修复后再使用"

        # 有人工复核触发 -> 至少 MEDIUM
        elif len(human_review_triggers) > 0:
            level = RiskLevel.MEDIUM
            for trigger in human_review_triggers[:3]:
                risk_points.append(trigger.description)
            one_line_summary = "中风险：包含需要关注的操作，建议人工复核"

        # 无违规 -> LOW
        else:
            level = RiskLevel.LOW
            one_line_summary = "低风险：可以试着用，但不保证业务完全正确"

        # Property 3: 非LOW风险必须有详细说明
        if level != RiskLevel.LOW and len(risk_points) == 0:
            risk_points.append("存在潜在风险，建议仔细检查")

        # 确定是否需要人工复核
        requires_human_review = (
            level == RiskLevel.HIGH
            or is_sensitive_domain
            or len(human_review_triggers) > 0
        )

        return RiskAssessment(
            level=level,
            one_line_summary=one_line_summary,
            risk_points=risk_points,
            human_review_triggers=human_review_triggers,
            requires_human_review=requires_human_review,
        )

    def check_human_review_triggers(
        self,
        code: str,
        validation_result: ValidationResult,
    ) -> List[HumanReviewTrigger]:
        """
        检查是否触发人工复核 (REQ-5.1, REQ-5.2, REQ-5.3)

        Property 5: 文件/网络/数据库操作必须触发

        Args:
            code: 原始代码
            validation_result: 验证结果

        Returns:
            List[HumanReviewTrigger]: 触发列表
        """
        triggers: List[HumanReviewTrigger] = []

        # 检查文件操作 (REQ-5.1)
        for pattern in FILE_OPERATION_PATTERNS:
            match = re.search(pattern, code, re.IGNORECASE)
            # DEF-001: 显式检查 None
            if match is not None:
                triggers.append(HumanReviewTrigger(
                    reason=HumanReviewReason.FILE_OPERATION,
                    description="代码包含文件写入/删除操作，建议人工确认",
                    evidence=match.group(0),
                ))
                break  # 每类只记录一次

        # 检查网络请求 (REQ-5.2)
        for pattern in NETWORK_REQUEST_PATTERNS:
            match = re.search(pattern, code, re.IGNORECASE)
            # DEF-001: 显式检查 None
            if match is not None:
                triggers.append(HumanReviewTrigger(
                    reason=HumanReviewReason.NETWORK_REQUEST,
                    description="代码包含网络请求，建议确认目标地址和数据安全",
                    evidence=match.group(0),
                ))
                break

        # 检查数据库操作 (REQ-5.3)
        for pattern in DATABASE_OPERATION_PATTERNS:
            match = re.search(pattern, code, re.IGNORECASE)
            # DEF-001: 显式检查 None
            if match is not None:
                triggers.append(HumanReviewTrigger(
                    reason=HumanReviewReason.DATABASE_OPERATION,
                    description="代码包含数据库操作，建议确认SQL安全性",
                    evidence=match.group(0),
                ))
                break

        # 检查敏感领域 (REQ-5.4)
        if self._check_sensitive_domain(code):
            triggers.append(HumanReviewTrigger(
                reason=HumanReviewReason.SENSITIVE_DOMAIN,
                description="代码涉及敏感领域（金融/认证/加密），必须人工复核",
            ))

        return triggers

    def _check_sensitive_domain(self, code: str) -> bool:
        """
        检查是否涉及敏感领域 (REQ-5.4)

        Args:
            code: 原始代码

        Returns:
            bool: 是否涉及敏感领域
        """
        code_lower = code.lower()
        for keyword in SENSITIVE_DOMAIN_KEYWORDS:
            if keyword in code_lower:
                return True
        return False


# =============================================================================
# Convenience Functions
# =============================================================================


def create_risk_calculator(
    mandatory_violation_threshold: int = 1,
    recommended_violation_threshold: int = 3,
) -> RiskLevelCalculator:
    """创建 RiskLevelCalculator 实例的便捷函数"""
    return RiskLevelCalculator(
        mandatory_violation_threshold=mandatory_violation_threshold,
        recommended_violation_threshold=recommended_violation_threshold,
    )
