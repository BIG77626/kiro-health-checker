"""
Rule Factory - 规则工厂（零Token成本版）

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 4.1, 4.2)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE, DATABASE-SAFETY
Level: Expert (P3)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: Uses RuleDraft, PatternTemplate from this module

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: ERR-004 (异常链必须使用 from)
  - Evidence: `raise RuleFactoryError(...) from e`

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit `is None` checks

Rule: DEF-002 (数值计算必须防止除零)
  - Evidence: Similarity calculation handles edge cases

Rule: SQLITE-001 (使用参数化查询)
  - Evidence: All queries use ? placeholders
===================================

Requirements: REQ-11.1, REQ-11.4, REQ-23.1, REQ-23.2
Properties:
  - Zero Token cost: No LLM calls
  - Template-based generation
"""

from __future__ import annotations

import logging
import re
import sqlite3
from datetime import datetime, timedelta
from difflib import SequenceMatcher
from pathlib import Path
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel, ConfigDict, Field

from .models import RuleCategory, SimplifiedArchitectureError

logger = logging.getLogger(__name__)


# =============================================================================
# Exceptions
# =============================================================================


class RuleFactoryError(SimplifiedArchitectureError):
    """规则工厂错误"""

    pass


# =============================================================================
# Data Models (PYDANTIC-001)
# =============================================================================


class PatternTemplate(BaseModel):
    """
    模式模板 (REQ-11.1)

    预定义的规则模板，用于模板匹配生成。
    """

    name: str = Field(min_length=1, description="模板名称")
    pattern: str = Field(min_length=1, description="正则表达式模式")
    severity: str = Field(
        default="recommended",
        pattern=r"^(mandatory|recommended)$",
        description="严重程度",
    )
    category: RuleCategory = Field(
        default=RuleCategory.ERROR_HANDLING,
        description="规则类别",
    )
    tags: List[str] = Field(default_factory=list, description="标签")
    description: str = Field(default="", description="描述")
    fix_suggestion: str = Field(default="", description="修复建议")

    model_config = ConfigDict(strict=True, extra="forbid")


class RuleDraft(BaseModel):
    """
    规则草稿 (REQ-11.1)

    由RuleFactory生成的规则草稿，需要人工审核。
    """

    id: str = Field(min_length=1, description="规则ID")
    pattern: str = Field(min_length=1, description="正则表达式模式")
    description: str = Field(default="", description="描述")
    category: RuleCategory = Field(
        default=RuleCategory.ERROR_HANDLING,
        description="规则类别",
    )
    severity: str = Field(
        default="recommended",
        pattern=r"^(mandatory|recommended)$",
        description="严重程度",
    )
    confidence: float = Field(
        ge=0.0,
        le=1.0,
        default=0.5,
        description="置信度",
    )
    source: str = Field(
        default="template",
        description="来源：template/false_green",
    )
    requires_review: bool = Field(
        default=True,
        description="是否需要人工审核",
    )
    test_cases_positive: List[str] = Field(
        default_factory=list,
        description="正例测试用例",
    )
    test_cases_negative: List[str] = Field(
        default_factory=list,
        description="反例测试用例",
    )
    tags: List[str] = Field(default_factory=list, description="标签")
    fix_suggestion: str = Field(default="", description="修复建议")

    model_config = ConfigDict(strict=True, extra="forbid")


class FalseGreenEventRecord(BaseModel):
    """假绿事件记录（用于相似度匹配）"""

    id: str
    violation_code: str
    reported_at: datetime
    issue_description: str

    model_config = ConfigDict(strict=True, extra="forbid")


# =============================================================================
# Pattern Templates (Hardcoded - REQ-11.1)
# =============================================================================

