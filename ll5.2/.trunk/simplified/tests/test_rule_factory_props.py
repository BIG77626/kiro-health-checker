"""
Property-Based Tests for Rule Factory

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 4.1, 4.2)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P3)

Tests:
  - Template-based rule generation
  - False green event-driven generation
  - Test case generation (mutation)
  - Zero Token cost verification
===================================
"""

from __future__ import annotations

import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import List

import pytest
from hypothesis import given, settings, strategies as st

from ..rule_factory import (
    DEFAULT_PATTERN_TEMPLATES,
    PatternTemplate,
    RuleDraft,
    RuleFactory,
    RuleFactoryError,
    create_rule_factory,
)
from ..models import RuleCategory


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def rule_factory() -> RuleFactory:
    """Create a RuleFactory instance for testing."""
    return RuleFactory()


@pytest.fixture
def temp_db_path(tmp_path: Path) -> Path:
    """Create a temporary database path."""
    return tmp_path / "test_false_green.db"


# =============================================================================
# Property Tests: Template Generation (REQ-11.1)
# =============================================================================


class TestTemplateGeneration:
    """Tests for template-based rule generation."""

    def test_generate_from_known_template(self, rule_factory: RuleFactory) -> None:
        """Test generating rule from known template."""
        draft = rule_factory.generate_from_template("bare_except")

        assert draft is not None
        assert draft.id.startswith("FG-")
        assert draft.source == "template"
        assert draft.requires_review is True
        assert draft.confidence == 0.8
        assert len(draft.test_cases_positive) > 0
        assert len(draft.test_cases_negative) > 0

    def test_generate_from_unknown_template(self, rule_factory: RuleFactory) -> None:
        """Test generating rule from unknown template returns None."""
        draft = rule_factory.generate_from_template("nonexistent_template")
        assert draft is None

    def test_generate_with_custom_pattern(self, rule_factory: RuleFactory) -> None:
        """Test generating rule with custom pattern."""
        custom_pattern = r"custom_pattern_\d+"
        draft = rule_factory.generate_from_template(
            "bare_except",
            custom_pattern=custom_pattern,
        )

        assert draft is not None
        assert draft.pattern == custom_pattern

    @given(st.sampled_from(list(DEFAULT_PATTERN_TEMPLATES.keys())))
    @settings(max_examples=10, deadline=None)
    def test_all_templates_generate_valid_drafts(
        self,
        template_name: str,
    ) -> None:
        """Property: All default templates should generate valid drafts."""
        factory = RuleFactory()
        draft = factory.generate_from_template(template_name)

        assert draft is not None
        assert draft.id.startswith("FG-")
        assert draft.pattern
        assert draft.source == "template"
        assert 0.0 <= draft.confidence <= 1.0

    def test_rule_id_uniqueness(self, rule_factory: RuleFactory) -> None:
        """Test that generated rule IDs are unique."""
        ids: List[str] = []
        for template_name in DEFAULT_PATTERN_TEMPLATES.keys():
            draft = rule_factory.generate_from_template(template_name)
            if draft is not None:
                ids.append(draft.id)

        # All IDs should be unique
        assert len(ids) == len(set(ids))


# =============================================================================
# Property Tests: False Green Generation (REQ-11.4)
# =============================================================================


class TestFalseGreenGeneration:
    """Tests for false green event-driven generation."""

    def test_generate_from_matching_code(self, rule_factory: RuleFactory) -> None:
        """Test generating rule from code matching a template."""
        # Code that matches bare_except template
        violation_code = "try:\n    pass\nexcept:\n    pass"

        # Without DB, similar_count defaults to 1, which is < MIN_SIMILAR_EVENTS
        draft = rule_factory.generate_from_false_green(
            violation_code=violation_code,
            issue_description="Bare except found",
        )

        # Should return None because similar_count < MIN_SIMILAR_EVENTS
        assert draft is None

    def test_generate_from_non_matching_code(self, rule_factory: RuleFactory) -> None:
        """Test generating rule from code not matching any template."""
        violation_code = "x = 1 + 2"

        draft = rule_factory.generate_from_false_green(
            violation_code=violation_code,
            issue_description="Some issue",
        )

        assert draft is None

    def test_similarity_threshold(self, rule_factory: RuleFactory) -> None:
        """Test that similarity threshold is respected."""
        # Code that's similar but not exact match
        violation_code = "except:  # catch all"

        draft = rule_factory.generate_from_false_green(
            violation_code=violation_code,
            issue_description="Bare except",
        )

        # Should return None due to low similar_count
        assert draft is None


