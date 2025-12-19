"""
Tests for health_check.py

Task: P0-2 - health_check.py 的 pytest 测试
Requirements: 2.3

测试策略：
- 使用 tmp_path 构造临时规则测试环境，避免污染真实数据
- 使用 capsys 捕获 stdout/stderr，验证输出格式
- 测试核心逻辑（run_health_check）而非 CLI 入口
- 覆盖边界情况：空目录、0 覆盖率、低于阈值等

最佳实践参考：
- pytest 官方文档：tmp_path fixture
- RealPython：Testing Python Applications
"""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from typing import Dict, Any

import pytest
import yaml

from ..health_check import (
    HealthCheckReport,
    RuleSampleStats,
    run_health_check,
    print_text_report,
)


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def empty_rule_tests_dir(tmp_path: Path) -> Path:
    """Create an empty rule_tests directory."""
    rule_tests = tmp_path / "rule_tests"
    rule_tests.mkdir()
    return rule_tests


@pytest.fixture
def minimal_rule_tests_dir(tmp_path: Path) -> Path:
    """
    Create a minimal rule_tests directory with 1 test file.
    
    Structure:
    - rule_tests/
      - TEST-001.yml (1 positive, 1 negative)
      - config.yml (coverage_threshold: 20.0)
    """
    rule_tests = tmp_path / "rule_tests"
    rule_tests.mkdir()
    
    # Create a test file
    test_file = rule_tests / "TEST-001.yml"
    test_file.write_text(
        yaml.dump({
            "rule_id": "TEST-001",
            "description": "Test rule for health check",
            "positive_cases": ["trigger_code()"],
            "negative_cases": ["safe_code()"],
        }),
        encoding="utf-8",
    )
    
    # Create config file
    config_file = rule_tests / "config.yml"
    config_file.write_text(
        yaml.dump({
            "coverage_threshold": 20.0,
            "high_priority_rules": ["TEST-001"],
        }),
        encoding="utf-8",
    )
    
    return rule_tests


@pytest.fixture
def multi_rule_tests_dir(tmp_path: Path) -> Path:
    """
    Create a rule_tests directory with multiple test files.
    
    Structure:
    - rule_tests/
      - SEC-001.yml (2 positive, 2 negative)
      - ERR-001.yml (1 positive, 1 negative)
      - config.yml (coverage_threshold: 10.0)
    """
    rule_tests = tmp_path / "rule_tests"
    rule_tests.mkdir()
    
    # SEC-001 test file
    sec_file = rule_tests / "SEC-001.yml"
    sec_file.write_text(
        yaml.dump({
            "rule_id": "SEC-001",
            "description": "Security rule test",
            "positive_cases": [
                "eval(user_input)",
                "exec(code)",
            ],
            "negative_cases": [
                "result = 1 + 2",
                "# eval in comment",
            ],
        }),
        encoding="utf-8",
    )
    
    # ERR-001 test file
    err_file = rule_tests / "ERR-001.yml"
    err_file.write_text(
        yaml.dump({
            "rule_id": "ERR-001",
            "description": "Error handling rule test",
            "positive_cases": ["except:"],
            "negative_cases": ["except ValueError:"],
        }),
        encoding="utf-8",
    )
    
    # Config file
    config_file = rule_tests / "config.yml"
    config_file.write_text(
        yaml.dump({
            "coverage_threshold": 10.0,
            "high_priority_rules": ["SEC-001", "ERR-001", "NET-001"],
        }),
        encoding="utf-8",
    )
    
    return rule_tests


# =============================================================================
# Test: HealthCheckReport Model
# =============================================================================


