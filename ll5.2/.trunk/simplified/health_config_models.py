"""
Health Config Models - 健康检查配置模型

=== SKILL COMPLIANCE DECLARATION ===
Task: REQUIREMENT-COVERAGE-TRACKING (Task 1.5)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: All classes inherit from BaseModel

Rule: PYDANTIC-002 (Optional 字段必须显式指定默认值)
  - Evidence: All fields have explicit defaults

Rule: PYDANTIC-004 (使用 ConfigDict 替代 class Config)
  - Evidence: `model_config = ConfigDict(extra="ignore")`

Rule: DEF-002 (防止除零错误)
  - Evidence: load_health_config() handles missing file gracefully
===================================

架构原则遵循：
- File-as-Boundary: health_config.yml 是健康策略的唯一归属
- Config-as-Policy: 阈值/开关在 YAML，行为在 Python
- Schema-First: YAML → Pydantic → 内部使用
- Safe to Remove: 配置缺失时返回默认值
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import yaml
from pydantic import BaseModel, ConfigDict, Field

logger = logging.getLogger(__name__)


# =============================================================================
# Policy Models
# =============================================================================


class RequirementsPolicy(BaseModel):
    """需求层策略"""
    
    enabled: bool = Field(
        default=True,
        description="是否启用需求层统计（关闭时完全跳过计算和加载）",
    )
    coverage_threshold: float = Field(
        default=10.0,
        ge=0.0,
        le=100.0,
        description="需求覆盖率阈值（百分比），低于此值时标记为 warning",
    )
    # V1: exit_on_failure（兼容字段），V2: exit_on_under_coverage/exit_on_traceability_issues
    exit_on_failure: bool = Field(
        default=False,
        description="兼容字段：覆盖率低于阈值时是否 exit 1（已被 exit_on_under_coverage 替代）",
    )
    exit_on_under_coverage: bool = Field(
        default=False,
        description="覆盖率低于阈值时是否将健康检查视为失败（用于 CI gate）",
    )
    exit_on_traceability_issues: bool = Field(
        default=False,
        description="存在追踪问题（孤儿/悬空引用）时是否将健康检查视为失败",
    )
    high_risk_gate_enabled: bool = Field(
        default=False,
        description="是否对高风险 REQ 开启强 gate（V2 预留）",
    )
    
    model_config = ConfigDict(extra="ignore")


class TraceabilityPolicy(BaseModel):
    """追踪策略"""
    
    enabled: bool = Field(
        default=True,
        description="是否启用追踪完整性检查",
    )
    warn_on_missing_backlinks: bool = Field(
        default=True,
        description="是否在缺失反向链接时打印 warning（当前设计无双向指针，保留字段）",
    )
    warn_on_orphans: bool = Field(
        default=True,
        description="是否在存在孤儿引用时打印 warning",
    )
    warn_on_dangling: bool = Field(
        default=True,
        description="是否在存在悬空引用时打印 warning",
    )
    
    model_config = ConfigDict(extra="ignore")


class RulesPolicy(BaseModel):
    """规则策略"""
    
    min_positive_cases: int = Field(
        default=1,
        ge=0,
        description="每条规则最少正例数",
    )
    min_negative_cases: int = Field(
        default=1,
        ge=0,
        description="每条规则最少反例数",
    )
    
    model_config = ConfigDict(extra="ignore")


class OutputPolicy(BaseModel):
    """输出策略"""
    
    show_requirement_layer: bool = Field(
        default=True,
        description="是否显示需求层统计",
    )
    show_traceability_details: bool = Field(
        default=True,
        description="是否显示追踪详情",
    )
    
    model_config = ConfigDict(extra="ignore")


# =============================================================================
# Main Config Model
# =============================================================================


class HealthConfig(BaseModel):
    """
    健康检查配置（策略层）
    
    对应 health_config.yml 文件。
    所有字段都有默认值，确保配置缺失时优雅降级。
    """
    
    version: int = Field(
        default=1,
        ge=1,
        description="配置版本号",
    )
    requirements: RequirementsPolicy = Field(
        default_factory=RequirementsPolicy,
        description="需求层策略",
    )
    traceability: TraceabilityPolicy = Field(
        default_factory=TraceabilityPolicy,
        description="追踪策略",
    )
    rules: RulesPolicy = Field(
        default_factory=RulesPolicy,
        description="规则策略",
    )
    output: OutputPolicy = Field(
        default_factory=OutputPolicy,
        description="输出策略",
    )
    
    # extra="ignore" 允许 YAML 中有未知字段，不报错
    model_config = ConfigDict(extra="ignore")


# =============================================================================
# Loader Function
# =============================================================================


def load_health_config(config_path: Path | None = None) -> HealthConfig:
    """
    加载健康检查配置
    
    Args:
        config_path: 配置文件路径，默认为 health_check.py 同级的 health_config.yml
        
    Returns:
        HealthConfig: 配置对象
        
    Note:
        - 配置文件不存在时返回默认配置（优雅降级）
        - YAML 解析错误时返回默认配置并记录 warning
        - 使用 pathlib.Path 而非字符串拼接
    """
    if config_path is None:
        # 默认路径：与此文件同级的 health_config.yml
        config_path = Path(__file__).parent / "health_config.yml"
    
    # 优雅降级：配置文件不存在时返回默认值
    if not config_path.exists():
        logger.info(f"Config not found at {config_path}, using defaults")
        return HealthConfig()
    
    try:
        raw_data: dict[str, Any] = yaml.safe_load(config_path.read_text(encoding="utf-8"))
        
        # 空文件或无效 YAML 返回默认值
        if raw_data is None:
            logger.warning(f"Empty config file at {config_path}, using defaults")
            return HealthConfig()
        
        return HealthConfig.model_validate(raw_data)
        
    except yaml.YAMLError as e:
        logger.warning(f"YAML parse error in {config_path}: {e}, using defaults")
        return HealthConfig()
    except Exception as e:
        logger.warning(f"Error loading config from {config_path}: {e}, using defaults")
        return HealthConfig()


# =============================================================================
# Convenience Functions
# =============================================================================


def get_default_config() -> HealthConfig:
    """获取默认配置（用于测试）"""
    return HealthConfig()
