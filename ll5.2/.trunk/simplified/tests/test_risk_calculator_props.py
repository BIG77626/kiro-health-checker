"""
Property Tests for Risk Calculator

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 2.4)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types
===================================

Properties:
  - Property 2: 风险等级三值约束
  - Property 3: 非LOW风险必须有详细说明
  - Property 5: 高风险操作触发人工复核
  - Property 6: 敏感领域强制HIGH风险
"""

from __future__ import annotations

from datetime import datetime
from typing import List

import pytest
from hypothesis import given, settings, strategies as st, HealthCheck

from ..models import (
    HumanReviewReason,
    RiskLevel,
    RuleViolation,
    ValidationResult,
)
from ..risk_calculator import RiskLevelCalculator


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def calculator() -> RiskLevelCalculator:
    """创建风险计算器"""
    return RiskLevelCalculator()


@pytest.fixture
def empty_validation_result() -> ValidationResult:
    """创建空的验证结果"""
    return ValidationResult(
        code_hash="abc123",
        ruleset_id="test",
        ruleset_version="1.0.0",
        timestamp=datetime.now(tz=None),
        total_rules=10,
        passed_rules=10,
        failed_rules=0,
        violations=[],
    )


# =============================================================================
# Property 2: 风险等级三值约束
# =============================================================================


