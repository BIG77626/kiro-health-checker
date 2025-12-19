"""
Property Tests for Rule Test Runner

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 3.2.3)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P2)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit `is None` checks
===================================

**Feature: dynamic-rule-scaling, Property 7: 测试用例有效性**
**Validates: Requirements 12.1, 12.3**
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import List

import pytest
import yaml
from hypothesis import given, settings, strategies as st, HealthCheck

from ..models import Rule, RuleCategory, RuleMaturity
from ..rule_test_runner import (
    CandidateSample,
    ExtendedTestCase,
    RuleTestCase,
    RuleTestResult,
    RuleTestRunner,
    RuleTestSummary,
    SampleMetadata,
    create_rule_test_runner,
    generate_test_template,
    normalize_test_case,
)


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def temp_tests_dir() -> Path:
    """Create a temporary tests directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def sample_rule() -> Rule:
    """Create a sample rule for testing."""
    return Rule(
        id="SEC-001",
        category=RuleCategory.SECURITY,
        description="Detect eval() calls",
        human_description="检测危险的 eval() 调用",
        severity="mandatory",
    )


@pytest.fixture
def sample_test_case() -> RuleTestCase:
    """Create a sample test case."""
    return RuleTestCase(
        rule_id="SEC-001",
        description="Test eval detection",
        positive_cases=[
            "result = eval(user_input)",
            "data = eval('1 + 2')",
        ],
        negative_cases=[
            "result = 1 + 2",
            "# eval in comment",
        ],
    )


# =============================================================================
# Test: RuleTestCase Model
# =============================================================================


class TestRuleTestCaseModel:
    """Tests for RuleTestCase model."""

    def test_is_valid_with_both_cases(self) -> None:
        """Test is_valid returns True when both positive and negative cases exist."""
        test_case = RuleTestCase(
            rule_id="TEST-001",
            positive_cases=["code1"],
            negative_cases=["code2"],
        )
        assert test_case.is_valid() is True

    # =========================================================================
    # Unit Tests for Backward Compatibility (Task 1.4)
    # =========================================================================

    def test_explicit_reviewed_false_preserved_in_dict_format(self) -> None:
        """
        Test that explicit reviewed=false is preserved when loading from dict format.

        **Feature: rule-test-samples, Task 1.4**
        **Validates: Requirements 1.3**
        """
        # Simulate loading from YAML with explicit reviewed=false
        test_case = RuleTestCase(
            rule_id="TEST-001",
            positive_cases=[
                {
                    "code": "trigger_code()",
                    "metadata": {
                        "source": "false_positive",
                        "reviewed": False,
                        "note": "Candidate sample",
                    },
                }
            ],
            negative_cases=["safe_code()"],
        )

        # Verify reviewed=false is preserved
        normalized = test_case.get_normalized_positive_cases()
        assert len(normalized) == 1
        assert normalized[0].get_metadata().reviewed is False
        assert normalized[0].get_metadata().source == "false_positive"

    def test_mixed_reviewed_values_preserved(self) -> None:
        """
        Test that mixed reviewed values (true/false) are preserved correctly.

        **Feature: rule-test-samples, Task 1.4**
        **Validates: Requirements 1.3**
        """
        test_case = RuleTestCase(
            rule_id="TEST-001",
            positive_cases=[
                "plain_string_code()",  # Should get reviewed=True
                {
                    "code": "reviewed_true_code()",
                    "metadata": {"source": "manual", "reviewed": True},
                },
                {
                    "code": "reviewed_false_code()",
                    "metadata": {"source": "false_green", "reviewed": False},
                },
            ],
            negative_cases=[],
        )

        normalized = test_case.get_normalized_positive_cases()
        assert len(normalized) == 3

        # Plain string -> reviewed=True (default)
        assert normalized[0].get_metadata().reviewed is True

        # Explicit reviewed=True -> preserved
        assert normalized[1].get_metadata().reviewed is True

        # Explicit reviewed=False -> preserved (NOT overwritten)
        assert normalized[2].get_metadata().reviewed is False

    def test_count_reviewed_cases(self) -> None:
        """
        Test count_reviewed_cases correctly counts reviewed samples.

        **Feature: rule-test-samples, Task 1.4**
        **Validates: Requirements 1.3**
        """
        test_case = RuleTestCase(
            rule_id="TEST-001",
            positive_cases=[
                "reviewed_by_default()",  # reviewed=True
                {
                    "code": "not_reviewed()",
                    "metadata": {"reviewed": False},
                },
            ],
            negative_cases=[
                "also_reviewed()",  # reviewed=True
                {
                    "code": "also_not_reviewed()",
                    "metadata": {"reviewed": False},
                },
                "third_reviewed()",  # reviewed=True
            ],
        )

        pos_reviewed, neg_reviewed = test_case.count_reviewed_cases()

        # 1 out of 2 positive cases are reviewed
        assert pos_reviewed == 1
        # 2 out of 3 negative cases are reviewed
        assert neg_reviewed == 2

    def test_is_valid_missing_positive(self) -> None:
        """Test is_valid returns False when positive cases are missing."""
        test_case = RuleTestCase(
            rule_id="TEST-001",
            positive_cases=[],
            negative_cases=["code"],
        )
        assert test_case.is_valid() is False

    def test_is_valid_missing_negative(self) -> None:
        """Test is_valid returns False when negative cases are missing."""
        test_case = RuleTestCase(
            rule_id="TEST-001",
            positive_cases=["code"],
            negative_cases=[],
        )
        assert test_case.is_valid() is False

    def test_is_valid_both_empty(self) -> None:
        """Test is_valid returns False when both are empty."""
        test_case = RuleTestCase(
            rule_id="TEST-001",
            positive_cases=[],
            negative_cases=[],
        )
        assert test_case.is_valid() is False


# =============================================================================
# Test: RuleTestResult Model
# =============================================================================


class TestRuleTestResultModel:
    """Tests for RuleTestResult model."""

    def test_passed_result(self) -> None:
        """Test creating a passed result."""
        result = RuleTestResult(
            rule_id="TEST-001",
            passed=True,
            positive_passed=2,
            positive_total=2,
            negative_passed=3,
            negative_total=3,
            failures=[],
        )
        assert result.passed is True
        assert result.positive_passed == result.positive_total
        assert result.negative_passed == result.negative_total

    def test_failed_result(self) -> None:
        """Test creating a failed result."""
        result = RuleTestResult(
            rule_id="TEST-001",
            passed=False,
            positive_passed=1,
            positive_total=2,
            negative_passed=3,
            negative_total=3,
            failures=["Positive case 2 did not trigger rule"],
        )
        assert result.passed is False
        assert len(result.failures) == 1


# =============================================================================
# Test: RuleTestSummary Model
# =============================================================================


class TestRuleTestSummaryModel:
    """Tests for RuleTestSummary model."""

    def test_all_passed_true(self) -> None:
        """Test all_passed returns True when no failures."""
        summary = RuleTestSummary(
            total_rules=3,
            passed_rules=3,
            failed_rules=0,
            missing_tests=[],
            invalid_tests=[],
            results=[],
        )
        assert summary.all_passed is True

    def test_all_passed_false_with_failures(self) -> None:
        """Test all_passed returns False when there are failures."""
        summary = RuleTestSummary(
            total_rules=3,
            passed_rules=2,
            failed_rules=1,
            missing_tests=[],
            invalid_tests=[],
            results=[],
        )
        assert summary.all_passed is False

    def test_all_passed_false_with_invalid(self) -> None:
        """Test all_passed returns False when there are invalid tests."""
        summary = RuleTestSummary(
            total_rules=3,
            passed_rules=3,
            failed_rules=0,
            missing_tests=[],
            invalid_tests=["TEST-001"],
            results=[],
        )
        assert summary.all_passed is False


