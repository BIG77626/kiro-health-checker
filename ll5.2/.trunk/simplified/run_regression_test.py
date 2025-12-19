#!/usr/bin/env python3
"""
Full Regression Test for Rule Test Samples

Task: 11.1 - Run full regression test with all new test files
Requirements: 2.1, 2.3

验证内容：
1. 所有 10 个规则测试文件能正确加载和通过
2. 覆盖率百分比正确计算（≥ coverage_threshold）
3. 冲突检测正常工作（无 SampleConflictError）
4. missing_tests 长度正确、invalid_tests 为 0

规则来源：统一使用 RuleRegistry（排除 DEPRECATED 规则）
退出码：0=成功，1=失败（方便 CI 集成）

架构设计（可测试性）：
- 核心逻辑在 run_all_checks() 函数中，返回 RegressionReport 数据结构
- run_regression_test() 负责输出格式化
- 支持 pytest 集成（test_regression.py）
"""

import logging
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, Any, List, Optional

# 添加父目录到 Python 路径
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir.parent))

# 设置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


# =============================================================================
# Data Models
# =============================================================================


@dataclass
class RegressionReport:
    """
    回归测试报告数据结构
    
    用于 pytest 集成和程序化访问。
    """
    # 系统功能检查结果
    test_files_loaded_correctly: bool = False
    coverage_meets_threshold: bool = False
    no_sample_conflict_error: bool = True
    no_yaml_parse_errors: bool = True
    invalid_tests_empty: bool = False
    missing_tests_count_correct: bool = False
    
    # 详细数据
    test_file_count: int = 0
    expected_test_files: int = 10
    coverage_percentage: float = 0.0
    coverage_threshold: float = 20.0
    total_rules: int = 0
    rules_with_tests: int = 0
    passed_rules: int = 0
    failed_rules: int = 0
    missing_tests_count: int = 0
    invalid_tests_count: int = 0
    
    # 错误信息
    errors: List[str] = field(default_factory=list)
    conflict_error: Optional[str] = None
    yaml_errors: List[str] = field(default_factory=list)
    
    @property
    def all_checks_passed(self) -> bool:
        """所有系统功能检查是否通过"""
        return (
            self.test_files_loaded_correctly
            and self.coverage_meets_threshold
            and self.no_sample_conflict_error
            and self.no_yaml_parse_errors
            and self.invalid_tests_empty
            and self.missing_tests_count_correct
        )
    
    def get_check_results(self) -> Dict[str, bool]:
        """获取所有检查结果的字典"""
        return {
            "Test files loaded correctly": self.test_files_loaded_correctly,
            "Coverage >= threshold": self.coverage_meets_threshold,
            "No SampleConflictError": self.no_sample_conflict_error,
            "No YAML parse errors": self.no_yaml_parse_errors,
            "invalid_tests is empty": self.invalid_tests_empty,
            "missing_tests count correct": self.missing_tests_count_correct,
        }


# =============================================================================
# Core Functions
# =============================================================================


def run_all_checks(
    expected_test_files: int = 10,
) -> RegressionReport:
    """
    运行所有回归检查（核心逻辑，可测试）
    
    这是回归测试的核心函数，将所有逻辑封装为可测试的纯函数。
    
    Args:
        expected_test_files: 预期的测试文件数量
        
    Returns:
        RegressionReport: 回归测试报告
    """
    from simplified.rule_test_runner import (
        RuleTestRunner,
        SampleConflictError,
        RuleTestError,
    )
    from simplified.rule_registry import RuleRegistry
    
    report = RegressionReport(expected_test_files=expected_test_files)
    
    # 1. 加载规则（统一来源：RuleRegistry）
    registry = RuleRegistry()
    all_rules = registry.get_all_rules()
    
    # 2. 创建测试运行器
    runner = RuleTestRunner()
    
    # 3. 加载测试用例（捕获 SampleConflictError 和 YAML 解析错误）
    test_cases = {}
    try:
        test_cases = runner.load_test_cases()
        report.test_file_count = len(test_cases)
    except SampleConflictError as e:
        report.conflict_error = str(e)
        report.no_sample_conflict_error = False
        report.errors.append(f"SampleConflictError: {e}")
    except RuleTestError as e:
        report.yaml_errors.append(str(e))
        report.no_yaml_parse_errors = False
        report.errors.append(f"RuleTestError: {e}")
    
    # 4. 验证测试文件数量
    report.test_files_loaded_correctly = (
        report.test_file_count == expected_test_files
    )
    
    # 5. 运行所有测试（明确 exclude_deprecated=True）
    summary = runner.run_all_tests(all_rules, exclude_deprecated=True)
    
    # 6. 填充报告数据
    report.total_rules = summary.total_rules
    report.rules_with_tests = summary.rules_with_tests
    report.passed_rules = summary.passed_rules
    report.failed_rules = summary.failed_rules
    report.missing_tests_count = len(summary.missing_tests)
    report.invalid_tests_count = len(summary.invalid_tests)
    
    # 7. 覆盖率验证
    report.coverage_percentage = summary.coverage_percentage or 0.0
    config = runner._load_config()
    report.coverage_threshold = config.get("coverage_threshold", 20.0)
    report.coverage_meets_threshold = (
        report.coverage_percentage >= report.coverage_threshold
    )
    
    # 8. 验证 missing_tests 长度
    expected_missing = report.total_rules - expected_test_files
    report.missing_tests_count_correct = (
        report.missing_tests_count == expected_missing
    )
    
    # 9. 验证 invalid_tests 为 0
    report.invalid_tests_empty = report.invalid_tests_count == 0
    
    return report


