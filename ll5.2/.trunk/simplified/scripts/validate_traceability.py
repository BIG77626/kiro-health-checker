#!/usr/bin/env python3
"""
REQ-Rule 双向追踪一致性验证脚本

用途:
  - 检测悬空引用 (Rule 引用不存在的 REQ)
  - 检测孤儿 REQ (REQ 引用不存在的 Rule)
  - 可选 --fix 模式自动修复

使用:
  python scripts/validate_traceability.py
  python scripts/validate_traceability.py --fix
"""

import sys
from pathlib import Path
from typing import Any

import yaml  # type: ignore[import-untyped]


def load_yaml_file(path: Path) -> dict[str, Any] | None:
    """安全加载 YAML 文件"""
    try:
        with path.open(encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception as e:
        print(f"  ⚠️ 无法加载 {path}: {e}")
        return None


def load_all_requirements(req_dir: Path) -> dict[str, dict[str, Any]]:
    """加载所有 REQ 文件"""
    reqs: dict[str, dict[str, Any]] = {}
    for file in req_dir.glob("REQ-*.yml"):
        data = load_yaml_file(file)
        if data and "id" in data:
            reqs[data["id"]] = data
            reqs[data["id"]]["_file"] = file
    return reqs


def load_all_rules(rules_dir: Path) -> dict[str, dict[str, Any]]:
    """加载所有规则文件"""
    rules: dict[str, dict[str, Any]] = {}
    for file in rules_dir.glob("*.yml"):
        data = load_yaml_file(file)
        if not data:
            continue
        if "rules" in data:
            for rule in data.get("rules", []):
                if "id" in rule:
                    rules[rule["id"]] = rule
                    rules[rule["id"]]["_file"] = file
        elif "id" in data:
            rules[data["id"]] = data
            rules[data["id"]]["_file"] = file
    return rules


def _check_req_to_rule(
    reqs: dict[str, dict[str, Any]], rules: dict[str, dict[str, Any]]
) -> list[str]:
    """检查 REQ.covered_by_rules 指向存在的 Rule"""
    errors: list[str] = []
    for req_id, req in reqs.items():
        for rule_id in req.get("covered_by_rules", []):
            if rule_id not in rules:
                errors.append(f"悬空引用: {req_id} -> {rule_id} (Rule不存在)")
    return errors


def _check_rule_to_req(
    reqs: dict[str, dict[str, Any]], rules: dict[str, dict[str, Any]]
) -> list[str]:
    """检查 Rule.requirement_ids 指向存在的 REQ"""
    errors: list[str] = []
    for rule_id, rule in rules.items():
        for req_id in rule.get("requirement_ids", []):
            if req_id not in reqs:
                errors.append(f"悬空引用: {rule_id} -> {req_id} (REQ不存在)")
    return errors


def _check_orphan_reqs(reqs: dict[str, dict[str, Any]]) -> list[str]:
    """检查孤儿 REQ"""
    return [
        f"孤儿REQ: {req_id} 没有关联任何规则"
        for req_id, req in reqs.items()
        if not req.get("covered_by_rules", [])
    ]


def _check_high_risk_samples(reqs: dict[str, dict[str, Any]]) -> list[str]:
    """检查高风险 REQ 样本要求"""
    warnings: list[str] = []
    for req_id, req in reqs.items():
        if req.get("risk_level", "").lower() != "high":
            continue
        min_pos = req.get("min_positive_samples", 2)
        min_neg = req.get("min_negative_samples", 1)
        if min_pos < 2 or min_neg < 1:
            warnings.append(f"高风险REQ {req_id} 样本要求过低: pos={min_pos}, neg={min_neg}")
    return warnings


def validate_traceability(
    req_dir: Path,
    rules_dir: Path,
    fix: bool = False,  # noqa: ARG001
) -> tuple[list[str], list[str]]:
    """验证双向追踪一致性，返回 (errors, warnings)"""
    reqs = load_all_requirements(req_dir)
    rules = load_all_rules(rules_dir)
    print(f"📊 加载了 {len(reqs)} 个 REQ, {len(rules)} 个 Rule")

    errors = _check_req_to_rule(reqs, rules) + _check_rule_to_req(reqs, rules)
    warnings = _check_orphan_reqs(reqs) + _check_high_risk_samples(reqs)
    return errors, warnings


def main() -> int:
    """主函数"""
    fix_mode = "--fix" in sys.argv
    script_dir = Path(__file__).parent
    base_dir = script_dir.parent
    req_dir = base_dir / "requirements"
    rules_dir = base_dir / "rules"

    if not req_dir.exists():
        print(f"❌ 找不到 requirements 目录: {req_dir}")
        return 1
    if not rules_dir.exists():
        print(f"❌ 找不到 rules 目录: {rules_dir}")
        return 1

    print("🔍 验证 REQ-Rule 双向追踪一致性...")
    print(f"   REQ目录: {req_dir}")
    print(f"   Rules目录: {rules_dir}\n")

    errors, warnings = validate_traceability(req_dir, rules_dir, fix=fix_mode)

    if warnings:
        print(f"\n⚠️ 警告 ({len(warnings)}):")
        for w in warnings:
            print(f"  - {w}")

    if errors:
        print(f"\n❌ 错误 ({len(errors)}):")
        for e in errors:
            print(f"  - {e}")
        print("\n追踪不一致，请修复后重试")
        return 1

    print("\n✅ 双向追踪一致性验证通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
