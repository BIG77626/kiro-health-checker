"""
False Green Tracker - 假绿率追踪器

=== SKILL COMPLIANCE DECLARATION ===
Task: ARCHITECTURE-SIMPLIFICATION (Task 3.2)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE, SQLITE-PERSISTENCE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: Uses ValidationRecord, FalseGreenEvent, FalseGreenStats from models.py

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: ERR-004 (异常链必须使用 from)
  - Evidence: `raise FalseGreenRecordError(...) from e`

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit `is None` checks

Rule: DEF-002 (数值计算必须防止除零)
  - Evidence: FalseGreenStats.calculate_rate() handles division by zero

Rule: SQLITE-001 (使用参数化查询)
  - Evidence: All queries use ? placeholders
===================================

Requirements: REQ-6.1, REQ-6.2, REQ-6.3, REQ-6.4
Properties:
  - Property 9: 验证记录完整性
  - Property 10: 假绿率计算正确性
"""

from __future__ import annotations

import logging
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Generator, List, Optional, Protocol

from .models import (
    FalseGreenEvent,
    FalseGreenRecordError,
    FalseGreenStats,
    RiskLevel,
    RuleMetrics,
    RuleQualityError,
    ValidationRecord,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Constants
# =============================================================================

DEFAULT_DB_PATH = ".false_green_tracker.db"
MAX_RETRIES = 3
RETRY_DELAY_MS = 100


# =============================================================================
# SQL Statements (SQLITE-001: 参数化查询)
# =============================================================================

CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS validation_records (
    id TEXT PRIMARY KEY,
    code_hash TEXT NOT NULL,
    ruleset_version TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    passed INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS false_green_events (
    id TEXT PRIMARY KEY,
    validation_id TEXT NOT NULL,
    reported_at TEXT NOT NULL,
    issue_description TEXT NOT NULL,
    missing_rule TEXT,
    rule_too_loose TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (validation_id) REFERENCES validation_records(id)
);

CREATE INDEX IF NOT EXISTS idx_validation_timestamp ON validation_records(timestamp);
CREATE INDEX IF NOT EXISTS idx_validation_passed ON validation_records(passed);
CREATE INDEX IF NOT EXISTS idx_false_green_validation ON false_green_events(validation_id);
"""

INSERT_VALIDATION_SQL = """
INSERT INTO validation_records (id, code_hash, ruleset_version, timestamp, risk_level, passed)
VALUES (?, ?, ?, ?, ?, ?);
"""

INSERT_FALSE_GREEN_SQL = """
INSERT INTO false_green_events (id, validation_id, reported_at, issue_description, missing_rule, rule_too_loose)
VALUES (?, ?, ?, ?, ?, ?);
"""

SELECT_VALIDATION_SQL = """
SELECT id, code_hash, ruleset_version, timestamp, risk_level, passed
FROM validation_records
WHERE id = ?;
"""

COUNT_VALIDATIONS_SQL = """
SELECT COUNT(*) FROM validation_records
WHERE timestamp >= ? AND timestamp <= ?;
"""

COUNT_PASSED_SQL = """
SELECT COUNT(*) FROM validation_records
WHERE timestamp >= ? AND timestamp <= ? AND passed = 1;
"""

COUNT_FALSE_GREEN_SQL = """
SELECT COUNT(*) FROM false_green_events fe
JOIN validation_records vr ON fe.validation_id = vr.id
WHERE vr.timestamp >= ? AND vr.timestamp <= ?;
"""

# =============================================================================
# Rule Quality Tracking SQL (Task 3.1 - REQ-6, REQ-16)
# =============================================================================

CREATE_RULE_METRICS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS rule_metrics (
    rule_id TEXT PRIMARY KEY,
    trigger_count INTEGER NOT NULL DEFAULT 0,
    false_positive_count INTEGER NOT NULL DEFAULT 0,
    last_triggered TEXT,
    is_disabled INTEGER NOT NULL DEFAULT 0,
    disable_reason TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rule_metrics_disabled ON rule_metrics(is_disabled);
CREATE INDEX IF NOT EXISTS idx_rule_metrics_last_triggered ON rule_metrics(last_triggered);
"""

INSERT_OR_UPDATE_RULE_METRICS_SQL = """
INSERT INTO rule_metrics (rule_id, trigger_count, false_positive_count, last_triggered, updated_at)
VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP)
ON CONFLICT(rule_id) DO UPDATE SET
    trigger_count = trigger_count + 1,
    false_positive_count = false_positive_count + excluded.false_positive_count,
    last_triggered = excluded.last_triggered,
    updated_at = CURRENT_TIMESTAMP;
"""

SELECT_RULE_METRICS_SQL = """
SELECT rule_id, trigger_count, false_positive_count, last_triggered, is_disabled, disable_reason
FROM rule_metrics
WHERE rule_id = ?;
"""

SELECT_STALE_RULES_SQL = """
SELECT rule_id FROM rule_metrics
WHERE last_triggered < ? OR last_triggered IS NULL;
"""

SELECT_ALL_RULE_METRICS_SQL = """
SELECT rule_id, trigger_count, false_positive_count, last_triggered, is_disabled, disable_reason
FROM rule_metrics;
"""

UPDATE_RULE_DISABLED_SQL = """
UPDATE rule_metrics
SET is_disabled = ?, disable_reason = ?, updated_at = CURRENT_TIMESTAMP
WHERE rule_id = ?;
"""

MARK_FALSE_POSITIVE_SQL = """
UPDATE rule_metrics
SET false_positive_count = false_positive_count + 1, updated_at = CURRENT_TIMESTAMP
WHERE rule_id = ?;
"""


# =============================================================================
# Protocol
# =============================================================================


class FalseGreenTrackerProtocol(Protocol):
    """假绿率追踪器接口"""

    def record_validation(self, record: ValidationRecord) -> None:
        """记录验证结果"""
        ...

    def report_false_green(
        self,
        validation_id: str,
        issue_description: str,
    ) -> FalseGreenEvent:
        """报告假绿事件"""
        ...

    def get_false_green_rate(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> FalseGreenStats:
        """获取假绿率统计"""
        ...


# =============================================================================
# Implementation
# =============================================================================


class FalseGreenTracker:
    """
    假绿率追踪器实现

    追踪验证结果和假绿事件，计算假绿率。

    Properties:
    - Property 9: 验证记录必须包含 code_hash, ruleset_version, timestamp
    - Property 10: false_green_rate = false_green_count / total_passed
    """

    def __init__(
        self,
        db_path: Optional[Path] = None,
    ) -> None:
        """
        初始化假绿率追踪器。

        Args:
            db_path: 数据库文件路径
        """
        # DEF-001: 显式检查 None
        if db_path is None:
            db_path = Path(DEFAULT_DB_PATH)

        self._db_path = Path(db_path)
        self._initialized = False

    @contextmanager
    def _get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """获取数据库连接"""
        conn: Optional[sqlite3.Connection] = None
        last_error: Optional[Exception] = None

        for attempt in range(MAX_RETRIES):
            try:
                conn = sqlite3.connect(
                    str(self._db_path),
                    timeout=30.0,
                    isolation_level="DEFERRED",
                )
                conn.execute("PRAGMA journal_mode=WAL;")

                yield conn
                conn.commit()
                return

            # ERR-001: 指定具体异常类型
            except sqlite3.OperationalError as e:
                last_error = e
                # DEF-001: 显式检查 None
                if conn is not None:
                    conn.rollback()
                    conn.close()
                    conn = None

                if attempt < MAX_RETRIES - 1:
                    import time
                    time.sleep(RETRY_DELAY_MS / 1000.0)
                    continue
                break

            finally:
                # DEF-001: 显式检查 None
                if conn is not None:
                    conn.close()

        # ERR-004: 异常链使用 from
        raise FalseGreenRecordError(
            f"Failed to connect to database after {MAX_RETRIES} attempts",
            cause=last_error,
        )

    def _ensure_initialized(self) -> None:
        """确保数据库已初始化"""
        if self._initialized:
            return

        try:
            with self._get_connection() as conn:
                conn.executescript(CREATE_TABLES_SQL)
            self._initialized = True
        # ERR-001: 指定具体异常类型
        except (sqlite3.Error, FalseGreenRecordError) as e:
            # ERR-004: 异常链使用 from
            raise FalseGreenRecordError(
                "Failed to initialize database",
                cause=e,
            ) from e

    def record_validation(self, record: ValidationRecord) -> None:
        """
        记录验证结果 (REQ-6.1)

        Property 9: 记录必须包含 code_hash, ruleset_version, timestamp

        Args:
            record: 验证记录

        Raises:
            FalseGreenRecordError: 记录失败
        """
        self._ensure_initialized()

        try:
            with self._get_connection() as conn:
                # SQLITE-001: 使用参数化查询
                conn.execute(
                    INSERT_VALIDATION_SQL,
                    (
                        record.id,
                        record.code_hash,
                        record.ruleset_version,
                        record.timestamp.isoformat(),
                        record.risk_level.value,
                        1 if record.passed else 0,
                    ),
                )
        # ERR-001: 指定具体异常类型
        except (sqlite3.Error, FalseGreenRecordError) as e:
            # ERR-004: 异常链使用 from
            raise FalseGreenRecordError(
                f"Failed to record validation: {e}",
                cause=e,
            ) from e

    def report_false_green(
        self,
        validation_id: str,
        issue_description: str,
        missing_rule: Optional[str] = None,
        rule_too_loose: Optional[str] = None,
    ) -> FalseGreenEvent:
        """
        报告假绿事件 (REQ-6.2)

        Args:
            validation_id: 关联的验证记录ID
            issue_description: 问题描述
            missing_rule: 缺失的规则（如果是规则缺失）
            rule_too_loose: 过于宽松的规则（如果是规则太宽松）

        Returns:
            FalseGreenEvent: 假绿事件

        Raises:
            FalseGreenRecordError: 记录失败
        """
        self._ensure_initialized()

        event_id = str(uuid.uuid4())
        reported_at = datetime.now(tz=None)

        try:
            with self._get_connection() as conn:
                # 验证 validation_id 存在
                cursor = conn.execute(
                    SELECT_VALIDATION_SQL,
                    (validation_id,),
                )
                row = cursor.fetchone()
                # DEF-001: 显式检查 None
                if row is None:
                    raise FalseGreenRecordError(
                        f"Validation record not found: {validation_id}"
                    )

                # SQLITE-001: 使用参数化查询
                conn.execute(
                    INSERT_FALSE_GREEN_SQL,
                    (
                        event_id,
                        validation_id,
                        reported_at.isoformat(),
                        issue_description,
                        missing_rule,
                        rule_too_loose,
                    ),
                )

            return FalseGreenEvent(
                id=event_id,
                validation_id=validation_id,
                reported_at=reported_at,
                issue_description=issue_description,
                missing_rule=missing_rule,
                rule_too_loose=rule_too_loose,
            )

        # ERR-001: 指定具体异常类型
        except (sqlite3.Error, FalseGreenRecordError) as e:
            # ERR-004: 异常链使用 from
            raise FalseGreenRecordError(
                f"Failed to report false green: {e}",
                cause=e,
            ) from e

    def get_false_green_rate(
        self,
        start_date: datetime,
        end_date: datetime,
    ) -> FalseGreenStats:
        """
        获取假绿率统计 (REQ-6.3)

        Property 10: false_green_rate = false_green_count / total_passed

        Args:
            start_date: 开始日期
            end_date: 结束日期

        Returns:
            FalseGreenStats: 假绿率统计

        Raises:
            FalseGreenRecordError: 查询失败
        """
        self._ensure_initialized()

        try:
            with self._get_connection() as conn:
                start_str = start_date.isoformat()
                end_str = end_date.isoformat()

                # 总验证次数
                cursor = conn.execute(
                    COUNT_VALIDATIONS_SQL,
                    (start_str, end_str),
                )
                total_validations = cursor.fetchone()[0]

                # 通过验证的次数
                cursor = conn.execute(
                    COUNT_PASSED_SQL,
                    (start_str, end_str),
                )
                total_passed = cursor.fetchone()[0]

                # 假绿事件数
                cursor = conn.execute(
                    COUNT_FALSE_GREEN_SQL,
                    (start_str, end_str),
                )
                false_green_count = cursor.fetchone()[0]

            # Property 10: 假绿率计算正确性
            # DEF-002: 防止除零
            false_green_rate = FalseGreenStats.calculate_rate(
                false_green_count, total_passed
            )

            return FalseGreenStats(
                period_start=start_date,
                period_end=end_date,
                total_validations=total_validations,
                total_passed=total_passed,
                false_green_count=false_green_count,
                false_green_rate=false_green_rate,
            )

        # ERR-001: 指定具体异常类型
        except (sqlite3.Error, FalseGreenRecordError) as e:
            # ERR-004: 异常链使用 from
            raise FalseGreenRecordError(
                f"Failed to get false green rate: {e}",
                cause=e,
            ) from e


# =============================================================================
# Rule Quality Tracker Protocol (Task 3.1)
# =============================================================================


class RuleQualityTrackerProtocol(Protocol):
    """规则质量追踪器接口"""

    def record_trigger(self, rule_id: str, was_false_positive: bool = False) -> None:
        """记录规则触发"""
        ...

    def get_metrics(self, rule_id: str) -> Optional[RuleMetrics]:
        """获取规则指标"""
        ...

    def get_stale_rules(self, days_threshold: int = 30) -> List[str]:
        """获取僵尸规则"""
        ...

    def should_disable(self, rule_id: str) -> bool:
        """判断是否应禁用规则"""
        ...


# =============================================================================
# Rule Quality Tracker Implementation (Task 3.1 - REQ-6, REQ-16)
# =============================================================================


class RuleQualityTracker:
    """
    规则质量追踪器 - 简化版

    =============================================================================
    SKILL COMPLIANCE DECLARATION
    =============================================================================
    Task: DYNAMIC-RULE-SCALING (Task 3.1)
    Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE, DATABASE-SAFETY
    Level: Expert (P2)

    Rule: ERR-001 (禁止裸 except)
      - Evidence: All except blocks specify concrete types

    Rule: ERR-004 (异常链必须使用 from)
      - Evidence: `raise RuleQualityError(...) from e`

    Rule: DEF-001 (禁止 truthiness 检查 Optional)
      - Evidence: Using explicit `is None` checks

    Rule: DEF-002 (数值计算必须防止除零)
      - Evidence: RuleMetrics.false_positive_rate handles division by zero

    Rule: SQLITE-001 (使用参数化查询)
      - Evidence: All queries use ? placeholders
    =============================================================================

    追踪规则触发频次和误报率，支持僵尸规则识别和自动禁用。

    Properties:
    - Property 8: 僵尸规则识别 - 30天未触发的规则应被标记为dormant
    """

    # 自动禁用阈值
    MIN_TRIGGERS_FOR_DISABLE = 5
    MAX_FALSE_POSITIVE_RATE = 0.5
    DEFAULT_STALE_DAYS = 30

    def __init__(
        self,
        db_path: Optional[Path] = None,
    ) -> None:
        """
        初始化规则质量追踪器。

        Args:
            db_path: 数据库文件路径
        """
        # DEF-001: 显式检查 None
        if db_path is None:
            db_path = Path(DEFAULT_DB_PATH)

        self._db_path = Path(db_path)
        self._initialized = False

    @contextmanager
    def _get_connection(self) -> Generator[sqlite3.Connection, None, None]:
        """获取数据库连接"""
        conn: Optional[sqlite3.Connection] = None
        last_error: Optional[Exception] = None

        for attempt in range(MAX_RETRIES):
            try:
                conn = sqlite3.connect(
                    str(self._db_path),
                    timeout=30.0,
                    isolation_level="DEFERRED",
                )
                conn.execute("PRAGMA journal_mode=WAL;")

                yield conn
                conn.commit()
                return

            # ERR-001: 指定具体异常类型
            except sqlite3.OperationalError as e:
                last_error = e
                # DEF-001: 显式检查 None
                if conn is not None:
                    conn.rollback()
                    conn.close()
                    conn = None

                if attempt < MAX_RETRIES - 1:
                    import time
                    time.sleep(RETRY_DELAY_MS / 1000.0)
                    continue
                break

            finally:
                # DEF-001: 显式检查 None
                if conn is not None:
                    conn.close()

        # ERR-004: 异常链使用 from
        raise RuleQualityError(
            f"Failed to connect to database after {MAX_RETRIES} attempts",
            cause=last_error,
        )

    def _ensure_initialized(self) -> None:
        """确保数据库已初始化"""
        if self._initialized:
            return

        try:
            with self._get_connection() as conn:
                conn.executescript(CREATE_RULE_METRICS_TABLE_SQL)
            self._initialized = True
        # ERR-001: 指定具体异常类型
        except (sqlite3.Error, RuleQualityError) as e:
            # ERR-004: 异常链使用 from
            raise RuleQualityError(
                "Failed to initialize rule metrics table",
                cause=e,
            ) from e

    def record_trigger(
        self,
        rule_id: str,
        was_false_positive: bool = False,
    ) -> None:
        """
        记录规则触发 (REQ-6.1, REQ-16.1)

        Args:
            rule_id: 规则ID
            was_false_positive: 是否为误报

        Raises:
            RuleQualityError: 记录失败
        """
        self._ensure_initialized()

        try:
            with self._get_connection() as conn:
                now = datetime.now(tz=None).isoformat()
                fp_increment = 1 if was_false_positive else 0

                # SQLITE-001: 使用参数化查询
                conn.execute(
                    INSERT_OR_UPDATE_RULE_METRICS_SQL,
                    (rule_id, fp_increment, now),
                )

                logger.debug(
                    f"Recorded trigger for rule {rule_id}, "
                    f"false_positive={was_false_positive}"
                )

        # ERR-001: 指定具体异常类型
        except (sqlite3.Error, RuleQualityError) as e:
            # ERR-004: 异常链使用 from
            raise RuleQualityError(
                f"Failed to record trigger for rule {rule_id}: {e}",
                cause=e,
            ) from e

    def mark_false_positive(self, rule_id: str) -> None:
        """
        标记规则触发为误报 (REQ-6.2)

        Args:
            rule_id: 规则ID

        Raises:
            RuleQualityError: 标记失败
        """
        self._ensure_initialized()

        try:
            with self._get_connection() as conn:
                # SQLITE-001: 使用参数化查询
                conn.execute(MARK_FALSE_POSITIVE_SQL, (rule_id,))
                logger.info(f"Marked false positive for rule {rule_id}")

        # ERR-001: 指定具体异常类型
        except (sqlite3.Error, RuleQualityError) as e:
            # ERR-004: 异常链使用 from
            raise RuleQualityError(
                f"Failed to mark false positive for rule {rule_id}: {e}",
                cause=e,
            ) from e

    def get_metrics(self, rule_id: str) -> Optional[RuleMetrics]:
        """
        获取规则质量指标 (REQ-6.3)

        Args:
            rule_id: 规则ID

        Returns:
            RuleMetrics: 规则指标，如果不存在返回None

        Raises:
            RuleQualityError: 查询失败
        """
        self._ensure_initialized()

        try:
            with self._get_connection() as conn:
                # SQLITE-001: 使用参数化查询
                cursor = conn.execute(SELECT_RULE_METRICS_SQL, (rule_id,))
                row = cursor.fetchone()

                # DEF-001: 显式检查 None
                if row is None:
                    return None

                # 解析 last_triggered
                last_triggered: Optional[datetime] = None
                if row[3] is not None:
                    last_triggered = datetime.fromisoformat(row[3])

                return RuleMetrics(
                    rule_id=row[0],
                    trigger_count=row[1],
                    false_positive_count=row[2],
                    last_triggered=last_triggered,
                    is_disabled=bool(row[4]),
                    disable_reason=row[5],
                )

        # ERR-001: 指定具体异常类型
        except (sqlite3.Error, RuleQualityError) as e:
            # ERR-004: 异常链使用 from
            raise RuleQualityError(
                f"Failed to get metrics for rule {rule_id}: {e}",
                cause=e,
            ) from e

    def get_all_metrics(self) -> List[RuleMetrics]:
        """
        获取所有规则的质量指标

        Returns:
            List[RuleMetrics]: 所有规则指标列表

        Raises:
            RuleQualityError: 查询失败
        """
        self._ensure_initialized()

        try:
            with self._get_connection() as conn:
                cursor = conn.execute(SELECT_ALL_RULE_METRICS_SQL)
                rows = cursor.fetchall()

                metrics_list: List[RuleMetrics] = []
                for row in rows:
                    # 解析 last_triggered
                    last_triggered: Optional[datetime] = None
                    if row[3] is not None:
                        last_triggered = datetime.fromisoformat(row[3])

                    metrics_list.append(
                        RuleMetrics(
                            rule_id=row[0],
                            trigger_count=row[1],
                            false_positive_count=row[2],
                            last_triggered=last_triggered,
                            is_disabled=bool(row[4]),
                            disable_reason=row[5],
                        )
                    )

                return metrics_list

        # ERR-001: 指定具体异常类型
        except (sqlite3.Error, RuleQualityError) as e:
            # ERR-004: 异常链使用 from
            raise RuleQualityError(
                f"Failed to get all metrics: {e}",
                cause=e,
            ) from e

    def get_stale_rules(self, days_threshold: int = DEFAULT_STALE_DAYS) -> List[str]:
        """
        识别僵尸规则 (REQ-16.2)

        Property 8: 30天未触发的规则应被标记为dormant

        Args:
            days_threshold: 天数阈值，默认30天

        Returns:
            List[str]: 僵尸规则ID列表

        Raises:
            RuleQualityError: 查询失败
        """
        self._ensure_initialized()

        try:
            from datetime import timedelta

            threshold_date = datetime.now(tz=None) - timedelta(days=days_threshold)
            threshold_str = threshold_date.isoformat()

            with self._get_connection() as conn:
                # SQLITE-001: 使用参数化查询
                cursor = conn.execute(SELECT_STALE_RULES_SQL, (threshold_str,))
                rows = cursor.fetchall()

                stale_rules = [row[0] for row in rows]

                if stale_rules:
                    logger.warning(
                        f"Found {len(stale_rules)} stale rules "
                        f"(not triggered in {days_threshold} days): {stale_rules}"
                    )

                return stale_rules

        # ERR-001: 指定具体异常类型
        except (sqlite3.Error, RuleQualityError) as e:
            # ERR-004: 异常链使用 from
            raise RuleQualityError(
                f"Failed to get stale rules: {e}",
                cause=e,
            ) from e

    def should_disable(
        self,
        rule_id: str,
        min_triggers: int = MIN_TRIGGERS_FOR_DISABLE,
        max_fp_rate: float = MAX_FALSE_POSITIVE_RATE,
    ) -> bool:
        """
        判断是否应自动禁用规则 (REQ-6.5, REQ-16.3)

        条件：误报率>50% 且 触发>5次

        Args:
            rule_id: 规则ID
            min_triggers: 最小触发次数阈值
            max_fp_rate: 最大误报率阈值

        Returns:
            bool: 是否应禁用

        Raises:
            RuleQualityError: 查询失败
        """
        metrics = self.get_metrics(rule_id)

        # DEF-001: 显式检查 None
        if metrics is None:
            return False

        # DEF-002: 防止除零（在 RuleMetrics.should_auto_disable 中处理）
        return metrics.should_auto_disable(min_triggers, max_fp_rate)

    def disable_rule(
        self,
        rule_id: str,
        reason: str = "Auto-disabled due to high false positive rate",
    ) -> None:
        """
        禁用规则 (REQ-16.3)

        Args:
            rule_id: 规则ID
            reason: 禁用原因

        Raises:
            RuleQualityError: 禁用失败
        """
        self._ensure_initialized()

        try:
            with self._get_connection() as conn:
                # SQLITE-001: 使用参数化查询
                conn.execute(UPDATE_RULE_DISABLED_SQL, (1, reason, rule_id))
                logger.warning(f"Disabled rule {rule_id}: {reason}")

        # ERR-001: 指定具体异常类型
        except (sqlite3.Error, RuleQualityError) as e:
            # ERR-004: 异常链使用 from
            raise RuleQualityError(
                f"Failed to disable rule {rule_id}: {e}",
                cause=e,
            ) from e

    def enable_rule(self, rule_id: str) -> None:
        """
        启用规则

        Args:
            rule_id: 规则ID

        Raises:
            RuleQualityError: 启用失败
        """
        self._ensure_initialized()

        try:
            with self._get_connection() as conn:
                # SQLITE-001: 使用参数化查询
                conn.execute(UPDATE_RULE_DISABLED_SQL, (0, None, rule_id))
                logger.info(f"Enabled rule {rule_id}")

        # ERR-001: 指定具体异常类型
        except (sqlite3.Error, RuleQualityError) as e:
            # ERR-004: 异常链使用 from
            raise RuleQualityError(
                f"Failed to enable rule {rule_id}: {e}",
                cause=e,
            ) from e

    def auto_disable_high_fp_rules(self) -> List[str]:
        """
        自动禁用高误报率规则

        Returns:
            List[str]: 被禁用的规则ID列表

        Raises:
            RuleQualityError: 操作失败
        """
        all_metrics = self.get_all_metrics()
        disabled_rules: List[str] = []

        for metrics in all_metrics:
            if metrics.is_disabled:
                continue

            if metrics.should_auto_disable(
                self.MIN_TRIGGERS_FOR_DISABLE,
                self.MAX_FALSE_POSITIVE_RATE,
            ):
                self.disable_rule(
                    metrics.rule_id,
                    f"Auto-disabled: FP rate {metrics.false_positive_rate:.1%} "
                    f"> {self.MAX_FALSE_POSITIVE_RATE:.0%} "
                    f"(triggers: {metrics.trigger_count})",
                )
                disabled_rules.append(metrics.rule_id)

        return disabled_rules


# =============================================================================
# Convenience Functions
# =============================================================================


def create_false_green_tracker(
    db_path: Optional[Path] = None,
) -> FalseGreenTracker:
    """创建 FalseGreenTracker 实例的便捷函数"""
    return FalseGreenTracker(db_path=db_path)


def create_rule_quality_tracker(
    db_path: Optional[Path] = None,
) -> RuleQualityTracker:
    """创建 RuleQualityTracker 实例的便捷函数"""
    return RuleQualityTracker(db_path=db_path)