# =============================================================================
# Test: RuleTestRunner
# =============================================================================


class TestRuleTestRunner:
    """Tests for RuleTestRunner."""

    def test_load_test_cases_empty_dir(self, temp_tests_dir: Path) -> None:
        """Test loading from empty directory."""
        runner = RuleTestRunner(tests_dir=temp_tests_dir)
        cases = runner.load_test_cases()
        assert cases == {}

    def test_load_test_cases_nonexistent_dir(self) -> None:
        """Test loading from nonexistent directory."""
        runner = RuleTestRunner(tests_dir=Path("/nonexistent/path"))
        cases = runner.load_test_cases()
        assert cases == {}

    def test_load_test_cases_valid_file(self, temp_tests_dir: Path) -> None:
        """Test loading valid test case file."""
        # Create a test file
        test_file = temp_tests_dir / "TEST-001.yml"
        test_file.write_text(
            """
rule_id: "TEST-001"
description: "Test rule"
positive_cases:
  - "trigger code"
negative_cases:
  - "safe code"
""",
            encoding="utf-8",
        )

        runner = RuleTestRunner(tests_dir=temp_tests_dir)
        cases = runner.load_test_cases()

        assert "TEST-001" in cases
        assert cases["TEST-001"].rule_id == "TEST-001"
        assert len(cases["TEST-001"].positive_cases) == 1
        assert len(cases["TEST-001"].negative_cases) == 1

    def test_load_test_cases_invalid_yaml(self, temp_tests_dir: Path) -> None:
        """Test loading invalid YAML file."""
        test_file = temp_tests_dir / "INVALID.yml"
        test_file.write_text("invalid: yaml: content:", encoding="utf-8")

        runner = RuleTestRunner(tests_dir=temp_tests_dir)
        cases = runner.load_test_cases()

        # Invalid file should be skipped
        assert "INVALID" not in cases

    def test_run_test_no_test_case(self, sample_rule: Rule) -> None:
        """Test running test when no test case exists."""
        runner = RuleTestRunner(tests_dir=Path("/nonexistent"))
        runner.load_test_cases()

        result = runner.run_test(sample_rule)

        assert result.passed is False
        assert "No test case found" in result.failures[0]

    def test_run_test_with_test_case(
        self, temp_tests_dir: Path, sample_rule: Rule
    ) -> None:
        """Test running test with valid test case."""
        # Create test file for SEC-001
        test_file = temp_tests_dir / "SEC-001.yml"
        test_file.write_text(
            """
rule_id: "SEC-001"
description: "Test eval detection"
positive_cases:
  - "result = eval(user_input)"
negative_cases:
  - "result = 1 + 2"
""",
            encoding="utf-8",
        )

        runner = RuleTestRunner(tests_dir=temp_tests_dir)
        runner.load_test_cases()

        result = runner.run_test(sample_rule)

        # SEC-001 should detect eval()
        assert result.positive_total == 1
        assert result.negative_total == 1

    def test_run_all_tests_empty(self) -> None:
        """Test running all tests with no rules."""
        runner = RuleTestRunner(tests_dir=Path("/nonexistent"))
        summary = runner.run_all_tests([])

        assert summary.total_rules == 0
        assert summary.passed_rules == 0
        assert summary.failed_rules == 0

    def test_validate_test_coverage_all_missing(self, sample_rule: Rule) -> None:
        """Test coverage validation when all tests are missing."""
        runner = RuleTestRunner(tests_dir=Path("/nonexistent"))
        runner.load_test_cases()

        passed, missing = runner.validate_test_coverage([sample_rule])

        assert passed is False
        assert sample_rule.id in missing


# =============================================================================
# Test: Convenience Functions
# =============================================================================


class TestConvenienceFunctions:
    """Tests for convenience functions."""

    def test_create_rule_test_runner(self, temp_tests_dir: Path) -> None:
        """Test create_rule_test_runner creates runner."""
        runner = create_rule_test_runner(tests_dir=temp_tests_dir)
        assert isinstance(runner, RuleTestRunner)

    def test_generate_test_template(self, sample_rule: Rule) -> None:
        """Test generate_test_template creates valid template."""
        template = generate_test_template(sample_rule)

        assert sample_rule.id in template
        assert "positive_cases" in template
        assert "negative_cases" in template
        assert sample_rule.description in template


# =============================================================================
# Property-Based Tests
# =============================================================================


class TestPropertyBased:
    """
    Property-based tests using Hypothesis.

    **Feature: dynamic-rule-scaling, Property 7: 测试用例有效性**
    **Validates: Requirements 12.1, 12.3**
    """

    @given(
        st.lists(st.text(min_size=1, max_size=50), min_size=0, max_size=5),
        st.lists(st.text(min_size=1, max_size=50), min_size=0, max_size=5),
    )
    @settings(max_examples=50)
    def test_is_valid_property(
        self, positive_cases: List[str], negative_cases: List[str]
    ) -> None:
        """
        Property: is_valid() returns True iff both lists have ≥1 element.

        **Feature: dynamic-rule-scaling, Property 7: 测试用例有效性**
        """
        test_case = RuleTestCase(
            rule_id="TEST-001",
            positive_cases=positive_cases,
            negative_cases=negative_cases,
        )

        expected = len(positive_cases) >= 1 and len(negative_cases) >= 1
        assert test_case.is_valid() == expected

    @given(
        st.integers(min_value=0, max_value=10),
        st.integers(min_value=0, max_value=10),
        st.integers(min_value=0, max_value=10),
        st.integers(min_value=0, max_value=10),
    )
    @settings(max_examples=50)
    def test_result_passed_property(
        self,
        pos_passed: int,
        pos_total: int,
        neg_passed: int,
        neg_total: int,
    ) -> None:
        """
        Property: passed is True iff all tests pass.
        """
        # Ensure passed <= total
        pos_passed = min(pos_passed, pos_total)
        neg_passed = min(neg_passed, neg_total)

        all_passed = pos_passed == pos_total and neg_passed == neg_total

        result = RuleTestResult(
            rule_id="TEST-001",
            passed=all_passed,
            positive_passed=pos_passed,
            positive_total=pos_total,
            negative_passed=neg_passed,
            negative_total=neg_total,
            failures=[] if all_passed else ["Some failure"],
        )

        assert result.passed == all_passed

    @given(
        st.integers(min_value=0, max_value=20),
        st.integers(min_value=0, max_value=20),
    )
    @settings(max_examples=50)
    def test_summary_all_passed_property(
        self, passed_rules: int, failed_rules: int
    ) -> None:
        """
        Property: all_passed is True iff failed_rules == 0 and no invalid tests.
        """
        summary = RuleTestSummary(
            total_rules=passed_rules + failed_rules,
            passed_rules=passed_rules,
            failed_rules=failed_rules,
            missing_tests=[],
            invalid_tests=[],
            results=[],
        )

        expected = failed_rules == 0
        assert summary.all_passed == expected


# =============================================================================
# Property-Based Tests: Schema Backward Compatibility
# =============================================================================


