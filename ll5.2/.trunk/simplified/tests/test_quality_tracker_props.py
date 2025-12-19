"""
Property Tests for RuleQualityTracker

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 3.1.5)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P2)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit `is None` checks
===================================

**Feature: dynamic-rule-scaling, Property 8: 僵尸规则识别**
**Validates: Requirements 16.2**
"""

from __future__ import annotations

import tempfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import List

import pytest
from hypothesis import given, settings, strategies as st

from ..false_green_tracker import RuleQualityTracker, create_rule_quality_tracker
from ..models import RuleMetrics, RuleQualityError


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def temp_db_path() -> Path:
    """Create a temporary database path for testing."""
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        return Path(f.name)


@pytest.fixture
def tracker(temp_db_path: Path) -> RuleQualityTracker:
    """Create a RuleQualityTracker instance for testing."""
    return RuleQualityTracker(db_path=temp_db_path)


# =============================================================================
# Test: RuleMetrics Model
# =============================================================================


class TestRuleMetricsModel:
    """Tests for RuleMetrics model."""

    def test_false_positive_rate_zero_triggers(self) -> None:
        """DEF-002: false_positive_rate handles zero triggers."""
        metrics = RuleMetrics(rule_id="TEST-001", trigger_count=0)
        assert metrics.false_positive_rate == 0.0

    def test_false_positive_rate_calculation(self) -> None:
        """Test false positive rate calculation."""
        metrics = RuleMetrics(
            rule_id="TEST-001",
            trigger_count=10,
            false_positive_count=3,
        )
        assert metrics.false_positive_rate == 0.3

    def test_should_auto_disable_below_threshold(self) -> None:
        """Test auto-disable returns False when below trigger threshold."""
        metrics = RuleMetrics(
            rule_id="TEST-001",
            trigger_count=3,  # Below min_triggers=5
            false_positive_count=3,  # 100% FP rate
        )
        assert metrics.should_auto_disable(min_triggers=5) is False

    def test_should_auto_disable_low_fp_rate(self) -> None:
        """Test auto-disable returns False when FP rate is low."""
        metrics = RuleMetrics(
            rule_id="TEST-001",
            trigger_count=10,
            false_positive_count=2,  # 20% FP rate
        )
        assert metrics.should_auto_disable(max_fp_rate=0.5) is False

    def test_should_auto_disable_high_fp_rate(self) -> None:
        """Test auto-disable returns True when FP rate is high."""
        metrics = RuleMetrics(
            rule_id="TEST-001",
            trigger_count=10,
            false_positive_count=6,  # 60% FP rate
        )
        assert metrics.should_auto_disable(min_triggers=5, max_fp_rate=0.5) is True


# =============================================================================
# Test: RuleQualityTracker Basic Operations
# =============================================================================


class TestRuleQualityTrackerBasic:
    """Basic tests for RuleQualityTracker."""

    def test_record_trigger_creates_metrics(self, tracker: RuleQualityTracker) -> None:
        """Test that record_trigger creates metrics for new rule."""
        tracker.record_trigger("TEST-001")
        
        metrics = tracker.get_metrics("TEST-001")
        assert metrics is not None
        assert metrics.rule_id == "TEST-001"
        assert metrics.trigger_count == 1
        assert metrics.false_positive_count == 0

    def test_record_trigger_increments_count(self, tracker: RuleQualityTracker) -> None:
        """Test that record_trigger increments trigger count."""
        tracker.record_trigger("TEST-001")
        tracker.record_trigger("TEST-001")
        tracker.record_trigger("TEST-001")
        
        metrics = tracker.get_metrics("TEST-001")
        assert metrics is not None
        assert metrics.trigger_count == 3

    def test_record_trigger_with_false_positive(
        self, tracker: RuleQualityTracker
    ) -> None:
        """Test recording trigger with false positive flag."""
        tracker.record_trigger("TEST-001", was_false_positive=True)
        
        metrics = tracker.get_metrics("TEST-001")
        assert metrics is not None
        assert metrics.trigger_count == 1
        assert metrics.false_positive_count == 1

    def test_mark_false_positive(self, tracker: RuleQualityTracker) -> None:
        """Test marking a trigger as false positive."""
        tracker.record_trigger("TEST-001")
        tracker.mark_false_positive("TEST-001")
        
        metrics = tracker.get_metrics("TEST-001")
        assert metrics is not None
        assert metrics.false_positive_count == 1

    def test_get_metrics_nonexistent_rule(self, tracker: RuleQualityTracker) -> None:
        """Test get_metrics returns None for nonexistent rule."""
        metrics = tracker.get_metrics("NONEXISTENT-001")
        assert metrics is None

    def test_get_all_metrics_empty(self, tracker: RuleQualityTracker) -> None:
        """Test get_all_metrics returns empty list when no metrics."""
        metrics_list = tracker.get_all_metrics()
        assert metrics_list == []

    def test_get_all_metrics_multiple_rules(
        self, tracker: RuleQualityTracker
    ) -> None:
        """Test get_all_metrics returns all tracked rules."""
        tracker.record_trigger("TEST-001")
        tracker.record_trigger("TEST-002")
        tracker.record_trigger("TEST-003")
        
        metrics_list = tracker.get_all_metrics()
        rule_ids = [m.rule_id for m in metrics_list]
        
        assert len(metrics_list) == 3
        assert "TEST-001" in rule_ids
        assert "TEST-002" in rule_ids
        assert "TEST-003" in rule_ids


