#!/usr/bin/env python3
"""
Rule Test Health Check Report Script

Task: 11.3 - Create simple health_check.py report script
Requirements: 2.3

功能：
- 输出规则测试覆盖率
- 输出各规则的样本数统计
- 仅做报告，不阻断 CI（始终返回 exit code 0）

输入依赖：
- RuleRegistry（规则总数和列表）
- RuleTestRunner.run_all_tests()（RuleTestSummary）
- rule_tests/config.yml（coverage_threshold、high_priority_rules）

输出格式：
- 默认：人类可读的表格/文本
- --json：机器可读的 JSON 格式

日志级别：
- 默认：info
- --quiet：仅输出结果
- --verbose：详细调试信息

架构设计（可测试性）：
- 核心逻辑在 run_health_check() 函数中，返回 HealthCheckReport 数据结构
- main() 只负责 CLI 参数解析和输出格式化
- 支持依赖注入（rule_tests_root 参数）便于测试
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable

# 添加父目录到 Python 路径
script_dir = Path(__file__).parent
sys.path.insert(0, str(script_dir.parent))

logger = logging.getLogger(__name__)


def _load_health_config_with_fallback():
    """
    加载 HealthConfig，兼容旧的 rule_tests/config.yml 配置。

    迁移策略：
    - 优先使用 health_config.yml 中的 requirements/rules 策略
    - 若存在 rule_tests/config.yml 中的 legacy 字段，则：
      - 覆盖率阈值：仅当 HealthConfig.rules/requirements 未显式配置时作为兜底
      - 打 warning，提示迁移到 health_config.yml
    """
    from simplified.health_config_models import HealthConfig, load_health_config
    from simplified.rule_test_runner import RuleTestRunner

    cfg = load_health_config()

    # 兼容旧的 rule_tests/config.yml（仅作为兜底，不作为权威来源）
    try:
        runner = RuleTestRunner()
        legacy_config = runner._load_config()
    except Exception:
        legacy_config = {}

    legacy_threshold = legacy_config.get("coverage_threshold")
    if legacy_threshold is not None:
        # 如果 HealthConfig 中未显式设置覆盖阈值，则使用旧值兜底
        if cfg.rules.min_positive_cases == 1 and cfg.rules.min_negative_cases == 1:
            # 仅在使用默认配置时发出迁移提示，避免覆盖显式配置
            logger.warning(
                "Detected legacy coverage_threshold in rule_tests/config.yml; "
                "please migrate to health_config.yml (requirements.coverage_threshold)."
            )
        # 覆盖率阈值作为兜底，仅在 requirements.coverage_threshold 为默认值时使用
        if cfg.requirements.coverage_threshold == 10.0:
            cfg.requirements.coverage_threshold = float(legacy_threshold)

    return cfg


@dataclass
class RuleSampleStats:
    """单个规则的样本统计"""
    rule_id: str
    has_test_file: bool
    positive_count: int = 0
    negative_count: int = 0
    test_passed: bool = False
    
    @property
    def total_samples(self) -> int:
        return self.positive_count + self.negative_count


@dataclass
class HealthCheckReport:
    """健康检查报告"""
    # 元数据
    schema_version: str = "v1.0"  # 外部工具可依赖的稳定契约版本
    generated_at: str = ""
    ruleset_source: str = "RuleRegistry (rules/*.yml)"
    coverage_scope: str = "有专门测试文件的规则，排除 DEPRECATED"
    
    # 规则统计
    total_rules: int = 0
    rules_with_tests: int = 0
    coverage_percentage: float = 0.0
    coverage_threshold: float = 20.0
    coverage_meets_threshold: bool = False
    
    # 测试结果
    passed_rules: int = 0
    failed_rules: int = 0
    
    # 详细列表
    missing_tests: List[str] = field(default_factory=list)
    invalid_tests: List[str] = field(default_factory=list)
    rules_with_test_files: List[str] = field(default_factory=list)
    
    # 高优先级规则覆盖
    high_priority_rules: List[str] = field(default_factory=list)
    high_priority_covered: List[str] = field(default_factory=list)
    high_priority_missing: List[str] = field(default_factory=list)
    
    # 样本统计
    sample_stats: List[Dict[str, Any]] = field(default_factory=list)

    # 需求覆盖统计（可选，V1 仅用于报告，不 gate CI）
    requirement_coverage: Optional[Dict[str, Any]] = None

    # 追踪完整性检查（Stage 3 新增）
    traceability: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典（用于 JSON 输出）"""
        return asdict(self)