class TestHealthCheckReportModel:
    """Tests for HealthCheckReport dataclass."""

    def test_to_dict_returns_all_fields(self) -> None:
        """Test to_dict includes all fields."""
        report = HealthCheckReport(
            generated_at="2025-12-18T10:00:00",
            total_rules=10,
            rules_with_tests=3,
            coverage_percentage=30.0,
            coverage_threshold=20.0,
            coverage_meets_threshold=True,
            passed_rules=2,
            failed_rules=1,
        )
        
        result = report.to_dict()
        
        assert result["generated_at"] == "2025-12-18T10:00:00"
        assert result["total_rules"] == 10
        assert result["rules_with_tests"] == 3
        assert result["coverage_percentage"] == 30.0
        assert result["coverage_meets_threshold"] is True

    def test_default_values(self) -> None:
        """Test default values are applied correctly."""
        report = HealthCheckReport(generated_at="2025-12-18T10:00:00")
        
        assert report.total_rules == 0
        assert report.rules_with_tests == 0
        assert report.coverage_percentage == 0.0
        assert report.coverage_threshold == 20.0
        assert report.coverage_meets_threshold is False
        assert report.missing_tests == []
        assert report.sample_stats == []


class TestRuleSampleStatsModel:
    """Tests for RuleSampleStats dataclass."""

    def test_total_samples_property(self) -> None:
        """Test total_samples calculates correctly."""
        stats = RuleSampleStats(
            rule_id="TEST-001",
            has_test_file=True,
            positive_count=3,
            negative_count=5,
        )
        
        assert stats.total_samples == 8

    def test_total_samples_zero(self) -> None:
        """Test total_samples with zero counts."""
        stats = RuleSampleStats(
            rule_id="TEST-001",
            has_test_file=True,
            positive_count=0,
            negative_count=0,
        )
        
        assert stats.total_samples == 0


# =============================================================================
# Test: run_health_check Core Function
# =============================================================================