DEFAULT_PATTERN_TEMPLATES: Dict[str, PatternTemplate] = {
    "no_type_hint": PatternTemplate(
        name="no_type_hint",
        pattern=r"def\s+\w+\s*\([^)]*\)\s*:",
        severity="recommended",
        category=RuleCategory.TYPE_SAFETY,
        tags=["type-safety", "pydantic"],
        description="Function missing return type annotation",
        fix_suggestion="Add return type annotation: def func() -> ReturnType:",
    ),
    "hardcoded_secret": PatternTemplate(
        name="hardcoded_secret",
        pattern=r'(?:password|secret|api_key|token)\s*=\s*["\'][^"\']{8,}["\']',
        severity="mandatory",
        category=RuleCategory.SECURITY,
        tags=["security", "secrets"],
        description="Hardcoded secret or credential detected",
        fix_suggestion="Use environment variables or secret management",
    ),
    "bare_except": PatternTemplate(
        name="bare_except",
        pattern=r"except\s*:",
        severity="mandatory",
        category=RuleCategory.ERROR_HANDLING,
        tags=["error-handling", "defensive"],
        description="Bare except clause catches all exceptions",
        fix_suggestion="Specify concrete exception types: except ValueError:",
    ),
    "sql_injection": PatternTemplate(
        name="sql_injection",
        pattern=r'(?:execute|cursor\.execute)\s*\(\s*["\'].*%s.*["\']',
        severity="mandatory",
        category=RuleCategory.SECURITY,
        tags=["security", "database", "sql-injection"],
        description="Potential SQL injection vulnerability",
        fix_suggestion="Use parameterized queries with ? placeholders",
    ),
    "print_debug": PatternTemplate(
        name="print_debug",
        pattern=r"print\s*\(",
        severity="recommended",
        category=RuleCategory.ERROR_HANDLING,
        tags=["debugging", "logging"],
        description="Debug print statement found",
        fix_suggestion="Use logging module instead of print",
    ),
    "todo_comment": PatternTemplate(
        name="todo_comment",
        pattern=r"#\s*TODO\s*:",
        severity="recommended",
        category=RuleCategory.ERROR_HANDLING,
        tags=["documentation", "maintenance"],
        description="TODO comment found",
        fix_suggestion="Address TODO or create issue tracker item",
    ),
    "magic_number": PatternTemplate(
        name="magic_number",
        pattern=r"(?<![a-zA-Z_])\d{3,}(?![a-zA-Z_\d])",
        severity="recommended",
        category=RuleCategory.ERROR_HANDLING,
        tags=["maintainability", "constants"],
        description="Magic number detected",
        fix_suggestion="Extract to named constant",
    ),
    "mutable_default": PatternTemplate(
        name="mutable_default",
        pattern=r"def\s+\w+\s*\([^)]*=\s*\[\s*\]",
        severity="mandatory",
        category=RuleCategory.ERROR_HANDLING,
        tags=["defensive", "python-gotchas"],
        description="Mutable default argument",
        fix_suggestion="Use None as default and initialize in function body",
    ),
}


# =============================================================================
# Rule Factory Implementation
# =============================================================================