def run_health_check(
    rule_tests_root: Optional[Path] = None,
    verbose: bool = False,
) -> HealthCheckReport:
    """
    生成健康检查报告（核心逻辑，可测试）
    
    这是 health_check.py 的核心函数，将所有逻辑封装为可测试的纯函数。
    main() 只负责 CLI 参数解析和输出格式化。
    
    Args:
        rule_tests_root: 规则测试目录（可选，默认使用 rule_tests/）
        verbose: 是否输出详细日志
        
    Returns:
        HealthCheckReport: 报告数据
    """
    from simplified.rule_test_runner import RuleTestRunner
    from simplified.rule_registry import RuleRegistry
    from simplified.requirement_models import RequirementLoader
    from simplified.requirement_coverage import (
        check_requirement_coverage,
        RequirementCoverageResult,
    )

    # 0. 加载健康检查配置（统一策略入口）
    cfg = _load_health_config_with_fallback()
    
    # 1. 加载规则
    registry = RuleRegistry()
    all_rules = registry.get_all_rules()
    
    if verbose:
        logger.info(f"Loaded {len(all_rules)} rules from RuleRegistry")
    
    # 2. 创建测试运行器并加载 legacy 配置（仅用于高优先级规则等非策略型信息）
    runner = RuleTestRunner(tests_dir=rule_tests_root)
    legacy_config = runner._load_config()
    # 覆盖率阈值统一使用 HealthConfig.requirements.coverage_threshold
    coverage_threshold = cfg.requirements.coverage_threshold
    high_priority_rules = legacy_config.get("high_priority_rules", [])
    
    if verbose:
        logger.info(f"Coverage threshold: {coverage_threshold}%")
        logger.info(f"High priority rules: {high_priority_rules}")
    
    # 3. 加载测试用例
    test_cases = runner.load_test_cases()
    
    if verbose:
        logger.info(f"Loaded {len(test_cases)} test files")
    
    # 4. 运行测试（排除 DEPRECATED）
    summary = runner.run_all_tests(all_rules, exclude_deprecated=True)
    
    # 5. 计算高优先级规则覆盖
    high_priority_covered = [
        rule_id for rule_id in high_priority_rules
        if rule_id in test_cases
    ]
    high_priority_missing = [
        rule_id for rule_id in high_priority_rules
        if rule_id not in test_cases
    ]
    
    # 6. 收集样本统计
    sample_stats: List[Dict[str, Any]] = []
    for rule_id, test_case in sorted(test_cases.items()):
        stats = RuleSampleStats(
            rule_id=rule_id,
            has_test_file=True,
            positive_count=len(test_case.positive_cases),
            negative_count=len(test_case.negative_cases),
        )
        # 查找测试结果
        for result in summary.results:
            if result.rule_id == rule_id:
                stats.test_passed = result.passed
                break
        sample_stats.append(asdict(stats))
    
    # 7. 需求覆盖统计（可选，可完全关闭计算）
    requirement_coverage_dict: Optional[Dict[str, Any]] = None
    traceability_dict: Optional[Dict[str, Any]] = None
    
    if cfg.requirements.enabled and cfg.output.show_requirement_layer:
        # 使用 RequirementLoader 加载需求，并调用 requirement_coverage 计算统计结果
        req_loader = RequirementLoader()
        requirements = req_loader.load_all()
        if requirements:
            try:
                req_cov: RequirementCoverageResult = check_requirement_coverage(
                    requirements=requirements,
                    rule_summary=summary,
                    verbose=verbose,
                    rules=all_rules,
                )
                requirement_coverage_dict = req_cov.model_dump()
            except NotImplementedError:
                # 在实现尚未完全就绪时，优雅降级为不输出需求层
                if verbose:
                    logger.info("Requirement coverage not implemented yet, skipping.")
                requirement_coverage_dict = None

            # 8. 追踪完整性检查（Stage 3 新增）
            if cfg.traceability.enabled:
                from simplified.requirement_traceability import check_traceability
                
                trace_result = check_traceability(
                    requirements=requirements,
                    rules=all_rules,
                )
                traceability_dict = trace_result.to_dict()
                
                # 根据配置打印 warning
                if trace_result.has_issues:
                    if cfg.traceability.warn_on_orphans and trace_result.orphan_requirements:
                        logger.warning(
                            f"Orphan requirements (not referenced by any rule): "
                            f"{trace_result.orphan_requirements}"
                        )
                    if cfg.traceability.warn_on_dangling and trace_result.dangling_rule_refs:
                        for rule_id, missing_reqs in trace_result.dangling_rule_refs.items():
                            logger.warning(
                                f"Dangling reference: {rule_id} -> {missing_reqs} (REQ not found)"
                            )

    # 9. 构建报告
    coverage = summary.coverage_percentage or 0.0
    report = HealthCheckReport(
        generated_at=datetime.now().isoformat(),
        total_rules=summary.total_rules,
        rules_with_tests=summary.rules_with_tests,
        coverage_percentage=coverage,
        coverage_threshold=coverage_threshold,
        coverage_meets_threshold=coverage >= coverage_threshold,
        passed_rules=summary.passed_rules,
        failed_rules=summary.failed_rules,
        missing_tests=summary.missing_tests[:20],  # 限制前 20 条
        invalid_tests=summary.invalid_tests,
        rules_with_test_files=sorted(test_cases.keys()),
        high_priority_rules=high_priority_rules,
        high_priority_covered=high_priority_covered,
        high_priority_missing=high_priority_missing,
        sample_stats=sample_stats,
        requirement_coverage=requirement_coverage_dict,
        traceability=traceability_dict,
    )
    
    return report


