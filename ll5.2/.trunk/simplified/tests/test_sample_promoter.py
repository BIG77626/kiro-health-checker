"""
Tests for RuleSamplePromoter and CLI

=== SKILL COMPLIANCE DECLARATION ===
Task: RULE-TEST-SAMPLES (Test Enhancement)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P2)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types
===================================

**Feature: rule-test-samples, Property 5: Promotion validation and metadata**
**Validates: Requirements 4.1, 4.2**

Test Categories:
1. RuleSamplePromoter Unit Tests - behavior tests for each branch
2. CLI Unit Tests - exit code and output mapping with monkeypatch
3. End-to-End Tests - full promotion workflow
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import Optional
from unittest.mock import MagicMock, patch

import pytest
import yaml

from ..promote_sample import (
    EXIT_FILE_ERROR,
    EXIT_SUCCESS,
    EXIT_SYSTEM_ERROR,
    EXIT_VALIDATION_ERROR,
    main,
    parse_args,
)
from ..rule_test_runner import (
    CandidateSample,
    RuleTestRunner,
    SampleConflictError,
    compute_sample_hash,
)
from ..sample_promoter import (
    CandidateNotFoundError,
    CandidateParseError,
    PromotionResult,
    RuleNotReadyError,
    RuleSamplePromoter,
    ValidationFailedError,
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
def temp_candidates_dir(temp_tests_dir: Path) -> Path:
    """Create a temporary candidates directory."""
    candidates = temp_tests_dir / "candidates"
    candidates.mkdir(parents=True, exist_ok=True)
    return candidates


@pytest.fixture
def sample_candidate_file(temp_candidates_dir: Path) -> Path:
    """Create a sample candidate file."""
    candidate_path = temp_candidates_dir / "NET-007_fp_20251218.yml"
    candidate_data = {
        "rule_id": "NET-007",
        "type": "false_positive",
        "code": "api_key = self.config.get_api_key()",
        "note": "Function param, not URL param",
    }
    with open(candidate_path, "w", encoding="utf-8") as f:
        yaml.safe_dump(candidate_data, f)
    return candidate_path


@pytest.fixture
def existing_test_file(temp_tests_dir: Path) -> Path:
    """Create an existing test file with some samples."""
    test_file = temp_tests_dir / "NET-007.yml"
    test_data = {
        "rule_id": "NET-007",
        "description": "Test cases for NET-007",
        "positive_cases": ["url = f'https://api.com?api_key={key}'"],
        "negative_cases": ["key = config.get('api_key')"],
    }
    with open(test_file, "w", encoding="utf-8") as f:
        yaml.safe_dump(test_data, f)
    return test_file


# =============================================================================
# RuleSamplePromoter Unit Tests
# =============================================================================


class TestRuleSamplePromoterBehavior:
    """
    Unit tests for RuleSamplePromoter behavior.

    Tests each branch: success, validation failure, conflict, new file creation.

    **Feature: rule-test-samples, Task 9.1**
    **Validates: Requirements 4.1, 4.2**
    """

    def test_read_candidate_success(
        self, temp_tests_dir: Path, sample_candidate_file: Path
    ) -> None:
        """Test reading a valid candidate file."""
        promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)
        candidate = promoter._read_candidate(sample_candidate_file)

        assert candidate.rule_id == "NET-007"
        assert candidate.type == "false_positive"
        assert "api_key" in candidate.code
        assert candidate.note == "Function param, not URL param"

    def test_read_candidate_not_found(self, temp_tests_dir: Path) -> None:
        """Test reading a non-existent candidate file raises error."""
        promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)
        fake_path = temp_tests_dir / "nonexistent.yml"

        with pytest.raises(CandidateNotFoundError) as exc_info:
            promoter._read_candidate(fake_path)

        assert "not found" in str(exc_info.value).lower()

    def test_read_candidate_invalid_yaml(
        self, temp_tests_dir: Path, temp_candidates_dir: Path
    ) -> None:
        """Test reading an invalid YAML file raises error."""
        invalid_file = temp_candidates_dir / "invalid.yml"
        invalid_file.write_text("invalid: yaml: content:", encoding="utf-8")

        promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)

        with pytest.raises(CandidateParseError) as exc_info:
            promoter._read_candidate(invalid_file)

        assert "parse" in str(exc_info.value).lower()


    def test_read_candidate_empty_file(
        self, temp_tests_dir: Path, temp_candidates_dir: Path
    ) -> None:
        """Test reading an empty YAML file raises error."""
        empty_file = temp_candidates_dir / "empty.yml"
        empty_file.write_text("", encoding="utf-8")

        promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)

        with pytest.raises(CandidateParseError) as exc_info:
            promoter._read_candidate(empty_file)

        assert "empty" in str(exc_info.value).lower()

    def test_check_conflicts_no_existing_file(self, temp_tests_dir: Path) -> None:
        """Test conflict check passes when no existing test file."""
        promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)
        code_hash = compute_sample_hash("some code")

        # Should not raise - no existing file means no conflict
        promoter._check_conflicts(code_hash, "NEW-001", is_positive=True)

    def test_check_conflicts_duplicate_positive(
        self, temp_tests_dir: Path, existing_test_file: Path
    ) -> None:
        """Test conflict check detects duplicate in positive cases."""
        promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)

        # Get hash of existing positive case
        existing_code = "url = f'https://api.com?api_key={key}'"
        code_hash = compute_sample_hash(existing_code)

        with pytest.raises(SampleConflictError) as exc_info:
            promoter._check_conflicts(code_hash, "NET-007", is_positive=True)

        assert "already exists" in str(exc_info.value).lower()
        assert "positive" in str(exc_info.value).lower()

    def test_check_conflicts_cross_conflict(
        self, temp_tests_dir: Path, existing_test_file: Path
    ) -> None:
        """Test conflict check detects cross-conflict (positive vs negative)."""
        promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)

        # Try to add existing positive case as negative
        existing_positive = "url = f'https://api.com?api_key={key}'"
        code_hash = compute_sample_hash(existing_positive)

        with pytest.raises(SampleConflictError) as exc_info:
            promoter._check_conflicts(code_hash, "NET-007", is_positive=False)

        assert "conflict" in str(exc_info.value).lower()


    def test_merge_creates_new_file(self, temp_tests_dir: Path) -> None:
        """Test merge creates new test file when none exists."""
        promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)

        candidate = CandidateSample(
            rule_id="NEW-001",
            type="false_positive",
            code="new_code()",
            note="Test note",
        )

        target_file = temp_tests_dir / "NEW-001.yml"
        assert not target_file.exists()

        promoter._merge_to_test_file(candidate, "NEW-001", is_positive=True, target_file=target_file)

        assert target_file.exists()
        with open(target_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        assert data["rule_id"] == "NEW-001"
        assert len(data["positive_cases"]) == 1
        assert data["positive_cases"][0]["code"] == "new_code()"
        assert data["positive_cases"][0]["metadata"]["reviewed"] is True

    def test_merge_appends_to_existing(
        self, temp_tests_dir: Path, existing_test_file: Path
    ) -> None:
        """Test merge appends to existing test file."""
        promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)

        candidate = CandidateSample(
            rule_id="NET-007",
            type="false_green",
            code="new_negative_case()",
            note="Added via promotion",
        )

        promoter._merge_to_test_file(
            candidate, "NET-007", is_positive=False, target_file=existing_test_file
        )

        with open(existing_test_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        # Should have original + new negative case
        assert len(data["negative_cases"]) == 2
        # New case should be last
        new_case = data["negative_cases"][-1]
        assert new_case["code"] == "new_negative_case()"
        assert new_case["metadata"]["source"] == "false_green"
        assert new_case["metadata"]["reviewed"] is True


    def test_atomic_write_creates_file(self, temp_tests_dir: Path) -> None:
        """Test atomic write creates file correctly."""
        promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)
        target_file = temp_tests_dir / "atomic_test.yml"

        data = {"key": "value", "list": [1, 2, 3]}
        promoter._atomic_write_yaml(target_file, data)

        assert target_file.exists()
        with open(target_file, "r", encoding="utf-8") as f:
            loaded = yaml.safe_load(f)

        assert loaded == data

    def test_atomic_write_overwrites_existing(self, temp_tests_dir: Path) -> None:
        """Test atomic write overwrites existing file."""
        promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)
        target_file = temp_tests_dir / "overwrite_test.yml"

        # Create initial file
        target_file.write_text("old: data", encoding="utf-8")

        # Overwrite with new data
        new_data = {"new": "data"}
        promoter._atomic_write_yaml(target_file, new_data)

        with open(target_file, "r", encoding="utf-8") as f:
            loaded = yaml.safe_load(f)

        assert loaded == new_data
        assert "old" not in loaded

    def test_delete_candidate_success(
        self, temp_tests_dir: Path, sample_candidate_file: Path
    ) -> None:
        """Test successful candidate file deletion."""
        promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)

        assert sample_candidate_file.exists()
        result = promoter._delete_candidate(sample_candidate_file)

        assert result is True
        assert not sample_candidate_file.exists()

    def test_delete_candidate_nonexistent(self, temp_tests_dir: Path) -> None:
        """Test deletion of non-existent file returns False."""
        promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)
        fake_path = temp_tests_dir / "nonexistent.yml"

        result = promoter._delete_candidate(fake_path)

        assert result is False


# =============================================================================
# CLI Unit Tests (with monkeypatch)
# =============================================================================


class TestPromoteSampleCLI:
    """
    Unit tests for promote_sample CLI.

    Uses monkeypatch to mock RuleSamplePromoter.promote() and test
    exit codes and output mapping without touching real filesystem.

    **Feature: rule-test-samples, Task 9.3**
    **Validates: Requirements 4.1**
    """

    def test_parse_args_basic(self) -> None:
        """Test basic argument parsing."""
        args = parse_args(["candidate.yml", "NET-007", "positive"])

        assert args.candidate_file == "candidate.yml"
        assert args.rule_id == "NET-007"
        assert args.sample_type == "positive"
        assert args.tests_dir is None
        assert args.verbose is False
        assert args.quiet is False

    def test_parse_args_with_options(self) -> None:
        """Test argument parsing with optional flags."""
        args = parse_args([
            "candidate.yml", "NET-007", "negative",
            "--tests-dir", "/custom/path",
            "-v",
        ])

        assert args.sample_type == "negative"
        assert args.tests_dir == "/custom/path"
        assert args.verbose is True

    def test_parse_args_invalid_sample_type(self) -> None:
        """Test that invalid sample_type is rejected."""
        with pytest.raises(SystemExit):
            parse_args(["candidate.yml", "NET-007", "invalid"])

    def test_cli_success(self, monkeypatch, capsys) -> None:
        """Test CLI returns EXIT_SUCCESS on successful promotion."""
        mock_result = PromotionResult(
            success=True,
            message="Success",
            target_file="/path/to/NET-007.yml",
            candidate_deleted=True,
        )

        mock_promoter = MagicMock()
        mock_promoter.promote.return_value = mock_result

        monkeypatch.setattr(
            "simplified.promote_sample.RuleSamplePromoter",
            lambda **kwargs: mock_promoter,
        )

        exit_code = main(["candidate.yml", "NET-007", "positive", "-q"])

        assert exit_code == EXIT_SUCCESS
        mock_promoter.promote.assert_called_once()


    def test_cli_candidate_not_found(self, monkeypatch, capsys) -> None:
        """Test CLI returns EXIT_FILE_ERROR when candidate not found."""
        mock_promoter = MagicMock()
        mock_promoter.promote.side_effect = CandidateNotFoundError("File not found")

        monkeypatch.setattr(
            "simplified.promote_sample.RuleSamplePromoter",
            lambda **kwargs: mock_promoter,
        )

        exit_code = main(["nonexistent.yml", "NET-007", "positive"])

        assert exit_code == EXIT_FILE_ERROR
        captured = capsys.readouterr()
        assert "not found" in captured.err.lower()

    def test_cli_candidate_parse_error(self, monkeypatch, capsys) -> None:
        """Test CLI returns EXIT_FILE_ERROR on parse error."""
        mock_promoter = MagicMock()
        mock_promoter.promote.side_effect = CandidateParseError("Invalid YAML")

        monkeypatch.setattr(
            "simplified.promote_sample.RuleSamplePromoter",
            lambda **kwargs: mock_promoter,
        )

        exit_code = main(["invalid.yml", "NET-007", "positive"])

        assert exit_code == EXIT_FILE_ERROR
        captured = capsys.readouterr()
        assert "parse" in captured.err.lower()

    def test_cli_validation_failed(self, monkeypatch, capsys) -> None:
        """Test CLI returns EXIT_VALIDATION_ERROR on validation failure."""
        mock_promoter = MagicMock()
        mock_promoter.promote.side_effect = ValidationFailedError(
            "Sample did not trigger rule"
        )

        monkeypatch.setattr(
            "simplified.promote_sample.RuleSamplePromoter",
            lambda **kwargs: mock_promoter,
        )

        exit_code = main(["candidate.yml", "NET-007", "positive"])

        assert exit_code == EXIT_VALIDATION_ERROR
        captured = capsys.readouterr()
        assert "validation" in captured.err.lower()

    def test_cli_rule_not_ready(self, monkeypatch, capsys) -> None:
        """Test CLI returns EXIT_VALIDATION_ERROR when rule not ready."""
        mock_promoter = MagicMock()
        mock_promoter.promote.side_effect = RuleNotReadyError(
            "Rule has no pattern"
        )

        monkeypatch.setattr(
            "simplified.promote_sample.RuleSamplePromoter",
            lambda **kwargs: mock_promoter,
        )

        exit_code = main(["candidate.yml", "NET-007", "positive"])

        assert exit_code == EXIT_VALIDATION_ERROR
        captured = capsys.readouterr()
        assert "not ready" in captured.err.lower()


    def test_cli_sample_conflict(self, monkeypatch, capsys) -> None:
        """Test CLI returns EXIT_VALIDATION_ERROR on sample conflict."""
        mock_promoter = MagicMock()
        mock_promoter.promote.side_effect = SampleConflictError(
            "Sample already exists in negative cases"
        )

        monkeypatch.setattr(
            "simplified.promote_sample.RuleSamplePromoter",
            lambda **kwargs: mock_promoter,
        )

        exit_code = main(["candidate.yml", "NET-007", "positive"])

        assert exit_code == EXIT_VALIDATION_ERROR
        captured = capsys.readouterr()
        assert "conflict" in captured.err.lower()

    def test_cli_system_error(self, monkeypatch, capsys) -> None:
        """Test CLI returns EXIT_SYSTEM_ERROR on unexpected exception."""
        mock_promoter = MagicMock()
        mock_promoter.promote.side_effect = RuntimeError("Unexpected error")

        monkeypatch.setattr(
            "simplified.promote_sample.RuleSamplePromoter",
            lambda **kwargs: mock_promoter,
        )

        exit_code = main(["candidate.yml", "NET-007", "positive"])

        assert exit_code == EXIT_SYSTEM_ERROR
        captured = capsys.readouterr()
        assert "system error" in captured.err.lower()

    def test_cli_verbose_output(self, monkeypatch, capsys) -> None:
        """Test CLI verbose flag enables detailed output."""
        mock_result = PromotionResult(
            success=True,
            message="Success",
            target_file="/path/to/NET-007.yml",
            candidate_deleted=True,
        )

        mock_promoter = MagicMock()
        mock_promoter.promote.return_value = mock_result

        monkeypatch.setattr(
            "simplified.promote_sample.RuleSamplePromoter",
            lambda **kwargs: mock_promoter,
        )

        exit_code = main(["candidate.yml", "NET-007", "positive", "-v"])

        assert exit_code == EXIT_SUCCESS
        captured = capsys.readouterr()
        assert "Promoting sample" in captured.out
        assert "successful" in captured.out.lower()


# =============================================================================
# End-to-End Tests
# =============================================================================


class TestPromotionEndToEnd:
    """
    End-to-end tests for the full promotion workflow.

    Tests the complete flow: candidates/ -> validate -> promote -> rule_tests/

    **Feature: rule-test-samples, Task 9**
    **Validates: Requirements 4.1, 4.2**
    """

    def test_e2e_promotion_creates_new_test_file(
        self, temp_tests_dir: Path, temp_candidates_dir: Path
    ) -> None:
        """
        E2E: Promote sample to a new rule (no existing test file).

        Golden path: candidate -> validation (mocked) -> new file created.
        """
        # Create candidate file
        candidate_path = temp_candidates_dir / "NEW-001_fp_test.yml"
        candidate_data = {
            "rule_id": "NEW-001",
            "type": "false_positive",
            "code": "safe_code_example()",
            "note": "E2E test sample",
        }
        with open(candidate_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(candidate_data, f)

        # Mock the validator to always pass
        with patch.object(
            RuleSamplePromoter,
            "_validate_sample",
            return_value=MagicMock(success=True, reason=""),
        ):
            promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)
            result = promoter.promote(
                candidate_file=candidate_path,
                target_rule_id="NEW-001",
                is_positive=False,  # false_positive -> negative case
            )

        # Verify result
        assert result.success is True
        assert result.candidate_deleted is True
        assert not candidate_path.exists()

        # Verify test file created
        test_file = temp_tests_dir / "NEW-001.yml"
        assert test_file.exists()

        with open(test_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        assert data["rule_id"] == "NEW-001"
        assert len(data["negative_cases"]) == 1
        assert data["negative_cases"][0]["code"] == "safe_code_example()"
        assert data["negative_cases"][0]["metadata"]["reviewed"] is True
        assert data["negative_cases"][0]["metadata"]["source"] == "false_positive"


    def test_e2e_promotion_appends_to_existing(
        self, temp_tests_dir: Path, temp_candidates_dir: Path, existing_test_file: Path
    ) -> None:
        """
        E2E: Promote sample to existing rule (appends to test file).

        Golden path: candidate -> validation (mocked) -> appended to existing.
        """
        # Create candidate file
        candidate_path = temp_candidates_dir / "NET-007_fg_test.yml"
        candidate_data = {
            "rule_id": "NET-007",
            "type": "false_green",
            "code": "url_with_secret = f'https://api.com?token={token}'",
            "note": "Should trigger but didn't",
        }
        with open(candidate_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(candidate_data, f)

        # Mock the validator to always pass
        with patch.object(
            RuleSamplePromoter,
            "_validate_sample",
            return_value=MagicMock(success=True, reason=""),
        ):
            promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)
            result = promoter.promote(
                candidate_file=candidate_path,
                target_rule_id="NET-007",
                is_positive=True,  # false_green -> positive case
            )

        # Verify result
        assert result.success is True
        assert result.candidate_deleted is True

        # Verify test file updated
        with open(existing_test_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        # Should have original + new positive case
        assert len(data["positive_cases"]) == 2
        new_case = data["positive_cases"][-1]
        assert "token" in new_case["code"]
        assert new_case["metadata"]["source"] == "false_green"

    def test_e2e_conflict_prevents_promotion(
        self, temp_tests_dir: Path, temp_candidates_dir: Path, existing_test_file: Path
    ) -> None:
        """
        E2E: Conflict detection prevents promotion.

        Failure path: candidate with duplicate code -> conflict error.
        """
        # Create candidate with same code as existing positive case
        candidate_path = temp_candidates_dir / "NET-007_dup_test.yml"
        candidate_data = {
            "rule_id": "NET-007",
            "type": "false_positive",
            "code": "url = f'https://api.com?api_key={key}'",  # Same as existing
            "note": "Duplicate sample",
        }
        with open(candidate_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(candidate_data, f)

        # Mock the validator to always pass
        with patch.object(
            RuleSamplePromoter,
            "_validate_sample",
            return_value=MagicMock(success=True, reason=""),
        ):
            promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)

            with pytest.raises(SampleConflictError) as exc_info:
                promoter.promote(
                    candidate_file=candidate_path,
                    target_rule_id="NET-007",
                    is_positive=True,
                )

        assert "already exists" in str(exc_info.value).lower()

        # Candidate file should NOT be deleted on failure
        assert candidate_path.exists()


    def test_e2e_validation_failure_prevents_promotion(
        self, temp_tests_dir: Path, temp_candidates_dir: Path
    ) -> None:
        """
        E2E: Validation failure prevents promotion.

        Failure path: sample doesn't produce expected result -> rejected.
        """
        # Create candidate file
        candidate_path = temp_candidates_dir / "TEST-001_fail.yml"
        candidate_data = {
            "rule_id": "TEST-001",
            "type": "false_positive",
            "code": "invalid_sample()",
            "note": "Should fail validation",
        }
        with open(candidate_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(candidate_data, f)

        # Mock the validator to fail
        with patch.object(
            RuleSamplePromoter,
            "_validate_sample",
            return_value=MagicMock(success=False, reason="Sample did not trigger rule"),
        ):
            promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)

            with pytest.raises(ValidationFailedError) as exc_info:
                promoter.promote(
                    candidate_file=candidate_path,
                    target_rule_id="TEST-001",
                    is_positive=True,
                )

        assert "validation failed" in str(exc_info.value).lower()

        # Candidate file should NOT be deleted on failure
        assert candidate_path.exists()

        # Test file should NOT be created
        test_file = temp_tests_dir / "TEST-001.yml"
        assert not test_file.exists()


# =============================================================================
# Property-Based Tests: Promotion Metadata (Property 5)
# =============================================================================


class TestPromotionMetadataProperty:
    """
    Property-based tests for promotion metadata.

    **Feature: rule-test-samples, Property 5: Promotion validation and metadata**
    **Validates: Requirements 4.1, 4.2**
    """

    @pytest.fixture
    def temp_tests_dir(self) -> Path:
        """Create a temporary tests directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            yield Path(tmpdir)

    def test_promoted_sample_has_reviewed_true(self, temp_tests_dir: Path) -> None:
        """
        Property 5a: Promoted samples always have metadata.reviewed=True.

        *For any* successfully promoted sample, the resulting test case
        SHALL have metadata.reviewed=True.

        **Feature: rule-test-samples, Property 5**
        **Validates: Requirements 4.1, 4.2**
        """
        # Create candidate
        candidates_dir = temp_tests_dir / "candidates"
        candidates_dir.mkdir()
        candidate_path = candidates_dir / "test.yml"

        candidate_data = {
            "rule_id": "TEST-001",
            "type": "false_positive",
            "code": "test_code()",
            "note": "Test note",
        }
        with open(candidate_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(candidate_data, f)

        # Mock validator and promote
        with patch.object(
            RuleSamplePromoter,
            "_validate_sample",
            return_value=MagicMock(success=True, reason=""),
        ):
            promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)
            promoter.promote(candidate_path, "TEST-001", is_positive=False)

        # Verify metadata.reviewed=True
        test_file = temp_tests_dir / "TEST-001.yml"
        with open(test_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        sample = data["negative_cases"][0]
        assert sample["metadata"]["reviewed"] is True


    def test_promoted_sample_preserves_source_type(self, temp_tests_dir: Path) -> None:
        """
        Property 5b: Promoted samples preserve source type.

        *For any* promoted sample, metadata.source SHALL equal the
        candidate's type (false_positive or false_green).

        **Feature: rule-test-samples, Property 5**
        **Validates: Requirements 4.1, 4.2**
        """
        candidates_dir = temp_tests_dir / "candidates"
        candidates_dir.mkdir()

        # Test both types with valid rule_id format (XXX-NNN)
        test_cases = [
            ("false_positive", "FPO-001"),
            ("false_green", "FGR-002"),
        ]
        for sample_type, rule_id in test_cases:
            candidate_path = candidates_dir / f"test_{sample_type}.yml"
            candidate_data = {
                "rule_id": rule_id,
                "type": sample_type,
                "code": f"code_for_{sample_type}()",
                "note": f"Testing {sample_type}",
            }
            with open(candidate_path, "w", encoding="utf-8") as f:
                yaml.safe_dump(candidate_data, f)

            with patch.object(
                RuleSamplePromoter,
                "_validate_sample",
                return_value=MagicMock(success=True, reason=""),
            ):
                promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)
                is_positive = sample_type == "false_green"
                promoter.promote(
                    candidate_path,
                    rule_id,
                    is_positive=is_positive,
                )

            # Verify source preserved
            test_file = temp_tests_dir / f"{rule_id}.yml"
            with open(test_file, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            cases_key = "positive_cases" if is_positive else "negative_cases"
            sample = data[cases_key][0]
            assert sample["metadata"]["source"] == sample_type

    def test_promoted_sample_preserves_note(self, temp_tests_dir: Path) -> None:
        """
        Property 5c: Promoted samples preserve note.

        *For any* promoted sample with a note, metadata.note SHALL
        equal the candidate's note.

        **Feature: rule-test-samples, Property 5**
        **Validates: Requirements 4.1, 4.2**
        """
        candidates_dir = temp_tests_dir / "candidates"
        candidates_dir.mkdir()

        test_note = "This is a detailed note about the sample"
        candidate_path = candidates_dir / "note_test.yml"
        candidate_data = {
            "rule_id": "NOTE-001",
            "type": "false_positive",
            "code": "code_with_note()",
            "note": test_note,
        }
        with open(candidate_path, "w", encoding="utf-8") as f:
            yaml.safe_dump(candidate_data, f)

        with patch.object(
            RuleSamplePromoter,
            "_validate_sample",
            return_value=MagicMock(success=True, reason=""),
        ):
            promoter = RuleSamplePromoter(tests_dir=temp_tests_dir)
            promoter.promote(candidate_path, "NOTE-001", is_positive=False)

        # Verify note preserved
        test_file = temp_tests_dir / "NOTE-001.yml"
        with open(test_file, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)

        sample = data["negative_cases"][0]
        assert sample["metadata"]["note"] == test_note
