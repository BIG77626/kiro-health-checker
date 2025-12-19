"""
Requirement Coverage - 需求覆盖统计接口（骨架）

=== SKILL COMPLIANCE DECLARATION ===
Task: REQUIREMENT-COVERAGE-TRACKING (Task 8.x, 9.x, 11.x)
Scope: 提供需求覆盖统计的数据模型与函数签名，不实现具体逻辑

Architecture Principles:
- Single Responsibility: 与 CLI/输出解耦，只负责「算清楚数字」
- Reuse First: 复用 RequirementLoader / Rule 模型 / RuleTestSummary，不重新发明轮子
- Safe to Call: 提供明确的输入输出契约，便于在 health_check 中集成与单测

Requirements Mapping:
- 8.1 RequirementCoverageResult model
- 8.2 check_requirement_coverage()
- 8.3 Property test hooks (待在 tests/ 中实现)
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Protocol

from pydantic import BaseModel, Field

from .models import RiskLevel, Rule
from .requirement_models import Requirement


class RuleTestSummaryLike(Protocol):
    """
    最小 RuleTestSummary 接口抽象，用于解耦依赖。

    这样 requirement_coverage 不需要直接导入 RuleTestRunner，
    只依赖于我们真正需要的统计字段，保持边界清晰。
    """

    total_rules: int
    rules_with_tests: int
    coverage_percentage: float
    passed_rules: int
    failed_rules: int
    missing_tests: List[str]
    invalid_tests: List[str]


class RequirementStat(BaseModel):
    """
    单个需求的覆盖详情，用于 --verbose / JSON 输出。
    """

    requirement_id: str
    risk_level: RiskLevel
    has_rules: bool
    has_samples: bool
    tests_passed: bool
    rule_ids: List[str] = Field(default_factory=list)
    tags: List[str] = Field(default_factory=list)
    extra: Dict[str, Any] = Field(default_factory=dict)


class RequirementCoverageResult(BaseModel):
    """
    需求覆盖统计结果模型 (Task 8.1)

    注意：这里只定义结构，不实现计算逻辑，便于在 Stage 2 中逐步填充。
    """

    total_requirements: int = 0
    requirements_with_rules: int = 0
    requirements_with_samples: int = 0
    coverage_percentage: float = 0.0
    # 完全覆盖：有规则、有样本且测试通过的 REQ 数量
    fully_covered: int = 0

    # 按风险等级分组统计
    by_risk_level: Dict[RiskLevel, Dict[str, Any]] = Field(default_factory=dict)

    # 每个需求的详细信息
    requirement_stats: List[RequirementStat] = Field(default_factory=list)


def check_requirement_coverage(
    requirements: Dict[str, Requirement],
    rule_summary: RuleTestSummaryLike,
    *,
    verbose: bool = False,
    rules: List[Rule],
) -> RequirementCoverageResult:
    """
    计算需求覆盖统计 (Task 8.2 实现)。

    设计目标：
    - 单次遍历构建 Rule → REQ 映射，避免 O(n^2) 嵌套
    - 将规则测试结果（rule_summary）与需求声明（requirements）做轻量关联
    - 输出结构适配 HealthCheckReport 的 JSON / 文本扩展

    Args:
        requirements: req_id -> Requirement 模型映射
        rule_summary: Rule 测试统计摘要（Protocol，解耦具体实现）
        verbose: 是否生成更详细的 requirement_stats
        rules: 当前激活的规则列表（包含 requirement_ids）

    Returns:
        RequirementCoverageResult: 需求覆盖统计结果
    """
    if not requirements:
        # 无需求时约定覆盖率为 100%，与 tasks.md 设计一致
        return RequirementCoverageResult(
            total_requirements=0,
            requirements_with_rules=0,
            requirements_with_samples=0,
            coverage_percentage=100.0,
            fully_covered=0,
            by_risk_level={},
            requirement_stats=[],
        )

    # 1. 构建 rule_id -> (has_samples, tests_passed) 索引
    # 判断「有样本」：rule_id 出现在 rule_summary.missing_tests 之外
    missing = set(rule_summary.missing_tests)
    invalid = set(rule_summary.invalid_tests)
    results_index: Dict[str, bool] = {}
    for r in getattr(rule_summary, "results", []):
        # 仅记录有效测试结果
        if hasattr(r, "rule_id") and hasattr(r, "passed"):
            results_index[r.rule_id] = bool(r.passed)

    def _has_samples(rule_id: str) -> bool:
        # 有测试文件且不是 invalid，即视为「有样本」
        if rule_id in missing:
            return False
        if rule_id in invalid:
            return False
        return True

    # 2. 构建 REQ -> 关联规则列表
    rules_by_req: Dict[str, List[str]] = {}
    for rule in rules:
        for req_id in getattr(rule, "requirement_ids", []):
            if req_id not in requirements:
                # 悬空引用在 traceability 阶段处理，这里只做轻量关联
                continue
            rules_by_req.setdefault(req_id, []).append(rule.id)

    # 3. 统计覆盖数据
    total_requirements = len(requirements)
    requirements_with_rules = 0
    requirements_with_samples = 0
    fully_covered = 0

    by_risk_level: Dict[RiskLevel, Dict[str, Any]] = {}
    requirement_stats: List[RequirementStat] = []

    for req_id, req in requirements.items():
        linked_rules = rules_by_req.get(req_id, [])
        has_rules = len(linked_rules) > 0

        # has_samples: 至少有一条关联规则拥有样本
        has_samples = any(_has_samples(rid) for rid in linked_rules)

        # tests_passed: 所有关联规则的测试都通过，且有样本
        if has_samples and linked_rules:
            all_passed = all(results_index.get(rid, False) for rid in linked_rules)
        else:
            all_passed = False

        if has_rules:
            requirements_with_rules += 1
        if has_samples:
            requirements_with_samples += 1

        # 风险等级统计初始化
        rl = req.risk_level
        if rl not in by_risk_level:
            by_risk_level[rl] = {
                "total": 0,
                "with_rules": 0,
                "with_samples": 0,
            }
        by_risk_level[rl]["total"] += 1
        if has_rules:
            by_risk_level[rl]["with_rules"] += 1
        if has_samples:
            by_risk_level[rl]["with_samples"] += 1

        if has_rules and has_samples and all_passed:
            fully_covered += 1

        if verbose:
            requirement_stats.append(
                RequirementStat(
                    requirement_id=req_id,
                    risk_level=req.risk_level,
                    has_rules=has_rules,
                    has_samples=has_samples,
                    tests_passed=all_passed,
                    rule_ids=linked_rules,
                    tags=getattr(req, "tags", []),
                )
            )

    coverage_percentage = (
        (requirements_with_samples / total_requirements) * 100.0
        if total_requirements > 0
        else 100.0
    )

    return RequirementCoverageResult(
        total_requirements=total_requirements,
        requirements_with_rules=requirements_with_rules,
        requirements_with_samples=requirements_with_samples,
        coverage_percentage=coverage_percentage,
        fully_covered=fully_covered,
        by_risk_level=by_risk_level,
        requirement_stats=requirement_stats,
    )


