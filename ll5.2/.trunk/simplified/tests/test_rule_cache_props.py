"""
Property Tests for TwoTierCache

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 2.2)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE, DATABASE-SAFETY
Level: Expert (P0)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types
===================================

Property 5: 缓存命中一致性
**Validates: Requirements 15.2, 7.5**
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict

import pytest
from hypothesis import given, settings, strategies as st

from ..rule_cache import CacheStats, TwoTierCache, create_two_tier_cache


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def temp_cache_dir(tmp_path: Path) -> Path:
    """创建临时缓存目录"""
    cache_dir = tmp_path / "cache"
    cache_dir.mkdir()
    return cache_dir


@pytest.fixture
def cache(temp_cache_dir: Path) -> TwoTierCache:
    """创建测试用的 TwoTierCache"""
    return TwoTierCache(cache_dir=temp_cache_dir)


# =============================================================================
# Property 5: 缓存命中一致性
# =============================================================================


class TestCacheHitConsistency:
    """Property 5: 缓存命中的查询，返回结果应与首次查询一致"""

    def test_get_after_set_returns_same_value(self, cache: TwoTierCache) -> None:
        """设置后获取返回相同值"""
        value = {"key": "value", "number": 42}
        cache.set("test-key", value)

        result = cache.get("test-key")

        assert result == value

    def test_multiple_gets_return_same_value(self, cache: TwoTierCache) -> None:
        """多次获取返回相同值"""
        value = {"data": "test"}
        cache.set("key1", value)

        result1 = cache.get("key1")
        result2 = cache.get("key1")
        result3 = cache.get("key1")

        assert result1 == result2 == result3 == value

    def test_get_nonexistent_returns_none(self, cache: TwoTierCache) -> None:
        """获取不存在的键返回 None"""
        result = cache.get("nonexistent-key")
        assert result is None

    def test_set_overwrites_existing(self, cache: TwoTierCache) -> None:
        """设置覆盖现有值"""
        cache.set("key", {"old": "value"})
        cache.set("key", {"new": "value"})

        result = cache.get("key")
        assert result == {"new": "value"}


# =============================================================================
# 缓存层级测试
# =============================================================================


class TestCacheTiers:
    """测试缓存层级功能"""

    def test_set_to_hot_cache(self, cache: TwoTierCache) -> None:
        """设置到热缓存"""
        cache.set("hot-key", {"data": "hot"}, tier="hot")

        result = cache.get("hot-key")
        assert result == {"data": "hot"}

        stats = cache.get_stats()
        assert stats.hot_cache_size >= 1

    def test_set_to_warm_cache(self, cache: TwoTierCache) -> None:
        """设置到温缓存"""
        cache.set("warm-key", {"data": "warm"}, tier="warm")

        result = cache.get("warm-key")
        assert result == {"data": "warm"}

    def test_set_to_cold_cache(self, cache: TwoTierCache) -> None:
        """设置到冷缓存"""
        cache.set("cold-key", {"data": "cold"}, tier="cold")

        # 冷缓存需要通过 get 加载到温缓存
        result = cache.get("cold-key")
        assert result == {"data": "cold"}

    def test_hot_cache_hit_increments_counter(self, cache: TwoTierCache) -> None:
        """热缓存命中增加计数"""
        cache.set("hot-key", {"data": "test"}, tier="hot")

        cache.get("hot-key")
        cache.get("hot-key")

        stats = cache.get_stats()
        assert stats.hot_cache_hits >= 2


# =============================================================================
# 缓存晋升测试 (REQ-22.4)
# =============================================================================


class TestCachePromotion:
    """测试缓存晋升功能"""

    def test_promotion_after_threshold_hits(self, temp_cache_dir: Path) -> None:
        """达到阈值后晋升到热缓存"""
        # 使用较低的晋升阈值便于测试
        cache = TwoTierCache(
            cache_dir=temp_cache_dir,
            promotion_threshold=2,
        )

        cache.set("promo-key", {"data": "test"}, tier="warm")

        # 第一次命中
        cache.get("promo-key")
        stats1 = cache.get_stats()
        assert stats1.hot_cache_size == 0

        # 第二次命中 - 应该晋升
        cache.get("promo-key")
        stats2 = cache.get_stats()
        assert stats2.hot_cache_size == 1
        assert stats2.promotion_count >= 1

    def test_hot_cache_size_limit(self, temp_cache_dir: Path) -> None:
        """热缓存大小限制"""
        cache = TwoTierCache(
            cache_dir=temp_cache_dir,
            hot_cache_size=2,
        )

        # 添加3个到热缓存
        cache.set("key1", {"data": 1}, tier="hot")
        cache.set("key2", {"data": 2}, tier="hot")
        cache.set("key3", {"data": 3}, tier="hot")  # 应该被放到温缓存

        stats = cache.get_stats()
        assert stats.hot_cache_size <= 2


# =============================================================================
# 缓存失效测试 (REQ-15.3)
# =============================================================================


class TestCacheInvalidation:
    """测试缓存失效功能"""

    def test_invalidate_single_key(self, cache: TwoTierCache) -> None:
        """失效单个键"""
        cache.set("key1", {"data": 1})
        cache.set("key2", {"data": 2})

        cache.invalidate("key1")

        assert cache.get("key1") is None
        assert cache.get("key2") == {"data": 2}

    def test_invalidate_all(self, cache: TwoTierCache) -> None:
        """失效所有缓存"""
        cache.set("key1", {"data": 1}, tier="hot")
        cache.set("key2", {"data": 2}, tier="warm")
        cache.set("key3", {"data": 3}, tier="cold")

        cache.invalidate_all()

        assert cache.get("key1") is None
        assert cache.get("key2") is None
        assert cache.get("key3") is None

        stats = cache.get_stats()
        assert stats.hot_cache_size == 0
        assert stats.warm_cache_size == 0

    def test_invalidate_nonexistent_key(self, cache: TwoTierCache) -> None:
        """失效不存在的键不报错"""
        cache.invalidate("nonexistent")  # 不应该抛出异常


# =============================================================================
# 统计信息测试
# =============================================================================


class TestCacheStats:
    """测试缓存统计信息"""

    def test_get_stats_returns_valid_stats(self, cache: TwoTierCache) -> None:
        """获取统计信息"""
        stats = cache.get_stats()

        assert isinstance(stats, CacheStats)
        assert stats.hot_cache_size >= 0
        assert stats.warm_cache_size >= 0
        assert stats.cold_cache_size >= 0

    def test_stats_track_misses(self, cache: TwoTierCache) -> None:
        """统计跟踪未命中"""
        cache.get("nonexistent1")
        cache.get("nonexistent2")

        stats = cache.get_stats()
        assert stats.total_misses >= 2

    def test_stats_track_hits(self, cache: TwoTierCache) -> None:
        """统计跟踪命中"""
        cache.set("key", {"data": "test"}, tier="hot")
        cache.get("key")
        cache.get("key")

        stats = cache.get_stats()
        assert stats.hot_cache_hits >= 2


# =============================================================================
# 资源管理测试
# =============================================================================


class TestResourceManagement:
    """测试资源管理"""

    def test_close_releases_resources(self, temp_cache_dir: Path) -> None:
        """关闭释放资源"""
        cache = TwoTierCache(cache_dir=temp_cache_dir)
        cache.set("key", {"data": "test"})

        cache.close()

        # 关闭后不应该崩溃
        cache.close()  # 重复关闭不报错


# =============================================================================
# 便捷函数测试
# =============================================================================


class TestConvenienceFunctions:
    """测试便捷函数"""

    def test_create_two_tier_cache(self, temp_cache_dir: Path) -> None:
        """create_two_tier_cache 便捷函数"""
        cache = create_two_tier_cache(cache_dir=temp_cache_dir)

        assert cache is not None
        cache.set("key", {"data": "test"})
        assert cache.get("key") == {"data": "test"}


# =============================================================================
# Property-Based Tests
# =============================================================================


class TestPropertyBased:
    """Property-based tests"""

    @given(st.text(min_size=1, max_size=50))
    @settings(max_examples=30)
    def test_get_set_roundtrip(self, key: str) -> None:
        """设置后获取返回相同值（往返测试）"""
        import tempfile
        tmpdir = tempfile.mkdtemp()
        try:
            cache = TwoTierCache(cache_dir=Path(tmpdir))
            value = {"key": key, "number": 42}

            cache.set(key, value)
            result = cache.get(key)

            assert result == value
            cache.close()
        finally:
            # Windows: 需要先关闭缓存再删除目录
            import shutil
            try:
                shutil.rmtree(tmpdir, ignore_errors=True)
            except Exception:
                pass

    @given(st.dictionaries(
        st.text(min_size=1, max_size=20),
        st.one_of(st.integers(), st.text(max_size=50), st.booleans()),
        min_size=1,
        max_size=5,
    ))
    @settings(max_examples=20)
    def test_cache_preserves_dict_structure(self, data: Dict[str, Any]) -> None:
        """缓存保持字典结构"""
        import tempfile
        tmpdir = tempfile.mkdtemp()
        try:
            cache = TwoTierCache(cache_dir=Path(tmpdir))

            cache.set("test-key", data)
            result = cache.get("test-key")

            assert result == data
            cache.close()
        finally:
            import shutil
            try:
                shutil.rmtree(tmpdir, ignore_errors=True)
            except Exception:
                pass

    @given(st.lists(st.text(min_size=1, max_size=20), min_size=1, max_size=10, unique=True))
    @settings(max_examples=20)
    def test_multiple_keys_independent(self, keys: list) -> None:
        """多个键相互独立"""
        import tempfile
        tmpdir = tempfile.mkdtemp()
        try:
            cache = TwoTierCache(cache_dir=Path(tmpdir))

            # 设置所有键
            for i, key in enumerate(keys):
                cache.set(key, {"index": i})

            # 验证所有键
            for i, key in enumerate(keys):
                result = cache.get(key)
                assert result == {"index": i}

            cache.close()
        finally:
            import shutil
            try:
                shutil.rmtree(tmpdir, ignore_errors=True)
            except Exception:
                pass

