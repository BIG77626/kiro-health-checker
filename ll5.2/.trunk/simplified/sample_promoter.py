"""
Rule Sample Promoter - 规则样本晋升器

=== SKILL COMPLIANCE DECLARATION ===
Task: RULE-TEST-SAMPLES (Task 9.1)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE, FILE-SAFETY
Level: Expert (P2)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: ERR-004 (异常链必须使用 from)
  - Evidence: `raise PromotionError(...) from e`

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit `is None` checks

Rule: FIL-001 (路径注入检测)
  - Evidence: Using Path.resolve() for path validation
===================================

Requirements: REQ-4.1, REQ-4.2
Properties:
  - Property 5: Promotion validation and metadata
"""

from __future__ import annotations

import logging
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Literal, Optional, Set, Tuple

import yaml
from pydantic import BaseModel, ConfigDict, Field

from .models import SimplifiedArchitectureError
from .rule_test_runner import (
    CandidateSample,
    ExtendedTestCase,
    RuleTestCase,
    RuleTestRunner,
    SampleConflictError,
    SampleMetadata,
    SampleValidationError,
    ValidationSampleResult,
    compute_sample_hash,
    get_sample_validator,
    normalize_code,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Exceptions
# =============================================================================


class PromotionError(SimplifiedArchitectureError):
    """晋升错误基类"""

    pass


class CandidateNotFoundError(PromotionError):
    """候选文件不存在"""

    pass


class CandidateParseError(PromotionError):
    """候选文件解析错误"""

    pass


class ValidationFailedError(PromotionError):
    """样本验证失败（正例未触发/反例误触发）"""

    pass


class RuleNotReadyError(PromotionError):
    """规则未准备好（无 pattern 等）"""

    pass


# =============================================================================
# Result Models
# =============================================================================


class PromotionResult(BaseModel):
    """
    晋升结果 (REQ-4.1)

    记录 promote() 的执行结果。
    """

    success: bool = Field(description="晋升是否成功")
    message: str = Field(description="结果消息")
    target_file: Optional[str] = Field(
        default=None,
        description="目标测试文件路径（成功时）",
    )
    candidate_deleted: bool = Field(
        default=False,
        description="候选文件是否已删除",
    )

    model_config = ConfigDict(strict=True, extra="forbid")


# =============================================================================
# Rule Sample Promoter
# =============================================================================


class RuleSamplePromoter:
    """
    规则样本晋升器 (Task 9.1, REQ-4.1, REQ-4.2)

    将审核通过的候选样本晋升到正式测试文件。

    晋升流程：
    1. 读取候选文件
    2. 验证样本产生预期结果（正例触发/反例不触发）
    3. 检查与现有样本的冲突
    4. 合并到 rule_tests/{rule_id}.yml（原子写入）
    5. 删除候选文件

    设计原则：
    - 验证失败不得写入
    - 冲突检测阻断
    - 原子写入（tempfile + os.replace）
    - 失败回滚（不修改任何文件）
    """

    def __init__(
        self,
        tests_dir: Optional[Path] = None,
        runner: Optional[RuleTestRunner] = None,
    ) -> None:
        """
        初始化晋升器。

        Args:
            tests_dir: 测试用例目录（默认 rule_tests/）
            runner: RuleTestRunner 实例（用于加载现有测试）
        """
        if tests_dir is None:
            tests_dir = Path(__file__).parent / "rule_tests"

        if runner is None:
            runner = RuleTestRunner(tests_dir=tests_dir)

        self._tests_dir = tests_dir.resolve()
        self._runner = runner
        self._validator = get_sample_validator()

    def promote(
        self,
        candidate_file: Path,
        target_rule_id: str,
        is_positive: bool,
    ) -> PromotionResult:
        """
        将候选样本晋升到正式测试文件 (REQ-4.1, REQ-4.2)

        Args:
            candidate_file: 候选样本文件路径
            target_rule_id: 目标规则ID
            is_positive: True=晋升为正例, False=晋升为反例

        Returns:
            PromotionResult: 晋升结果

        Raises:
            CandidateNotFoundError: 候选文件不存在
            CandidateParseError: 候选文件解析错误
            ValidationFailedError: 样本验证失败
            RuleNotReadyError: 规则未准备好
            SampleConflictError: 样本冲突
        """
        sample_type = "positive" if is_positive else "negative"

        # 日志：开始晋升
        logger.info(
            f"Starting promotion: candidate={candidate_file}, "
            f"rule_id={target_rule_id}, type={sample_type}"
        )

        # Step 1: 读取候选文件
        logger.info("Step 1: Reading candidate file...")
        candidate = self._read_candidate(candidate_file)
        logger.info(f"  Candidate loaded: rule_id={candidate.rule_id}")

        # Step 2: 验证样本
        logger.info("Step 2: Validating sample...")
        validation_result = self._validate_sample(
            candidate.code, target_rule_id, is_positive
        )
        if not validation_result.success:
            logger.warning(f"  Validation: FAILED - {validation_result.reason}")
            raise ValidationFailedError(
                f"Sample validation failed: {validation_result.reason}"
            )
        logger.info("  Validation: PASSED")

        # Step 3: 检查冲突
        logger.info("Step 3: Checking conflicts...")
        code_hash = compute_sample_hash(candidate.code)
        self._check_conflicts(code_hash, target_rule_id, is_positive)
        logger.info("  Conflict check: PASSED")

        # Step 4: 合并到测试文件（原子写入）
        target_file = self._tests_dir / f"{target_rule_id}.yml"
        logger.info(f"Step 4: Writing to {target_file}...")
        self._merge_to_test_file(candidate, target_rule_id, is_positive, target_file)
        logger.info("  Write: COMPLETED")

        # Step 5: 删除候选文件
        logger.info("Step 5: Removing candidate file...")
        candidate_deleted = self._delete_candidate(candidate_file)
        if candidate_deleted:
            logger.info("  Candidate file: DELETED")
        else:
            logger.warning("  Candidate file: FAILED TO DELETE")

        # 最终结果
        logger.info(
            f"Promotion completed: {candidate_file} -> {target_file}"
        )

        return PromotionResult(
            success=True,
            message=f"Successfully promoted sample to {target_file}",
            target_file=str(target_file),
            candidate_deleted=candidate_deleted,
        )

    def _read_candidate(self, candidate_file: Path) -> CandidateSample:
        """
        读取候选文件

        Args:
            candidate_file: 候选文件路径

        Returns:
            CandidateSample: 候选样本

        Raises:
            CandidateNotFoundError: 文件不存在
            CandidateParseError: 解析错误
        """
        # 路径规范化和验证
        resolved_path = candidate_file.expanduser().resolve()

        if not resolved_path.exists():
            raise CandidateNotFoundError(
                f"Candidate file not found: {candidate_file}"
            )

        if not resolved_path.is_file():
            raise CandidateNotFoundError(
                f"Candidate path is not a file: {candidate_file}"
            )

        try:
            with open(resolved_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            if data is None:
                raise CandidateParseError(
                    f"Candidate file is empty: {candidate_file}"
                )

            return CandidateSample(**data)

        except yaml.YAMLError as e:
            raise CandidateParseError(
                f"Failed to parse candidate YAML: {e}"
            ) from e
        except (TypeError, ValueError) as e:
            raise CandidateParseError(
                f"Invalid candidate schema: {e}"
            ) from e

    def _validate_sample(
        self,
        code: str,
        rule_id: str,
        expected_trigger: bool,
    ) -> ValidationSampleResult:
        """
        验证样本 (REQ-4.2)

        Args:
            code: 代码片段
            rule_id: 规则ID
            expected_trigger: 预期是否触发

        Returns:
            ValidationSampleResult: 验证结果

        Raises:
            RuleNotReadyError: 规则未准备好（无 pattern）
        """
        result = self._validator.validate_sample(code, rule_id, expected_trigger)

        # 区分"验证失败"和"规则未准备好"
        if not result.success:
            if "not found" in result.reason.lower():
                raise RuleNotReadyError(
                    f"Rule not found: {rule_id}. "
                    f"Please ensure the rule exists before promoting samples."
                )
            if "no pattern" in result.reason.lower():
                raise RuleNotReadyError(
                    f"Rule has no pattern: {rule_id}. "
                    f"Please add a pattern to the rule before promoting samples."
                )

        return result

    def _check_conflicts(
        self,
        code_hash: str,
        rule_id: str,
        is_positive: bool,
    ) -> None:
        """
        检查样本冲突 (复用现有冲突检测逻辑)

        在内存中模拟合并后检测冲突：
        - 同一 hash 在同一规则下同时出现在 positive & negative
        - 同一 hash 在目标集合中已存在（重复）

        Args:
            code_hash: 样本哈希
            rule_id: 规则ID
            is_positive: 是否为正例

        Raises:
            SampleConflictError: 发现冲突
        """
        # 加载现有测试用例
        test_cases = self._runner.load_test_cases()
        test_case = test_cases.get(rule_id)

        if test_case is None:
            # 规则还没有测试文件，不会有冲突
            return

        # 收集现有样本的哈希
        positive_hashes: Set[str] = set()
        negative_hashes: Set[str] = set()

        for code in test_case.get_positive_codes():
            positive_hashes.add(compute_sample_hash(code))

        for code in test_case.get_negative_codes():
            negative_hashes.add(compute_sample_hash(code))

        # 检查冲突：同一 hash 在 positive 和 negative 中都存在
        if is_positive:
            # 要添加到 positive，检查是否在 negative 中
            if code_hash in negative_hashes:
                logger.error(
                    f"Conflict detected: hash={code_hash} already exists "
                    f"in negative cases for rule {rule_id}"
                )
                raise SampleConflictError(
                    f"Sample hash {code_hash} conflicts: "
                    f"already exists in negative cases for rule {rule_id}. "
                    f"Cannot promote as positive."
                )
            # 检查重复
            if code_hash in positive_hashes:
                logger.warning(
                    f"Duplicate sample: hash={code_hash} already exists "
                    f"in positive cases for rule {rule_id}"
                )
                raise SampleConflictError(
                    f"Sample hash {code_hash} already exists "
                    f"in positive cases for rule {rule_id}. "
                    f"Duplicate samples are not allowed."
                )
        else:
            # 要添加到 negative，检查是否在 positive 中
            if code_hash in positive_hashes:
                logger.error(
                    f"Conflict detected: hash={code_hash} already exists "
                    f"in positive cases for rule {rule_id}"
                )
                raise SampleConflictError(
                    f"Sample hash {code_hash} conflicts: "
                    f"already exists in positive cases for rule {rule_id}. "
                    f"Cannot promote as negative."
                )
            # 检查重复
            if code_hash in negative_hashes:
                logger.warning(
                    f"Duplicate sample: hash={code_hash} already exists "
                    f"in negative cases for rule {rule_id}"
                )
                raise SampleConflictError(
                    f"Sample hash {code_hash} already exists "
                    f"in negative cases for rule {rule_id}. "
                    f"Duplicate samples are not allowed."
                )

    def _merge_to_test_file(
        self,
        candidate: CandidateSample,
        rule_id: str,
        is_positive: bool,
        target_file: Path,
    ) -> None:
        """
        合并样本到测试文件（原子写入）

        使用 tempfile + os.replace 实现原子替换。

        注意：此操作会重写 YAML 文件，可能丢失注释。

        Args:
            candidate: 候选样本
            rule_id: 规则ID
            is_positive: 是否为正例
            target_file: 目标文件路径
        """
        # 加载或创建测试用例
        if target_file.exists():
            with open(target_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
        else:
            # 创建新的测试文件
            data = {
                "rule_id": rule_id,
                "description": f"Test cases for {rule_id}",
                "positive_cases": [],
                "negative_cases": [],
            }

        # 构造新样本（带元数据）
        new_sample = {
            "code": candidate.code,
            "metadata": {
                "source": candidate.type,  # false_positive or false_green
                "reviewed": True,  # 晋升成功即视为已审核
                "note": candidate.note,
            },
        }

        # 添加到对应列表
        if is_positive:
            if "positive_cases" not in data:
                data["positive_cases"] = []
            data["positive_cases"].append(new_sample)
        else:
            if "negative_cases" not in data:
                data["negative_cases"] = []
            data["negative_cases"].append(new_sample)

        # 原子写入：tempfile + os.replace
        self._atomic_write_yaml(target_file, data)

    def _atomic_write_yaml(self, target_file: Path, data: dict) -> None:
        """
        原子写入 YAML 文件

        使用 tempfile.NamedTemporaryFile + os.replace 实现。

        Args:
            target_file: 目标文件路径
            data: 要写入的数据
        """
        # 确保目标目录存在
        target_file.parent.mkdir(parents=True, exist_ok=True)

        # 创建临时文件（在同一目录下，确保 os.replace 可以工作）
        fd, tmp_path = tempfile.mkstemp(
            suffix=".yml.tmp",
            dir=target_file.parent,
        )

        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                yaml.safe_dump(
                    data,
                    f,
                    default_flow_style=False,
                    allow_unicode=True,
                    sort_keys=False,
                )
                # 确保数据写入磁盘
                f.flush()
                os.fsync(f.fileno())

            # 原子替换
            os.replace(tmp_path, target_file)

        except Exception:
            # 清理临时文件
            try:
                os.unlink(tmp_path)
            except OSError:
                pass
            raise

    def _delete_candidate(self, candidate_file: Path) -> bool:
        """
        删除候选文件

        Args:
            candidate_file: 候选文件路径

        Returns:
            bool: 是否成功删除
        """
        try:
            resolved_path = candidate_file.expanduser().resolve()
            resolved_path.unlink()
            return True
        except OSError as e:
            logger.warning(f"Failed to delete candidate file: {e}")
            return False


# =============================================================================
# Convenience Functions
# =============================================================================


def create_promoter(tests_dir: Optional[Path] = None) -> RuleSamplePromoter:
    """创建 RuleSamplePromoter 实例的便捷函数"""
    return RuleSamplePromoter(tests_dir=tests_dir)


def promote_sample(
    candidate_file: Path,
    rule_id: str,
    is_positive: bool,
    tests_dir: Optional[Path] = None,
) -> PromotionResult:
    """
    晋升样本的便捷函数

    Args:
        candidate_file: 候选文件路径
        rule_id: 规则ID
        is_positive: 是否为正例
        tests_dir: 测试目录（可选）

    Returns:
        PromotionResult: 晋升结果
    """
    promoter = create_promoter(tests_dir=tests_dir)
    return promoter.promote(candidate_file, rule_id, is_positive)
