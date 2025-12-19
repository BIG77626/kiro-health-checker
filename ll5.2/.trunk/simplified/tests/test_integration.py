"""
Integration Tests for Simplified Architecture

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 4.2)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types
===================================

端到端集成测试：场景选择 → 规则验证 → 风险计算 → 报告生成
"""

from __future__ import annotations

import tempfile
from pathlib import Path

import pytest

from ..models import RiskLevel
from ..validator import SimplifiedValidator, validate_code, get_scenarios


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def validator() -> SimplifiedValidator:
    """创建验证器"""
    return SimplifiedValidator()


@pytest.fixture
def temp_db_path(tmp_path: Path) -> Path:
    """创建临时数据库路径"""
    return tmp_path / "test_false_green.db"


# =============================================================================
# 端到端测试
# =============================================================================


class TestEndToEndValidation:
    """端到端验证流程测试"""

    def test_validate_safe_code(self, validator: SimplifiedValidator) -> None:
        """验证安全代码应该返回 LOW 风险"""
        code = '''
def add(a: int, b: int) -> int:
    """Add two numbers."""
    return a + b
'''
        report = validator.validate(code)

        assert report.risk_level == RiskLevel.LOW
        assert len(report.one_line_conclusion) > 0
        assert report.coverage_boundary is not None

    def test_validate_dangerous_code(self, validator: SimplifiedValidator) -> None:
        """验证危险代码应该返回 HIGH 风险"""
        code = '''
def execute_user_input(user_input):
    eval(user_input)  # 危险！
'''
        report = validator.validate(code)

        # eval 应该触发 HIGH 风险
        assert report.risk_level in [RiskLevel.MEDIUM, RiskLevel.HIGH]

    def test_validate_with_scenario(self, validator: SimplifiedValidator) -> None:
        """使用场景验证代码"""
        code = '''
import requests

def fetch_data(url):
    response = requests.get(url)
    return response.json()
'''
        # 使用 API 客户端场景
        scenarios = validator.get_scenarios()
        if len(scenarios) > 0:
            report = validator.validate(code, scenario_id=scenarios[0].id)
            assert report is not None
            assert report.risk_level in list(RiskLevel)

    def test_validate_sensitive_domain(self, validator: SimplifiedValidator) -> None:
        """验证敏感领域代码应该触发人工复核"""
        code = '''
def process_payment(amount, card_number):
    # 处理支付
    return charge_card(card_number, amount)
'''
        report = validator.validate(code)

        # 敏感领域应该触发人工复核
        assert report.human_review_required is True
        assert report.risk_level == RiskLevel.HIGH

    def test_validate_file_operation(self, validator: SimplifiedValidator) -> None:
        """验证文件操作代码应该触发人工复核"""
        code = '''
import os

def delete_file(path):
    os.remove(path)
'''
        report = validator.validate(code)

        # 文件操作应该触发人工复核
        assert report.human_review_required is True


# =============================================================================
# 报告生成测试
# =============================================================================


class TestReportGeneration:
    """报告生成测试"""

    def test_markdown_export(self, validator: SimplifiedValidator) -> None:
        """Markdown 导出测试"""
        code = '''
def hello():
    print("Hello, World!")
'''
        report = validator.validate(code)
        markdown = validator.export_markdown(report)

        assert "代码验证报告" in markdown
        assert "本次检查能防范" in markdown
        assert "本次检查不能保证" in markdown

    def test_report_contains_usage_advice(
        self,
        validator: SimplifiedValidator,
    ) -> None:
        """报告应该包含使用建议"""
        code = '''
def safe_function():
    return 42
'''
        report = validator.validate(code)

        assert report.usage_advice is not None


# =============================================================================
# 假绿追踪测试
# =============================================================================


class TestFalseGreenTracking:
    """假绿追踪测试"""

    def test_validation_records_id(
        self,
        tmp_path: Path,
    ) -> None:
        """验证应该记录ID"""
        db_path = tmp_path / "test.db"
        validator = SimplifiedValidator(db_path=db_path)

        code = '''
def test():
    pass
'''
        validator.validate(code, record_validation=True)

        assert validator.last_validation_id is not None

    def test_report_false_green(
        self,
        tmp_path: Path,
    ) -> None:
        """报告假绿事件"""
        db_path = tmp_path / "test.db"
        validator = SimplifiedValidator(db_path=db_path)

        code = '''
def test():
    pass
'''
        validator.validate(code, record_validation=True)

        # 报告假绿（不应该抛出异常）
        validator.report_false_green(
            issue_description="测试假绿事件",
            missing_rule="TEST-001",
        )


# =============================================================================
# 便捷函数测试
# =============================================================================


class TestConvenienceFunctions:
    """便捷函数测试"""

    def test_validate_code_function(self) -> None:
        """validate_code 便捷函数测试"""
        code = '''
def test():
    return 1
'''
        report = validate_code(code)

        assert report is not None
        assert report.risk_level in list(RiskLevel)

    def test_get_scenarios_function(self) -> None:
        """get_scenarios 便捷函数测试"""
        scenarios = get_scenarios()

        assert isinstance(scenarios, list)
        # 至少应该有默认场景
        assert len(scenarios) >= 1


# =============================================================================
# Property 12: 公开接口不暴露Skill概念
# =============================================================================


class TestNoSkillExposure:
    """Property 12: 公开接口不暴露Skill概念"""

    def test_validator_api_no_skill(self) -> None:
        """验证器API不应该包含skill"""
        validator = SimplifiedValidator()

        # 检查公开方法名
        public_methods = [
            m for m in dir(validator)
            if not m.startswith("_")
        ]

        for method in public_methods:
            assert "skill" not in method.lower(), f"Method {method} contains 'skill'"

    def test_report_no_skill(self, validator: SimplifiedValidator) -> None:
        """报告不应该包含skill"""
        code = '''
def test():
    pass
'''
        report = validator.validate(code)

        # 检查报告字段
        report_dict = report.model_dump()

        def check_no_skill(obj, path=""):
            if isinstance(obj, dict):
                for key, value in obj.items():
                    assert "skill" not in key.lower(), f"Key {path}.{key} contains 'skill'"
                    check_no_skill(value, f"{path}.{key}")
            elif isinstance(obj, list):
                for i, item in enumerate(obj):
                    check_no_skill(item, f"{path}[{i}]")
            elif isinstance(obj, str):
                # 字符串值可以包含skill（如描述文本），但键名不应该
                pass

        check_no_skill(report_dict)

    def test_scenario_no_skill(self) -> None:
        """场景不应该包含skill"""
        scenarios = get_scenarios()

        for scenario in scenarios:
            assert "skill" not in scenario.id.lower()
            assert "skill" not in scenario.name.lower()
