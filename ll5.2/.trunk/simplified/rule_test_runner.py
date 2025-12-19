"""
Rule Test Runner - 规则测试集管理与运行器

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 3.2)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE, FILE-SAFETY
Level: Expert (P2)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: Uses RuleTestCase, RuleTestResult from this module

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: ERR-004 (异常链必须使用 from)
  - Evidence: `raise RuleTestError(...) from e`

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit `is None` checks

Rule: FIL-001 (路径注入检测)
  - Evidence: Using Path.resolve() for path validation
===================================

Requirements: REQ-12.1, REQ-12.2, REQ-12.3
Properties:
  - Property 7: 测试用例有效性
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List, Literal, Optional, Tuple, Union

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import Rule, RuleCategory, SimplifiedArchitectureError
from .rule_validator import RuleBasedValidator

logger = logging.getLogger(__name__)


# =============================================================================
# Exceptions
# =============================================================================


class RuleTestError(SimplifiedArchitectureError):
    """规则测试错误"""

    pass


class SampleConflictError(SimplifiedArchitectureError):
    """样本冲突错误 (Task 8.2)

    当同一代码片段同时出现在正例和反例中时抛出。
    """

    pass


class SampleValidationError(SimplifiedArchitectureError):
    """样本验证错误 (Task 8.1)

    当样本验证失败时抛出（如找不到规则、无 pattern 等）。
    """

    pass


# =============================================================================
# Data Models (PYDANTIC-001)
# =============================================================================


# =============================================================================
# Sample Validation Models (Task 8.1)
# =============================================================================


class ValidationSampleResult(BaseModel):
    """
    样本验证结果 (Task 8.1, REQ-4.2)

    记录 validate_sample() 的执行结果。
    """

    success: bool = Field(description="验证是否通过")
    reason: str = Field(default="", description="失败原因（成功时为空）")
    triggered: bool = Field(
        default=False,
        description="规则是否被触发",
    )
    code_hash: str = Field(
        default="",
        description="规范化代码的 SHA256 哈希（用于冲突检测复用）",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


# =============================================================================
# Sample Normalization Utilities (Task 8.1, 8.2)
# =============================================================================


def normalize_code(code: str) -> str:
    """
    规范化代码文本 (Task 8.2)

    用于冲突检测前的文本规范化。

    规范化规则：
    - 去除首尾空白
    - 统一换行符为 \\n
    - 合并连续空行为单个空行

    Args:
        code: 原始代码

    Returns:
        str: 规范化后的代码
    """
    import re

    # 统一换行符
    normalized = code.replace("\r\n", "\n").replace("\r", "\n")
    # 去除首尾空白
    normalized = normalized.strip()
    # 合并连续空行（2+ 个换行符变为 2 个）
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized


def compute_sample_hash(code: str) -> str:
    """
    计算代码片段的哈希值 (Task 8.1, 8.2)

    基于规范化文本计算 SHA256 哈希。

    Args:
        code: 代码片段（会先规范化）

    Returns:
        str: SHA256 哈希值（前 16 位，便于日志显示）
    """
    import hashlib

    normalized = normalize_code(code)
    full_hash = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    # 返回前 16 位，足够唯一且便于日志显示
    return full_hash[:16]


# =============================================================================
# Data Models (PYDANTIC-001)
# =============================================================================


class SampleMetadata(BaseModel):
    """
    样本元数据 (REQ-1.1)

    跟踪样本来源和审核状态。

    元数据默认值约定：
    - 旧格式（纯字符串）加载时：source="manual", reviewed=True
    - 从 candidates promote 时：必须显式 reviewed=False，promote 成功后改为 True
    """

    source: Literal["manual", "false_positive", "false_green"] = Field(
        default="manual",
        description="样本来源：manual=手工添加, false_positive=误报, false_green=假绿",
    )
    reviewed: bool = Field(
        default=True,
        description="是否已审核：True=已审核, False=待审核",
    )
    note: str = Field(
        default="",
        description="备注信息",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


class ExtendedTestCase(BaseModel):
    """
    扩展的测试用例 (REQ-1.1)

    支持代码片段和可选元数据，向后兼容纯字符串格式。
    """

    code: str = Field(min_length=1, description="代码片段")
    metadata: Optional[SampleMetadata] = Field(
        default=None,
        description="可选元数据，为 None 时使用默认值",
    )

    model_config = ConfigDict(strict=True, extra="forbid")

    def get_metadata(self) -> SampleMetadata:
        """获取元数据，如果为 None 则返回默认值"""
        if self.metadata is None:
            return SampleMetadata()
        return self.metadata


# Type alias for test case items (backward compatible)
TestCaseItem = Union[str, ExtendedTestCase]


def normalize_test_case(item: TestCaseItem) -> ExtendedTestCase:
    """
    将测试用例项规范化为 ExtendedTestCase

    Args:
        item: 字符串或 ExtendedTestCase

    Returns:
        ExtendedTestCase: 规范化后的测试用例
    """
    if isinstance(item, str):
        # 旧格式：纯字符串，使用默认元数据 (source="manual", reviewed=True)
        return ExtendedTestCase(
            code=item,
            metadata=SampleMetadata(source="manual", reviewed=True),
        )
    return item


def extract_code(item: TestCaseItem) -> str:
    """
    从测试用例项中提取代码

    Args:
        item: 字符串或 ExtendedTestCase

    Returns:
        str: 代码片段
    """
    if isinstance(item, str):
        return item
    return item.code


class RuleTestCase(BaseModel):
    """
    规则测试用例 (REQ-12.1, REQ-1.1)

    每条规则应有正例和反例测试用例。
    支持两种格式：
    - 旧格式：纯字符串列表（向后兼容）
    - 新格式：ExtendedTestCase 列表（带元数据）
    """

    rule_id: str = Field(min_length=1, description="规则ID")
    description: str = Field(default="", description="测试用例描述")
    positive_cases: List[TestCaseItem] = Field(
        default_factory=list,
        description="正例：应触发规则的代码片段",
    )
    negative_cases: List[TestCaseItem] = Field(
        default_factory=list,
        description="反例：不应触发规则的代码片段",
    )

    model_config = ConfigDict(strict=True, extra="forbid")

    @field_validator("positive_cases", "negative_cases", mode="before")
    @classmethod
    def convert_cases(cls, v: List) -> List[TestCaseItem]:
        """
        转换测试用例列表，支持混合格式

        处理三种输入格式：
        1. 纯字符串：保持为字符串（运行时转换）
        2. dict with 'code' key：转换为 ExtendedTestCase
        3. ExtendedTestCase：保持不变
        """
        if not isinstance(v, list):
            return v

        result: List[TestCaseItem] = []
        for item in v:
            if isinstance(item, str):
                # 保持字符串格式，运行时按需转换
                result.append(item)
            elif isinstance(item, dict):
                # 字典格式：转换为 ExtendedTestCase
                if "code" in item:
                    metadata = None
                    if "metadata" in item and item["metadata"] is not None:
                        metadata = SampleMetadata(**item["metadata"])
                    result.append(ExtendedTestCase(code=item["code"], metadata=metadata))
                else:
                    # 无效格式，保持原样让 Pydantic 报错
                    result.append(item)
            elif isinstance(item, ExtendedTestCase):
                result.append(item)
            else:
                # 未知格式，保持原样
                result.append(item)
        return result

    def get_positive_codes(self) -> List[str]:
        """获取所有正例代码"""
        return [extract_code(item) for item in self.positive_cases]

    def get_negative_codes(self) -> List[str]:
        """获取所有反例代码"""
        return [extract_code(item) for item in self.negative_cases]

    def get_normalized_positive_cases(self) -> List[ExtendedTestCase]:
        """获取规范化的正例列表"""
        return [normalize_test_case(item) for item in self.positive_cases]

    def get_normalized_negative_cases(self) -> List[ExtendedTestCase]:
        """获取规范化的反例列表"""
        return [normalize_test_case(item) for item in self.negative_cases]

    def is_valid(self) -> bool:
        """
        检查测试用例是否有效 (REQ-12.3)

        最低要求：≥1正例 + ≥1反例
        """
        return len(self.positive_cases) >= 1 and len(self.negative_cases) >= 1

    def count_reviewed_cases(self) -> Tuple[int, int]:
        """
        统计已审核的用例数

        Returns:
            Tuple[int, int]: (已审核正例数, 已审核反例数)
        """
        positive_reviewed = sum(
            1 for item in self.get_normalized_positive_cases()
            if item.get_metadata().reviewed
        )
        negative_reviewed = sum(
            1 for item in self.get_normalized_negative_cases()
            if item.get_metadata().reviewed
        )
        return positive_reviewed, negative_reviewed


class RuleTestResult(BaseModel):
    """
    规则测试结果

    记录单条规则的测试执行结果。
    """

    rule_id: str = Field(min_length=1, description="规则ID")
    passed: bool = Field(description="是否全部通过")
    positive_passed: int = Field(ge=0, description="正例通过数")
    positive_total: int = Field(ge=0, description="正例总数")
    negative_passed: int = Field(ge=0, description="反例通过数")
    negative_total: int = Field(ge=0, description="反例总数")
    failures: List[str] = Field(
        default_factory=list,
        description="失败详情",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


class RuleTestSummary(BaseModel):
    """
    规则测试汇总

    所有规则测试的汇总结果。
    """

    total_rules: int = Field(ge=0, description="测试的规则总数")
    passed_rules: int = Field(ge=0, description="通过的规则数")
    failed_rules: int = Field(ge=0, description="失败的规则数")
    missing_tests: List[str] = Field(
        default_factory=list,
        description="缺少测试用例的规则ID",
    )
    invalid_tests: List[str] = Field(
        default_factory=list,
        description="测试用例无效的规则ID（缺少正例或反例）",
    )
    results: List[RuleTestResult] = Field(
        default_factory=list,
        description="各规则测试结果",
    )
    # 覆盖率字段 (Task 5.1)
    coverage_percentage: Optional[float] = Field(
        default=None,
        ge=0.0,
        le=100.0,
        description="测试覆盖率百分比 (rules_with_tests / total_rules * 100)",
    )

    model_config = ConfigDict(strict=True, extra="forbid")

    @property
    def all_passed(self) -> bool:
        """是否全部通过"""
        return self.failed_rules == 0 and len(self.invalid_tests) == 0

    @property
    def rules_with_tests(self) -> int:
        """有测试文件的规则数"""
        return self.total_rules - len(self.missing_tests)


class CandidateSample(BaseModel):
    """
    候选样本模型 (REQ-3.2, Task 7.2)

    用于存储待审核的误报/假绿样本。

    **唯一源文件**: 此类是 CandidateSample schema 的唯一定义，
    所有引用应从 rule_test_runner 模块导入，禁止重复定义。

    **必填字段**: rule_id, type, code
    **可选字段**: note（建议填写）, event_id, source_file, source_line, created_at

    候选文件命名约定：{RULE_ID}_{type}_{date}.yml
    - 例如：NET-007_fp_20251218.yml（误报）
    - 例如：ERR-003_fg_20251218.yml（假绿）

    rule_id 格式约定：^[A-Z]{2,4}-\\d{3}$（2-4 大写字母 + 3 位数字）
    """

    # 必填字段
    rule_id: str = Field(
        min_length=1,
        description="规则ID，如 NET-007, ERR-003",
    )
    type: Literal["false_positive", "false_green"] = Field(
        description="样本类型：false_positive=误报, false_green=假绿",
    )
    code: str = Field(
        min_length=1,
        description="代码片段",
    )

    # 可选字段
    event_id: Optional[str] = Field(
        default=None,
        description="关联的事件ID（如有）",
    )
    note: str = Field(
        default="",
        description="备注信息，描述为何是误报/假绿",
    )
    source_file: Optional[str] = Field(
        default=None,
        description="来源文件名",
    )
    source_line: Optional[int] = Field(
        default=None,
        ge=1,
        description="来源行号",
    )
    created_at: Optional[str] = Field(
        default=None,
        description="创建时间，ISO 8601 格式（如 2025-12-18T10:30:00）",
    )

    model_config = ConfigDict(strict=True, extra="forbid")

    @field_validator("rule_id")
    @classmethod
    def validate_rule_id_format(cls, v: str) -> str:
        """验证规则ID格式（如 NET-007, ERR-003）"""
        import re
        if not re.match(r"^[A-Z]{2,4}-\d{3}$", v):
            raise ValueError(
                f"Invalid rule_id format: {v}. Expected format: XXX-NNN (e.g., NET-007)"
            )
        return v

    @field_validator("created_at")
    @classmethod
    def validate_created_at_iso8601(cls, v: Optional[str]) -> Optional[str]:
        """
        验证 created_at 为有效的 ISO 8601 格式

        支持格式：
        - 2025-12-18T10:30:00
        - 2025-12-18T10:30:00Z
        - 2025-12-18T10:30:00+08:00
        - 2025-12-18 (仅日期)
        """
        if v is None:
            return v

        from datetime import datetime

        # 尝试多种 ISO 8601 格式
        formats_to_try = [
            "%Y-%m-%dT%H:%M:%S",      # 2025-12-18T10:30:00
            "%Y-%m-%dT%H:%M:%SZ",     # 2025-12-18T10:30:00Z
            "%Y-%m-%dT%H:%M:%S%z",    # 2025-12-18T10:30:00+08:00
            "%Y-%m-%d",               # 2025-12-18
        ]

        # 先尝试 fromisoformat（Python 3.7+，支持更多格式）
        try:
            datetime.fromisoformat(v.replace("Z", "+00:00"))
            return v
        except ValueError:
            pass

        # 回退到 strptime
        for fmt in formats_to_try:
            try:
                datetime.strptime(v, fmt)
                return v
            except ValueError:
                continue

        raise ValueError(
            f"Invalid created_at format: {v}. "
            f"Expected ISO 8601 format (e.g., 2025-12-18T10:30:00)"
        )

    def to_extended_test_case(self, reviewed: bool = False) -> ExtendedTestCase:
        """
        转换为 ExtendedTestCase 用于晋升

        Args:
            reviewed: 是否已审核（晋升成功后设为 True）

        Returns:
            ExtendedTestCase: 可合并到 RuleTestCase 的格式
        """
        source: Literal["manual", "false_positive", "false_green"]
        if self.type == "false_positive":
            source = "false_positive"
        else:
            source = "false_green"

        return ExtendedTestCase(
            code=self.code,
            metadata=SampleMetadata(
                source=source,
                reviewed=reviewed,
                note=self.note,
            ),
        )


# =============================================================================
# Rule Test Runner
# =============================================================================


class RuleTestRunner:
    """
    规则测试运行器 (REQ-12.2)

    验证正例触发规则，反例不触发规则。

    Property 7: 测试用例有效性
    - 正例必须触发规则
    - 反例不能触发规则
    """

    DEFAULT_TESTS_DIR = "rule_tests"
    DEFAULT_COVERAGE_THRESHOLD = 20.0

    def __init__(
        self,
        tests_dir: Optional[Path] = None,
        validator: Optional[RuleBasedValidator] = None,
    ) -> None:
        """
        初始化规则测试运行器。

        Args:
            tests_dir: 测试用例目录
            validator: 规则验证器
        """
        # DEF-001: 显式检查 None
        if tests_dir is None:
            tests_dir = Path(__file__).parent / self.DEFAULT_TESTS_DIR

        if validator is None:
            validator = RuleBasedValidator()

        self._tests_dir = tests_dir
        self._validator = validator
        self._test_cases: Dict[str, RuleTestCase] = {}
        # 配置缓存（一次读取）
        self._config_cache: Optional[Dict] = None

    def _load_config(self) -> Dict:
        """
        加载配置文件（带缓存）

        Returns:
            Dict: 配置字典，包含 coverage_threshold 等
        """
        if self._config_cache is not None:
            return self._config_cache

        defaults = {
            "coverage_threshold": self.DEFAULT_COVERAGE_THRESHOLD,
        }

        config_path = self._tests_dir / "config.yml"
        if not config_path.exists():
            self._config_cache = defaults
            return defaults

        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
                if config is None:
                    self._config_cache = defaults
                    return defaults
                # 合并默认值
                self._config_cache = {**defaults, **config}
                return self._config_cache
        except (yaml.YAMLError, OSError) as e:
            logger.warning(f"Failed to load config from {config_path}: {e}")
            self._config_cache = defaults
            return defaults

    @staticmethod
    def calculate_coverage_percentage(
        rules_with_tests: int,
        total_rules: int,
    ) -> float:
        """
        计算覆盖率百分比

        Args:
            rules_with_tests: 有测试文件的规则数
            total_rules: 总规则数

        Returns:
            float: 覆盖率百分比 (0.0-100.0)
        """
        # 除零保护
        if total_rules == 0:
            return 0.0
        return round((rules_with_tests / total_rules) * 100, 1)

    def load_test_cases(self) -> Dict[str, RuleTestCase]:
        """
        加载所有测试用例 (REQ-12.1)

        Returns:
            Dict[str, RuleTestCase]: rule_id -> RuleTestCase 映射

        Raises:
            RuleTestError: 加载失败
        """
        self._test_cases = {}

        # FIL-001: 路径验证
        if not self._tests_dir.exists():
            logger.warning(f"Tests directory not found: {self._tests_dir}")
            return self._test_cases

        try:
            # 排除配置文件（config.yml 不是测试文件）
            excluded_files = {"config.yml"}
            
            for yaml_file in self._tests_dir.glob("*.yml"):
                # 跳过配置文件
                if yaml_file.name in excluded_files:
                    continue
                    
                test_case = self._load_test_file(yaml_file)
                # DEF-001: 显式检查 None
                if test_case is not None:
                    self._test_cases[test_case.rule_id] = test_case

            logger.info(f"Loaded {len(self._test_cases)} rule test cases")

            # Task 8.2: 冲突检测
            self._detect_conflicts()

            return self._test_cases

        # ERR-001: 指定具体异常类型
        except (OSError, yaml.YAMLError) as e:
            # ERR-004: 异常链使用 from
            raise RuleTestError(
                f"Failed to load test cases: {e}",
                cause=e,
            ) from e

    def _load_test_file(self, yaml_file: Path) -> Optional[RuleTestCase]:
        """
        加载单个测试文件

        Args:
            yaml_file: YAML文件路径

        Returns:
            Optional[RuleTestCase]: 测试用例
        """
        try:
            with open(yaml_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            # DEF-001: 显式检查 None
            if data is None:
                logger.warning(f"Empty test file: {yaml_file}")
                return None

            return RuleTestCase(**data)

        # ERR-001: 指定具体异常类型
        except (yaml.YAMLError, TypeError, ValueError) as e:
            logger.warning(f"Failed to load test file {yaml_file}: {e}")
            return None

    def _detect_conflicts(self) -> None:
        """
        检测样本冲突和重复 (Task 8.2, REQ-2.2)

        冲突检测（文本哈希级别）：
        - 规范化文本：去掉前后空白、多余空行
        - 冲突检测：同一 hash 在同一规则下同时出现在 positive & negative
        - 重复检测：同一 hash 在 positive 或 negative 内部出现多次

        日志要求（按 design.md）：
        - 冲突 → logger.error + 抛 SampleConflictError
        - 重复 → logger.warning（不阻断）

        Raises:
            SampleConflictError: 发现冲突时抛出
        """
        # 构建哈希索引：hash -> List[(rule_id, "positive"|"negative", index)]
        hash_index: Dict[str, List[Tuple[str, str, int]]] = {}

        for rule_id, test_case in self._test_cases.items():
            # 处理正例
            positive_codes = test_case.get_positive_codes()
            for idx, code in enumerate(positive_codes):
                code_hash = compute_sample_hash(code)
                if code_hash not in hash_index:
                    hash_index[code_hash] = []
                hash_index[code_hash].append((rule_id, "positive", idx))

            # 处理反例
            negative_codes = test_case.get_negative_codes()
            for idx, code in enumerate(negative_codes):
                code_hash = compute_sample_hash(code)
                if code_hash not in hash_index:
                    hash_index[code_hash] = []
                hash_index[code_hash].append((rule_id, "negative", idx))

        # 检测冲突和重复
        for code_hash, locations in hash_index.items():
            if len(locations) <= 1:
                continue

            # 按规则分组
            by_rule: Dict[str, Dict[str, List[int]]] = {}
            for rule_id, case_type, idx in locations:
                if rule_id not in by_rule:
                    by_rule[rule_id] = {"positive": [], "negative": []}
                by_rule[rule_id][case_type].append(idx)

            for rule_id, type_indices in by_rule.items():
                positive_indices = type_indices["positive"]
                negative_indices = type_indices["negative"]

                # 冲突检测：同一 hash 同时在 positive 和 negative
                if positive_indices and negative_indices:
                    logger.error(
                        f"Conflict detected: hash={code_hash} exists in both "
                        f"positive and negative cases for rule {rule_id}"
                    )
                    logger.error(
                        f"  Positive indices: {positive_indices}"
                    )
                    logger.error(
                        f"  Negative indices: {negative_indices}"
                    )
                    raise SampleConflictError(
                        f"Hash {code_hash} conflicts in rule {rule_id}: "
                        f"exists in both positive (indices {positive_indices}) "
                        f"and negative (indices {negative_indices}) cases"
                    )

                # 重复检测：同一集合内多次出现
                if len(positive_indices) > 1:
                    logger.warning(
                        f"Duplicate sample: hash={code_hash} appears "
                        f"{len(positive_indices)} times in positive cases "
                        f"for rule {rule_id} (indices: {positive_indices})"
                    )

                if len(negative_indices) > 1:
                    logger.warning(
                        f"Duplicate sample: hash={code_hash} appears "
                        f"{len(negative_indices)} times in negative cases "
                        f"for rule {rule_id} (indices: {negative_indices})"
                    )

    def run_test(self, rule: Rule) -> RuleTestResult:
        """
        运行单条规则的测试 (REQ-12.2)

        Property 7: 测试用例有效性
        - 正例必须触发规则
        - 反例不能触发规则

        Args:
            rule: 要测试的规则

        Returns:
            RuleTestResult: 测试结果
        """
        test_case = self._test_cases.get(rule.id)

        # DEF-001: 显式检查 None
        if test_case is None:
            return RuleTestResult(
                rule_id=rule.id,
                passed=False,
                positive_passed=0,
                positive_total=0,
                negative_passed=0,
                negative_total=0,
                failures=[f"No test case found for rule {rule.id}"],
            )

        failures: List[str] = []
        positive_passed = 0
        negative_passed = 0

        # 获取代码列表（兼容新旧格式）
        positive_codes = test_case.get_positive_codes()
        negative_codes = test_case.get_negative_codes()

        # 测试正例：应触发规则
        for i, code in enumerate(positive_codes):
            triggered = self._check_rule_triggers(rule, code)
            if triggered:
                positive_passed += 1
            else:
                failures.append(
                    f"Positive case {i + 1} did not trigger rule {rule.id}"
                )

        # 测试反例：不应触发规则
        for i, code in enumerate(negative_codes):
            triggered = self._check_rule_triggers(rule, code)
            if not triggered:
                negative_passed += 1
            else:
                failures.append(
                    f"Negative case {i + 1} incorrectly triggered rule {rule.id}"
                )

        all_passed = (
            positive_passed == len(positive_codes)
            and negative_passed == len(negative_codes)
        )

        return RuleTestResult(
            rule_id=rule.id,
            passed=all_passed,
            positive_passed=positive_passed,
            positive_total=len(test_case.positive_cases),
            negative_passed=negative_passed,
            negative_total=len(test_case.negative_cases),
            failures=failures,
        )

    def _check_rule_triggers(self, rule: Rule, code: str) -> bool:
        """
        检查规则是否被代码触发

        Args:
            rule: 规则
            code: 代码片段

        Returns:
            bool: 是否触发
        """
        from .models import RuleSet

        # 创建只包含这一条规则的规则集
        ruleset = RuleSet(
            id="test",
            name="Test RuleSet",
            version="1.0.0",
            rules=[rule],
        )

        result = self._validator.validate(code, ruleset)
        return len(result.violations) > 0

    def run_all_tests(
        self,
        rules: List[Rule],
        exclude_deprecated: bool = True,
    ) -> RuleTestSummary:
        """
        运行所有规则的测试

        Args:
            rules: 规则列表
            exclude_deprecated: 是否排除已废弃规则（默认 True）

        Returns:
            RuleTestSummary: 测试汇总
        """
        from .models import RuleMaturity

        # 确保测试用例已加载
        if not self._test_cases:
            self.load_test_cases()

        # 过滤已废弃规则（避免计入覆盖率分母）
        if exclude_deprecated:
            active_rules = [
                r for r in rules
                if r.maturity != RuleMaturity.DEPRECATED
            ]
        else:
            active_rules = rules

        results: List[RuleTestResult] = []
        missing_tests: List[str] = []
        invalid_tests: List[str] = []
        passed_count = 0
        failed_count = 0

        for rule in active_rules:
            # 检查是否有测试用例
            test_case = self._test_cases.get(rule.id)
            if test_case is None:
                missing_tests.append(rule.id)
                continue

            # 检查测试用例是否有效
            if not test_case.is_valid():
                invalid_tests.append(rule.id)
                logger.warning(
                    f"Invalid test case for rule {rule.id}: "
                    f"needs ≥1 positive and ≥1 negative case"
                )

            # 运行测试
            result = self.run_test(rule)
            results.append(result)

            if result.passed:
                passed_count += 1
            else:
                failed_count += 1

        # 计算覆盖率
        total_rules = len(active_rules)
        rules_with_tests = total_rules - len(missing_tests)
        coverage_percentage = self.calculate_coverage_percentage(
            rules_with_tests, total_rules
        )

        # 加载配置获取阈值
        config = self._load_config()
        coverage_threshold = config.get(
            "coverage_threshold", self.DEFAULT_COVERAGE_THRESHOLD
        )

        # 输出覆盖率日志（仅一次）
        self._log_coverage_summary(
            coverage_percentage=coverage_percentage,
            coverage_threshold=coverage_threshold,
            rules_with_tests=rules_with_tests,
            total_rules=total_rules,
            missing_tests=missing_tests,
            passed_count=passed_count,
            failed_count=failed_count,
        )

        return RuleTestSummary(
            total_rules=total_rules,
            passed_rules=passed_count,
            failed_rules=failed_count,
            missing_tests=missing_tests,
            invalid_tests=invalid_tests,
            results=results,
            coverage_percentage=coverage_percentage,
        )

    def _log_coverage_summary(
        self,
        coverage_percentage: float,
        coverage_threshold: float,
        rules_with_tests: int,
        total_rules: int,
        missing_tests: List[str],
        passed_count: int,
        failed_count: int,
    ) -> None:
        """
        输出覆盖率汇总日志（仅一次）

        Args:
            coverage_percentage: 覆盖率百分比
            coverage_threshold: 覆盖率阈值
            rules_with_tests: 有测试的规则数
            total_rules: 总规则数
            missing_tests: 缺失测试的规则列表
            passed_count: 通过数
            failed_count: 失败数
        """
        # 覆盖率信息
        logger.info(
            f"Test coverage: {coverage_percentage:.1f}% "
            f"({rules_with_tests}/{total_rules} rules with tests)"
        )

        # 通过率信息（与覆盖率分开）
        tested_rules = passed_count + failed_count
        if tested_rules > 0:
            pass_rate = round((passed_count / tested_rules) * 100, 1)
            logger.info(
                f"Pass rate: {pass_rate:.1f}% "
                f"({passed_count}/{tested_rules} tests passed)"
            )

        # 覆盖率警告（低于阈值时）
        if coverage_percentage < coverage_threshold:
            logger.warning(
                f"Coverage {coverage_percentage:.1f}% is below threshold "
                f"{coverage_threshold:.1f}%"
            )

        # 缺失测试的规则（列表过长时只输出前 10 项）
        if missing_tests:
            missing_count = len(missing_tests)
            max_display = 10
            if missing_count <= max_display:
                logger.info(f"Rules without tests ({missing_count}): {missing_tests}")
            else:
                displayed = missing_tests[:max_display]
                logger.info(
                    f"Rules without tests ({missing_count}): "
                    f"{displayed} ... and {missing_count - max_display} more"
                )

    def validate_test_coverage(
        self,
        rules: List[Rule],
        require_all: bool = False,
    ) -> Tuple[bool, List[str]]:
        """
        验证测试覆盖率

        Args:
            rules: 规则列表
            require_all: 是否要求所有规则都有测试

        Returns:
            Tuple[bool, List[str]]: (是否通过, 缺少测试的规则ID列表)
        """
        # 确保测试用例已加载
        if not self._test_cases:
            self.load_test_cases()

        missing: List[str] = []
        for rule in rules:
            if rule.id not in self._test_cases:
                missing.append(rule.id)

        if require_all:
            return len(missing) == 0, missing
        else:
            # 至少有一半规则有测试
            coverage = (len(rules) - len(missing)) / len(rules) if rules else 0
            return coverage >= 0.5, missing


# =============================================================================
# Convenience Functions
# =============================================================================


def create_rule_test_runner(
    tests_dir: Optional[Path] = None,
) -> RuleTestRunner:
    """创建 RuleTestRunner 实例的便捷函数"""
    return RuleTestRunner(tests_dir=tests_dir)


def generate_test_template(rule: Rule) -> str:
    """
    生成规则测试用例模板

    Args:
        rule: 规则

    Returns:
        str: YAML格式的测试用例模板
    """
    template = f"""# Test cases for rule {rule.id}
