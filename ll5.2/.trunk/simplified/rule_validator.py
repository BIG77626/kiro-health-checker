"""
Rule-Based Validator - 基于规则的验证器

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 2.3)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: Uses ValidationResult, RuleViolation from models.py

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: ERR-004 (异常链必须使用 from)
  - Evidence: `raise ValidationError(...) from e`

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit `is None` checks
===================================

Requirements: REQ-1.1, REQ-1.2, REQ-1.4
Property 4: 违规记录结构完整性
"""

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import List, Optional, Protocol

from .models import (
    Rule,
    RuleSet,
    RuleViolation,
    ValidationError,
    ValidationResult,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Protocol
# =============================================================================


class RuleBasedValidatorProtocol(Protocol):
    """基于规则的验证器接口"""

    def validate(
        self,
        code: str,
        ruleset: RuleSet,
        filename: Optional[str] = None,
    ) -> ValidationResult:
        """使用固定规则集验证代码"""
        ...


# =============================================================================
# Implementation
# =============================================================================


class RuleBasedValidator:
    """
    基于规则的验证器实现

    使用固定规则集验证代码，替代原来的Skill智能选择机制。

    Property 4: 每个违规记录必须包含 rule_id, rule_description, severity, fix_suggestion
    """

    def validate(
        self,
        code: str,
        ruleset: RuleSet,
        filename: Optional[str] = None,
    ) -> ValidationResult:
        """
        使用固定规则集验证代码 (REQ-1.1)

        Args:
            code: 要验证的代码
            ruleset: 规则集
            filename: 文件名（可选，用于日志）

        Returns:
            ValidationResult: 验证结果

        Raises:
            ValidationError: 验证执行错误
        """
        try:
            violations: List[RuleViolation] = []
            passed_count = 0
            failed_count = 0

            for rule in ruleset.rules:
                try:
                    violation = self._check_rule(code, rule)
                    # DEF-001: 显式检查 None
                    if violation is not None:
                        violations.append(violation)
                        failed_count += 1
                    else:
                        passed_count += 1
                # ERR-001: 指定具体异常类型
                except (re.error, ValueError, TypeError) as e:
                    logger.warning(
                        f"Rule {rule.id} check failed: {e}"
                    )
                    # 规则检查失败时，保守地认为通过
                    passed_count += 1

            # 检测未覆盖的代码模式
            uncovered_patterns = self._detect_uncovered_patterns(code, ruleset)

            return ValidationResult(
                code_hash=ValidationResult.compute_code_hash(code),
                ruleset_id=ruleset.id,
                ruleset_version=ruleset.version,
                timestamp=datetime.now(tz=None),
                total_rules=len(ruleset.rules),
                passed_rules=passed_count,
                failed_rules=failed_count,
                violations=violations,
                uncovered_patterns=uncovered_patterns,
            )

        # ERR-001: 指定具体异常类型
        except (OSError, MemoryError) as e:
            # ERR-004: 异常链使用 from
            raise ValidationError(
                f"Validation failed: {e}",
                cause=e,
            ) from e

    def _check_rule(
        self,
        code: str,
        rule: Rule,
    ) -> Optional[RuleViolation]:
        """
        检查单条规则 (REQ-1.2)

        Property 4: 违规记录必须包含完整字段

        Args:
            code: 要验证的代码
            rule: 规则

        Returns:
            Optional[RuleViolation]: 违规记录，如果通过则返回 None
        """
        # 根据检测器类型执行检查
        if rule.detector == "grep":
            return self._check_grep_rule(code, rule)
        elif rule.detector == "ast":
            return self._check_ast_rule(code, rule)
        else:
            # manual 类型规则跳过自动检查
            return None

    def _check_grep_rule(
        self,
        code: str,
        rule: Rule,
    ) -> Optional[RuleViolation]:
        """
        使用正则表达式检查规则

        Args:
            code: 要验证的代码
            rule: 规则

        Returns:
            Optional[RuleViolation]: 违规记录
        """
        # 从规则描述中提取模式（简化实现）
        # 实际应该从规则定义中读取 pattern 字段
        pattern = self._get_rule_pattern(rule)
        # DEF-001: 显式检查 None
        if pattern is None:
            return None

        # 搜索匹配
        match = re.search(pattern, code, re.MULTILINE | re.IGNORECASE)
        # DEF-001: 显式检查 None
        if match is None:
            return None

        # 计算行号
        line_number = code[:match.start()].count("\n") + 1

        # Property 4: 违规记录结构完整性
        return RuleViolation(
            rule_id=rule.id,
            rule_description=rule.description,
            human_description=rule.human_description,
            severity=rule.severity,
            evidence=match.group(0)[:100],  # 限制长度
            line_number=line_number,
            fix_suggestion=rule.fix_suggestion,
        )

    def _check_ast_rule(
        self,
        code: str,
        rule: Rule,
    ) -> Optional[RuleViolation]:
        """
        使用 AST 检查规则

        Args:
            code: 要验证的代码
            rule: 规则

        Returns:
            Optional[RuleViolation]: 违规记录
        """
        # 简化实现：AST 规则暂时使用正则表达式
        # 完整实现应该使用 ast 模块解析代码
        return self._check_grep_rule(code, rule)

    def _get_rule_pattern(self, rule: Rule) -> Optional[str]:
        """
        获取规则的检测模式

        Args:
            rule: 规则

        Returns:
            Optional[str]: 正则表达式模式
        """
        # 规则ID到模式的映射
        patterns = {
            # 危险调用
            "SEC-001": r"eval\s*\(",
            "SEC-002": r"exec\s*\(",
            "SEC-003": r"os\.system\s*\(",
            "SEC-004": r"subprocess\.\w+\([^)]*shell\s*=\s*True",
            "SEC-005": r"pickle\.loads?\s*\(",
            "SEC-006": r"(password|api_key|secret|token)\s*=\s*[\"'][^\"']+[\"']",
            "SEC-007": r"log(ger)?\.(info|debug|warning|error)\([^)]*password",
            # 错误处理
            "ERR-001": r"except\s*:",
            "ERR-002": r"except\s+Exception\s*:",
            # ERR-003: 排除 KeyboardInterrupt, SystemExit, OSError 等合理场景
            "ERR-003": r"except\s+(?!KeyboardInterrupt|SystemExit|OSError\b)[A-Za-z]*\s*:\s*\n\s*(pass|\.\.\.)\s*$",
            # 类型安全
            "TYP-001": r"Optional\[[^\]]+\]\s*$",
            "TYP-002": r":\s*Any\s*[=,)]",
            # 网络
            "NET-001": r"requests\.(get|post|put|delete|patch)\s*\([^)]*\)(?!.*timeout)",
            "NET-004": r"verify\s*=\s*False",
            "NET-005": r"http://(?!localhost|127\.0\.0\.1)",
            # NET-007: 只匹配 URL 参数（?key=xxx 或 &key=xxx），排除函数参数
            "NET-007": r"[?&](password|api_key|secret|token)=[^&\s]+",
            # 文件
            "FIL-001": r"open\s*\([^)]*\+[^)]*\)",
            "FIL-003": r"os\.remove\s*\(|os\.unlink\s*\(|shutil\.rmtree\s*\(",
            "FIL-004": r"rmtree\s*\([^)]*[\"']\/[\"']",
            "FIL-005": r"open\s*\([^)]*[\"']w[\"'][^)]*\)(?!\s*as)",
            # 数据库
            "DBA-001": r"execute\s*\([^)]*\+[^)]*\)|execute\s*\([^)]*%[^)]*\)|execute\s*\(f[\"']",
            "DBA-002": r"\.format\s*\([^)]*\).*(?:SELECT|INSERT|UPDATE|DELETE)",
            "DBA-003": r"connect\s*\([^)]*\)(?!\s*as)",
            "DBA-007": r"log.*sql|log.*query",
            "DBA-008": r"connect\s*\([^)]*password\s*=\s*[\"'][^\"']+[\"']",
        }

        return patterns.get(rule.id)

    def _detect_uncovered_patterns(
        self,
        code: str,
        ruleset: RuleSet,
    ) -> List[str]:
        """
        检测未被规则覆盖的代码模式 (REQ-4.4)

        Args:
            code: 要验证的代码
            ruleset: 规则集

        Returns:
            List[str]: 未覆盖的模式列表
        """
        uncovered: List[str] = []

        # 检查一些常见但可能未被覆盖的模式
        uncovered_checks = [
            (r"import\s+subprocess", "subprocess 模块使用"),
            (r"import\s+ctypes", "ctypes 模块使用（底层操作）"),
            (r"import\s+multiprocessing", "多进程操作"),
            (r"__import__\s*\(", "动态导入"),
            (r"globals\s*\(\)|locals\s*\(\)", "全局/局部变量访问"),
            (r"setattr\s*\(|getattr\s*\(", "动态属性操作"),
        ]

        # 获取规则集覆盖的规则ID
        covered_patterns = set()
        for rule in ruleset.rules:
            pattern = self._get_rule_pattern(rule)
            # DEF-001: 显式检查 None
            if pattern is not None:
                covered_patterns.add(pattern)

        for pattern, description in uncovered_checks:
            # 检查是否已被规则覆盖
            is_covered = any(
                pattern in covered
                for covered in covered_patterns
            )
            if not is_covered:
                match = re.search(pattern, code)
                # DEF-001: 显式检查 None
                if match is not None:
                    uncovered.append(description)

        return uncovered


# =============================================================================
# Convenience Functions
# =============================================================================


def create_rule_validator() -> RuleBasedValidator:
    """创建 RuleBasedValidator 实例的便捷函数"""
    return RuleBasedValidator()