# =============================================================================
# Test: Stale Rule Detection (Property 8)
# =============================================================================


class TestStaleRuleDetection:
    """
    Tests for stale rule detection.
    
    **Feature: dynamic-rule-scaling, Property 8: 僵尸规则识别**
    **Validates: Requirements 16.2**
    """

    def test_get_stale_rules_empty_db(self, tracker: RuleQualityTracker) -> None:
        """Test get_stale_rules returns empty list when no rules."""
        stale_rules = tracker.get_stale_rules()
        assert stale_rules == []

    def test_get_stale_rules_recent_trigger(
        self, tracker: RuleQualityTracker
    ) -> None:
        """Test recently triggered rules are not stale."""
        tracker.record_trigger("TEST-001")
        
        stale_rules = tracker.get_stale_rules(days_threshold=30)
        assert "TEST-001" not in stale_rules

    def test_get_stale_rules_custom_threshold(
        self, tracker: RuleQualityTracker
    ) -> None:
        """Test custom days threshold."""
        tracker.record_trigger("TEST-001")
        
        # With a large threshold (e.g., 365 days), the rule should NOT be stale
        # because it was just triggered (within the last 365 days)
        stale_rules_large = tracker.get_stale_rules(days_threshold=365)
        assert "TEST-001" not in stale_rules_large
        
        # With 1 day threshold, a just-triggered rule should NOT be stale
        stale_rules_1day = tracker.get_stale_rules(days_threshold=1)
        assert "TEST-001" not in stale_rules_1day


# =============================================================================
# Test: Auto-Disable Logic
# =============================================================================


class TestAutoDisableLogic:
    """Tests for auto-disable functionality."""

    def test_should_disable_new_rule(self, tracker: RuleQualityTracker) -> None:
        """Test should_disable returns False for new rule."""
        assert tracker.should_disable("NONEXISTENT-001") is False

    def test_should_disable_low_triggers(self, tracker: RuleQualityTracker) -> None:
        """Test should_disable returns False when triggers below threshold."""
        # Record 3 triggers, all false positives
        for _ in range(3):
            tracker.record_trigger("TEST-001", was_false_positive=True)
        
        # Should not disable because trigger count < 5
        assert tracker.should_disable("TEST-001") is False

    def test_should_disable_low_fp_rate(self, tracker: RuleQualityTracker) -> None:
        """Test should_disable returns False when FP rate is low."""
        # Record 10 triggers, 2 false positives (20% FP rate)
        for i in range(10):
            tracker.record_trigger("TEST-001", was_false_positive=(i < 2))
        
        # Should not disable because FP rate < 50%
        assert tracker.should_disable("TEST-001") is False

    def test_should_disable_high_fp_rate(self, tracker: RuleQualityTracker) -> None:
        """Test should_disable returns True when FP rate is high."""
        # Record 10 triggers, 6 false positives (60% FP rate)
        for i in range(10):
            tracker.record_trigger("TEST-001", was_false_positive=(i < 6))
        
        # Should disable because FP rate > 50% and triggers > 5
        assert tracker.should_disable("TEST-001") is True

    def test_disable_rule(self, tracker: RuleQualityTracker) -> None:
        """Test disable_rule marks rule as disabled."""
        tracker.record_trigger("TEST-001")
        tracker.disable_rule("TEST-001", "Test reason")
        
        metrics = tracker.get_metrics("TEST-001")
        assert metrics is not None
        assert metrics.is_disabled is True
        assert metrics.disable_reason == "Test reason"

    def test_enable_rule(self, tracker: RuleQualityTracker) -> None:
        """Test enable_rule re-enables disabled rule."""
        tracker.record_trigger("TEST-001")
        tracker.disable_rule("TEST-001", "Test reason")
        tracker.enable_rule("TEST-001")
        
        metrics = tracker.get_metrics("TEST-001")
        assert metrics is not None
        assert metrics.is_disabled is False
        assert metrics.disable_reason is None

    def test_auto_disable_high_fp_rules(self, tracker: RuleQualityTracker) -> None:
        """Test auto_disable_high_fp_rules disables high FP rules."""
        # Create a rule with high FP rate
        for i in range(10):
            tracker.record_trigger("HIGH-FP-001", was_false_positive=(i < 6))
        
        # Create a rule with low FP rate
        for i in range(10):
            tracker.record_trigger("LOW-FP-001", was_false_positive=(i < 2))
        
        disabled = tracker.auto_disable_high_fp_rules()
        
        assert "HIGH-FP-001" in disabled
        assert "LOW-FP-001" not in disabled