# {rule.description}

rule_id: "{rule.id}"
description: "Test cases for {rule.id}: {rule.description}"

# Positive cases: code that SHOULD trigger this rule
positive_cases:
  - |
    # TODO: Add code that should trigger {rule.id}
    pass

# Negative cases: code that should NOT trigger this rule
negative_cases:
  - |
    # TODO: Add code that should NOT trigger {rule.id}
    pass
"""
    return template


# =============================================================================
# Sample Validator (Task 8.1)
# =============================================================================


class SampleValidator:
    """
    样本验证器 (Task 8.1, REQ-4.2)

    验证样本是否产生预期结果：
    - 正例必须触发规则
    - 反例必须不触发规则

    设计考虑（100+ 规则场景）：
    - 进程级缓存 Rule 对象和单规则 RuleSet
    - 避免重复构造 RuleSet 和正则解析
    - 缓存失效策略：进程级，按 rule_id 键

    日志要求（按 design.md）：
    - logger.info: rule_id, hash, type, result
    - logger.warning: 失败原因
    """

    def __init__(
        self,
        validator: Optional[RuleBasedValidator] = None,
    ) -> None:
        """
        初始化样本验证器。

        Args:
            validator: 规则验证器（可选，默认创建新实例）
        """
        from .rule_registry import RuleRegistry

        if validator is None:
            validator = RuleBasedValidator()

        self._validator = validator
        self._registry = RuleRegistry()

        # 进程级缓存（100+ 规则场景优化）
        self._rule_cache: Dict[str, Rule] = {}
        self._ruleset_cache: Dict[str, "RuleSet"] = {}

    def _get_rule(self, rule_id: str) -> Optional[Rule]:
        """
        获取规则对象（带缓存）

        Args:
            rule_id: 规则ID

        Returns:
            Optional[Rule]: 规则对象，不存在返回 None
        """
        # 缓存命中
        if rule_id in self._rule_cache:
            return self._rule_cache[rule_id]

        # 从 Registry 加载
        rule = self._registry.get_rule_by_id(rule_id)
        if rule is not None:
            self._rule_cache[rule_id] = rule
        return rule

    def _get_single_rule_ruleset(self, rule: Rule) -> "RuleSet":
        """
        获取单规则 RuleSet（带缓存）

        Args:
            rule: 规则对象

        Returns:
            RuleSet: 只包含该规则的 RuleSet
        """
        from .models import RuleSet

        # 缓存命中
        if rule.id in self._ruleset_cache:
            return self._ruleset_cache[rule.id]

        # 构造新 RuleSet
        ruleset = RuleSet(
            id=f"single-{rule.id}",
            name=f"Single Rule: {rule.id}",
            version="1.0.0",
            rules=[rule],
        )
        self._ruleset_cache[rule.id] = ruleset
        return ruleset

    def _has_pattern(self, rule: Rule) -> bool:
        """
        检查规则是否有检测模式

        Args:
            rule: 规则对象

        Returns:
            bool: 是否有 pattern
        """
        # 检查 RuleBasedValidator 是否有该规则的 pattern
        pattern = self._validator._get_rule_pattern(rule)
        return pattern is not None

    def validate_sample(
        self,
        code: str,
        rule_id: str,
        expected_trigger: bool,
    ) -> ValidationSampleResult:
        """
        验证样本是否产生预期结果 (Task 8.1, REQ-4.2)

        正例必须触发规则，反例必须不触发规则。
        不通过验证的样本一律不得进入 rule_tests。

        日志要求（按 design.md）：
        - logger.info: rule_id, hash, type, result
        - logger.warning: 失败原因

        Args:
            code: 代码片段
            rule_id: 规则ID
            expected_trigger: 预期是否触发（True=正例，False=反例）

        Returns:
            ValidationSampleResult: 验证结果
        """
        # 规范化代码并计算哈希
        normalized_code = normalize_code(code)
        code_hash = compute_sample_hash(code)
        sample_type = "positive" if expected_trigger else "negative"

        # 日志：开始验证
        logger.info(
            f"Validating sample: rule_id={rule_id}, hash={code_hash}, "
            f"type={sample_type}"
        )

        # 1. 获取规则
        rule = self._get_rule(rule_id)
        if rule is None:
            reason = f"Rule not found: {rule_id}"
            logger.warning(f"Validation failed: rule_id={rule_id}, reason={reason}")
            return ValidationSampleResult(
                success=False,
                reason=reason,
                triggered=False,
                code_hash=code_hash,
            )

        # 2. 检查规则是否有 pattern（兼容无 pattern 的规则）
        if not self._has_pattern(rule):
            reason = f"Rule has no pattern: {rule_id}"
            logger.warning(f"Validation failed: rule_id={rule_id}, reason={reason}")
            return ValidationSampleResult(
                success=False,
                reason=reason,
                triggered=False,
                code_hash=code_hash,
            )

        # 3. 执行验证
        try:
            ruleset = self._get_single_rule_ruleset(rule)
            result = self._validator.validate(normalized_code, ruleset)
            triggered = len(result.violations) > 0
        except (ValueError, TypeError, AttributeError) as e:
            reason = f"Validation error: {e}"
            logger.error(f"Validation failed: rule_id={rule_id}, reason={reason}")
            return ValidationSampleResult(
                success=False,
                reason=reason,
                triggered=False,
                code_hash=code_hash,
            )

        # 4. 比较结果
        passed = triggered == expected_trigger

        # 日志：验证结果
        logger.info(
            f"Validation result: triggered={triggered}, "
            f"expected={expected_trigger}, passed={passed}"
        )

        if not passed:
            if expected_trigger:
                reason = f"Positive case did not trigger rule {rule_id}"
            else:
                reason = f"Negative case incorrectly triggered rule {rule_id}"
            logger.warning(f"Validation failed: rule_id={rule_id}, reason={reason}")
            return ValidationSampleResult(
                success=False,
                reason=reason,
                triggered=triggered,
                code_hash=code_hash,
            )

        return ValidationSampleResult(
            success=True,
            reason="",
            triggered=triggered,
            code_hash=code_hash,
        )

    def clear_cache(self) -> None:
        """清除缓存"""
        self._rule_cache.clear()
        self._ruleset_cache.clear()


# =============================================================================
# Convenience Functions for Sample Validation
# =============================================================================

# 模块级单例（懒加载），确保缓存在多次调用间复用
_SAMPLE_VALIDATOR: Optional[SampleValidator] = None


def create_sample_validator() -> SampleValidator:
    """创建 SampleValidator 实例的便捷函数"""
    return SampleValidator()


def get_sample_validator() -> SampleValidator:
    """
    获取模块级 SampleValidator 单例（懒加载）

    用于需要复用缓存的场景（如批量验证、晋升器）。
    如果需要独立实例，请使用 create_sample_validator()。

    Returns:
        SampleValidator: 模块级单例实例
    """
    global _SAMPLE_VALIDATOR
    if _SAMPLE_VALIDATOR is None:
        _SAMPLE_VALIDATOR = SampleValidator()
    return _SAMPLE_VALIDATOR


def validate_sample(
    code: str,
    rule_id: str,
    expected_trigger: bool,
) -> ValidationSampleResult:
    """
    验证样本的便捷函数 (Task 8.1)

    使用模块级单例，确保 Rule/RuleSet 缓存在多次调用间复用。
    适用于 RuleSamplePromoter 等需要频繁验证的场景。

    Args:
        code: 代码片段
        rule_id: 规则ID
        expected_trigger: 预期是否触发

    Returns:
        ValidationSampleResult: 验证结果
    """
    validator = get_sample_validator()
    return validator.validate_sample(code, rule_id, expected_trigger)


def reset_sample_validator_cache() -> None:
    """
    重置模块级 SampleValidator 单例

    用于测试或需要强制刷新缓存的场景。
    """
    global _SAMPLE_VALIDATOR
    if _SAMPLE_VALIDATOR is not None:
        _SAMPLE_VALIDATOR.clear_cache()
    _SAMPLE_VALIDATOR = None