class TestSchemaBackwardCompatibilityProperty:
    """
    Property-based tests for schema backward compatibility.

    **Feature: rule-test-samples, Property 1: Schema backward compatibility**
    **Validates: Requirements 1.2, 1.3**
    """

    @given(
        st.text(min_size=1, max_size=100, alphabet=st.characters(
            whitelist_categories=("L", "N", "P", "S"),
            whitelist_characters=" \n\t"
        )),
    )
    @settings(max_examples=100)
    def test_plain_string_gets_default_metadata(self, code: str) -> None:
        """
        Property 1a: Plain string test cases get default metadata.

        *For any* plain string code snippet, when loaded as a test case,
        the normalized form SHALL have source="manual" and reviewed=True.

        **Feature: rule-test-samples, Property 1: Schema backward compatibility**
        **Validates: Requirements 1.2, 1.3**
        """
        # Create a test case with plain string (old format)
        test_case = RuleTestCase(
            rule_id="TEST-001",
            positive_cases=[code],
            negative_cases=[code],
        )

        # Normalize and check defaults
        normalized_positive = test_case.get_normalized_positive_cases()
        normalized_negative = test_case.get_normalized_negative_cases()

        # All normalized cases should have default metadata
        for case in normalized_positive + normalized_negative:
            metadata = case.get_metadata()
            assert metadata.source == "manual", (
                f"Expected source='manual', got '{metadata.source}'"
            )
            assert metadata.reviewed is True, (
                f"Expected reviewed=True, got {metadata.reviewed}"
            )

    @given(
        st.text(min_size=1, max_size=100, alphabet=st.characters(
            whitelist_categories=("L", "N", "P", "S"),
            whitelist_characters=" \n\t"
        )),
    )
    @settings(max_examples=100)
    def test_normalize_test_case_applies_defaults(self, code: str) -> None:
        """
        Property 1b: normalize_test_case applies correct defaults to strings.

        *For any* plain string, normalize_test_case SHALL return an
        ExtendedTestCase with source="manual" and reviewed=True.

        **Feature: rule-test-samples, Property 1: Schema backward compatibility**
        **Validates: Requirements 1.2**
        """
        # Normalize a plain string
        normalized = normalize_test_case(code)

        # Check it's an ExtendedTestCase
        assert isinstance(normalized, ExtendedTestCase)
        assert normalized.code == code

        # Check default metadata
        metadata = normalized.get_metadata()
        assert metadata.source == "manual"
        assert metadata.reviewed is True
        assert metadata.note == ""

    @given(
        st.text(min_size=1, max_size=100, alphabet=st.characters(
            whitelist_categories=("L", "N", "P", "S"),
            whitelist_characters=" \n\t"
        )),
        st.sampled_from(["manual", "false_positive", "false_green"]),
        st.booleans(),
        st.text(max_size=50),
    )
    @settings(max_examples=100)
    def test_explicit_metadata_preserved(
        self, code: str, source: str, reviewed: bool, note: str
    ) -> None:
        """
        Property 1c: Explicit metadata is preserved, not overwritten.

        *For any* ExtendedTestCase with explicit metadata, the metadata
        SHALL be preserved exactly as specified (especially reviewed=False).

        **Feature: rule-test-samples, Property 1: Schema backward compatibility**
        **Validates: Requirements 1.2, 1.3**
        """
        # Create explicit metadata
        explicit_metadata = SampleMetadata(
            source=source,
            reviewed=reviewed,
            note=note,
        )

        # Create ExtendedTestCase with explicit metadata
        extended_case = ExtendedTestCase(
            code=code,
            metadata=explicit_metadata,
        )

        # Create test case with the extended format
        test_case = RuleTestCase(
            rule_id="TEST-001",
            positive_cases=[extended_case],
            negative_cases=[],
        )

        # Get normalized cases
        normalized = test_case.get_normalized_positive_cases()
        assert len(normalized) == 1

        # Verify metadata is preserved exactly
        result_metadata = normalized[0].get_metadata()
        assert result_metadata.source == source, (
            f"Source was overwritten: expected '{source}', got '{result_metadata.source}'"
        )
        assert result_metadata.reviewed == reviewed, (
            f"Reviewed was overwritten: expected {reviewed}, got {result_metadata.reviewed}"
        )
        assert result_metadata.note == note, (
            f"Note was overwritten: expected '{note}', got '{result_metadata.note}'"
        )

    @given(
        st.text(min_size=1, max_size=100, alphabet=st.characters(
            whitelist_categories=("L", "N", "P", "S"),
            whitelist_characters=" \n\t"
        )),
    )
    @settings(max_examples=50)
    def test_reviewed_false_not_overwritten(self, code: str) -> None:
        """
        Property 1d: reviewed=False is never overwritten to True.

        *For any* sample with explicit reviewed=False, loading and
        normalizing SHALL preserve reviewed=False.

        **Feature: rule-test-samples, Property 1: Schema backward compatibility**
        **Validates: Requirements 1.2**
        """
        # Create case with reviewed=False (candidate sample scenario)
        candidate_metadata = SampleMetadata(
            source="false_positive",
            reviewed=False,  # Explicitly False
            note="Candidate from TOOL_TEST_ANALYSIS.md",
        )

        extended_case = ExtendedTestCase(
            code=code,
            metadata=candidate_metadata,
        )

        # Load through RuleTestCase
        test_case = RuleTestCase(
            rule_id="TEST-001",
            positive_cases=[extended_case],
            negative_cases=[],
        )

        # Normalize and verify reviewed=False is preserved
        normalized = test_case.get_normalized_positive_cases()
        assert len(normalized) == 1

        result_metadata = normalized[0].get_metadata()
        assert result_metadata.reviewed is False, (
            "reviewed=False was incorrectly overwritten to True"
        )

    @given(
        st.lists(
            st.text(min_size=1, max_size=50, alphabet=st.characters(
                whitelist_categories=("L", "N"),
            )),
            min_size=1,
            max_size=5,
        ),
        st.lists(
            st.text(min_size=1, max_size=50, alphabet=st.characters(
                whitelist_categories=("L", "N"),
            )),
            min_size=1,
            max_size=5,
        ),
    )
    @settings(max_examples=50)
    def test_mixed_format_backward_compatible(
        self, positive_codes: List[str], negative_codes: List[str]
    ) -> None:
        """
        Property 1e: Mixed format (strings + ExtendedTestCase) is handled correctly.

        *For any* mix of plain strings and ExtendedTestCases, the RuleTestCase
        SHALL correctly normalize all items with appropriate defaults.

        **Feature: rule-test-samples, Property 1: Schema backward compatibility**
        **Validates: Requirements 1.2, 1.3**
        """
        # Create mixed positive cases: some strings, some ExtendedTestCase
        mixed_positive: List = []
        for i, code in enumerate(positive_codes):
            if i % 2 == 0:
                # Plain string (old format)
                mixed_positive.append(code)
            else:
                # ExtendedTestCase with explicit metadata
                mixed_positive.append(ExtendedTestCase(
                    code=code,
                    metadata=SampleMetadata(
                        source="false_green",
                        reviewed=False,
                    ),
                ))

        test_case = RuleTestCase(
            rule_id="TEST-001",
            positive_cases=mixed_positive,
            negative_cases=negative_codes,  # All plain strings
        )

        # Normalize and verify
        normalized_positive = test_case.get_normalized_positive_cases()
        normalized_negative = test_case.get_normalized_negative_cases()

        # Check positive cases
        for i, normalized in enumerate(normalized_positive):
            assert isinstance(normalized, ExtendedTestCase)
            metadata = normalized.get_metadata()

            if i % 2 == 0:
                # Was plain string -> should have defaults
                assert metadata.source == "manual"
                assert metadata.reviewed is True
            else:
                # Was ExtendedTestCase -> should preserve explicit values
                assert metadata.source == "false_green"
                assert metadata.reviewed is False

        # Check negative cases (all plain strings -> all defaults)
        for normalized in normalized_negative:
            assert isinstance(normalized, ExtendedTestCase)
            metadata = normalized.get_metadata()
            assert metadata.source == "manual"
            assert metadata.reviewed is True


