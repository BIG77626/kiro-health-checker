"""
Tests for HotReloader

=== SKILL COMPLIANCE DECLARATION ===
Task: DYNAMIC-RULE-SCALING (Task 2.3)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE, FILE-SAFETY
Level: Expert (P0)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types
===================================

Requirements: REQ-17 (规则热加载)
"""

from __future__ import annotations

import time
from pathlib import Path
from typing import List

import pytest
import yaml

from ..hot_reloader import HotReloader, ReloadEvent, ReloaderStats, create_hot_reloader
from ..rule_index import UnifiedRuleIndex
from ..rule_registry import RuleRegistry


# =============================================================================
# Test Fixtures
# =============================================================================


@pytest.fixture
def temp_rules_dir(tmp_path: Path) -> Path:
    """创建临时规则目录"""
    rules_dir = tmp_path / "rules"
    rules_dir.mkdir()

    rules_data = {
        "rules": [
            {
                "id": "SEC-001",
                "category": "security",
                "description": "Security rule 1",
                "human_description": "Security check",
                "severity": "mandatory",
                "skill_tags": ["security"],
                "scenario_tags": ["cli_tool"],
            },
        ]
    }

    with open(rules_dir / "test_rules.yml", "w", encoding="utf-8") as f:
        yaml.dump(rules_data, f)

    return rules_dir


@pytest.fixture
def rule_registry(temp_rules_dir: Path) -> RuleRegistry:
    """创建测试用的 RuleRegistry"""
    return RuleRegistry(rules_dir=temp_rules_dir)


@pytest.fixture
def rule_index(rule_registry: RuleRegistry) -> UnifiedRuleIndex:
    """创建测试用的 UnifiedRuleIndex"""
    return UnifiedRuleIndex(rule_registry=rule_registry)


@pytest.fixture
def hot_reloader(
    temp_rules_dir: Path,
    rule_registry: RuleRegistry,
    rule_index: UnifiedRuleIndex,
) -> HotReloader:
    """创建测试用的 HotReloader"""
    return HotReloader(
        rules_dir=temp_rules_dir,
        rule_registry=rule_registry,
        rule_index=rule_index,
        scan_interval=0.1,  # 快速扫描便于测试
    )


# =============================================================================
# 基本功能测试
# =============================================================================


class TestBasicFunctionality:
    """测试基本功能"""

    def test_start_and_stop(self, hot_reloader: HotReloader) -> None:
        """启动和停止"""
        assert not hot_reloader.is_running

        hot_reloader.start()
        assert hot_reloader.is_running

        hot_reloader.stop()
        assert not hot_reloader.is_running

    def test_double_start_is_safe(self, hot_reloader: HotReloader) -> None:
        """重复启动是安全的"""
        hot_reloader.start()
        hot_reloader.start()  # 不应该抛出异常

        assert hot_reloader.is_running
        hot_reloader.stop()

    def test_double_stop_is_safe(self, hot_reloader: HotReloader) -> None:
        """重复停止是安全的"""
        hot_reloader.start()
        hot_reloader.stop()
        hot_reloader.stop()  # 不应该抛出异常

        assert not hot_reloader.is_running


# =============================================================================
# 文件变更检测测试
# =============================================================================


class TestFileChangeDetection:
    """测试文件变更检测"""

    def test_force_scan(self, hot_reloader: HotReloader) -> None:
        """强制扫描"""
        hot_reloader.force_scan()

        stats = hot_reloader.get_stats()
        assert stats.total_scans >= 1

    def test_detect_new_file(
        self,
        temp_rules_dir: Path,
        hot_reloader: HotReloader,
    ) -> None:
        """检测新文件"""
        reload_events: List[ReloadEvent] = []

        def on_reload(event: ReloadEvent) -> None:
            reload_events.append(event)

        hot_reloader._on_reload = on_reload

        # 创建新规则文件
        new_rules = {
            "rules": [
                {
                    "id": "NEW-001",
                    "category": "security",
                    "description": "New rule",
                    "human_description": "New check",
                    "severity": "mandatory",
                    "skill_tags": ["new-tag"],
                },
            ]
        }

        with open(temp_rules_dir / "new_rules.yml", "w", encoding="utf-8") as f:
            yaml.dump(new_rules, f)

        # 强制扫描
        hot_reloader.force_scan()

        # 验证检测到新文件
        assert len(reload_events) >= 1
        assert any(e.event_type == "added" for e in reload_events)

    def test_detect_modified_file(
        self,
        temp_rules_dir: Path,
        hot_reloader: HotReloader,
    ) -> None:
        """检测文件修改"""
        reload_events: List[ReloadEvent] = []

        def on_reload(event: ReloadEvent) -> None:
            reload_events.append(event)

        hot_reloader._on_reload = on_reload

        # 初始扫描
        hot_reloader.force_scan()
        reload_events.clear()

        # 等待一小段时间确保 mtime 变化
        time.sleep(0.1)

        # 修改现有文件
        modified_rules = {
            "rules": [
                {
                    "id": "SEC-001",
                    "category": "security",
                    "description": "Modified rule",
                    "human_description": "Modified check",
                    "severity": "mandatory",
                    "skill_tags": ["security", "modified"],
                },
            ]
        }

        with open(temp_rules_dir / "test_rules.yml", "w", encoding="utf-8") as f:
            yaml.dump(modified_rules, f)

        # 强制扫描
        hot_reloader.force_scan()

        # 验证检测到修改
        assert len(reload_events) >= 1
        assert any(e.event_type == "modified" for e in reload_events)


# =============================================================================
# 自动回退测试 (Kill Switch)
# =============================================================================


class TestKillSwitch:
    """测试自动回退功能"""

    def test_invalid_yaml_does_not_crash(
        self,
        temp_rules_dir: Path,
        hot_reloader: HotReloader,
    ) -> None:
        """无效YAML不会崩溃"""
        reload_events: List[ReloadEvent] = []

        def on_reload(event: ReloadEvent) -> None:
            reload_events.append(event)

        hot_reloader._on_reload = on_reload

        # 创建无效YAML文件
        with open(temp_rules_dir / "invalid.yml", "w", encoding="utf-8") as f:
            f.write("invalid: yaml: content: [")

        # 强制扫描 - 不应该崩溃
        hot_reloader.force_scan()

        # 验证记录了失败
        stats = hot_reloader.get_stats()
        assert stats.failed_reloads >= 1


# =============================================================================
# 统计信息测试
# =============================================================================


class TestReloaderStats:
    """测试统计信息"""

    def test_get_stats(self, hot_reloader: HotReloader) -> None:
        """获取统计信息"""
        stats = hot_reloader.get_stats()

        assert isinstance(stats, ReloaderStats)
        assert stats.scan_interval == 0.1
        assert stats.watched_files >= 0

    def test_stats_track_scans(self, hot_reloader: HotReloader) -> None:
        """统计跟踪扫描次数"""
        hot_reloader.force_scan()
        hot_reloader.force_scan()

        stats = hot_reloader.get_stats()
        assert stats.total_scans >= 2


# =============================================================================
# 便捷函数测试
# =============================================================================


class TestConvenienceFunctions:
    """测试便捷函数"""

    def test_create_hot_reloader(
        self,
        temp_rules_dir: Path,
        rule_registry: RuleRegistry,
    ) -> None:
        """create_hot_reloader 便捷函数"""
        reloader = create_hot_reloader(
            rules_dir=temp_rules_dir,
            rule_registry=rule_registry,
        )

        assert reloader is not None
        assert not reloader.is_running

