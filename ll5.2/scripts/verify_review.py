#!/usr/bin/env python3
"""
One-click review verification entrypoint.

运行方式（在 ll5.2 根目录）:
    python scripts/verify_review.py          # 默认：不含性能测试
    python scripts/verify_review.py --slow   # 包含性能测试
    python scripts/verify_review.py --xml    # 生成 JUnit XML 报告

行为：
- 调用 pytest 运行 review 相关测试文件
- 作为阶段一 + 阶段二 + 阶段三审查结论的自动化「回归验证」

阶段覆盖：
- Stage 1: 范围 & 映射基础检查
- Stage 2: 实现 & Config-as-Policy & 开关行为
- Cross-Stage: 设计 ↔ 实现一致性
- Stage 3: Traceability 追踪完整性 + CLI 输出 + 性能基线
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


# 审查测试文件列表
REVIEW_TEST_FILES = [
    ".trunk/simplified/tests/test_review_stage1.py",
    ".trunk/simplified/tests/test_review_stage2.py",
    ".trunk/simplified/tests/test_review_cross_stage.py",
    ".trunk/simplified/tests/test_review_traceability.py",
    ".trunk/simplified/tests/test_review_cli_output.py",
    ".trunk/simplified/tests/test_review_performance.py",
    ".trunk/simplified/tests/test_review_meta.py",
]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run review verification tests",
    )
    parser.add_argument(
        "--slow",
        action="store_true",
        help="包含性能测试（默认跳过）",
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="详细输出",
    )
    parser.add_argument(
        "--xml",
        type=str,
        metavar="FILE",
        help="生成 JUnit XML 报告到指定文件",
    )
    args = parser.parse_args()

    repo_root = Path(__file__).resolve().parent.parent

    cmd = [sys.executable, "-m", "pytest"] + REVIEW_TEST_FILES

    # 默认跳过 slow 测试
    if not args.slow:
        cmd.append("-m")
        cmd.append("not slow")

    # 输出详细程度
    if args.verbose:
        cmd.append("-v")
    else:
        cmd.append("-q")

    # JUnit XML 报告
    if args.xml:
        cmd.append(f"--junitxml={args.xml}")

    result = subprocess.run(cmd, cwd=str(repo_root))
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())


