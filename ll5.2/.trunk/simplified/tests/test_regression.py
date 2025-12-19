"""
Tests for run_regression_test.py

Task: P1-4 - 回归脚本 pytest 集成
Requirements: 2.1, 2.3

测试策略：
- 测试核心逻辑（run_all_checks）而非 CLI 入口
- 验证 RegressionReport 数据结构正确性
- 验证系统功能检查逻辑
- 可标记为 @pytest.mark.regression 用于 CI 选择性运行

最佳实践参考：
- Martin Fowler: 回归测试应在测试框架内可见
- pytest 官方文档：使用 markers 组织测试
"""

from __future__ import annotations

import pytest

from ..run_regression_test import (
    RegressionReport,
    run_all_checks,
    run_regression_test,
)


# =============================================================================
# Test: RegressionReport Model
# =============================================================================


class TestRegressionReportModel:
    """Tests for RegressionReport dataclass."""

    def test_all_checks_passed_true(self) -> None:
        """Test all_checks_passed returns True when all checks pass."""
        report = RegressionReport(
            test_files_loaded_correctly=True,
            coverage_meets_threshold=True,
            no_sample_conflict_error=True,
            no_yaml_parse_errors=True,
            invalid_tests_empty=True,
            missing_tests_count_correct=True,
        )
        
        assert report.all_checks_passed is True

    def test_all_checks_passed_false_single_failure(self) -> None:
        """Test all_checks_passed returns False when any check fails."""
        # Test each check individually
        checks = [
            "test_files_loaded_correctly",
            "coverage_meets_threshold",
            "no_sample_conflict_error",
            "no_yaml_parse_errors",
            "invalid_tests_empty",
            "missing_tests_count_correct",
        ]
        
        for failing_check in checks:
            kwargs = {check: True for check in checks}
            kwargs[failing_check] = False
            
            report = RegressionReport(**kwargs)
            assert report.all_checks_passed is False, (
                f"all_checks_passed should be False when {failing_check} is False"
            )

    def test_get_check_results_returns_dict(self) -> None:
        """Test get_check_results returns correct dictionary."""
        report = RegressionReport(
            test_files_loaded_correctly=True,
            coverage_meets_threshold=False,
            no_sample_conflict_error=True,
            no_yaml_parse_errors=True,
            invalid_tests_empty=True,
            missing_tests_count_correct=False,
        )
        
        results = report.get_check_results()
        
        assert isinstance(results, dict)
        assert len(results) == 6
        assert results["Test files loaded correctly"] is True
        assert results["Coverage >= threshold"] is False
        assert results["missing_tests count correct"] is False

    def test_default_values(self) -> None:
        """Test default values are applied correctly."""
        report = RegressionReport()
        
        assert report.test_files_loaded_correctly is False
        assert report.coverage_meets_threshold is False
        assert report.no_sample_conflict_error is True  # Default True
        assert report.no_yaml_parse_errors is True  # Default True
        assert report.invalid_tests_empty is False
        assert report.missing_tests_count_correct is False
        assert report.errors == []
        assert report.conflict_error is None
        assert report.yaml_errors == []


# =============================================================================
# Test: run_all_checks Core Function
# =============================================================================


@pytest.mark.regression
class TestRunAllChecks:
    """
    Tests for run_all_checks() core function.
    
    标记为 @pytest.mark.regression 用于 CI 选择性运行。
    """

    def test_returns_regression_report(self) -> None:
        """Test run_all_checks returns RegressionReport."""
        report = run_all_checks()
        
        assert isinstance(report, RegressionReport)

    def test_total_rules_positive(self) -> None:
        """Test total_rules is positive."""
        report = run_all_checks()
        
        assert report.total_rules > 0

    def test_coverage_percentage_in_range(self) -> None:
        """Test coverage_percentage is in valid range."""
        report = run_all_checks()
        
        assert 0.0 <= report.coverage_percentage <= 100.0

    def test_coverage_calculation_correct(self) -> None:
        """Test coverage percentage calculation is correct."""
        report = run_all_checks()
        
        if report.total_rules > 0:
            expected_coverage = (report.rules_with_tests / report.total_rules) * 100
            assert abs(report.coverage_percentage - expected_coverage) < 0.1

    def test_no_sample_conflict_error(self) -> None:
        """Test no SampleConflictError in current test files."""
        report = run_all_checks()
        
        assert report.no_sample_conflict_error is True
        assert report.conflict_error is None

    def test_no_yaml_parse_errors(self) -> None:
        """Test no YAML parse errors in current test files."""
        report = run_all_checks()
        
        assert report.no_yaml_parse_errors is True
        assert report.yaml_errors == []

    def test_invalid_tests_empty(self) -> None:
        """Test invalid_tests is empty (all test files have valid structure)."""
        report = run_all_checks()
        
        assert report.invalid_tests_empty is True
        assert report.invalid_tests_count == 0

    def test_rules_with_tests_matches_test_file_count(self) -> None:
        """Test rules_with_tests matches test_file_count."""
        report = run_all_checks()
        
        # rules_with_tests should equal test_file_count
        # (assuming each test file covers exactly one rule)
        assert report.rules_with_tests == report.test_file_count

    def test_passed_plus_failed_equals_rules_with_tests(self) -> None:
        """Test passed + failed equals rules_with_tests."""
        report = run_all_checks()
        
        assert report.passed_rules + report.failed_rules == report.rules_with_tests


