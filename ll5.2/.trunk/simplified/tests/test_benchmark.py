"""
Performance Benchmark Tests

Validates key operations meet SLA requirements:
- Rule selection latency < 10ms
- Cache hit latency < 1ms
- E2E validation latency < 200ms

Note: No Skill declaration - benchmark code is pure performance
measurement without business logic requiring skill constraints.
"""

from __future__ import annotations

import timeit

import pytest

from ..rule_selector import RuleSelector
from ..rule_cache import TwoTierCache
from ..validator import SimplifiedValidator


# =============================================================================
# SLA Constants
# =============================================================================

SLA_RULE_SELECTION_MS = 10.0  # 规则选择 < 10ms
SLA_CACHE_HIT_MS = 1.0  # 缓存命中 < 1ms
SLA_VALIDATION_MS = 200.0  # 端到端验证 < 200ms
BENCHMARK_ITERATIONS = 100  # 基准测试迭代次数


# =============================================================================
# Benchmark Tests
# =============================================================================


class TestRuleSelectorBenchmark:
    """RuleSelector 性能基准测试"""

    @pytest.fixture
    def selector(self) -> RuleSelector:
        """创建 RuleSelector 实例"""
        return RuleSelector()

    def test_select_by_tags_latency(self, selector: RuleSelector) -> None:
        """
        规则选择延迟 < 10ms

        SLA: 单次 select_by_tags 调用应在 10ms 内完成
        """
        tags = ["security", "error-handling"]

        # 预热
        selector.select_by_tags(tags)

        # 基准测试
        total_time = timeit.timeit(
            lambda: selector.select_by_tags(tags),
            number=BENCHMARK_ITERATIONS,
        )
        avg_latency_ms = (total_time / BENCHMARK_ITERATIONS) * 1000

        print(f"\n[PASS] Rule selection latency: {avg_latency_ms:.2f}ms (SLA: <{SLA_RULE_SELECTION_MS}ms)")
        assert avg_latency_ms < SLA_RULE_SELECTION_MS, (
            f"规则选择延迟 {avg_latency_ms:.2f}ms 超过 SLA {SLA_RULE_SELECTION_MS}ms"
        )

    def test_select_by_single_tag_latency(self, selector: RuleSelector) -> None:
        """单标签选择延迟"""
        tags = ["security"]

        total_time = timeit.timeit(
            lambda: selector.select_by_tags(tags),
            number=BENCHMARK_ITERATIONS,
        )
        avg_latency_ms = (total_time / BENCHMARK_ITERATIONS) * 1000

        print(f"\n[PASS] Single tag selection latency: {avg_latency_ms:.2f}ms")
        assert avg_latency_ms < SLA_RULE_SELECTION_MS

    def test_fallback_selection_latency(self, selector: RuleSelector) -> None:
        """回退选择延迟"""
        tags: list[str] = []  # 空标签触发回退

        total_time = timeit.timeit(
            lambda: selector.select_by_tags(tags),
            number=BENCHMARK_ITERATIONS,
        )
        avg_latency_ms = (total_time / BENCHMARK_ITERATIONS) * 1000

        print(f"\n[PASS] Fallback selection latency: {avg_latency_ms:.2f}ms")
        assert avg_latency_ms < SLA_RULE_SELECTION_MS


class TestCacheBenchmark:
    """TwoTierCache 性能基准测试"""

    @pytest.fixture
    def cache(self) -> TwoTierCache:
        """创建 TwoTierCache 实例"""
        return TwoTierCache()

    def test_cache_hit_latency(self, cache: TwoTierCache) -> None:
        """
        缓存命中延迟 < 1ms

        SLA: 温缓存命中应在 1ms 内完成
        """
        # 预填充缓存
        cache.set("test_key", {"data": "value", "rules": ["SEC-001"]})

        # 基准测试
        total_time = timeit.timeit(
            lambda: cache.get("test_key"),
            number=BENCHMARK_ITERATIONS,
        )
        avg_latency_ms = (total_time / BENCHMARK_ITERATIONS) * 1000

        print(f"\n[PASS] Cache hit latency: {avg_latency_ms:.3f}ms (SLA: <{SLA_CACHE_HIT_MS}ms)")
        assert avg_latency_ms < SLA_CACHE_HIT_MS, (
            f"缓存命中延迟 {avg_latency_ms:.3f}ms 超过 SLA {SLA_CACHE_HIT_MS}ms"
        )

    def test_cache_miss_latency(self, cache: TwoTierCache) -> None:
        """缓存未命中延迟"""
        total_time = timeit.timeit(
            lambda: cache.get("nonexistent_key"),
            number=BENCHMARK_ITERATIONS,
        )
        avg_latency_ms = (total_time / BENCHMARK_ITERATIONS) * 1000

        print(f"\n[PASS] Cache miss latency: {avg_latency_ms:.3f}ms")
        # 未命中也应该很快
        assert avg_latency_ms < SLA_CACHE_HIT_MS * 2

    def test_cache_set_latency(self, cache: TwoTierCache) -> None:
        """缓存写入延迟"""
        total_time = timeit.timeit(
            lambda: cache.set(f"key_{id(object())}", {"data": "value"}),
            number=BENCHMARK_ITERATIONS,
        )
        avg_latency_ms = (total_time / BENCHMARK_ITERATIONS) * 1000

        print(f"\n[PASS] Cache write latency: {avg_latency_ms:.3f}ms")
        assert avg_latency_ms < SLA_CACHE_HIT_MS * 5  # 写入可以稍慢


