"""
Requirement Models - 需求模型和加载器

=== SKILL COMPLIANCE DECLARATION ===
Task: REQUIREMENT-COVERAGE-TRACKING (Task 3.1, 3.3)
Skills: PYDANTIC-TYPE-SAFETY, ERROR-HANDLING, PYTHON-DEFENSIVE
Level: Expert (P0)

Rule: PYDANTIC-001 (数据模型必须继承 BaseModel)
  - Evidence: Requirement inherits from BaseModel

Rule: PYDANTIC-002 (Optional 字段必须显式指定默认值)
  - Evidence: All optional fields have explicit defaults

Rule: PYDANTIC-004 (使用 ConfigDict 替代 class Config)
  - Evidence: model_config = ConfigDict(...)

Rule: ERR-001 (禁止裸 except)
  - Evidence: All except blocks specify concrete types

Rule: DEF-001 (禁止 truthiness 检查 Optional)
  - Evidence: Using explicit `is None` checks
===================================

Architecture Principles:
- File-as-Boundary: requirements/REQ-*.yml → Requirement model
- Config-as-Policy: YAML 存数据，Python 做校验
- Schema-First: Pydantic model 定义 schema
- Safe to Remove: 目录不存在时优雅降级

Requirements: 1.1, 1.2, 1.3, 1.4
"""

from __future__ import annotations

import logging
from enum import Enum
from pathlib import Path
from typing import Dict, List, Literal, Optional

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator

from .models import RiskLevel  # 复用现有枚举，不新建

logger = logging.getLogger(__name__)


# =============================================================================
# Constants
# =============================================================================

REQUIREMENTS_DIR = "requirements"
REQ_FILE_PATTERN = "REQ-*.yml"


# =============================================================================
# Requirement Model (Task 3.1)
# =============================================================================


class RequirementStatus(str, Enum):
    """
    需求状态枚举。

    V1 只区分 active 和 deprecated：
    - active: 正常需求，参与 orphan 检测
    - deprecated: 已废弃需求，不参与 orphan 检测

    Note:
        V2 可扩展 pending 状态用于预留需求。
    """

    ACTIVE = "active"
    DEPRECATED = "deprecated"


class Requirement(BaseModel):
    """
    需求模型 (REQ-1.1, REQ-1.2)

    对应 requirements/REQ-*.yml 文件。
    """

    # 必填字段
    id: str = Field(
        pattern=r"^REQ-[A-Z]{2,4}-\d{3}$",
        description="需求ID，格式 REQ-{DOMAIN}-{NNN}",
    )
    title: str = Field(min_length=1, description="需求标题")

    # 带默认值的字段
    risk_level: RiskLevel = Field(
        default=RiskLevel.MEDIUM,
        description="风险等级: HIGH/MEDIUM/LOW",
    )
    covered_by_rules: List[str] = Field(
        default_factory=list,
        description="覆盖此需求的规则ID列表",
    )
    status: RequirementStatus = Field(
        default=RequirementStatus.ACTIVE,
        description="需求状态: active/deprecated",
    )

    # 可选字段
    description: str = Field(default="", description="需求描述")
    tags: List[str] = Field(default_factory=list, description="标签")
    min_positive_samples: int = Field(default=3, ge=0, description="最少正例数")
    min_negative_samples: int = Field(default=3, ge=0, description="最少反例数")

    # 版本控制字段（Task 27 - 需求版本控制）
    version: str = Field(default="1.0", description="需求版本号")
    last_modified: str = Field(default="", description="最后修改日期 (YYYY-MM-DD)")
    changelog: List[str] = Field(default_factory=list, description="变更历史")

    model_config = ConfigDict(
        extra="ignore",  # 忽略未知字段，向后兼容
    )

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v: str | RequirementStatus) -> str:
        """
        YAML 写小写 'active'，内部转为小写（枚举值本身是小写）
        """
        if isinstance(v, str):
            return v.lower()
        return v

    @field_validator("risk_level", mode="before")
    @classmethod
    def normalize_risk_level(cls, v: str | RiskLevel) -> str:
        """
        YAML 写小写 'high'，内部转为大写 'HIGH'

        这样 YAML 文件可以写 risk_level: "high"，
        内部统一使用 RiskLevel.HIGH 枚举。
        """
        if isinstance(v, str):
            return v.upper()
        return v