# 保持向后兼容的别名
generate_health_report = run_health_check


MAX_HIGH_RISK_DISPLAY = 5  # 默认模式下最多显示的高风险未覆盖 REQ 数量


def _get_high_risk_uncovered(req_cov: Dict[str, Any]) -> List[str]:
    """从 requirement_coverage 中提取高风险未覆盖的 REQ ID 列表。"""
    result: List[str] = []
    req_stats = req_cov.get("requirement_stats", [])
    for stat in req_stats:
        risk_level = stat.get("risk_level", "")
        has_rules = stat.get("has_rules", False)
        has_samples = stat.get("has_samples", False)
        tests_passed = stat.get("tests_passed", False)
        req_id = stat.get("requirement_id", "") or stat.get("req_id", "")
        # 高风险且非“完全覆盖”（缺规则 / 缺样本 / 测试未通过）
        is_high_risk = str(risk_level).upper().endswith("HIGH")
        fully_covered = has_rules and has_samples and tests_passed
        if is_high_risk and not fully_covered and req_id:
            result.append(req_id)
    return result


def _print_requirement_layer(req_cov: Dict[str, Any], quiet: bool, verbose: bool) -> None:
    """打印需求层统计。"""
    print("-" * 60)
    print("[需求层] Requirement Coverage")
    print("-" * 60)
    total = req_cov.get("total_requirements", 0)
    with_rules = req_cov.get("requirements_with_rules", 0)
    with_samples = req_cov.get("requirements_with_samples", 0)
    coverage_pct = req_cov.get("coverage_percentage", 0.0)
    fully_covered = req_cov.get("fully_covered", 0)
    print(
        f"  总数: {total} / 有规则: {with_rules} / 有样本: {with_samples} / 完全覆盖: {fully_covered}"
    )
    print(f"  覆盖率: {coverage_pct:.1f}%")

    # 默认仅输出摘要，高风险详情放在 verbose 模式下
    high_risk_uncovered = _get_high_risk_uncovered(req_cov)
    if not quiet and high_risk_uncovered:
        print()
        print(
            f"  [HIGH-RISK] 未完全覆盖的高风险需求: {len(high_risk_uncovered)} 个"
        )
        if verbose:
            display_count = min(len(high_risk_uncovered), MAX_HIGH_RISK_DISPLAY)
            for req_id in high_risk_uncovered[:display_count]:
                print(f"    - {req_id}")
            if len(high_risk_uncovered) > MAX_HIGH_RISK_DISPLAY:
                print(
                    f"    ... 还有 {len(high_risk_uncovered) - MAX_HIGH_RISK_DISPLAY} 条"
                )
    print()