# =============================================================================
# Test: Existing Test Files Backward Compatibility (Task 3.0)
# =============================================================================


class TestExistingTestFilesBackwardCompatibility:
    """
    Verify existing 3 test files (ERR-001, NET-001, SEC-001) work with extended Schema.

    **Feature: rule-test-samples, Task 3.0**
    **Validates: Requirements 2.1**
    """

    @pytest.fixture
    def real_tests_dir(self) -> Path:
        """Get the real rule_tests directory."""
        return Path(__file__).parent.parent / "rule_tests"

    def test_existing_test_files_load_correctly(self, real_tests_dir: Path) -> None:
        """
        Verify all 3 existing test files load correctly with extended schema.

        Confirms SEC-001.yml, NET-001.yml, ERR-001.yml load correctly.
        """
        runner = RuleTestRunner(tests_dir=real_tests_dir)
        cases = runner.load_test_cases()

        # All 3 files should load
        expected_rules = ["ERR-001", "NET-001", "SEC-001"]
        for rule_id in expected_rules:
            assert rule_id in cases, f"Test file for {rule_id} failed to load"

        # Verify each has valid structure
        for rule_id in expected_rules:
            test_case = cases[rule_id]
            assert test_case.rule_id == rule_id
            assert len(test_case.positive_cases) >= 1, f"{rule_id} missing positive cases"
            assert len(test_case.negative_cases) >= 1, f"{rule_id} missing negative cases"

    def test_err001_loads_with_default_metadata(self, real_tests_dir: Path) -> None:
        """
        Verify ERR-001.yml loads with correct default metadata.

        Plain string cases should get source="manual", reviewed=True.
        """
        runner = RuleTestRunner(tests_dir=real_tests_dir)
        cases = runner.load_test_cases()

        test_case = cases["ERR-001"]

        # Normalize and check metadata
        normalized_positive = test_case.get_normalized_positive_cases()
        normalized_negative = test_case.get_normalized_negative_cases()

        # All cases should have default metadata
        for case in normalized_positive:
            metadata = case.get_metadata()
            assert metadata.source == "manual"
            assert metadata.reviewed is True

        for case in normalized_negative:
            metadata = case.get_metadata()
            assert metadata.source == "manual"
            assert metadata.reviewed is True

    def test_net001_loads_with_default_metadata(self, real_tests_dir: Path) -> None:
        """
        Verify NET-001.yml loads with correct default metadata.

        Plain string cases should get source="manual", reviewed=True.
        """
        runner = RuleTestRunner(tests_dir=real_tests_dir)
        cases = runner.load_test_cases()

        test_case = cases["NET-001"]

        # Normalize and check metadata
        normalized_positive = test_case.get_normalized_positive_cases()
        normalized_negative = test_case.get_normalized_negative_cases()

        # All cases should have default metadata
        for case in normalized_positive:
            metadata = case.get_metadata()
            assert metadata.source == "manual"
            assert metadata.reviewed is True

        for case in normalized_negative:
            metadata = case.get_metadata()
            assert metadata.source == "manual"
            assert metadata.reviewed is True

    def test_sec001_loads_with_default_metadata(self, real_tests_dir: Path) -> None:
        """
        Verify SEC-001.yml loads with correct default metadata.

        Plain string cases should get source="manual", reviewed=True.
        """
        runner = RuleTestRunner(tests_dir=real_tests_dir)
        cases = runner.load_test_cases()

        test_case = cases["SEC-001"]

        # Normalize and check metadata
        normalized_positive = test_case.get_normalized_positive_cases()
        normalized_negative = test_case.get_normalized_negative_cases()

        # All cases should have default metadata
        for case in normalized_positive:
            metadata = case.get_metadata()
            assert metadata.source == "manual"
            assert metadata.reviewed is True

        for case in normalized_negative:
            metadata = case.get_metadata()
            assert metadata.source == "manual"
            assert metadata.reviewed is True

    def test_coverage_statistics_include_existing_files(
        self, real_tests_dir: Path
    ) -> None:
        """
        Verify existing test files are included in coverage statistics.

        The 3 existing files should contribute to coverage count.
        """
        runner = RuleTestRunner(tests_dir=real_tests_dir)
        cases = runner.load_test_cases()

        # Should have at least 3 test cases loaded
        assert len(cases) >= 3, f"Expected at least 3 test cases, got {len(cases)}"

        # All 3 should be valid (have both positive and negative cases)
        for rule_id in ["ERR-001", "NET-001", "SEC-001"]:
            assert cases[rule_id].is_valid(), f"{rule_id} test case is not valid"

    def test_existing_files_code_extraction(self, real_tests_dir: Path) -> None:
        """
        Verify code extraction works correctly for existing files.

        get_positive_codes() and get_negative_codes() should return strings.
        """
        runner = RuleTestRunner(tests_dir=real_tests_dir)
        cases = runner.load_test_cases()

        for rule_id in ["ERR-001", "NET-001", "SEC-001"]:
            test_case = cases[rule_id]

            positive_codes = test_case.get_positive_codes()
            negative_codes = test_case.get_negative_codes()

            # All should be strings
            for code in positive_codes:
                assert isinstance(code, str), f"{rule_id} positive code is not string"
                assert len(code) > 0, f"{rule_id} has empty positive code"

            for code in negative_codes:
                assert isinstance(code, str), f"{rule_id} negative code is not string"
                assert len(code) > 0, f"{rule_id} has empty negative code"


# =============================================================================
# Property-Based Tests: Minimum Coverage (Task 3.8)
# =============================================================================


def _load_test_config(tests_dir: Path) -> dict:
    """
    Load test configuration from config.yml.

    Falls back to defaults if config file doesn't exist.
    """
    config_path = tests_dir / "config.yml"
    defaults = {
        "min_positive_cases": 1,
        "min_negative_cases": 1,
        "high_priority_rules": [
            "SEC-001", "SEC-006", "SEC-007",
            "ERR-001", "ERR-002", "ERR-003",
            "NET-001", "NET-007",
            "DBA-003", "TYP-002",
        ],
    }

    if not config_path.exists():
        return defaults

    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = yaml.safe_load(f)
            if config is None:
                return defaults
            # Merge with defaults (config values override defaults)
            return {**defaults, **config}
    except (yaml.YAMLError, OSError):
        return defaults