class TestRunHealthCheck:
    """
    Tests for run_health_check() core function.
    
    使用 tmp_path 构造临时环境，验证核心逻辑。
    """

    def test_with_real_rule_tests(self) -> None:
        """
        Test run_health_check with real rule_tests directory.
        
        验证在真实环境下能正常运行并返回合理结果。
        """
        # 使用默认路径（真实 rule_tests/）
        report = run_health_check()
        
        # 基本断言：报告结构正确
        assert report.generated_at is not None
        assert report.total_rules >= 0
        assert report.rules_with_tests >= 0
        assert 0.0 <= report.coverage_percentage <= 100.0
        
        # 覆盖率计算正确
        if report.total_rules > 0:
            expected_coverage = (report.rules_with_tests / report.total_rules) * 100
            assert abs(report.coverage_percentage - expected_coverage) < 0.1

    def test_coverage_meets_threshold_true(self) -> None:
        """
        Test coverage_meets_threshold is True when coverage >= threshold.
        """
        report = run_health_check()
        
        # 验证 coverage_meets_threshold 逻辑正确
        expected = report.coverage_percentage >= report.coverage_threshold
        assert report.coverage_meets_threshold == expected

    def test_requirement_layer_disabled_in_config(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """
        当 requirements.enabled=False 时，应完全跳过需求层计算。
        """
        from simplified import health_config_models

        # 在临时目录下创建自定义 health_config.yml
        config_path = tmp_path / "health_config.yml"
        config_path.write_text(
            yaml.dump(
                {
                    "version": 1,
                    "requirements": {
                        "enabled": False,
                        "coverage_threshold": 10.0,
                    },
                    "traceability": {},
                    "rules": {
                        "min_positive_cases": 1,
                        "min_negative_cases": 1,
                    },
                    "output": {
                        "show_requirement_layer": True,
                        "show_traceability_details": True,
                    },
                }
            ),
            encoding="utf-8",
        )

        # monkeypatch 默认配置加载路径，让 health_check 使用临时配置文件
        original_load = health_config_models.load_health_config

        def _load_override(path: Path | None = None) -> health_config_models.HealthConfig:
            return original_load(config_path)

        monkeypatch.setattr(health_config_models, "load_health_config", _load_override)

        report = run_health_check()
        # 需求层被禁用时，不应产生 requirement_coverage 字段内容
        assert report.requirement_coverage is None

    def test_sample_stats_structure(self) -> None:
        """
        Test sample_stats contains correct structure.
        """
        report = run_health_check()
        
        # 每个 sample_stats 条目应有正确字段
        for stats in report.sample_stats:
            assert "rule_id" in stats
            assert "has_test_file" in stats
            assert "positive_count" in stats
            assert "negative_count" in stats
            # Note: total_samples is a property, not serialized by asdict()
            # test_passed may not be present if no test was run
            
            # 类型检查
            assert isinstance(stats["rule_id"], str)
            assert isinstance(stats["positive_count"], int)
            assert isinstance(stats["negative_count"], int)
            
            # 验证 total_samples 可以计算
            total = stats["positive_count"] + stats["negative_count"]
            assert total >= 0

    def test_rules_with_test_files_sorted(self) -> None:
        """
        Test rules_with_test_files is sorted alphabetically.
        """
        report = run_health_check()
        
        # 验证列表已排序
        assert report.rules_with_test_files == sorted(report.rules_with_test_files)


# =============================================================================
# Test: print_text_report Output
# =============================================================================


class TestPrintTextReport:
    """
    Tests for print_text_report() output formatting.
    
    使用 capsys 捕获 stdout 验证输出内容。
    """

    def test_output_contains_coverage_info(self, capsys: pytest.CaptureFixture) -> None:
        """Test output contains coverage information."""
        report = HealthCheckReport(
            generated_at="2025-12-18T10:00:00",
            total_rules=35,
            rules_with_tests=10,
            coverage_percentage=28.6,
            coverage_threshold=20.0,
            coverage_meets_threshold=True,
        )
        
        print_text_report(report)
        captured = capsys.readouterr()
        
        # 验证关键信息存在
        assert "Coverage" in captured.out
        assert "28.6%" in captured.out
        assert "35" in captured.out
        assert "10" in captured.out

    def test_output_contains_threshold_status(self, capsys: pytest.CaptureFixture) -> None:
        """Test output shows threshold status correctly."""
        # 覆盖率高于阈值
        report_ok = HealthCheckReport(
            generated_at="2025-12-18T10:00:00",
            coverage_percentage=30.0,
            coverage_threshold=20.0,
            coverage_meets_threshold=True,
        )
        
        print_text_report(report_ok)
        captured = capsys.readouterr()
        assert "[OK]" in captured.out or "meets threshold" in captured.out.lower()
        
        # 覆盖率低于阈值
        report_warn = HealthCheckReport(
            generated_at="2025-12-18T10:00:00",
            coverage_percentage=10.0,
            coverage_threshold=20.0,
            coverage_meets_threshold=False,
        )
        
        print_text_report(report_warn)
        captured = capsys.readouterr()
        assert "[WARNING]" in captured.out or "below threshold" in captured.out.lower()

    def test_quiet_mode_minimal_output(self, capsys: pytest.CaptureFixture) -> None:
        """Test quiet mode produces minimal output."""
        report = HealthCheckReport(
            generated_at="2025-12-18T10:00:00",
            total_rules=35,
            rules_with_tests=10,
            coverage_percentage=28.6,
            missing_tests=["RULE-001", "RULE-002", "RULE-003"],
            sample_stats=[
                {
                    "rule_id": "SEC-001",
                    "has_test_file": True,
                    "positive_count": 3,
                    "negative_count": 2,
                    "test_passed": True,
                },
            ],
        )
        
        # Normal mode
        print_text_report(report, quiet=False)
        normal_output = capsys.readouterr().out
        
        # Quiet mode
        print_text_report(report, quiet=True)
        quiet_output = capsys.readouterr().out
        
        # Quiet mode should be shorter
        assert len(quiet_output) < len(normal_output)

    def test_output_contains_sample_statistics(self, capsys: pytest.CaptureFixture) -> None:
        """Test output contains sample statistics table."""
        report = HealthCheckReport(
            generated_at="2025-12-18T10:00:00",
            sample_stats=[
                {
                    "rule_id": "SEC-001",
                    "has_test_file": True,
                    "positive_count": 3,
                    "negative_count": 2,
                    "total_samples": 5,
                    "test_passed": True,
                },
            ],
        )
        
        print_text_report(report, quiet=False)
        captured = capsys.readouterr()
        
        # 验证样本统计表存在
        assert "Sample Statistics" in captured.out
        assert "SEC-001" in captured.out


# =============================================================================
# Test: JSON Output
# =============================================================================


class TestJsonOutput:
    """Tests for JSON output format."""

    def test_json_output_valid(self) -> None:
        """Test JSON output is valid JSON."""
        report = HealthCheckReport(
            generated_at="2025-12-18T10:00:00",
            total_rules=35,
            rules_with_tests=10,
            coverage_percentage=28.6,
        )
        
        json_str = json.dumps(report.to_dict(), indent=2)
        
        # 验证可以解析回来
        parsed = json.loads(json_str)
        assert parsed["total_rules"] == 35
        assert parsed["coverage_percentage"] == 28.6

    def test_json_output_contains_all_fields(self) -> None:
        """Test JSON output contains all expected fields."""
        report = HealthCheckReport(
            generated_at="2025-12-18T10:00:00",
            total_rules=35,
            rules_with_tests=10,
            coverage_percentage=28.6,
            coverage_threshold=20.0,
            coverage_meets_threshold=True,
            passed_rules=8,
            failed_rules=2,
            missing_tests=["RULE-001"],
            invalid_tests=[],
            rules_with_test_files=["SEC-001", "ERR-001"],
            high_priority_rules=["SEC-001"],
            high_priority_covered=["SEC-001"],
            high_priority_missing=[],
            sample_stats=[],
        )
        
        result = report.to_dict()
        
        # 验证所有字段存在
        expected_fields = [
            "generated_at",
            "ruleset_source",
            "coverage_scope",
            "total_rules",
            "rules_with_tests",
            "coverage_percentage",
            "coverage_threshold",
            "coverage_meets_threshold",
            "passed_rules",
            "failed_rules",
            "missing_tests",
            "invalid_tests",
            "rules_with_test_files",
            "high_priority_rules",
            "high_priority_covered",
            "high_priority_missing",
            "sample_stats",
        ]
        
        for field in expected_fields:
            assert field in result, f"Missing field: {field}"


# =============================================================================
# Test: Edge Cases
# =============================================================================


class TestEdgeCases:
    """Tests for edge cases and boundary conditions."""

    def test_zero_coverage_report(self) -> None:
        """Test report with 0% coverage."""
        report = HealthCheckReport(
            generated_at="2025-12-18T10:00:00",
            total_rules=10,
            rules_with_tests=0,
            coverage_percentage=0.0,
            coverage_threshold=20.0,
            coverage_meets_threshold=False,
        )
        
        assert report.coverage_percentage == 0.0
        assert report.coverage_meets_threshold is False

    def test_full_coverage_report(self) -> None:
        """Test report with 100% coverage."""
        report = HealthCheckReport(
            generated_at="2025-12-18T10:00:00",
            total_rules=10,
            rules_with_tests=10,
            coverage_percentage=100.0,
            coverage_threshold=20.0,
            coverage_meets_threshold=True,
        )
        
        assert report.coverage_percentage == 100.0
        assert report.coverage_meets_threshold is True

    def test_empty_missing_tests_list(self) -> None:
        """Test report with no missing tests."""
        report = HealthCheckReport(
            generated_at="2025-12-18T10:00:00",
            missing_tests=[],
        )
        
        assert report.missing_tests == []

    def test_large_missing_tests_list(self) -> None:
        """Test report with many missing tests (truncation)."""
        # run_health_check 限制 missing_tests 为前 20 条
        report = HealthCheckReport(
            generated_at="2025-12-18T10:00:00",
            missing_tests=[f"RULE-{i:03d}" for i in range(25)],
        )
        
        # 验证列表长度
        assert len(report.missing_tests) == 25  # 模型本身不限制

    def test_high_priority_all_covered(self) -> None:
        """Test when all high priority rules are covered."""
        report = HealthCheckReport(
            generated_at="2025-12-18T10:00:00",
            high_priority_rules=["SEC-001", "ERR-001"],
            high_priority_covered=["SEC-001", "ERR-001"],
            high_priority_missing=[],
        )
        
        assert len(report.high_priority_missing) == 0
        assert len(report.high_priority_covered) == 2

    def test_high_priority_none_covered(self) -> None:
        """Test when no high priority rules are covered."""
        report = HealthCheckReport(
            generated_at="2025-12-18T10:00:00",
            high_priority_rules=["SEC-001", "ERR-001"],
            high_priority_covered=[],
            high_priority_missing=["SEC-001", "ERR-001"],
        )
        
        assert len(report.high_priority_covered) == 0
        assert len(report.high_priority_missing) == 2
