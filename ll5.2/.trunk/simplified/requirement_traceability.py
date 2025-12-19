"""
Requirement Traceability - 需求追踪完整性检查

=== SKILL COMPLIANCE DECLARATION ===
Task: REQUIREMENT-COVERAGE-TRACKING (Stage 3 - Traceability)
Scope: 检查 Rule.requirement_ids → Requirement.id 的引用完整性

Architecture Principles:
- Single Responsibility: 只做追踪检查，不做覆盖统计
- Reuse First: 复用 Requirement / Rule 模型，不新建
- Safe to Call: 纯函数，无副作用，便于测试

Requirements Mapping:
- 3.1 Orphan reference detection (REQ 存在但未被引用)
- 3.3 Dangling reference detection (Rule 引用不存在的 REQ)
- 3.4 Report traceability violations
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List

from .models import Rule
from .requirement_models import Requirement


@dataclass
class TraceabilityResult:
    """
    追踪完整性检查结果。

    Attributes:
        orphan_requirements: REQ 文件存在，但没有任何 Rule.requirement_ids 指向它
        dangling_rule_refs: Rule.requirement_ids 指向了不存在的 REQ ID
                           格式: {rule_id: [missing_req_id, ...]}
    """

    orphan_requirements: List[str] = field(default_factory=list)
    dangling_rule_refs: Dict[str, List[str]] = field(default_factory=dict)

    @property
    def has_issues(self) -> bool:
        """是否存在追踪问题"""
        return bool(self.orphan_requirements) or bool(self.dangling_rule_refs)

    @property
    def orphan_count(self) -> int:
        """孤儿 REQ 数量"""
        return len(self.orphan_requirements)

    @property
    def dangling_count(self) -> int:
        """悬空引用总数"""
        return sum(len(refs) for refs in self.dangling_rule_refs.values())

    def to_dict(self) -> Dict:
        """转换为字典（用于 JSON 输出）"""
        return {
            "orphan_requirements": self.orphan_requirements,
            "dangling_rule_refs": self.dangling_rule_refs,
            "orphan_count": self.orphan_count,
            "dangling_count": self.dangling_count,
            "has_issues": self.has_issues,
        }


def check_traceability(
    requirements: Dict[str, Requirement],
    rules: List[Rule],
) -> TraceabilityResult:
    """
    检查 Rule.requirement_ids → Requirement.id 的引用完整性。

    检测两类问题：
    1. orphan_requirements: REQ 存在但没有任何 Rule 引用它（需求无人实现）
    2. dangling_rule_refs: Rule 引用了不存在的 REQ（需求已删除，规则未清理）

    Args:
        requirements: req_id -> Requirement 映射
        rules: 规则列表（包含 requirement_ids 字段）

    Returns:
        TraceabilityResult: 追踪检查结果

    Note:
        - 纯函数，无副作用
        - 空 requirements 或空 rules 时返回空结果（不报错）
        - 不检测 missing_backlink（当前设计无双向指针）
        - deprecated 状态的 REQ 不参与 orphan 检测（故意孤儿）
    """
    from .requirement_models import RequirementStatus

    req_ids = set(requirements.keys())

    # 过滤出 active 状态的 REQ（deprecated 不参与 orphan 检测）
    active_req_ids = {
        req_id
        for req_id, req in requirements.items()
        if req.status == RequirementStatus.ACTIVE
    }

    # 被规则引用的 REQ 集合
    referenced_reqs: set[str] = set()

    # 悬空引用：Rule 指向不存在的 REQ
    dangling: Dict[str, List[str]] = {}

    for rule in rules:
        rule_req_ids = getattr(rule, "requirement_ids", []) or []
        for req_id in rule_req_ids:
            if req_id not in req_ids:
                # 悬空引用
                dangling.setdefault(rule.id, []).append(req_id)
            else:
                # 有效引用
                referenced_reqs.add(req_id)

    # 孤儿 REQ：active 状态且未被任何 Rule 引用
    orphan = [req_id for req_id in active_req_ids if req_id not in referenced_reqs]

    return TraceabilityResult(
        orphan_requirements=sorted(orphan),
        dangling_rule_refs=dangling,
    )