def _print_traceability_layer(trace: Dict[str, Any], quiet: bool, verbose: bool) -> None:
    """打印追踪完整性统计。"""
    print("-" * 60)
    print("[追踪] Traceability Check")
    print("-" * 60)
    orphan_count = trace.get("orphan_count", 0)
    dangling_count = trace.get("dangling_count", 0)
    has_issues = trace.get("has_issues", False)
    print(f"  孤儿需求 (无规则引用): {orphan_count}")
    print(f"  悬空引用 (规则指向不存在的 REQ): {dangling_count}")
    if has_issues:
        print("  状态: [WARNING] 存在追踪问题")
    else:
        print("  状态: [OK] 追踪完整")

    # 默认模式只看摘要，详细 ID 仅在 verbose 模式下输出
    if not quiet and has_issues and verbose:
        orphan_reqs = trace.get("orphan_requirements", [])
        dangling_refs = trace.get("dangling_rule_refs", {})
        if orphan_reqs:
            print()
            print("  孤儿需求列表:")
            display_count = min(len(orphan_reqs), MAX_HIGH_RISK_DISPLAY)
            for req_id in orphan_reqs[:display_count]:
                print(f"    - {req_id}")
        if dangling_refs:
            print()
            print("  悬空引用列表:")
            count = 0
            for rule_id, missing_reqs in dangling_refs.items():
                if count >= MAX_HIGH_RISK_DISPLAY:
                    break
                print(f"    - {rule_id} -> {missing_reqs}")
                count += 1
    print()


def _calculate_exit_code(report: HealthCheckReport, cfg: "HealthConfig") -> int:
    """
    根据报告与配置计算退出码。

    策略：
    - 默认返回 0（不 gate）
    - 当 requirements.exit_on_under_coverage=True 且 coverage_meets_threshold=False 时 -> 1
    - 当 requirements.exit_on_traceability_issues=True 且 traceability.enabled=True 且存在追踪问题时 -> 1
    - 兼容旧字段 exit_on_failure：等价于 exit_on_under_coverage
    """
    exit_code = 0

    # 兼容字段：exit_on_failure 视作 exit_on_under_coverage
    gate_under_coverage = (
        getattr(cfg.requirements, "exit_on_under_coverage", False)
        or getattr(cfg.requirements, "exit_on_failure", False)
    )
    if gate_under_coverage and not report.coverage_meets_threshold:
        exit_code = 1

    gate_traceability = getattr(
        cfg.requirements, "exit_on_traceability_issues", False
    ) and cfg.traceability.enabled
    if (
        gate_traceability
        and report.traceability
        and report.traceability.get("has_issues", False)
    ):
        exit_code = 1

    return exit_code