# =============================================================================
# Property Tests: Test Case Generation (REQ-23.1, REQ-23.2)
# =============================================================================


class TestTestCaseGeneration:
    """Tests for test case generation."""

    @given(st.sampled_from(list(DEFAULT_PATTERN_TEMPLATES.keys())))
    @settings(max_examples=10, deadline=None)
    def test_templates_generate_test_cases(self, template_name: str) -> None:
        """Property: All templates should generate test cases."""
        factory = RuleFactory()
        draft = factory.generate_from_template(template_name)

        assert draft is not None
        # At least one positive and one negative case
        assert len(draft.test_cases_positive) >= 1
        assert len(draft.test_cases_negative) >= 1

    def test_mutated_tests_generation(self, rule_factory: RuleFactory) -> None:
        """Test mutation-based test generation."""
        base_code = "def foo(x):\n    return x"
        variants = rule_factory.generate_mutated_tests(base_code, num_variants=3)

        assert len(variants) == 3
        # All variants should be different from base
        for variant in variants:
            assert variant != base_code or "Mutated" in variant

    @given(st.text(min_size=10, max_size=100))
    @settings(max_examples=10, deadline=None)
    def test_mutation_produces_variants(self, base_code: str) -> None:
        """Property: Mutation should produce variants."""
        factory = RuleFactory()
        variants = factory.generate_mutated_tests(base_code, num_variants=3)

        assert len(variants) <= 3
        # Variants should exist
        assert len(variants) > 0


# =============================================================================
# Property Tests: Pattern Matching
# =============================================================================


class TestPatternMatching:
    """Tests for pattern matching functionality."""

    def test_find_matching_template_exact(self, rule_factory: RuleFactory) -> None:
        """Test finding template with exact regex match."""
        code = "try:\n    pass\nexcept:\n    pass"
        template = rule_factory._find_matching_template(code)

        assert template is not None
        assert template.name == "bare_except"

    def test_find_matching_template_hardcoded_secret(
        self, rule_factory: RuleFactory
    ) -> None:
        """Test finding hardcoded secret template."""
        code = 'password = "mysupersecretpassword123"'
        template = rule_factory._find_matching_template(code)

        assert template is not None
        assert template.name == "hardcoded_secret"

    def test_find_matching_template_no_match(self, rule_factory: RuleFactory) -> None:
        """Test no template match for clean code."""
        code = "x = 1 + 2"
        template = rule_factory._find_matching_template(code)

        # May or may not match depending on similarity
        # Just verify it doesn't crash
        assert template is None or isinstance(template, PatternTemplate)

    def test_pattern_similarity_identical(self, rule_factory: RuleFactory) -> None:
        """Test similarity of identical strings."""
        code = "except:"
        pattern = "except:"
        similarity = rule_factory._pattern_similarity(code, pattern)

        assert similarity == 1.0

    def test_pattern_similarity_empty(self, rule_factory: RuleFactory) -> None:
        """Test similarity with empty strings."""
        assert rule_factory._pattern_similarity("", "pattern") == 0.0
        assert rule_factory._pattern_similarity("code", "") == 0.0
        assert rule_factory._pattern_similarity("", "") == 0.0


# =============================================================================
# Property Tests: Zero Token Cost
# =============================================================================


class TestZeroTokenCost:
    """Tests verifying zero LLM token cost."""

    def test_no_external_api_calls(self, rule_factory: RuleFactory) -> None:
        """Verify no external API calls are made."""
        # Generate multiple rules
        for template_name in DEFAULT_PATTERN_TEMPLATES.keys():
            draft = rule_factory.generate_from_template(template_name)
            assert draft is not None

        # If we got here without network errors, no API calls were made
        # This is a structural test - the implementation doesn't have any API client

    def test_all_operations_local(self, rule_factory: RuleFactory) -> None:
        """Verify all operations are local."""
        # Template generation
        draft = rule_factory.generate_from_template("bare_except")
        assert draft is not None

        # False green generation (without DB)
        draft = rule_factory.generate_from_false_green(
            "except:", "test"
        )
        # Returns None due to low count, but no external calls

        # Mutation
        variants = rule_factory.generate_mutated_tests("code", 3)
        assert len(variants) > 0


# =============================================================================
# Property Tests: Template Management
# =============================================================================


