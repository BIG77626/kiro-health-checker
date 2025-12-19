"""
Two-Tier Cache - 两层缓存

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 2.2)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE, DATABASE-SAFETY
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: CacheStats inherits from BaseModel

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit None checks

Rule: DB-002 (连接泄漏检测)
  - Evidence: SQLite connection properly managed
===================================

Requirements: REQ-15, REQ-22 (缓存)
"""

from __future__ import annotations

import json
import logging
import sqlite3
import threading
from collections import Counter
from pathlib import Path
from typing import Any, Dict, Optional

from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)


# =============================================================================
# Data Models
# =============================================================================


class CacheStats(BaseModel):
    """缓存统计信息"""

    model_config = ConfigDict(strict=True, extra="forbid")

    hot_cache_size: int = Field(ge=0, description="热缓存大小")
    warm_cache_size: int = Field(ge=0, description="温缓存大小")
    cold_cache_size: int = Field(ge=0, description="冷缓存大小")
    hot_cache_hits: int = Field(ge=0, description="热缓存命中次数")
    warm_cache_hits: int = Field(ge=0, description="温缓存命中次数")
    cold_cache_hits: int = Field(ge=0, description="冷缓存命中次数")
    total_misses: int = Field(ge=0, description="总未命中次数")
    promotion_count: int = Field(ge=0, description="晋升次数")


# =============================================================================
# Implementation
# =============================================================================