class RuleFactory:
    """
    规则工厂 - 零Token成本版 (REQ-11.1, REQ-11.4)

    基于模板和统计生成规则，不调用LLM。

    Features:
    - 本地模式库（预定义模板）
    - 假绿事件驱动生成（相似度匹配）
    - 测试用例生成（模板+变异）
    """

    # 相似度阈值
    SIMILARITY_THRESHOLD = 0.7
    # 最小相似事件数（30天内）
    MIN_SIMILAR_EVENTS = 3
    # 事件统计天数
    EVENT_WINDOW_DAYS = 30

    def __init__(
        self,
        db_path: Optional[Path] = None,
        templates: Optional[Dict[str, PatternTemplate]] = None,
    ) -> None:
        """
        初始化规则工厂。

        Args:
            db_path: 假绿事件数据库路径
            templates: 自定义模板（可选）
        """
        # DEF-001: 显式检查 None
        if templates is None:
            templates = DEFAULT_PATTERN_TEMPLATES.copy()

        self._templates = templates
        self._db_path = db_path
        self._rule_counter = 0

    def _generate_rule_id(self, template_name: str) -> str:
        """生成规则ID"""
        self._rule_counter += 1
        prefix = template_name[:3].upper()
        return f"FG-{prefix}-{self._rule_counter:03d}"

    def generate_from_template(
        self,
        template_name: str,
        custom_pattern: Optional[str] = None,
    ) -> Optional[RuleDraft]:
        """
        从模板生成规则草稿 (REQ-11.1)

        Args:
            template_name: 模板名称
            custom_pattern: 自定义模式（可选）

        Returns:
            Optional[RuleDraft]: 规则草稿
        """
        template = self._templates.get(template_name)

        # DEF-001: 显式检查 None
        if template is None:
            logger.warning(f"Template not found: {template_name}")
            return None

        pattern = custom_pattern if custom_pattern is not None else template.pattern
        rule_id = self._generate_rule_id(template_name)

        # 生成测试用例
        positive_cases, negative_cases = self._generate_tests_from_template(template)

        return RuleDraft(
            id=rule_id,
            pattern=pattern,
            description=template.description,
            category=template.category,
            severity=template.severity,
            confidence=0.8,  # 模板生成置信度较高
            source="template",
            requires_review=True,
            test_cases_positive=positive_cases,
            test_cases_negative=negative_cases,
            tags=template.tags,
            fix_suggestion=template.fix_suggestion,
        )

    def generate_from_false_green(
        self,
        violation_code: str,
        issue_description: str,
    ) -> Optional[RuleDraft]:
        """
        从假绿事件生成规则草稿 (REQ-11.1, REQ-11.4)

        条件：30天内相似事件>3次才生成

        Args:
            violation_code: 违规代码片段
            issue_description: 问题描述

        Returns:
            Optional[RuleDraft]: 规则草稿，如果不满足条件返回None
        """
        # 1. 查找匹配的模板
        matched_template = self._find_matching_template(violation_code)

        # DEF-001: 显式检查 None
        if matched_template is None:
            logger.debug(f"No matching template for code: {violation_code[:50]}...")
            return None

        # 2. 统计相似事件（如果有数据库）
        similar_count = 1  # 默认当前事件
        if self._db_path is not None:
            similar_count = self._count_similar_events(violation_code)

        # 3. 检查是否满足最小事件数
        if similar_count < self.MIN_SIMILAR_EVENTS:
            logger.debug(
                f"Not enough similar events: {similar_count} < {self.MIN_SIMILAR_EVENTS}"
            )
            return None

        # 4. 生成规则草稿
        rule_id = self._generate_rule_id(matched_template.name)
        confidence = min(similar_count / 10.0, 0.9)

        positive_cases, negative_cases = self._generate_tests_from_template(
            matched_template
        )

        return RuleDraft(
            id=rule_id,
            pattern=matched_template.pattern,
            description=f"Auto-generated from {similar_count} false greens: {issue_description}",
            category=matched_template.category,
            severity=matched_template.severity,
            confidence=confidence,
            source="false_green",
            requires_review=True,
            test_cases_positive=positive_cases,
            test_cases_negative=negative_cases,
            tags=matched_template.tags + ["auto-generated"],
            fix_suggestion=matched_template.fix_suggestion,
        )

    def _find_matching_template(
        self,
        code: str,
    ) -> Optional[PatternTemplate]:
        """
        查找匹配的模板 (REQ-11.1)

        使用正则匹配和字符相似度。

        Args:
            code: 代码片段

        Returns:
            Optional[PatternTemplate]: 匹配的模板
        """
        best_match: Optional[PatternTemplate] = None
        best_score = 0.0

        for template in self._templates.values():
            # 1. 尝试正则匹配
            try:
                if re.search(template.pattern, code):
                    return template  # 精确匹配，直接返回
            # ERR-001: 指定具体异常类型
            except re.error:
                pass

            # 2. 计算字符相似度
            similarity = self._pattern_similarity(code, template.pattern)
            if similarity > best_score and similarity >= self.SIMILARITY_THRESHOLD:
                best_score = similarity
                best_match = template

        return best_match

    def _pattern_similarity(self, code: str, pattern: str) -> float:
        """
        计算代码与模式的相似度 (REQ-11.4)

        使用 difflib.SequenceMatcher（无需Embedding）

        Args:
            code: 代码片段
            pattern: 模式字符串

        Returns:
            float: 相似度 [0, 1]
        """
        # DEF-002: 处理空字符串
        if not code or not pattern:
            return 0.0

        # 截取前100字符进行比较
        code_sample = code[:100]
        pattern_sample = pattern[:100]

        return SequenceMatcher(None, code_sample, pattern_sample).ratio()

    def _count_similar_events(self, violation_code: str) -> int:
        """
        统计相似假绿事件数量

        Note: 当前实现比较 violation_code 与 issue_description，
        这是一个近似匹配（issue_description 通常包含代码片段描述）。
        未来可扩展 false_green_events 表添加 violation_code 字段。

        Args:
            violation_code: 违规代码

        Returns:
            int: 相似事件数量
        """
        # DEF-001: 显式检查 None
        if self._db_path is None:
            return 1

        # 性能保护：限制查询数量
        MAX_EVENTS_TO_CHECK = 1000

        try:
            conn = sqlite3.connect(str(self._db_path))
            try:
                # 查询30天内的假绿事件（限制数量防止性能问题）
                threshold_date = datetime.now(tz=None) - timedelta(
                    days=self.EVENT_WINDOW_DAYS
                )

                # SQLITE-001: 使用参数化查询
                cursor = conn.execute(
                    """
                    SELECT issue_description FROM false_green_events
                    WHERE reported_at >= ?
                    ORDER BY reported_at DESC
                    LIMIT ?
                    """,
                    (threshold_date.isoformat(), MAX_EVENTS_TO_CHECK),
                )

                similar_count = 0
                violation_sample = violation_code[:100]
                for (description,) in cursor.fetchall():
                    # DEF-001: 显式检查 None
                    if description is None:
                        continue
                    # 计算相似度（比较代码与描述的近似匹配）
                    similarity = SequenceMatcher(
                        None, violation_sample, description[:100]
                    ).ratio()
                    if similarity >= self.SIMILARITY_THRESHOLD:
                        similar_count += 1

                return max(similar_count, 1)

            finally:
                conn.close()

        # ERR-001: 指定具体异常类型
        except sqlite3.Error as e:
            logger.warning(f"Failed to count similar events: {e}")
            return 1

    def _generate_tests_from_template(
        self,
        template: PatternTemplate,
    ) -> Tuple[List[str], List[str]]:
        """
        从模板生成测试用例 (REQ-11.4, REQ-23.1)

        Args:
            template: 模式模板

        Returns:
            Tuple[List[str], List[str]]: (正例列表, 反例列表)
        """
        positive_cases: List[str] = []
        negative_cases: List[str] = []

        # 根据模板类型生成测试用例
        if template.name == "bare_except":
            positive_cases = [
                "try:\n    pass\nexcept:\n    pass",
                "try:\n    x = 1\nexcept:  # bad\n    print('error')",
            ]
            negative_cases = [
                "try:\n    pass\nexcept ValueError:\n    pass",
                "try:\n    x = 1\nexcept (TypeError, ValueError):\n    pass",
            ]

        elif template.name == "hardcoded_secret":
            positive_cases = [
                'password = "supersecret123"',
                'api_key = "sk-1234567890abcdef"',
                'token = "ghp_xxxxxxxxxxxx"',
            ]
            negative_cases = [
                'password = os.environ.get("PASSWORD")',
                "api_key = config.get_secret('api_key')",
                "token = None",
            ]

        elif template.name == "no_type_hint":
            positive_cases = [
                "def foo(x):\n    return x",
                "def bar(a, b):\n    pass",
            ]
            negative_cases = [
                "def foo(x: int) -> int:\n    return x",
                "def bar(a: str, b: str) -> None:\n    pass",
            ]

        elif template.name == "sql_injection":
            positive_cases = [
                'cursor.execute("SELECT * FROM users WHERE id = %s" % user_id)',
                'db.execute("DELETE FROM items WHERE name = %s" % name)',
            ]
            negative_cases = [
                'cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))',
                'db.execute("DELETE FROM items WHERE name = ?", (name,))',
            ]

        elif template.name == "print_debug":
            positive_cases = [
                'print("debug")',
                "print(x)",
            ]
            negative_cases = [
                'logger.debug("debug")',
                "logging.info(x)",
            ]

        elif template.name == "mutable_default":
            positive_cases = [
                "def foo(items=[]):\n    items.append(1)",
                "def bar(data={}):\n    pass",
            ]
            negative_cases = [
                "def foo(items=None):\n    if items is None:\n        items = []",
                "def bar(data: Optional[dict] = None):\n    pass",
            ]

        elif template.name == "magic_number":
            positive_cases = [
                "timeout = 3600",
                "max_retries = 1000",
                "buffer_size = 65536",
            ]
            negative_cases = [
                "TIMEOUT_SECONDS = 3600\ntimeout = TIMEOUT_SECONDS",
                "MAX_RETRIES = 1000",
                "x = 0  # zero is not magic",
                "y = 1  # one is not magic",
            ]

        elif template.name == "todo_comment":
            positive_cases = [
                "# TODO: fix this later",
                "# TODO: implement error handling",
            ]
            negative_cases = [
                "# This is a regular comment",
                "# DONE: completed this task",
                "# NOTE: important information",
            ]

        else:
            # 默认：生成通用测试用例
            positive_cases = [f"# Code matching {template.name}"]
            negative_cases = [f"# Code NOT matching {template.name}"]

        return positive_cases, negative_cases

    def generate_mutated_tests(
        self,
        base_code: str,
        num_variants: int = 3,
    ) -> List[str]:
        """
        生成变异测试用例 (REQ-23.2)

        通过字符替换、行重排生成变体。

        Args:
            base_code: 基础代码
            num_variants: 变体数量

        Returns:
            List[str]: 变体列表
        """
        variants: List[str] = []

        # 变异策略1：空白字符变化
        variants.append(base_code.replace("  ", "    "))
        variants.append(base_code.replace("\n", "\n\n"))

        # 变异策略2：注释添加
        lines = base_code.split("\n")
        if lines:
            commented = lines.copy()
            commented.insert(0, "# Mutated variant")
            variants.append("\n".join(commented))

        # 变异策略3：变量名变化（简单替换）
        variants.append(base_code.replace("x", "y"))
        variants.append(base_code.replace("foo", "bar"))

        return variants[:num_variants]

    def list_templates(self) -> List[str]:
        """列出所有可用模板名称"""
        return list(self._templates.keys())

    def get_template(self, name: str) -> Optional[PatternTemplate]:
        """获取指定模板"""
        return self._templates.get(name)

    def add_template(self, template: PatternTemplate) -> None:
        """添加自定义模板"""
        self._templates[template.name] = template
        logger.info(f"Added template: {template.name}")


# =============================================================================
# Convenience Functions
# =============================================================================


def create_rule_factory(
    db_path: Optional[Path] = None,
) -> RuleFactory:
    """创建 RuleFactory 实例的便捷函数"""
    return RuleFactory(db_path=db_path)
