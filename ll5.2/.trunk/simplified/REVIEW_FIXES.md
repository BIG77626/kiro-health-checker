# Code Review Fixes - Dynamic Rule Scaling

**Date**: 2025-12-17
**Reviewer**: Code Review Analysis
**Status**: Addressed Critical Issues

---

## Issues Addressed

### Phase 4: RuleFactory

#### 1. `_count_similar_events` Field Mismatch (FIXED)
**Issue**: Comparing `violation_code` with `issue_description` - semantically different fields.

**Fix**:
- Added documentation noting this is an approximation
- Added `MAX_EVENTS_TO_CHECK = 1000` limit to prevent performance issues
- Added `ORDER BY reported_at DESC LIMIT ?` to SQL query
- Added explicit `None` check for description field

#### 2. Test Case Coverage (FIXED)
**Issue**: `magic_number` and `todo_comment` templates lacked proper test cases.

**Fix**: Added comprehensive positive and negative test cases for both templates.

---

### Phase 2: TwoTierCache

#### 3. Cachetools Fallback Memory Leak (FIXED)
**Issue**: When `cachetools` is unavailable, using plain dict loses capacity constraint.

**Fix**:
- Added `_has_lru_cache` flag to track availability
- Added bounded dict logic in `_set_warm()` with FIFO eviction
- Enhanced warning message to suggest installing cachetools

---

### Phase 1: RuleSelector

#### 4. Sorting After Explicit Rule Addition (FIXED)
**Issue**: `_add_explicit_rules` didn't re-sort, potentially breaking mandatory priority.

**Fix**: Added re-sorting after adding explicit rules with `(severity, id)` key.

---

## Known Limitations (Documented, Not Fixed)

### Design Decisions (Acceptable for Single-User Scenario)

1. **OR Semantics in Tag Query**: `_query_by_tags` uses union (OR) not intersection.
   - Rationale: Single-user scenario, broader matching is acceptable
   - Mitigation: Skill declarations should be precise

2. **Fallback Returns All Mandatory**: `_fallback_selection` returns all mandatory rules.
   - Rationale: Conservative approach for safety
   - Mitigation: Upper layer filtering in validator

3. **MIN_SIMILAR_EVENTS = 3**: Without DB, always returns 1, never generates.
   - Rationale: Intentional - requires evidence before auto-generating rules
   - Mitigation: User can manually create rules

4. **Pattern Matching Similarity**: 0.7 threshold may match unrelated code.
   - Rationale: All generated rules require human review (`requires_review=True`)
   - Mitigation: Manual review before activation

---

## Test Results

```
295 passed in 14.80s
```

All tests pass after fixes.

---

## Recommendations for Future Work

1. **Add `violation_code` field to `false_green_events` table** for better similarity matching
2. **Consider intersection mode** for tag queries when precision is critical
3. **Add monitoring/alerting** for cache miss rates and cold storage errors
4. **Pressure test** with 500+ rules to validate performance assumptions
