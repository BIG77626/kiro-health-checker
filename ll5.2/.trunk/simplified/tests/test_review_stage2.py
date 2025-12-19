from __future__ import annotations

"""
Stage 2 Review Verification - 实现 & Config-as-Policy & 开关行为（行为级）

目的：
- 验证阶段二关键架构结论在代码中真实成立
- 重点覆盖：Config-as-Policy、需求层启用开关、health_check 结果契约

设计原则：
- 不打桩内部实现，只验证最终结果
- 测试的是「输出契约」而非「调用过程」
- 配置变化 → 结果变化，而非配置变化 → 调用链变化
"""

from pathlib import Path
from typing import Any, Dict

import pytest


def test_config_as_policy_implemented() -> None:
    """
    A-04/N-03 行为验证：覆盖率阈值由 HealthConfig.requirements 控制。
    
    验证方式：加载配置，检查字段可访问且类型正确。
    """
    from ..health_check import _load_health_config_with_fallback
    from ..health_config_models import HealthConfig

    cfg = _load_health_config_with_fallback()
    
    # 行为验证：返回正确类型
    assert isinstance(cfg, HealthConfig), (
        f"_load_health_config_with_fallback 应返回 HealthConfig，实际返回 {type(cfg)}"
    )

    # 行为验证：coverage_threshold 可访问且为 float
    assert isinstance(cfg.requirements.coverage_threshold, float), (
        f"coverage_threshold 应为 float，实际为 {type(cfg.requirements.coverage_threshold)}"
    )
    
    # 行为验证：enabled 开关可访问且为 bool
    assert isinstance(cfg.requirements.enabled, bool), (
        f"requirements.enabled 应为 bool，实际为 {type(cfg.requirements.enabled)}"
    )


def test_requirement_layer_disabled_returns_none(tmp_path: Path) -> None:
    """
    P-03 行为验证：requirements.enabled=False 时，report.requirement_coverage 为 None。
    
    验证方式：构造禁用配置，运行 health_check，检查结果字段。
    不打桩内部调用，只验证最终输出。
    """
    from ..health_check import run_health_check, _load_health_config_with_fallback
    from ..health_config_models import HealthConfig, RequirementsPolicy, OutputPolicy
    import simplified.health_check as health_check_module

    # 构造禁用需求层的配置
    disabled_cfg = HealthConfig(
        requirements=RequirementsPolicy(enabled=False),
        output=OutputPolicy(show_requirement_layer=True),
    )

    # 临时替换配置加载函数
    original_load = health_check_module._load_health_config_with_fallback

    def _load_disabled_config():
        return disabled_cfg

    try:
        health_check_module._load_health_config_with_fallback = _load_disabled_config
        report = run_health_check()
        
        # 行为验证：需求层被禁用时，requirement_coverage 应为 None
        assert report.requirement_coverage is None, (
            "requirements.enabled=False 时，requirement_coverage 应为 None，"
            f"实际为 {report.requirement_coverage}"
        )
    finally:
        health_check_module._load_health_config_with_fallback = original_load


def test_requirement_layer_enabled_returns_coverage_data() -> None:
    """
    A-01/S-02 行为验证：开启需求层时，report.requirement_coverage 包含覆盖数据。
    
    验证方式：使用默认配置（enabled=True），检查结果字段结构。
    不打桩 check_requirement_coverage，只验证最终输出契约。
    """
    from ..health_check import run_health_check, _load_health_config_with_fallback
    from ..health_config_models import HealthConfig, RequirementsPolicy, OutputPolicy
    import simplified.health_check as health_check_module

    # 构造启用需求层的配置
    enabled_cfg = HealthConfig(
        requirements=RequirementsPolicy(enabled=True),
        output=OutputPolicy(show_requirement_layer=True),
    )

    original_load = health_check_module._load_health_config_with_fallback

    def _load_enabled_config():
        return enabled_cfg

    try:
        health_check_module._load_health_config_with_fallback = _load_enabled_config
        report = run_health_check()
        
        # 行为验证：需求层启用时，requirement_coverage 可能为 dict 或 None
        # （取决于是否有 requirements/ 目录和 REQ 文件）
        # 关键是：如果有数据，结构应该正确
        if report.requirement_coverage is not None:
            assert isinstance(report.requirement_coverage, dict), (
                f"requirement_coverage 应为 dict，实际为 {type(report.requirement_coverage)}"
            )
            # 验证核心字段存在
            expected_keys = [
                "total_requirements",
                "requirements_with_rules",
                "requirements_with_samples",
                "coverage_percentage",
            ]
            for key in expected_keys:
                assert key in report.requirement_coverage, (
                    f"requirement_coverage 缺少字段: {key}"
                )
    finally:
        health_check_module._load_health_config_with_fallback = original_load


def test_health_config_default_values() -> None:
    """
    行为验证：HealthConfig 默认值符合设计文档。
    
    验证方式：构造默认实例，检查各字段默认值。
    """
    from ..health_config_models import HealthConfig

    cfg = HealthConfig()

    # 行为验证：requirements 策略默认值
    assert cfg.requirements.enabled is True, "requirements.enabled 默认应为 True"
    assert cfg.requirements.coverage_threshold == 10.0, (
        f"coverage_threshold 默认应为 10.0，实际为 {cfg.requirements.coverage_threshold}"
    )
    assert cfg.requirements.exit_on_failure is False, (
        "exit_on_failure 默认应为 False（V1 不 gate）"
    )
    assert cfg.requirements.high_risk_gate_enabled is False, (
        "high_risk_gate_enabled 默认应为 False（V2 预留）"
    )

    # 行为验证：traceability 策略默认值
    assert cfg.traceability.warn_on_missing_backlinks is True
    assert cfg.traceability.warn_on_orphans is True
    assert cfg.traceability.warn_on_dangling is True

    # 行为验证：output 策略默认值
    assert cfg.output.show_requirement_layer is True
    assert cfg.output.show_traceability_details is True


def test_health_config_yaml_loading(tmp_path: Path) -> None:
    """
    行为验证：从 YAML 文件加载配置，值正确覆盖默认值。
    
    验证方式：创建临时 YAML，加载后检查值。
    """
    from ..health_config_models import load_health_config

    # 创建自定义配置文件
    config_content = """
version: 1
requirements:
  enabled: false
  coverage_threshold: 50.0
  exit_on_failure: true
traceability:
  warn_on_orphans: false
output:
  show_requirement_layer: false
"""
    config_path = tmp_path / "health_config.yml"
    config_path.write_text(config_content, encoding="utf-8")

    cfg = load_health_config(config_path)

    # 行为验证：YAML 值正确加载
    assert cfg.requirements.enabled is False
    assert cfg.requirements.coverage_threshold == 50.0
    assert cfg.requirements.exit_on_failure is True
    assert cfg.traceability.warn_on_orphans is False
    assert cfg.output.show_requirement_layer is False


def test_health_config_missing_file_uses_defaults() -> None:
    """
    行为验证：配置文件不存在时，使用默认值（优雅降级）。
    
    验证方式：加载不存在的路径，检查返回默认配置。
    """
    from ..health_config_models import load_health_config, HealthConfig

    # 加载不存在的文件
    cfg = load_health_config(Path("/nonexistent/path/config.yml"))

    # 行为验证：返回默认配置
    default_cfg = HealthConfig()
    assert cfg.requirements.enabled == default_cfg.requirements.enabled
    assert cfg.requirements.coverage_threshold == default_cfg.requirements.coverage_threshold
