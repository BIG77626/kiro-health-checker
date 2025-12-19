#!/usr/bin/env python3
"""
Promote Sample CLI - 样本晋升命令行工具

=== SKILL COMPLIANCE DECLARATION ===
Task: RULE-TEST-SAMPLES (Task 9.3)
Skills: ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Standard (P1)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types
===================================

Usage:
    python -m simplified.promote_sample <candidate_file> <rule_id> <positive|negative>

Examples:
    # 将候选样本晋升为正例
    python -m simplified.promote_sample candidates/NET-007_fp_20251218.yml NET-007 positive

    # 将候选样本晋升为反例
    python -m simplified.promote_sample candidates/NET-007_fp_20251218.yml NET-007 negative

Exit Codes:
    0 - Success
    1 - Validation/conflict error (sample problem)
    2 - File/parse error (candidate file problem)
    3 - System error (unexpected)
"""

from __future__ import annotations

import argparse
import logging
import sys
from pathlib import Path

import yaml

from .rule_test_runner import SampleConflictError, SampleValidationError
from .sample_promoter import (
    CandidateNotFoundError,
    CandidateParseError,
    PromotionResult,
    RuleNotReadyError,
    RuleSamplePromoter,
    ValidationFailedError,
)

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(message)s",
)
logger = logging.getLogger(__name__)


# =============================================================================
# Exit Codes
# =============================================================================

EXIT_SUCCESS = 0
EXIT_VALIDATION_ERROR = 1  # 样本问题（验证失败、冲突）
EXIT_FILE_ERROR = 2  # 文件问题（不存在、解析错误）
EXIT_SYSTEM_ERROR = 3  # 系统错误（意外异常）


# =============================================================================
# CLI Implementation
# =============================================================================


def parse_args(args: list[str] | None = None) -> argparse.Namespace:
    """
    解析命令行参数

    Args:
        args: 命令行参数列表（默认使用 sys.argv）

    Returns:
        argparse.Namespace: 解析后的参数
    """
    parser = argparse.ArgumentParser(
        prog="python -m simplified.promote_sample",
        description="Promote a candidate sample to the official rule test file.",
        epilog="""
Examples:
  %(prog)s candidates/NET-007_fp_20251218.yml NET-007 positive
  %(prog)s candidates/ERR-003_fg_20251218.yml ERR-003 negative
        """,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )

    parser.add_argument(
        "candidate_file",
        type=str,
        help="Path to the candidate sample file (YAML)",
    )

    parser.add_argument(
        "rule_id",
        type=str,
        help="Target rule ID (e.g., NET-007, ERR-003)",
    )

    parser.add_argument(
        "sample_type",
        type=str,
        choices=["positive", "negative"],
        help="Sample type: 'positive' (should trigger) or 'negative' (should not trigger)",
    )

    parser.add_argument(
        "--tests-dir",
        type=str,
        default=None,
        help="Path to rule_tests directory (default: auto-detect)",
    )

    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose output",
    )

    parser.add_argument(
        "-q", "--quiet",
        action="store_true",
        help="Suppress non-error output",
    )

    return parser.parse_args(args)


def main(args: list[str] | None = None) -> int:
    """
    CLI 主入口

    Args:
        args: 命令行参数列表（默认使用 sys.argv）

    Returns:
        int: 退出码
    """
    parsed = parse_args(args)

    # 配置日志级别
    if parsed.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    elif parsed.quiet:
        logging.getLogger().setLevel(logging.ERROR)

    # 规范化路径
    candidate_path = Path(parsed.candidate_file).expanduser().resolve()
    is_positive = parsed.sample_type == "positive"

    # 可选的 tests_dir
    tests_dir = None
    if parsed.tests_dir is not None:
        tests_dir = Path(parsed.tests_dir).expanduser().resolve()

    # 输出开始信息
    if not parsed.quiet:
        print(f"Promoting sample: {parsed.candidate_file}")
        print(f"  Rule ID: {parsed.rule_id}")
        print(f"  Type: {parsed.sample_type}")
        print()

    try:
        # 创建晋升器并执行
        promoter = RuleSamplePromoter(tests_dir=tests_dir)
        result = promoter.promote(
            candidate_file=candidate_path,
            target_rule_id=parsed.rule_id,
            is_positive=is_positive,
        )

        # 输出成功信息
        if not parsed.quiet:
            print("✓ Promotion successful!")
            print(f"  Target file: {result.target_file}")
            if result.candidate_deleted:
                print("  Candidate file: deleted")
            else:
                print("  Candidate file: NOT deleted (please remove manually)")

        return EXIT_SUCCESS

    except CandidateNotFoundError as e:
        print(f"✗ Error: Candidate file not found", file=sys.stderr)
        print(f"  {e}", file=sys.stderr)
        return EXIT_FILE_ERROR

    except CandidateParseError as e:
        print(f"✗ Error: Failed to parse candidate file", file=sys.stderr)
        print(f"  {e}", file=sys.stderr)
        return EXIT_FILE_ERROR

    except yaml.YAMLError as e:
        print(f"✗ Error: Invalid YAML format", file=sys.stderr)
        print(f"  {e}", file=sys.stderr)
        return EXIT_FILE_ERROR

    except ValidationFailedError as e:
        print(f"✗ Error: Sample validation failed", file=sys.stderr)
        print(f"  {e}", file=sys.stderr)
        print(file=sys.stderr)
        print("  The sample does not produce the expected result.", file=sys.stderr)
        print("  Please verify the sample is correct before promoting.", file=sys.stderr)
        return EXIT_VALIDATION_ERROR

    except RuleNotReadyError as e:
        print(f"✗ Error: Rule not ready for sample promotion", file=sys.stderr)
        print(f"  {e}", file=sys.stderr)
        print(file=sys.stderr)
        print("  Please ensure the rule exists and has a pattern.", file=sys.stderr)
        return EXIT_VALIDATION_ERROR

    except SampleConflictError as e:
        print(f"✗ Error: Sample conflict detected", file=sys.stderr)
        print(f"  {e}", file=sys.stderr)
        print(file=sys.stderr)
        print("  The sample conflicts with existing samples.", file=sys.stderr)
        print("  Please review and resolve the conflict.", file=sys.stderr)
        return EXIT_VALIDATION_ERROR

    except SampleValidationError as e:
        print(f"✗ Error: Sample validation error", file=sys.stderr)
        print(f"  {e}", file=sys.stderr)
        return EXIT_VALIDATION_ERROR

    except OSError as e:
        print(f"✗ Error: File system error", file=sys.stderr)
        print(f"  {e}", file=sys.stderr)
        return EXIT_FILE_ERROR

    except Exception as e:
        # 意外异常：记录详细日志，但不在 CLI 输出堆栈
        logger.exception("Unexpected error during promotion")
        print(f"✗ System error: {type(e).__name__}", file=sys.stderr)
        print("  Please contact the maintainer.", file=sys.stderr)
        return EXIT_SYSTEM_ERROR


if __name__ == "__main__":
    sys.exit(main())