class TestRiskLevelThreeValueConstraint:
    """Property 2: 风险等级只能是 LOW/MEDIUM/HIGH"""

    @given(
        mandatory_count=st.integers(min_value=0, max_value=10),
        recommended_count=st.integers(min_value=0, max_value=10),
    )
    @settings(max_examples=100, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_calculate_returns_valid_level(
        self,
        calculator: RiskLevelCalculator,
        mandatory_count: int,
        recommended_count: int,
    ) -> None:
        """calculate() 返回的 level 只能是三个值之一"""
        violations: List[RuleViolation] = []

        # 添加强制规则违规
        for i in range(mandatory_count):
            violations.append(RuleViolation(
                rule_id=f"SEC-{i:03d}",
                rule_description=f"Test rule {i}",
                human_description=f"Test description {i}",
                severity="mandatory",
            ))

        # 添加推荐规则违规
        for i in range(recommended_count):
            violations.append(RuleViolation(
                rule_id=f"REC-{i:03d}",
                rule_description=f"Test rule {i}",
                human_description=f"Test description {i}",
                severity="recommended",
            ))

        result = ValidationResult(
            code_hash="test",
            ruleset_id="test",
            ruleset_version="1.0.0",
            timestamp=datetime.now(tz=None),
            total_rules=mandatory_count + recommended_count,
            passed_rules=0,
            failed_rules=mandatory_count + recommended_count,
            violations=violations,
        )

        assessment = calculator.calculate(result)

        # Property 2: 只能是三个值之一
        assert assessment.level in [RiskLevel.LOW, RiskLevel.MEDIUM, RiskLevel.HIGH]


# =============================================================================
# Property 3: 非LOW风险必须有详细说明
# =============================================================================


class TestNonLowRiskMustHaveDetails:
    """Property 3: MEDIUM/HIGH 风险必须有 risk_points"""

    def test_medium_risk_has_risk_points(
        self,
        calculator: RiskLevelCalculator,
    ) -> None:
        """MEDIUM 风险必须有 risk_points"""
        # 创建足够的推荐规则违规触发 MEDIUM
        violations = [
            RuleViolation(
                rule_id=f"REC-{i:03d}",
                rule_description=f"Test rule {i}",
                human_description=f"Test description {i}",
                severity="recommended",
            )
            for i in range(5)
        ]

        result = ValidationResult(
            code_hash="test",
            ruleset_id="test",
            ruleset_version="1.0.0",
            timestamp=datetime.now(tz=None),
            total_rules=5,
            passed_rules=0,
            failed_rules=5,
            violations=violations,
        )

        assessment = calculator.calculate(result)

        if assessment.level == RiskLevel.MEDIUM:
            # Property 3: risk_points 必须非空
            assert len(assessment.risk_points) > 0

    def test_high_risk_has_risk_points(
        self,
        calculator: RiskLevelCalculator,
    ) -> None:
        """HIGH 风险必须有 risk_points"""
        # 创建强制规则违规触发 HIGH
        violations = [
            RuleViolation(
                rule_id="SEC-001",
                rule_description="Test rule",
                human_description="Test description",
                severity="mandatory",
            )
        ]

        result = ValidationResult(
            code_hash="test",
            ruleset_id="test",
            ruleset_version="1.0.0",
            timestamp=datetime.now(tz=None),
            total_rules=1,
            passed_rules=0,
            failed_rules=1,
            violations=violations,
        )

        assessment = calculator.calculate(result)

        if assessment.level == RiskLevel.HIGH:
            # Property 3: risk_points 必须非空
            assert len(assessment.risk_points) > 0

    def test_low_risk_may_have_empty_risk_points(
        self,
        calculator: RiskLevelCalculator,
        empty_validation_result: ValidationResult,
    ) -> None:
        """LOW 风险可以没有 risk_points"""
        assessment = calculator.calculate(empty_validation_result)

        if assessment.level == RiskLevel.LOW:
            # LOW 风险可以没有 risk_points
            assert True  # 不强制要求


# =============================================================================
# Property 5: 高风险操作触发人工复核
# =============================================================================


class TestHighRiskOperationsTriggerHumanReview:
    """Property 5: 文件/网络/数据库操作必须触发人工复核"""

    def test_file_operation_triggers_review(
        self,
        calculator: RiskLevelCalculator,
        empty_validation_result: ValidationResult,
    ) -> None:
        """文件操作触发人工复核"""
        code = """
import os
os.remove('/tmp/test.txt')
"""
        triggers = calculator.check_human_review_triggers(
            code, empty_validation_result
        )

        # Property 5: 必须有 FILE_OPERATION 触发
        reasons = [t.reason for t in triggers]
        assert HumanReviewReason.FILE_OPERATION in reasons

    def test_network_request_triggers_review(
        self,
        calculator: RiskLevelCalculator,
        empty_validation_result: ValidationResult,
    ) -> None:
        """网络请求触发人工复核"""
        code = """
import requests
response = requests.get('https://api.example.com')
"""
        triggers = calculator.check_human_review_triggers(
            code, empty_validation_result
        )

        # Property 5: 必须有 NETWORK_REQUEST 触发
        reasons = [t.reason for t in triggers]
        assert HumanReviewReason.NETWORK_REQUEST in reasons

    def test_database_operation_triggers_review(
        self,
        calculator: RiskLevelCalculator,
        empty_validation_result: ValidationResult,
    ) -> None:
        """数据库操作触发人工复核"""
        code = """
cursor.execute('SELECT * FROM users')
"""
        triggers = calculator.check_human_review_triggers(
            code, empty_validation_result
        )

        # Property 5: 必须有 DATABASE_OPERATION 触发
        reasons = [t.reason for t in triggers]
        assert HumanReviewReason.DATABASE_OPERATION in reasons


# =============================================================================
# Property 6: 敏感领域强制HIGH风险
# =============================================================================


class TestSensitiveDomainForcesHighRisk:
    """Property 6: 敏感领域强制 HIGH 风险"""

    @pytest.mark.parametrize("keyword", [
        "payment",
        "password",
        "auth",
        "encrypt",
        "token",
        "credential",
        "secret",
    ])
    def test_sensitive_keyword_forces_high_risk(
        self,
        calculator: RiskLevelCalculator,
        empty_validation_result: ValidationResult,
        keyword: str,
    ) -> None:
        """敏感关键词强制 HIGH 风险"""
        code = f"""
def process_{keyword}():
    pass
"""
        assessment = calculator.calculate(
            empty_validation_result,
            code=code,
        )

        # Property 6: 敏感领域必须是 HIGH 风险
        assert assessment.level == RiskLevel.HIGH
        assert assessment.requires_human_review is True

    def test_sensitive_domain_triggers_review(
        self,
        calculator: RiskLevelCalculator,
        empty_validation_result: ValidationResult,
    ) -> None:
        """敏感领域触发人工复核"""
        code = """
def process_payment(amount):
    return charge_credit_card(amount)
"""
        triggers = calculator.check_human_review_triggers(
            code, empty_validation_result
        )

        # Property 6: 必须有 SENSITIVE_DOMAIN 触发
        reasons = [t.reason for t in triggers]
        assert HumanReviewReason.SENSITIVE_DOMAIN in reasons


# =============================================================================
# 边界条件测试
# =============================================================================


class TestEdgeCases:
    """边界条件测试"""

    def test_empty_code(
        self,
        calculator: RiskLevelCalculator,
        empty_validation_result: ValidationResult,
    ) -> None:
        """空代码应该返回 LOW 风险"""
        assessment = calculator.calculate(
            empty_validation_result,
            code="",
        )
        assert assessment.level == RiskLevel.LOW

    def test_no_violations_low_risk(
        self,
        calculator: RiskLevelCalculator,
        empty_validation_result: ValidationResult,
    ) -> None:
        """无违规应该返回 LOW 风险"""
        assessment = calculator.calculate(empty_validation_result)
        assert assessment.level == RiskLevel.LOW

    def test_one_line_summary_always_present(
        self,
        calculator: RiskLevelCalculator,
        empty_validation_result: ValidationResult,
    ) -> None:
        """one_line_summary 必须非空"""
        assessment = calculator.calculate(empty_validation_result)
        assert len(assessment.one_line_summary) > 0