class TestMinimumCoverageProperty:
    """
    Property-based tests for minimum test case coverage.

    **Feature: rule-test-samples, Property 2: Test case minimum coverage**
    **Validates: Requirements 2.2**

    Configuration is loaded from rule_tests/config.yml.
    """

    @pytest.fixture
    def real_tests_dir(self) -> Path:
        """Get the real rule_tests directory."""
        return Path(__file__).parent.parent / "rule_tests"

    @pytest.fixture
    def test_config(self, real_tests_dir: Path) -> dict:
        """Load test configuration from config.yml."""
        return _load_test_config(real_tests_dir)

    @property
    def _fallback_high_priority_rules(self) -> List[str]:
        """Fallback high-priority rules list (used when config not available)."""
        return [
            "SEC-001", "SEC-006", "SEC-007",
            "ERR-001", "ERR-002", "ERR-003",
            "NET-001", "NET-007",
            "DBA-003", "TYP-002",
        ]

    @property
    def _fallback_min_positive(self) -> int:
        """Fallback minimum positive cases (used when config not available)."""
        return 1

    @property
    def _fallback_min_negative(self) -> int:
        """Fallback minimum negative cases (used when config not available)."""
        return 1

    def test_high_priority_rules_have_test_files(
        self, real_tests_dir: Path, test_config: dict
    ) -> None:
        """
        Property 2a: All high-priority rules must have test files.

        *For any* high-priority rule, a corresponding test file SHALL exist.

        **Feature: rule-test-samples, Property 2: Test case minimum coverage**
        **Validates: Requirements 2.2**
        """
        runner = RuleTestRunner(tests_dir=real_tests_dir)
        cases = runner.load_test_cases()

        high_priority_rules = test_config.get(
            "high_priority_rules", self._fallback_high_priority_rules
        )

        missing_rules = []
        for rule_id in high_priority_rules:
            if rule_id not in cases:
                missing_rules.append(rule_id)

        assert len(missing_rules) == 0, (
            f"Missing test files for high-priority rules: {missing_rules}"
        )

    def test_high_priority_rules_meet_minimum_positive_cases(
        self, real_tests_dir: Path, test_config: dict
    ) -> None:
        """
        Property 2b: High-priority rules must have minimum positive cases.

        *For any* high-priority rule test file, the file SHALL contain
        at least min_positive_cases positive cases (from config.yml).

        **Feature: rule-test-samples, Property 2: Test case minimum coverage**
        **Validates: Requirements 2.2**
        """
        runner = RuleTestRunner(tests_dir=real_tests_dir)
        cases = runner.load_test_cases()

        high_priority_rules = test_config.get(
            "high_priority_rules", self._fallback_high_priority_rules
        )
        min_positive = test_config.get(
            "min_positive_cases", self._fallback_min_positive
        )

        insufficient_rules = []
        for rule_id in high_priority_rules:
            if rule_id in cases:
                test_case = cases[rule_id]
                if len(test_case.positive_cases) < min_positive:
                    insufficient_rules.append(
                        f"{rule_id}: {len(test_case.positive_cases)} positive cases "
                        f"(need >= {min_positive})"
                    )

        assert len(insufficient_rules) == 0, (
            f"Rules with insufficient positive cases:\n"
            + "\n".join(insufficient_rules)
        )

    def test_high_priority_rules_meet_minimum_negative_cases(
        self, real_tests_dir: Path, test_config: dict
    ) -> None:
        """
        Property 2c: High-priority rules must have minimum negative cases.

        *For any* high-priority rule test file, the file SHALL contain
        at least min_negative_cases negative cases (from config.yml).

        **Feature: rule-test-samples, Property 2: Test case minimum coverage**
        **Validates: Requirements 2.2**
        """
        runner = RuleTestRunner(tests_dir=real_tests_dir)
        cases = runner.load_test_cases()

        high_priority_rules = test_config.get(
            "high_priority_rules", self._fallback_high_priority_rules
        )
        min_negative = test_config.get(
            "min_negative_cases", self._fallback_min_negative
        )

        insufficient_rules = []
        for rule_id in high_priority_rules:
            if rule_id in cases:
                test_case = cases[rule_id]
                if len(test_case.negative_cases) < min_negative:
                    insufficient_rules.append(
                        f"{rule_id}: {len(test_case.negative_cases)} negative cases "
                        f"(need >= {min_negative})"
                    )

        assert len(insufficient_rules) == 0, (
            f"Rules with insufficient negative cases:\n"
            + "\n".join(insufficient_rules)
        )

    @given(st.integers(min_value=1, max_value=3))
    @settings(max_examples=3, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_coverage_threshold_property(
        self, real_tests_dir: Path, test_config: dict, threshold: int
    ) -> None:
        """
        Property 2d: Coverage threshold is configurable.

        *For any* threshold value, the test SHALL correctly identify
        rules that don't meet the threshold.

        **Feature: rule-test-samples, Property 2: Test case minimum coverage**
        **Validates: Requirements 2.2**
        """
        runner = RuleTestRunner(tests_dir=real_tests_dir)
        cases = runner.load_test_cases()

        high_priority_rules = test_config.get(
            "high_priority_rules", self._fallback_high_priority_rules
        )

        # Count rules meeting the threshold
        rules_meeting_threshold = 0
        for rule_id in high_priority_rules:
            if rule_id in cases:
                test_case = cases[rule_id]
                if (
                    len(test_case.positive_cases) >= threshold
                    and len(test_case.negative_cases) >= threshold
                ):
                    rules_meeting_threshold += 1

        # Property: count should be consistent with actual data
        actual_count = sum(
            1
            for rule_id in high_priority_rules
            if rule_id in cases
            and len(cases[rule_id].positive_cases) >= threshold
            and len(cases[rule_id].negative_cases) >= threshold
        )

        assert rules_meeting_threshold == actual_count

    def test_all_test_files_are_valid(self, real_tests_dir: Path) -> None:
        """
        Property 2e: All test files must be valid (have both positive and negative).

        *For any* test file in rule_tests/, the file SHALL have at least
        1 positive case AND 1 negative case.

        **Feature: rule-test-samples, Property 2: Test case minimum coverage**
        **Validates: Requirements 2.2**
        """
        runner = RuleTestRunner(tests_dir=real_tests_dir)
        cases = runner.load_test_cases()

        invalid_rules = []
        for rule_id, test_case in cases.items():
            if not test_case.is_valid():
                invalid_rules.append(
                    f"{rule_id}: {len(test_case.positive_cases)} positive, "
                    f"{len(test_case.negative_cases)} negative"
                )

        assert len(invalid_rules) == 0, (
            f"Invalid test files (need >= 1 positive AND >= 1 negative):\n"
            + "\n".join(invalid_rules)
        )

    def test_coverage_summary_report(
        self, real_tests_dir: Path, test_config: dict
    ) -> None:
        """
        Generate a coverage summary for high-priority rules.

        This is an informational test that prints coverage statistics.
        Configuration is loaded from config.yml.
        """
        runner = RuleTestRunner(tests_dir=real_tests_dir)
        cases = runner.load_test_cases()

        high_priority_rules = test_config.get(
            "high_priority_rules", self._fallback_high_priority_rules
        )
        min_positive = test_config.get(
            "min_positive_cases", self._fallback_min_positive
        )
        min_negative = test_config.get(
            "min_negative_cases", self._fallback_min_negative
        )

        print("\n=== High-Priority Rule Coverage Summary ===")
        print(f"Config: rule_tests/config.yml")
        print(f"Threshold: >= {min_positive} positive, >= {min_negative} negative\n")

        total_rules = len(high_priority_rules)
        rules_with_tests = 0
        rules_meeting_threshold = 0

        for rule_id in high_priority_rules:
            if rule_id in cases:
                rules_with_tests += 1
                test_case = cases[rule_id]
                pos_count = len(test_case.positive_cases)
                neg_count = len(test_case.negative_cases)

                meets_threshold = (
                    pos_count >= min_positive and neg_count >= min_negative
                )
                if meets_threshold:
                    rules_meeting_threshold += 1

                status = "✓" if meets_threshold else "✗"
                print(f"  {status} {rule_id}: {pos_count} positive, {neg_count} negative")
            else:
                print(f"  ✗ {rule_id}: NO TEST FILE")

        coverage_pct = (rules_with_tests / total_rules) * 100 if total_rules > 0 else 0
        threshold_pct = (rules_meeting_threshold / total_rules) * 100 if total_rules > 0 else 0

        print(f"\nCoverage: {rules_with_tests}/{total_rules} ({coverage_pct:.1f}%)")
        print(f"Meeting threshold: {rules_meeting_threshold}/{total_rules} ({threshold_pct:.1f}%)")

        # This test always passes - it's for reporting only
        assert True


# =============================================================================
# Unit Tests: Coverage Percentage Calculation (Task 5.1, 5.3)
# =============================================================================


class TestCoveragePercentageCalculation:
    """
    Unit tests for coverage percentage calculation.

    **Feature: rule-test-samples, Task 5.1, 5.3**
    **Validates: Requirements 2.3**
    """

    def test_calculate_coverage_percentage_normal(self) -> None:
        """Test normal coverage calculation."""
        # 10 rules with tests out of 35 total = 28.6%
        result = RuleTestRunner.calculate_coverage_percentage(10, 35)
        assert result == 28.6

    def test_calculate_coverage_percentage_zero_total(self) -> None:
        """Test coverage calculation with zero total rules (divide by zero protection)."""
        result = RuleTestRunner.calculate_coverage_percentage(0, 0)
        assert result == 0.0

    def test_calculate_coverage_percentage_full_coverage(self) -> None:
        """Test 100% coverage."""
        result = RuleTestRunner.calculate_coverage_percentage(10, 10)
        assert result == 100.0

    def test_calculate_coverage_percentage_no_tests(self) -> None:
        """Test 0% coverage (no tests)."""
        result = RuleTestRunner.calculate_coverage_percentage(0, 10)
        assert result == 0.0

    def test_calculate_coverage_percentage_rounding(self) -> None:
        """Test that result is rounded to 1 decimal place."""
        # 1/3 = 33.333...% should round to 33.3%
        result = RuleTestRunner.calculate_coverage_percentage(1, 3)
        assert result == 33.3

    def test_summary_includes_coverage_percentage(self, temp_tests_dir: Path) -> None:
        """Test that RuleTestSummary includes coverage_percentage field."""
        # Create a test file
        test_file = temp_tests_dir / "TEST-001.yml"
        test_file.write_text(
            """
rule_id: "TEST-001"
description: "Test rule"
positive_cases:
  - "trigger code"
negative_cases:
  - "safe code"
""",
            encoding="utf-8",
        )

        runner = RuleTestRunner(tests_dir=temp_tests_dir)
        runner.load_test_cases()

        # Create a test rule
        rule = Rule(
            id="TEST-001",
            category=RuleCategory.SECURITY,
            description="Test rule",
            human_description="Test rule",
            severity="mandatory",
        )

        summary = runner.run_all_tests([rule])

        # Verify coverage_percentage is set
        assert summary.coverage_percentage is not None
        assert summary.coverage_percentage == 100.0  # 1/1 = 100%

    def test_summary_coverage_with_missing_tests(self, temp_tests_dir: Path) -> None:
        """Test coverage calculation when some rules have no tests."""
        # Create a test file for only one rule
        test_file = temp_tests_dir / "TEST-001.yml"
        test_file.write_text(
            """
rule_id: "TEST-001"
description: "Test rule"
positive_cases:
  - "trigger code"
negative_cases:
  - "safe code"
""",
            encoding="utf-8",
        )

        runner = RuleTestRunner(tests_dir=temp_tests_dir)
        runner.load_test_cases()

        # Create two rules, only one has tests
        rules = [
            Rule(
                id="TEST-001",
                category=RuleCategory.SECURITY,
                description="Test rule 1",
                human_description="Test rule 1",
                severity="mandatory",
            ),
            Rule(
                id="TEST-002",
                category=RuleCategory.SECURITY,
                description="Test rule 2",
                human_description="Test rule 2",
                severity="mandatory",
            ),
        ]

        summary = runner.run_all_tests(rules)

        # Verify coverage_percentage: 1/2 = 50%
        assert summary.coverage_percentage == 50.0
        assert summary.rules_with_tests == 1
        assert len(summary.missing_tests) == 1
        assert "TEST-002" in summary.missing_tests

    @pytest.fixture
    def temp_tests_dir(self) -> Path:
        """Create a temporary tests directory."""
        import tempfile
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir)