def print_text_report(
    report: HealthCheckReport,
    quiet: bool = False,
    verbose: bool = False,
    cfg: Any = None,
) -> None:
    """
    打印人类可读的文本报告
    
    Args:
        report: 健康检查报告
        quiet: 是否简洁模式
        verbose: 是否详细模式
        cfg: HealthConfig 配置对象（可选）
    """
    if cfg is None:
        from simplified.health_config_models import load_health_config
        cfg = load_health_config()
    
    print("=" * 60)
    print("Rule Test Health Check Report")
    print("=" * 60)
    print(f"Generated: {report.generated_at}")
    print(f"Source: {report.ruleset_source}")
    print(f"Scope: {report.coverage_scope}")
    print()
    
    # 覆盖率摘要
    print("-" * 60)
    print("Coverage Summary")
    print("-" * 60)
    print(f"  Total rules (active): {report.total_rules}")
    print(f"  Rules with tests: {report.rules_with_tests}")
    print(f"  Coverage: {report.coverage_percentage:.1f}%")
    print(f"  Threshold: {report.coverage_threshold:.1f}%")
    
    if report.coverage_meets_threshold:
        print(f"  Status: [OK] Coverage meets threshold")
    else:
        print(f"  Status: [WARNING] Coverage below threshold")
    print()
    
    # 测试结果
    print("-" * 60)
    print("Test Results")
    print("-" * 60)
    print(f"  Passed: {report.passed_rules}")
    print(f"  Failed: {report.failed_rules}")
    print(f"  Invalid: {len(report.invalid_tests)}")
    print()
    
    # 高优先级规则覆盖
    if report.high_priority_rules:
        print("-" * 60)
        print("High Priority Rules Coverage")
        print("-" * 60)
        hp_coverage = len(report.high_priority_covered) / len(report.high_priority_rules) * 100
        print(f"  Covered: {len(report.high_priority_covered)}/{len(report.high_priority_rules)} ({hp_coverage:.0f}%)")
        if report.high_priority_missing and not quiet:
            print(f"  Missing: {report.high_priority_missing}")
        print()
    
    # 有测试文件的规则（按类别分组）
    if not quiet:
        print("-" * 60)
        print("Rules with Test Files (by category)")
        print("-" * 60)
        
        # 按前缀分组
        by_category: Dict[str, List[str]] = {}
        for rule_id in report.rules_with_test_files:
            prefix = rule_id.split("-")[0]
            if prefix not in by_category:
                by_category[prefix] = []
            by_category[prefix].append(rule_id)
        
        for category in sorted(by_category.keys()):
            rules = by_category[category]
            print(f"  {category}: {', '.join(rules)}")
        print()
    
    # 样本统计
    if not quiet and report.sample_stats:
        print("-" * 60)
        print("Sample Statistics")
        print("-" * 60)
        print(f"  {'Rule ID':<12} {'Positive':>10} {'Negative':>10} {'Total':>8} {'Status':>8}")
        print(f"  {'-'*12} {'-'*10} {'-'*10} {'-'*8} {'-'*8}")
        for stats in report.sample_stats:
            status = "PASS" if stats["test_passed"] else "FAIL"
            total = stats["positive_count"] + stats["negative_count"]
            print(f"  {stats['rule_id']:<12} {stats['positive_count']:>10} {stats['negative_count']:>10} {total:>8} {status:>8}")
        print()
    
    # 缺失测试的规则
    if not quiet and report.missing_tests:
        print("-" * 60)
        print(f"Rules without Tests (showing first {len(report.missing_tests)})")
        print("-" * 60)
        for rule_id in report.missing_tests[:10]:
            print(f"  - {rule_id}")
        if len(report.missing_tests) > 10:
            print(f"  ... and {len(report.missing_tests) - 10} more")
        print()
    
    # 需求层统计（Stage 3 新增）
    if cfg.output.show_requirement_layer and report.requirement_coverage:
        _print_requirement_layer(report.requirement_coverage, quiet, verbose)
    
    # 追踪完整性（Stage 3 新增）
    if cfg.traceability.enabled and report.traceability:
        _print_traceability_layer(report.traceability, quiet, verbose)
    
    print("=" * 60)


def main() -> int:
    """
    主函数

    Returns:
        int: 退出码（可用于 CI gate，默认 0）
    """
    parser = argparse.ArgumentParser(
        description="Rule Test Health Check Report",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output in JSON format (machine-readable)",
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Minimal output (summary only)",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Verbose output (debug info)",
    )
    parser.add_argument(
        "--output", "-o",
        type=str,
        help="Output file path (default: stdout)",
    )
    
    args = parser.parse_args()
    
    # 设置日志级别
    if args.verbose:
        logging.basicConfig(level=logging.DEBUG, format="%(levelname)s - %(message)s")
    elif args.quiet:
        logging.basicConfig(level=logging.WARNING, format="%(levelname)s - %(message)s")
    else:
        logging.basicConfig(level=logging.INFO, format="%(levelname)s - %(message)s")
    
    # 生成报告 & 加载配置
    from simplified.health_config_models import load_health_config, HealthConfig

    cfg: HealthConfig = load_health_config()
    report = generate_health_report(verbose=args.verbose)
    
    # 输出报告
    if args.json:
        output = json.dumps(report.to_dict(), indent=2, ensure_ascii=False)
    else:
        # 文本输出需要捕获 print
        import io
        from contextlib import redirect_stdout

        buffer = io.StringIO()
        with redirect_stdout(buffer):
            print_text_report(report, quiet=args.quiet, verbose=args.verbose, cfg=cfg)
        output = buffer.getvalue()
    
    # 写入文件或 stdout
    if args.output:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(output)
        print(f"Report written to: {args.output}")
    else:
        print(output)

    # 计算退出码（用于 CI gate）
    exit_code = _calculate_exit_code(report, cfg)
    return exit_code


if __name__ == "__main__":
    import os
    os.chdir(script_dir)
    sys.exit(main())