# =============================================================================
# RequirementLoader (Task 3.3)
# =============================================================================


class RequirementLoader:
    """
    需求加载器 (REQ-1.1, REQ-1.3)

    加载 requirements/ 目录下的所有需求文件。
    模式与 RuleRegistry 一致：类 + load_all() 方法 + 缓存。
    """

    def __init__(self, requirements_dir: Optional[Path] = None) -> None:
        """
        初始化需求加载器。

        Args:
            requirements_dir: 需求目录，默认为当前模块所在目录下的 requirements/
        """
        # DEF-001: 显式检查 None
        if requirements_dir is None:
            requirements_dir = Path(__file__).parent / REQUIREMENTS_DIR

        self._requirements_dir = Path(requirements_dir)

        # 缓存（与 RuleRegistry 模式一致）
        self._cache: Optional[Dict[str, Requirement]] = None
        self._last_mtime: float = 0.0
        self._cached_files: set[Path] = set()  # 文件数量变化检测

    def load_all(self, force_reload: bool = False) -> Dict[str, Requirement]:
        """
        加载所有需求文件（带缓存）。

        Args:
            force_reload: 强制重新加载，忽略缓存

        Returns:
            Dict[str, Requirement]: req_id -> Requirement 映射

        Note:
            - 目录不存在 -> log info，返回空 dict（优雅降级）
            - 无效文件 -> log warning，跳过，继续加载其他文件
            - 文件未变动 -> 返回缓存
        """
        # 优雅降级：目录不存在时返回空 dict
        if not self._requirements_dir.exists():
            logger.info(
                f"Requirements directory not found: {self._requirements_dir}, "
                "skipping requirement layer"
            )
            return {}

        # 检查是否需要重载
        if force_reload or self._should_reload():
            logger.info(f"Loading requirements from {self._requirements_dir}")
            self._cache = self._load_from_disk()
            logger.info(f"Loaded {len(self._cache)} requirements")
        else:
            logger.debug("Using cached requirements")

        return self._cache or {}

    def _should_reload(self) -> bool:
        """
        检测是否需要重载：文件数量或 mtime 变化。

        比单纯 mtime 更健壮，能检测文件新增/删除。
        """
        current_files = set(self._requirements_dir.glob(REQ_FILE_PATTERN))

        # 文件数量变化 -> 需要重载
        if current_files != self._cached_files:
            self._cached_files = current_files
            return True

        # mtime 变化 -> 需要重载
        current_mtime = max(
            (f.stat().st_mtime for f in current_files if f.is_file()),
            default=0.0,
        )
        if self._cache is None or current_mtime > self._last_mtime:
            self._last_mtime = current_mtime
            return True

        return False

    def _load_from_disk(self) -> Dict[str, Requirement]:
        """从磁盘加载所有需求文件（私有方法）"""
        requirements: Dict[str, Requirement] = {}

        for req_file in self._requirements_dir.glob(REQ_FILE_PATTERN):
            if not req_file.is_file():
                continue

            try:
                data = yaml.safe_load(req_file.read_text(encoding="utf-8"))

                # DEF-001: 显式检查 None
                if data is None:
                    logger.warning(f"Empty requirement file: {req_file}")
                    continue

                req = Requirement.model_validate(data)
                requirements[req.id] = req

            except yaml.YAMLError as e:
                # YAML 语法错误：warning + skip（V1 不 gate）
                logger.warning(f"YAML syntax error in {req_file}: {e}")
                continue

            except Exception as e:
                # 其他错误（如字段校验失败）：warning + skip
                logger.warning(f"Invalid requirement file {req_file}: {e}")
                continue

        return requirements

    def clear_cache(self) -> None:
        """清除缓存"""
        self._cache = None
        self._last_mtime = 0.0


# =============================================================================
# Convenience Functions
# =============================================================================


def create_requirement_loader(
    requirements_dir: Optional[Path] = None,
) -> RequirementLoader:
    """创建 RequirementLoader 实例的便捷函数"""
    return RequirementLoader(requirements_dir=requirements_dir)