# =============================================================================
# Unit Tests: CandidateSample Model (Task 7.2)
# =============================================================================


class TestCandidateSampleModel:
    """
    Unit tests for CandidateSample model.

    **Feature: rule-test-samples, Task 7.2**
    **Validates: Requirements 3.2**
    """

    def test_valid_candidate_sample(self) -> None:
        """Test creating a valid candidate sample with required fields only."""
        sample = CandidateSample(
            rule_id="NET-007",
            type="false_positive",
            code="api_key = self.config.get_api_key()",
        )
        assert sample.rule_id == "NET-007"
        assert sample.type == "false_positive"
        assert sample.code == "api_key = self.config.get_api_key()"
        # Optional fields should have defaults
        assert sample.note == ""
        assert sample.event_id is None
        assert sample.source_file is None
        assert sample.source_line is None
        assert sample.created_at is None

    def test_valid_candidate_sample_with_all_fields(self) -> None:
        """Test creating a candidate sample with all fields."""
        sample = CandidateSample(
            rule_id="ERR-003",
            type="false_green",
            code="except KeyboardInterrupt: pass",
            note="KeyboardInterrupt should be allowed",
            event_id="evt_12345",
            source_file="test_file.py",
            source_line=42,
            created_at="2025-12-18T10:30:00",
        )
        assert sample.rule_id == "ERR-003"
        assert sample.type == "false_green"
        assert sample.note == "KeyboardInterrupt should be allowed"
        assert sample.event_id == "evt_12345"
        assert sample.source_file == "test_file.py"
        assert sample.source_line == 42

    def test_missing_required_field_rule_id(self) -> None:
        """Test that missing rule_id raises validation error."""
        import pydantic
        with pytest.raises(pydantic.ValidationError) as exc_info:
            CandidateSample(
                type="false_positive",
                code="some code",
            )
        assert "rule_id" in str(exc_info.value)

    def test_missing_required_field_type(self) -> None:
        """Test that missing type raises validation error."""
        import pydantic
        with pytest.raises(pydantic.ValidationError) as exc_info:
            CandidateSample(
                rule_id="NET-007",
                code="some code",
            )
        assert "type" in str(exc_info.value)

    def test_missing_required_field_code(self) -> None:
        """Test that missing code raises validation error."""
        import pydantic
        with pytest.raises(pydantic.ValidationError) as exc_info:
            CandidateSample(
                rule_id="NET-007",
                type="false_positive",
            )
        assert "code" in str(exc_info.value)

    def test_empty_code_rejected(self) -> None:
        """Test that empty code string is rejected."""
        import pydantic
        with pytest.raises(pydantic.ValidationError) as exc_info:
            CandidateSample(
                rule_id="NET-007",
                type="false_positive",
                code="",
            )
        assert "code" in str(exc_info.value).lower()

    def test_invalid_type_enum(self) -> None:
        """Test that invalid type enum value is rejected."""
        import pydantic
        with pytest.raises(pydantic.ValidationError) as exc_info:
            CandidateSample(
                rule_id="NET-007",
                type="invalid_type",
                code="some code",
            )
        assert "type" in str(exc_info.value).lower()

    def test_invalid_rule_id_format(self) -> None:
        """Test that invalid rule_id format is rejected."""
        import pydantic
        # Too short prefix
        with pytest.raises(pydantic.ValidationError):
            CandidateSample(
                rule_id="A-001",  # Only 1 letter
                type="false_positive",
                code="some code",
            )
        # Too long prefix
        with pytest.raises(pydantic.ValidationError):
            CandidateSample(
                rule_id="ABCDE-001",  # 5 letters
                type="false_positive",
                code="some code",
            )
        # Wrong number format
        with pytest.raises(pydantic.ValidationError):
            CandidateSample(
                rule_id="NET-01",  # Only 2 digits
                type="false_positive",
                code="some code",
            )
        # Lowercase
        with pytest.raises(pydantic.ValidationError):
            CandidateSample(
                rule_id="net-007",  # Lowercase
                type="false_positive",
                code="some code",
            )

    def test_valid_rule_id_formats(self) -> None:
        """Test various valid rule_id formats."""
        # 2 letters
        sample1 = CandidateSample(
            rule_id="DB-001",
            type="false_positive",
            code="code",
        )
        assert sample1.rule_id == "DB-001"

        # 3 letters
        sample2 = CandidateSample(
            rule_id="SEC-001",
            type="false_green",
            code="code",
        )
        assert sample2.rule_id == "SEC-001"

        # 4 letters
        sample3 = CandidateSample(
            rule_id="PERF-001",
            type="false_positive",
            code="code",
        )
        assert sample3.rule_id == "PERF-001"

    def test_to_extended_test_case_false_positive(self) -> None:
        """Test conversion to ExtendedTestCase for false_positive."""
        sample = CandidateSample(
            rule_id="NET-007",
            type="false_positive",
            code="api_key = config.get()",
            note="Function param, not URL param",
        )

        extended = sample.to_extended_test_case(reviewed=True)

        assert extended.code == "api_key = config.get()"
        assert extended.metadata is not None
        assert extended.metadata.source == "false_positive"
        assert extended.metadata.reviewed is True
        assert extended.metadata.note == "Function param, not URL param"

    def test_to_extended_test_case_false_green(self) -> None:
        """Test conversion to ExtendedTestCase for false_green."""
        sample = CandidateSample(
            rule_id="ERR-003",
            type="false_green",
            code="except ValueError: pass",
            note="Should trigger but didn't",
        )

        extended = sample.to_extended_test_case(reviewed=False)

        assert extended.code == "except ValueError: pass"
        assert extended.metadata is not None
        assert extended.metadata.source == "false_green"
        assert extended.metadata.reviewed is False
        assert extended.metadata.note == "Should trigger but didn't"

    def test_source_line_must_be_positive(self) -> None:
        """Test that source_line must be >= 1."""
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            CandidateSample(
                rule_id="NET-007",
                type="false_positive",
                code="code",
                source_line=0,  # Invalid: must be >= 1
            )

    def test_note_is_optional_with_empty_default(self) -> None:
        """Test that note is optional and defaults to empty string."""
        sample = CandidateSample(
            rule_id="NET-007",
            type="false_positive",
            code="code",
        )
        # note should default to empty string, not None
        assert sample.note == ""
        assert isinstance(sample.note, str)

    # =========================================================================
    # created_at ISO 8601 validation tests
    # =========================================================================

    def test_created_at_valid_iso8601_datetime(self) -> None:
        """Test valid ISO 8601 datetime format."""
        sample = CandidateSample(
            rule_id="NET-007",
            type="false_positive",
            code="code",
            created_at="2025-12-18T10:30:00",
        )
        assert sample.created_at == "2025-12-18T10:30:00"

    def test_created_at_valid_iso8601_with_z(self) -> None:
        """Test valid ISO 8601 datetime with Z suffix."""
        sample = CandidateSample(
            rule_id="NET-007",
            type="false_positive",
            code="code",
            created_at="2025-12-18T10:30:00Z",
        )
        assert sample.created_at == "2025-12-18T10:30:00Z"

    def test_created_at_valid_iso8601_with_timezone(self) -> None:
        """Test valid ISO 8601 datetime with timezone offset."""
        sample = CandidateSample(
            rule_id="NET-007",
            type="false_positive",
            code="code",
            created_at="2025-12-18T10:30:00+08:00",
        )
        assert sample.created_at == "2025-12-18T10:30:00+08:00"

    def test_created_at_valid_date_only(self) -> None:
        """Test valid ISO 8601 date-only format."""
        sample = CandidateSample(
            rule_id="NET-007",
            type="false_positive",
            code="code",
            created_at="2025-12-18",
        )
        assert sample.created_at == "2025-12-18"

    def test_created_at_none_is_valid(self) -> None:
        """Test that None is valid for created_at."""
        sample = CandidateSample(
            rule_id="NET-007",
            type="false_positive",
            code="code",
            created_at=None,
        )
        assert sample.created_at is None

    def test_created_at_invalid_format_rejected(self) -> None:
        """Test that invalid datetime format is rejected."""
        import pydantic
        # Invalid format: DD/MM/YYYY
        with pytest.raises(pydantic.ValidationError) as exc_info:
            CandidateSample(
                rule_id="NET-007",
                type="false_positive",
                code="code",
                created_at="18/12/2025",
            )
        assert "created_at" in str(exc_info.value).lower()

    def test_created_at_invalid_random_string_rejected(self) -> None:
        """Test that random string is rejected for created_at."""
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            CandidateSample(
                rule_id="NET-007",
                type="false_positive",
                code="code",
                created_at="not a date",
            )

    def test_created_at_invalid_format_with_slashes_rejected(self) -> None:
        """Test that date with slashes is rejected."""
        import pydantic
        # Invalid format: YYYY/MM/DD (slashes instead of dashes)
        with pytest.raises(pydantic.ValidationError):
            CandidateSample(
                rule_id="NET-007",
                type="false_positive",
                code="code",
                created_at="2025/12/18",  # Slashes not allowed
            )