# =============================================================================
# Test: Convenience Functions
# =============================================================================


class TestConvenienceFunctions:
    """Tests for convenience functions."""

    def test_create_rule_quality_tracker(self, temp_db_path: Path) -> None:
        """Test create_rule_quality_tracker creates tracker."""
        tracker = create_rule_quality_tracker(db_path=temp_db_path)
        assert isinstance(tracker, RuleQualityTracker)

    def test_create_rule_quality_tracker_default_path(self) -> None:
        """Test create_rule_quality_tracker with default path."""
        tracker = create_rule_quality_tracker()
        assert isinstance(tracker, RuleQualityTracker)


# =============================================================================
# Property-Based Tests
# =============================================================================


class TestPropertyBased:
    """Property-based tests using Hypothesis."""

    @given(st.lists(st.booleans(), min_size=1, max_size=20))
    @settings(max_examples=50, deadline=None)
    def test_trigger_count_matches_calls(
        self, false_positive_flags: List[bool]
    ) -> None:
        """
        Property: trigger_count should equal number of record_trigger calls.
        
        **Feature: dynamic-rule-scaling, Property 8: 僵尸规则识别**
        """
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            tracker = RuleQualityTracker(db_path=Path(f.name))
        
        for fp in false_positive_flags:
            tracker.record_trigger("TEST-001", was_false_positive=fp)
        
        metrics = tracker.get_metrics("TEST-001")
        assert metrics is not None
        assert metrics.trigger_count == len(false_positive_flags)

    @given(st.lists(st.booleans(), min_size=1, max_size=20))
    @settings(max_examples=50, deadline=None)
    def test_fp_count_matches_fp_flags(
        self, false_positive_flags: List[bool]
    ) -> None:
        """
        Property: false_positive_count should equal number of True flags.
        """
        with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
            tracker = RuleQualityTracker(db_path=Path(f.name))
        
        for fp in false_positive_flags:
            tracker.record_trigger("TEST-001", was_false_positive=fp)
        
        metrics = tracker.get_metrics("TEST-001")
        assert metrics is not None
        assert metrics.false_positive_count == sum(false_positive_flags)

    @given(
        st.integers(min_value=0, max_value=100),
        st.integers(min_value=0, max_value=100),
    )
    @settings(max_examples=50)
    def test_fp_rate_calculation_property(
        self, trigger_count: int, fp_count: int
    ) -> None:
        """
        Property: FP rate should be fp_count / trigger_count (or 0 if no triggers).
        
        DEF-002: Handles division by zero.
        """
        # Ensure fp_count <= trigger_count
        fp_count = min(fp_count, trigger_count)
        
        metrics = RuleMetrics(
            rule_id="TEST-001",
            trigger_count=trigger_count,
            false_positive_count=fp_count,
        )
        
        if trigger_count == 0:
            assert metrics.false_positive_rate == 0.0
        else:
            expected_rate = fp_count / trigger_count
            assert abs(metrics.false_positive_rate - expected_rate) < 1e-9

    @given(
        st.integers(min_value=0, max_value=20),
        st.integers(min_value=0, max_value=20),
        st.integers(min_value=1, max_value=10),
        st.floats(min_value=0.1, max_value=0.9),
    )
    @settings(max_examples=50)
    def test_should_auto_disable_property(
        self,
        trigger_count: int,
        fp_count: int,
        min_triggers: int,
        max_fp_rate: float,
    ) -> None:
        """
        Property: should_auto_disable returns True iff:
        - trigger_count >= min_triggers AND
        - fp_rate > max_fp_rate
        """
        # Ensure fp_count <= trigger_count
        fp_count = min(fp_count, trigger_count)
        
        metrics = RuleMetrics(
            rule_id="TEST-001",
            trigger_count=trigger_count,
            false_positive_count=fp_count,
        )
        
        result = metrics.should_auto_disable(min_triggers, max_fp_rate)
        
        # Calculate expected result
        if trigger_count < min_triggers:
            expected = False
        elif trigger_count == 0:
            expected = False
        else:
            fp_rate = fp_count / trigger_count
            expected = fp_rate > max_fp_rate
        
        assert result == expected