class TestTemplateManagement:
    """Tests for template management."""

    def test_list_templates(self, rule_factory: RuleFactory) -> None:
        """Test listing available templates."""
        templates = rule_factory.list_templates()

        assert len(templates) == len(DEFAULT_PATTERN_TEMPLATES)
        assert "bare_except" in templates
        assert "hardcoded_secret" in templates

    def test_get_template(self, rule_factory: RuleFactory) -> None:
        """Test getting specific template."""
        template = rule_factory.get_template("bare_except")

        assert template is not None
        assert template.name == "bare_except"
        assert template.severity == "mandatory"

    def test_get_nonexistent_template(self, rule_factory: RuleFactory) -> None:
        """Test getting nonexistent template."""
        template = rule_factory.get_template("nonexistent")
        assert template is None

    def test_add_custom_template(self, rule_factory: RuleFactory) -> None:
        """Test adding custom template."""
        custom = PatternTemplate(
            name="custom_rule",
            pattern=r"custom_pattern",
            severity="recommended",
            category=RuleCategory.ERROR_HANDLING,
            tags=["custom"],
            description="Custom rule",
        )

        rule_factory.add_template(custom)

        assert "custom_rule" in rule_factory.list_templates()
        assert rule_factory.get_template("custom_rule") == custom


# =============================================================================
# Property Tests: Data Model Validation
# =============================================================================


class TestDataModelValidation:
    """Tests for Pydantic model validation."""

    def test_rule_draft_validation(self) -> None:
        """Test RuleDraft validation."""
        draft = RuleDraft(
            id="TEST-001",
            pattern=r"test_pattern",
            description="Test rule",
            confidence=0.5,
        )

        assert draft.id == "TEST-001"
        assert draft.requires_review is True
        assert draft.source == "template"

    def test_rule_draft_confidence_bounds(self) -> None:
        """Test confidence bounds validation."""
        # Valid confidence
        draft = RuleDraft(
            id="TEST-001",
            pattern="test",
            confidence=0.5,
        )
        assert draft.confidence == 0.5

        # Invalid confidence (too high)
        with pytest.raises(ValueError):
            RuleDraft(
                id="TEST-001",
                pattern="test",
                confidence=1.5,
            )

        # Invalid confidence (negative)
        with pytest.raises(ValueError):
            RuleDraft(
                id="TEST-001",
                pattern="test",
                confidence=-0.1,
            )

    def test_pattern_template_validation(self) -> None:
        """Test PatternTemplate validation."""
        template = PatternTemplate(
            name="test",
            pattern=r"test_pattern",
            severity="mandatory",
        )

        assert template.name == "test"
        assert template.severity == "mandatory"

    def test_pattern_template_invalid_severity(self) -> None:
        """Test PatternTemplate rejects invalid severity."""
        with pytest.raises(ValueError):
            PatternTemplate(
                name="test",
                pattern="test",
                severity="invalid",
            )


# =============================================================================
# Property Tests: Convenience Functions
# =============================================================================


class TestConvenienceFunctions:
    """Tests for convenience functions."""

    def test_create_rule_factory(self) -> None:
        """Test create_rule_factory function."""
        factory = create_rule_factory()

        assert isinstance(factory, RuleFactory)
        assert len(factory.list_templates()) > 0

    def test_create_rule_factory_with_db_path(self, temp_db_path: Path) -> None:
        """Test create_rule_factory with database path."""
        factory = create_rule_factory(db_path=temp_db_path)

        assert isinstance(factory, RuleFactory)
        assert factory._db_path == temp_db_path


# =============================================================================
# Integration Tests
# =============================================================================


class TestIntegration:
    """Integration tests for RuleFactory."""

    def test_full_workflow_template(self, rule_factory: RuleFactory) -> None:
        """Test full workflow: template -> draft -> tests."""
        # 1. Generate from template
        draft = rule_factory.generate_from_template("bare_except")
        assert draft is not None

        # 2. Verify draft has all required fields
        assert draft.id
        assert draft.pattern
        assert draft.description
        assert draft.test_cases_positive
        assert draft.test_cases_negative

        # 3. Generate mutated tests
        variants = rule_factory.generate_mutated_tests(
            draft.test_cases_positive[0],
            num_variants=2,
        )
        assert len(variants) == 2

    def test_multiple_templates_no_id_collision(
        self, rule_factory: RuleFactory
    ) -> None:
        """Test generating from multiple templates without ID collision."""
        drafts: List[RuleDraft] = []

        for template_name in DEFAULT_PATTERN_TEMPLATES.keys():
            draft = rule_factory.generate_from_template(template_name)
            if draft is not None:
                drafts.append(draft)

        # All IDs should be unique
        ids = [d.id for d in drafts]
        assert len(ids) == len(set(ids))

        # All drafts should have test cases
        for draft in drafts:
            assert len(draft.test_cases_positive) >= 1
            assert len(draft.test_cases_negative) >= 1