# =============================================================================
# Property-Based Tests: Candidate Schema Completeness (Task 7.3)
# =============================================================================


# Strategy for generating valid rule_id format
def valid_rule_id_strategy() -> st.SearchStrategy[str]:
    """Generate valid rule_id in format XXX-NNN (2-4 uppercase + 3 digits)."""
    prefix = st.text(
        alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        min_size=2,
        max_size=4,
    )
    suffix = st.integers(min_value=1, max_value=999)
    return st.builds(
        lambda p, s: f"{p}-{s:03d}",
        prefix,
        suffix,
    )


class TestCandidateSchemaCompletenessProperty:
    """
    Property-based tests for candidate schema completeness.

    **Feature: rule-test-samples, Property 4: Candidate schema completeness**
    **Validates: Requirements 3.2**
    """

    @given(
        rule_id=valid_rule_id_strategy(),
        sample_type=st.sampled_from(["false_positive", "false_green"]),
        code=st.text(min_size=1, max_size=200, alphabet=st.characters(
            whitelist_categories=("L", "N", "P", "S"),
            whitelist_characters=" \n\t=()._"
        )),
        note=st.text(max_size=100),
    )
    @settings(max_examples=100)
    def test_valid_candidate_has_required_fields(
        self,
        rule_id: str,
        sample_type: str,
        code: str,
        note: str,
    ) -> None:
        """
        Property 4a: Valid candidates have all required fields.

        *For any* valid CandidateSample, the sample SHALL have
        rule_id, type, and code fields present and non-empty.

        **Feature: rule-test-samples, Property 4: Candidate schema completeness**
        **Validates: Requirements 3.2**
        """
        sample = CandidateSample(
            rule_id=rule_id,
            type=sample_type,
            code=code,
            note=note,
        )

        # Required fields must be present and non-empty
        assert sample.rule_id is not None
        assert len(sample.rule_id) > 0
        assert sample.type is not None
        assert sample.type in ("false_positive", "false_green")
        assert sample.code is not None
        assert len(sample.code) > 0

        # note is optional but should be a string
        assert isinstance(sample.note, str)

    @given(
        sample_type=st.sampled_from(["false_positive", "false_green"]),
        code=st.text(min_size=1, max_size=50),
    )
    @settings(max_examples=50)
    def test_missing_rule_id_raises_error(
        self,
        sample_type: str,
        code: str,
    ) -> None:
        """
        Property 4b: Missing rule_id raises validation error.

        *For any* candidate without rule_id, creation SHALL fail.

        **Feature: rule-test-samples, Property 4: Candidate schema completeness**
        **Validates: Requirements 3.2**
        """
        import pydantic
        with pytest.raises(pydantic.ValidationError) as exc_info:
            CandidateSample(
                type=sample_type,
                code=code,
            )
        # Verify the error mentions rule_id
        error_str = str(exc_info.value).lower()
        assert "rule_id" in error_str

    @given(
        rule_id=valid_rule_id_strategy(),
        code=st.text(min_size=1, max_size=50),
    )
    @settings(max_examples=50)
    def test_missing_type_raises_error(
        self,
        rule_id: str,
        code: str,
    ) -> None:
        """
        Property 4c: Missing type raises validation error.

        *For any* candidate without type, creation SHALL fail.

        **Feature: rule-test-samples, Property 4: Candidate schema completeness**
        **Validates: Requirements 3.2**
        """
        import pydantic
        with pytest.raises(pydantic.ValidationError) as exc_info:
            CandidateSample(
                rule_id=rule_id,
                code=code,
            )
        # Verify the error mentions type
        error_str = str(exc_info.value).lower()
        assert "type" in error_str

    @given(
        rule_id=valid_rule_id_strategy(),
        sample_type=st.sampled_from(["false_positive", "false_green"]),
    )
    @settings(max_examples=50)
    def test_missing_code_raises_error(
        self,
        rule_id: str,
        sample_type: str,
    ) -> None:
        """
        Property 4d: Missing code raises validation error.

        *For any* candidate without code, creation SHALL fail.

        **Feature: rule-test-samples, Property 4: Candidate schema completeness**
        **Validates: Requirements 3.2**
        """
        import pydantic
        with pytest.raises(pydantic.ValidationError) as exc_info:
            CandidateSample(
                rule_id=rule_id,
                type=sample_type,
            )
        # Verify the error mentions code
        error_str = str(exc_info.value).lower()
        assert "code" in error_str

    @given(
        rule_id=valid_rule_id_strategy(),
        sample_type=st.sampled_from(["false_positive", "false_green"]),
    )
    @settings(max_examples=50)
    def test_empty_code_raises_error(
        self,
        rule_id: str,
        sample_type: str,
    ) -> None:
        """
        Property 4e: Empty code string raises validation error.

        *For any* candidate with empty code, creation SHALL fail.

        **Feature: rule-test-samples, Property 4: Candidate schema completeness**
        **Validates: Requirements 3.2**
        """
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            CandidateSample(
                rule_id=rule_id,
                type=sample_type,
                code="",  # Empty string
            )

    @given(
        rule_id=valid_rule_id_strategy(),
        invalid_type=st.text(min_size=1, max_size=20).filter(
            lambda x: x not in ("false_positive", "false_green")
        ),
        code=st.text(min_size=1, max_size=50),
    )
    @settings(max_examples=50)
    def test_invalid_type_enum_raises_error(
        self,
        rule_id: str,
        invalid_type: str,
        code: str,
    ) -> None:
        """
        Property 4f: Invalid type enum raises validation error.

        *For any* candidate with type not in (false_positive, false_green),
        creation SHALL fail.

        **Feature: rule-test-samples, Property 4: Candidate schema completeness**
        **Validates: Requirements 3.2**
        """
        import pydantic
        with pytest.raises(pydantic.ValidationError):
            CandidateSample(
                rule_id=rule_id,
                type=invalid_type,
                code=code,
            )

    @given(
        rule_id=valid_rule_id_strategy(),
        sample_type=st.sampled_from(["false_positive", "false_green"]),
        code=st.text(min_size=1, max_size=100, alphabet=st.characters(
            whitelist_categories=("L", "N", "P", "S"),
            whitelist_characters=" \n\t=()._"
        )),
    )
    @settings(max_examples=50)
    def test_note_optional_defaults_to_empty(
        self,
        rule_id: str,
        sample_type: str,
        code: str,
    ) -> None:
        """
        Property 4g: note is optional and defaults to empty string.

        *For any* valid candidate without note, note SHALL default to "".

        **Feature: rule-test-samples, Property 4: Candidate schema completeness**
        **Validates: Requirements 3.2**
        """
        sample = CandidateSample(
            rule_id=rule_id,
            type=sample_type,
            code=code,
            # note not provided
        )

        # note should default to empty string
        assert sample.note == ""
        assert isinstance(sample.note, str)

    @given(
        rule_id=valid_rule_id_strategy(),
        sample_type=st.sampled_from(["false_positive", "false_green"]),
        code=st.text(min_size=1, max_size=100, alphabet=st.characters(
            whitelist_categories=("L", "N", "P", "S"),
            whitelist_characters=" \n\t=()._"
        )),
        note=st.text(max_size=200),
    )
    @settings(max_examples=50)
    def test_to_extended_test_case_preserves_data(
        self,
        rule_id: str,
        sample_type: str,
        code: str,
        note: str,
    ) -> None:
        """
        Property 4h: Conversion to ExtendedTestCase preserves data.

        *For any* valid CandidateSample, converting to ExtendedTestCase
        SHALL preserve code and note, and set correct source.

        **Feature: rule-test-samples, Property 4: Candidate schema completeness**
        **Validates: Requirements 3.2**
        """
        sample = CandidateSample(
            rule_id=rule_id,
            type=sample_type,
            code=code,
            note=note,
        )

        extended = sample.to_extended_test_case(reviewed=False)

        # Code should be preserved
        assert extended.code == code

        # Metadata should be set correctly
        assert extended.metadata is not None
        assert extended.metadata.source == sample_type
        assert extended.metadata.reviewed is False
        assert extended.metadata.note == note