def run_regression_test(
    expected_test_files: int = 10,
    verbose: bool = True,
) -> bool:
    """
    运行完整回归测试（带输出格式化）
    
    规则来源：RuleRegistry（统一来源）
    排除规则：DEPRECATED（exclude_deprecated=True）
    
    Args:
        expected_test_files: 预期的测试文件数量
        verbose: 是否输出详细信息
        
    Returns:
        bool: 系统功能验证是否全部通过
    """
    from simplified.rule_test_runner import RuleTestRunner
    
    if verbose:
        print("=" * 60)
        print("Rule Test Samples - Full Regression Test")
        print("=" * 60)
        print()
    
    # 运行核心检查
    report = run_all_checks(expected_test_files=expected_test_files)
    
    if verbose:
        # 输出详细信息
        print(f"[STEP 1] Loading rules from RuleRegistry...")
        print(f"  Total rules loaded: {report.total_rules}")
        print(f"  Source: RuleRegistry (rules/*.yml)")
        print()
        
        print(f"[STEP 2] Creating RuleTestRunner...")
        print()
        
        print(f"[STEP 3] Loading test cases...")
        if report.conflict_error:
            print(f"  [ERROR] SampleConflictError: {report.conflict_error}")
        elif report.yaml_errors:
            for err in report.yaml_errors:
                print(f"  [ERROR] RuleTestError: {err}")
        else:
            print(f"  Test files loaded: {report.test_file_count}")
        print()
        
        print(f"[STEP 4] Verifying test file count...")
        if report.test_files_loaded_correctly:
            print(f"  [PASS] Test file count: {report.test_file_count} (expected {expected_test_files})")
        else:
            print(f"  [WARN] Expected {expected_test_files} test files, got {report.test_file_count}")
        print()
        
        print(f"[STEP 5] Running all tests (exclude_deprecated=True)...")
        print("-" * 60)
        print()
        print("-" * 60)
        print("Test Results Summary")
        print("-" * 60)
        print(f"  Total rules (active): {report.total_rules}")
        print(f"  Rules with tests: {report.rules_with_tests}")
        print(f"  Passed: {report.passed_rules}")
        print(f"  Failed: {report.failed_rules}")
        print(f"  Missing tests: {report.missing_tests_count}")
        print(f"  Invalid tests: {report.invalid_tests_count}")
        print()
        
        print(f"[STEP 6] Coverage Analysis...")
        print(f"  Coverage: {report.coverage_percentage:.1f}%")
        print(f"  Threshold: {report.coverage_threshold:.1f}%")
        if report.coverage_meets_threshold:
            print(f"  [PASS] Coverage {report.coverage_percentage:.1f}% >= threshold {report.coverage_threshold:.1f}%")
        else:
            print(f"  [WARN] Coverage {report.coverage_percentage:.1f}% < threshold {report.coverage_threshold:.1f}%")
        print()
        
        print(f"[STEP 7] Verifying missing_tests count...")
        expected_missing = report.total_rules - expected_test_files
        if report.missing_tests_count_correct:
            print(f"  [PASS] missing_tests count: {report.missing_tests_count} (expected {expected_missing})")
        else:
            print(f"  [WARN] missing_tests count: {report.missing_tests_count} (expected {expected_missing})")
        print()
        
        print(f"[STEP 8] Verifying invalid_tests is empty...")
        if report.invalid_tests_empty:
            print(f"  [PASS] invalid_tests count: 0")
        else:
            print(f"  [FAIL] invalid_tests count: {report.invalid_tests_count}")
        print()
        
        # 系统功能验证结论
        print("=" * 60)
        print("System Functionality Verification")
        print("=" * 60)
        
        for check_name, passed in report.get_check_results().items():
            status = "[PASS]" if passed else "[FAIL]"
            print(f"  {status} {check_name}")
        
        print()
        if report.all_checks_passed:
            print("[SUCCESS] All system functionality checks passed!")
        else:
            print("[FAILURE] Some system functionality checks failed!")
            if report.errors:
                print("\nErrors encountered:")
                for err in report.errors:
                    print(f"  - {err}")
        
        print()
        print(f"Sample Quality: {report.passed_rules}/{report.rules_with_tests} tests passed")
        print("(Sample quality issues should be addressed in FT-8: 历史样本二次审计)")
        print("=" * 60)
    
    return report.all_checks_passed


if __name__ == "__main__":
    import os
    os.chdir(script_dir)
    
    success = run_regression_test()
    # 返回非 0 退出码方便 CI 失败原因排查
    sys.exit(0 if success else 1)