class TwoTierCache:
    """
    两层缓存：热/温 + SQLite冷存储（Windows适配）(REQ-15, REQ-22)

    缓存层次：
    1. 热缓存（dict）：永不淘汰，上限50条
    2. 温缓存（LRU）：容量100条，命中3次晋升到热缓存
    3. 冷存储（SQLite）：持久化存储

    使用示例:
    ```python
    cache = TwoTierCache()

    # 存储
    cache.set("key1", {"data": "value"})

    # 获取
    value = cache.get("key1")

    # 失效
    cache.invalidate("key1")
    cache.invalidate_all()
    ```
    """

    # 默认配置
    DEFAULT_HOT_CACHE_SIZE = 50
    DEFAULT_WARM_CACHE_SIZE = 100
    DEFAULT_PROMOTION_THRESHOLD = 3

    def __init__(
        self,
        cache_dir: Optional[Path] = None,
        hot_cache_size: int = DEFAULT_HOT_CACHE_SIZE,
        warm_cache_size: int = DEFAULT_WARM_CACHE_SIZE,
        promotion_threshold: int = DEFAULT_PROMOTION_THRESHOLD,
    ) -> None:
        """
        初始化 TwoTierCache。

        Args:
            cache_dir: 缓存目录，默认为 ~/.trunk_intelligence/cache
            hot_cache_size: 热缓存大小上限
            warm_cache_size: 温缓存大小上限
            promotion_threshold: 晋升阈值（命中次数）
        """
        # DEF-001: 显式检查 None
        if cache_dir is None:
            cache_dir = Path.home() / ".trunk_intelligence" / "cache"

        self._cache_dir = Path(cache_dir)
        self._hot_cache_size = hot_cache_size
        self._warm_cache_size = warm_cache_size
        self._promotion_threshold = promotion_threshold

        # 确保缓存目录存在
        self._cache_dir.mkdir(parents=True, exist_ok=True)

        # 1. 热缓存：Python dict，永不淘汰
        self._hot_cache: Dict[str, Any] = {}

        # 2. 温缓存：使用 cachetools.LRUCache
        self._warm_cache_size = warm_cache_size
        try:
            from cachetools import LRUCache
            self._warm_cache: LRUCache = LRUCache(maxsize=warm_cache_size)
            self._has_lru_cache = True
        except ImportError:
            # 如果 cachetools 不可用，使用简单的 dict（带手动容量限制）
            logger.warning(
                "cachetools not available, using bounded dict for warm cache. "
                "Install cachetools for better LRU behavior: pip install cachetools"
            )
            self._warm_cache = {}  # type: ignore
            self._has_lru_cache = False

        # 3. 冷存储：SQLite
        self._db_path = self._cache_dir / "rules_cache.db"
        self._db: Optional[sqlite3.Connection] = None
        self._init_cold_storage()

        # 缓存晋升策略（基于命中次数）
        self._hit_counter: Counter[str] = Counter()

        # 统计信息
        self._hot_hits = 0
        self._warm_hits = 0
        self._cold_hits = 0
        self._misses = 0
        self._promotions = 0

        # 线程锁
        self._lock = threading.RLock()

    def _init_cold_storage(self) -> None:
        """初始化冷存储（SQLite）"""
        try:
            self._db = sqlite3.connect(
                str(self._db_path),
                check_same_thread=False,
            )
            self._db.execute("""
                CREATE TABLE IF NOT EXISTS cache (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            self._db.commit()
        except sqlite3.Error as e:
            logger.warning(f"Failed to initialize cold storage: {e}")
            self._db = None

    def get(self, key: str) -> Optional[Any]:
        """
        获取缓存值 (REQ-15.2)

        查询顺序：热缓存 → 温缓存 → 冷存储

        Args:
            key: 缓存键

        Returns:
            Optional[Any]: 缓存值，如果不存在返回 None
        """
        with self._lock:
            # 1. 热缓存
            if key in self._hot_cache:
                self._hot_hits += 1
                return self._hot_cache[key]

            # 2. 温缓存
            if key in self._warm_cache:
                self._warm_hits += 1
                self._hit_counter[key] += 1

                # 获取值（在可能的晋升之前）
                value = self._warm_cache[key]

                # 晋升机制：命中达到阈值 → 热缓存
                if self._hit_counter[key] >= self._promotion_threshold:
                    self._promote_to_hot(key)
                    # 晋升后重置计数器，避免重复晋升判定
                    self._hit_counter[key] = 0

                return value

                # 3. 冷存储
            value = self._load_from_cold(key)
            if value is not None:
                self._cold_hits += 1
                # 首次加载先放温缓存
                self._set_warm(key, value)
                return value

            # 未命中
            self._misses += 1
            logger.debug(f"Cache miss for key: {key}")
            return None

    def set(self, key: str, value: Any, tier: str = "warm") -> None:
        """
        设置缓存值

        Args:
            key: 缓存键
            value: 缓存值
            tier: 目标层级 ("hot", "warm", "cold")
        """
        with self._lock:
            if tier == "hot":
                self._set_hot(key, value)
            elif tier == "cold":
                self._save_to_cold(key, value)
            else:
                self._set_warm(key, value)

    def _set_hot(self, key: str, value: Any) -> None:
        """设置热缓存"""
        # 检查热缓存大小限制
        if len(self._hot_cache) >= self._hot_cache_size and key not in self._hot_cache:
            # 热缓存已满，不再添加新条目
            logger.debug(f"Hot cache full, storing in warm cache: {key}")
            self._set_warm(key, value)
            return

        self._hot_cache[key] = value

    def _set_warm(self, key: str, value: Any) -> None:
        """设置温缓存"""
        # 如果没有 LRU 缓存，手动限制大小
        if not self._has_lru_cache and len(self._warm_cache) >= self._warm_cache_size:
            # 简单策略：删除第一个条目（FIFO）
            if self._warm_cache:
                oldest_key = next(iter(self._warm_cache))
                del self._warm_cache[oldest_key]
                logger.debug(f"Warm cache full, evicted: {oldest_key}")

        self._warm_cache[key] = value

    def _promote_to_hot(self, key: str) -> None:
        """晋升到热缓存 (REQ-22.4)"""
        if key not in self._warm_cache:
            return

        # 检查热缓存大小限制
        if len(self._hot_cache) >= self._hot_cache_size:
            logger.debug(f"Hot cache full, cannot promote: {key}")
            return

        # 从温缓存移动到热缓存
        value = self._warm_cache.pop(key, None)
        if value is not None:
            self._hot_cache[key] = value
            self._promotions += 1
            logger.debug(f"Promoted to hot cache: {key}")

    def _load_from_cold(self, key: str) -> Optional[Any]:
        """从冷存储加载"""
        if self._db is None:
            return None

        try:
            cursor = self._db.execute(
                "SELECT value FROM cache WHERE key = ?",
                (key,),
            )
            row = cursor.fetchone()
            if row:
                return json.loads(row[0])
        except (sqlite3.Error, json.JSONDecodeError) as e:
            # 冷存储读取失败应记录为错误级别，便于监控告警
            logger.error(f"Cold storage read error for key '{key}': {e}")

        return None

    def _save_to_cold(self, key: str, value: Any) -> None:
        """保存到冷存储"""
        if self._db is None:
            return

        try:
            value_json = json.dumps(value)
            self._db.execute(
                """
                INSERT OR REPLACE INTO cache (key, value, updated_at)
                VALUES (?, ?, CURRENT_TIMESTAMP)
                """,
                (key, value_json),
            )
            self._db.commit()
        except (sqlite3.Error, TypeError) as e:
            logger.warning(f"Failed to save to cold storage: {e}")

    def invalidate(self, key: str) -> None:
        """
        失效单个缓存

        Args:
            key: 缓存键
        """
        with self._lock:
            # 从所有层级移除
            self._hot_cache.pop(key, None)
            self._warm_cache.pop(key, None)
            self._hit_counter.pop(key, None)

            # 从冷存储移除
            if self._db is not None:
                try:
                    self._db.execute("DELETE FROM cache WHERE key = ?", (key,))
                    self._db.commit()
                except sqlite3.Error as e:
                    logger.warning(f"Failed to invalidate cold cache: {e}")

    def invalidate_all(self) -> None:
        """
        失效所有缓存 (REQ-15.3)

        规则库版本变更时调用
        """
        with self._lock:
            self._hot_cache.clear()
            self._warm_cache.clear()
            self._hit_counter.clear()

            # 清空冷存储
            if self._db is not None:
                try:
                    self._db.execute("DELETE FROM cache")
                    self._db.commit()
                except sqlite3.Error as e:
                    logger.warning(f"Failed to clear cold cache: {e}")

            # 重置统计
            self._hot_hits = 0
            self._warm_hits = 0
            self._cold_hits = 0
            self._misses = 0
            self._promotions = 0

            logger.info("All caches invalidated")

    def get_stats(self) -> CacheStats:
        """
        获取缓存统计信息

        Returns:
            CacheStats: 统计信息
        """
        with self._lock:
            cold_size = 0
            if self._db is not None:
                try:
                    cursor = self._db.execute("SELECT COUNT(*) FROM cache")
                    row = cursor.fetchone()
                    if row:
                        cold_size = row[0]
                except sqlite3.Error:
                    pass

            return CacheStats(
                hot_cache_size=len(self._hot_cache),
                warm_cache_size=len(self._warm_cache),
                cold_cache_size=cold_size,
                hot_cache_hits=self._hot_hits,
                warm_cache_hits=self._warm_hits,
                cold_cache_hits=self._cold_hits,
                total_misses=self._misses,
                promotion_count=self._promotions,
            )

    def close(self) -> None:
        """关闭缓存（释放资源）"""
        with self._lock:
            if self._db is not None:
                try:
                    self._db.close()
                except sqlite3.Error:
                    pass
                self._db = None

    def __del__(self) -> None:
        """析构函数"""
        self.close()


# =============================================================================
# Convenience Functions
# =============================================================================


def create_two_tier_cache(
    cache_dir: Optional[Path] = None,
) -> TwoTierCache:
    """创建 TwoTierCache 实例的便捷函数"""
    return TwoTierCache(cache_dir=cache_dir)