class TestMemoryBenchmark:
    """Memory usage benchmark tests"""

    def test_rule_registry_memory(self) -> None:
        """Rule registry memory usage should be reasonable"""
        import tracemalloc

        tracemalloc.start()

        # Load rule registry
        from ..rule_registry import RuleRegistry
        registry = RuleRegistry()
        _ = registry.get_all_rules()

        current, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        peak_mb = peak / (1024 * 1024)
        print(f"\n[INFO] Rule registry peak memory: {peak_mb:.2f}MB")

        # SLA: < 50MB for rule registry
        assert peak_mb < 50, f"Memory usage {peak_mb:.2f}MB exceeds 50MB limit"

    def test_validator_memory_no_leak(self) -> None:
        """Validator should not leak memory across multiple validations"""
        import tracemalloc

        validator = SimplifiedValidator()
        code = "x = 1 + 2"

        # Warmup
        for _ in range(5):
            validator.validate(code, record_validation=False)

        tracemalloc.start()
        baseline = tracemalloc.get_traced_memory()[0]

        # Run multiple validations
        for _ in range(50):
            validator.validate(code, record_validation=False)

        current, _ = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        growth_kb = (current - baseline) / 1024
        print(f"\n[INFO] Memory growth after 50 validations: {growth_kb:.2f}KB")

        # SLA: < 1MB growth (allows for some caching)
        assert growth_kb < 1024, f"Memory growth {growth_kb:.2f}KB suggests leak"


class TestValidatorBenchmark:
    """SimplifiedValidator 端到端性能基准测试"""

    @pytest.fixture
    def validator(self) -> SimplifiedValidator:
        """创建 SimplifiedValidator 实例"""
        return SimplifiedValidator()

    @pytest.fixture
    def sample_code(self) -> str:
        """示例代码"""
        return '''
"""
=== SKILL COMPLIANCE DECLARATION ===
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING
===================================
"""
from pydantic import BaseModel

class User(BaseModel):
    name: str
    email: str

def process_user(user: User) -> str:
    try:
        return user.name.upper()
    except AttributeError as e:
        raise ValueError("Invalid user") from e
'''

    def test_validation_latency(
        self,
        validator: SimplifiedValidator,
        sample_code: str,
    ) -> None:
        """
        端到端验证延迟 < 200ms

        SLA: 完整验证流程应在 200ms 内完成
        """
        # 预热
        validator.validate(sample_code, record_validation=False)

        # 基准测试（减少迭代次数因为验证较慢）
        iterations = 10
        total_time = timeit.timeit(
            lambda: validator.validate(sample_code, record_validation=False),
            number=iterations,
        )
        avg_latency_ms = (total_time / iterations) * 1000

        print(f"\n[PASS] E2E validation latency: {avg_latency_ms:.2f}ms (SLA: <{SLA_VALIDATION_MS}ms)")
        assert avg_latency_ms < SLA_VALIDATION_MS, (
            f"验证延迟 {avg_latency_ms:.2f}ms 超过 SLA {SLA_VALIDATION_MS}ms"
        )

    def test_validation_without_skill_declaration(
        self,
        validator: SimplifiedValidator,
    ) -> None:
        """无Skill声明的验证延迟"""
        simple_code = "x = 1 + 2"

        iterations = 10
        total_time = timeit.timeit(
            lambda: validator.validate(simple_code, record_validation=False),
            number=iterations,
        )
        avg_latency_ms = (total_time / iterations) * 1000

        print(f"\n[PASS] Simple code validation latency: {avg_latency_ms:.2f}ms")
        assert avg_latency_ms < SLA_VALIDATION_MS


# =============================================================================
# CLI Entry Point
# =============================================================================


def run_benchmarks() -> None:
    """Run all benchmarks and output report"""
    print("=" * 60)
    print("Performance Benchmark Report")
    print("=" * 60)

    # 1. RuleSelector benchmark
    print("\n[1/3] RuleSelector Performance")
    selector = RuleSelector()
    tags = ["security", "error-handling"]

    # Warmup
    selector.select_by_tags(tags)

    total_time = timeit.timeit(
        lambda: selector.select_by_tags(tags),
        number=BENCHMARK_ITERATIONS,
    )
    avg_ms = (total_time / BENCHMARK_ITERATIONS) * 1000
    status = "PASS" if avg_ms < SLA_RULE_SELECTION_MS else "FAIL"
    print(f"  Rule selection: {avg_ms:.2f}ms (SLA: <{SLA_RULE_SELECTION_MS}ms) [{status}]")

    # 2. Cache benchmark
    print("\n[2/3] TwoTierCache Performance")
    cache = TwoTierCache()
    cache.set("test_key", {"data": "value"})

    total_time = timeit.timeit(
        lambda: cache.get("test_key"),
        number=BENCHMARK_ITERATIONS,
    )
    avg_ms = (total_time / BENCHMARK_ITERATIONS) * 1000
    status = "PASS" if avg_ms < SLA_CACHE_HIT_MS else "FAIL"
    print(f"  Cache hit: {avg_ms:.3f}ms (SLA: <{SLA_CACHE_HIT_MS}ms) [{status}]")

    # 3. Validator benchmark
    print("\n[3/3] SimplifiedValidator Performance")
    validator = SimplifiedValidator()
    code = 'from pydantic import BaseModel\nclass User(BaseModel): pass'

    # Warmup
    validator.validate(code, record_validation=False)

    iterations = 10
    total_time = timeit.timeit(
        lambda: validator.validate(code, record_validation=False),
        number=iterations,
    )
    avg_ms = (total_time / iterations) * 1000
    status = "PASS" if avg_ms < SLA_VALIDATION_MS else "FAIL"
    print(f"  E2E validation: {avg_ms:.2f}ms (SLA: <{SLA_VALIDATION_MS}ms) [{status}]")

    print("\n" + "=" * 60)
    print("Benchmark Complete")
    print("=" * 60)


if __name__ == "__main__":
    run_benchmarks()