# =============================================================================
# Test: System Functionality Checks
# =============================================================================


@pytest.mark.regression
class TestSystemFunctionalityChecks:
    """
    Tests for individual system functionality checks.
    
    这些测试验证回归测试的各项检查逻辑。
    """

    def test_test_files_loaded_check(self) -> None:
        """Test test_files_loaded_correctly check logic."""
        report = run_all_checks(expected_test_files=10)
        
        # 检查逻辑：test_file_count == expected_test_files
        expected = report.test_file_count == 10
        assert report.test_files_loaded_correctly == expected

    def test_coverage_threshold_check(self) -> None:
        """Test coverage_meets_threshold check logic."""
        report = run_all_checks()
        
        # 检查逻辑：coverage_percentage >= coverage_threshold
        expected = report.coverage_percentage >= report.coverage_threshold
        assert report.coverage_meets_threshold == expected

    def test_missing_tests_count_check(self) -> None:
        """Test missing_tests_count_correct check logic."""
        report = run_all_checks(expected_test_files=10)
        
        # 检查逻辑：missing_tests_count == total_rules - expected_test_files
        expected_missing = report.total_rules - 10
        expected = report.missing_tests_count == expected_missing
        assert report.missing_tests_count_correct == expected


# =============================================================================
# Test: run_regression_test Function
# =============================================================================


@pytest.mark.regression
class TestRunRegressionTest:
    """
    Tests for run_regression_test() function.
    """

    def test_returns_bool(self) -> None:
        """Test run_regression_test returns boolean."""
        result = run_regression_test(verbose=False)
        
        assert isinstance(result, bool)

    def test_verbose_false_no_output(self, capsys: pytest.CaptureFixture) -> None:
        """Test verbose=False produces no output."""
        run_regression_test(verbose=False)
        captured = capsys.readouterr()
        
        # Should have no output
        assert captured.out == ""

    def test_verbose_true_has_output(self, capsys: pytest.CaptureFixture) -> None:
        """Test verbose=True produces output."""
        run_regression_test(verbose=True)
        captured = capsys.readouterr()
        
        # Should have output
        assert len(captured.out) > 0
        assert "Rule Test Samples" in captured.out

    def test_result_matches_report(self) -> None:
        """Test return value matches report.all_checks_passed."""
        report = run_all_checks()
        result = run_regression_test(verbose=False)
        
        assert result == report.all_checks_passed


# =============================================================================
# Test: Integration with Real Data
# =============================================================================


@pytest.mark.regression
class TestRegressionIntegration:
    """
    Integration tests using real rule_tests data.
    
    这些测试验证回归测试在真实环境下的行为。
    """

    def test_current_test_files_count(self) -> None:
        """
        Test current test file count matches expected.
        
        当前预期：10 个测试文件
        - 3 existing: ERR-001, NET-001, SEC-001
        - 7 new: NET-007, ERR-002, ERR-003, SEC-006, SEC-007, DBA-003, TYP-002
        """
        report = run_all_checks(expected_test_files=10)
        
        # 验证测试文件数量
        assert report.test_file_count == 10, (
            f"Expected 10 test files, got {report.test_file_count}"
        )

    def test_coverage_above_minimum(self) -> None:
        """
        Test coverage is above minimum threshold.
        
        当前预期：覆盖率 >= 20%（配置的阈值）
        """
        report = run_all_checks()
        
        assert report.coverage_percentage >= 20.0, (
            f"Coverage {report.coverage_percentage}% is below minimum 20%"
        )

    def test_all_system_checks_pass(self) -> None:
        """
        Test all system functionality checks pass.
        
        这是回归测试的核心断言。
        """
        report = run_all_checks(expected_test_files=10)
        
        # 输出详细信息便于调试
        if not report.all_checks_passed:
            for check_name, passed in report.get_check_results().items():
                if not passed:
                    print(f"FAILED: {check_name}")
            if report.errors:
                print(f"Errors: {report.errors}")
        
        assert report.all_checks_passed, (
            f"System checks failed: {report.get_check_results()}"
        )
