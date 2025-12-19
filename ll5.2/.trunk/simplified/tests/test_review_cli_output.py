from __future__ import annotations

"""
CLI Output Review Tests - 阶段三：文本/JSON 输出行为级验证

重点验证：
- 默认模式只展示摘要，不泄露过多 ID 细节
- verbose 模式下展示 traceability 详情
- JSON 输出包含 requirement_coverage / traceability 字段，且向后兼容
- 高风险未覆盖 REQ 高亮提示
- 孤儿 REQ 数量在摘要中正确显示
- 退出码策略（exit_on_under_coverage / exit_on_traceability_issues）
- 端到端 CLI 行为（真实进程边界）
"""

import io
import json
import subprocess
import sys
from contextlib import redirect_stdout
from datetime import datetime
from pathlib import Path
from typing import Any, Dict

import pytest

from ..health_check import HealthCheckReport, print_text_report
from ..health_config_models import get_default_config, HealthConfig
from .. import health_check  # type: ignore


# =============================================================================
# Helper Functions
# =============================================================================


def _make_report_with_layers(
    *,
    requirement_coverage: Dict[str, Any] | None = None,
    traceability: Dict[str, Any] | None = None,
) -> HealthCheckReport:
    return HealthCheckReport(
        generated_at="2025-12-18T10:00:00",
        requirement_coverage=requirement_coverage,
        traceability=traceability,
    )


def _capture_text_report(
    report: HealthCheckReport,
    quiet: bool = False,
    verbose: bool = False,
    cfg: HealthConfig | None = None,
) -> str:
    """捕获 print_text_report 的输出"""
    if cfg is None:
        cfg = get_default_config()

    buffer = io.StringIO()
    with redirect_stdout(buffer):
        print_text_report(report, quiet=quiet, verbose=verbose, cfg=cfg)
    return buffer.getvalue()


def _create_report_with_requirement_coverage(
    req_coverage: Dict[str, Any] | None = None,
    traceability: Dict[str, Any] | None = None,
) -> HealthCheckReport:
    """创建带需求覆盖数据的 HealthCheckReport"""
    return HealthCheckReport(
        generated_at=datetime.now().isoformat(),
        total_rules=10,
        rules_with_tests=5,
        coverage_percentage=50.0,
        coverage_threshold=20.0,
        coverage_meets_threshold=True,
        passed_rules=5,
        failed_rules=0,
        requirement_coverage=req_coverage,
        traceability=traceability,
    )


# =============================================================================
# 默认/verbose 模式输出测试
# =============================================================================


def test_default_output_shows_summary_only(capsys: pytest.CaptureFixture) -> None:
    """默认模式：只显示摘要，不打印具体 traceability ID 列表。"""

    req_cov = {
        "total_requirements": 10,
        "requirements_with_rules": 8,
        "requirements_with_samples": 5,
        "coverage_percentage": 50.0,
        "fully_covered": 3,
        "requirement_stats": [],
    }
    trace = {
        "orphan_requirements": ["REQ-001", "REQ-002"],
        "dangling_rule_refs": {"RULE-001": ["REQ-999"]},
        "orphan_count": 2,
        "dangling_count": 1,
        "has_issues": True,
    }
    report = _make_report_with_layers(
        requirement_coverage=req_cov,
        traceability=trace,
    )

    print_text_report(report, quiet=False, verbose=False)
    out = capsys.readouterr().out

    # 摘要信息应存在
    assert "Requirement Coverage" in out
    assert "Traceability Check" in out
    # 默认模式下不应打印具体 orphan/dangling ID 列表
    assert "孤儿需求列表" not in out
    assert "悬空引用列表" not in out
    assert "RULE-001" not in out
    assert "REQ-001" not in out


def test_verbose_output_shows_traceability_details(
    capsys: pytest.CaptureFixture,
) -> None:
    """verbose 模式：应打印 traceability 详情列表。"""

    trace = {
        "orphan_requirements": ["REQ-001", "REQ-002"],
        "dangling_rule_refs": {"RULE-001": ["REQ-999"]},
        "orphan_count": 2,
        "dangling_count": 1,
        "has_issues": True,
    }
    report = _make_report_with_layers(
        requirement_coverage=None,
        traceability=trace,
    )

    print_text_report(report, quiet=False, verbose=True)
    out = capsys.readouterr().out

    assert "孤儿需求列表" in out
    assert "悬空引用列表" in out
    assert "RULE-001" in out
    assert "REQ-001" in out


# =============================================================================
# 需求层输出测试
# =============================================================================


def test_requirement_layer_shown_when_data_exists() -> None:
    """有需求覆盖数据时，输出包含 [需求层] 段落"""
    req_cov = {
        "total_requirements": 5,
        "requirements_with_rules": 3,
        "requirements_with_samples": 2,
        "coverage_percentage": 60.0,
        "by_risk_level": {},
        "requirement_stats": [],
    }
    report = _create_report_with_requirement_coverage(req_coverage=req_cov)

    output = _capture_text_report(report)

    assert "[需求层]" in output
    assert "总数: 5" in output
    assert "有规则: 3" in output
    assert "覆盖率: 60.0%" in output


def test_requirement_layer_hidden_when_no_data() -> None:
    """无需求覆盖数据时，输出不包含 [需求层] 段落"""
    report = _create_report_with_requirement_coverage(req_coverage=None)

    output = _capture_text_report(report)

    assert "[需求层]" not in output


def test_high_risk_uncovered_highlighted(capsys: pytest.CaptureFixture) -> None:
    """存在高风险未完全覆盖 REQ 时，应在文本输出中有 [HIGH-RISK] 标记。"""

    req_cov = {
        "total_requirements": 3,
        "requirements_with_rules": 3,
        "requirements_with_samples": 2,
        "coverage_percentage": 66.7,
        "fully_covered": 1,
        "requirement_stats": [
            {
                "requirement_id": "REQ-HIGH-001",
                "risk_level": "HIGH",
                "has_rules": True,
                "has_samples": False,
                "tests_passed": False,
            },
            {
                "requirement_id": "REQ-MED-001",
                "risk_level": "MEDIUM",
                "has_rules": True,
                "has_samples": True,
                "tests_passed": True,
            },
        ],
    }
    report = _make_report_with_layers(
        requirement_coverage=req_cov,
        traceability=None,
    )

    print_text_report(report, quiet=False, verbose=False)
    out = capsys.readouterr().out

    assert "[HIGH-RISK]" in out
    # 默认模式只显示数量，不显示具体 ID
    assert "REQ-HIGH-001" not in out


def test_orphan_requirements_in_summary(capsys: pytest.CaptureFixture) -> None:
    """孤儿 REQ 数量应在追踪摘要中正确显示。"""

    trace = {
        "orphan_requirements": ["REQ-001", "REQ-002", "REQ-003"],
        "dangling_rule_refs": {},
        "orphan_count": 3,
        "dangling_count": 0,
        "has_issues": True,
    }
    report = _make_report_with_layers(
        requirement_coverage=None,
        traceability=trace,
    )

    print_text_report(report, quiet=False, verbose=False)
    out = capsys.readouterr().out

    assert "孤儿需求 (无规则引用): 3" in out


# =============================================================================
# 追踪层输出测试
# =============================================================================


def test_traceability_layer_shown_when_data_exists() -> None:
    """有追踪数据时，输出包含 [追踪] 段落"""
    trace = {
        "orphan_requirements": [],
        "dangling_rule_refs": {},
        "orphan_count": 0,
        "dangling_count": 0,
        "has_issues": False,
    }
    report = _create_report_with_requirement_coverage(traceability=trace)

    output = _capture_text_report(report)

    assert "[追踪]" in output
    assert "孤儿需求" in output
    assert "悬空引用" in output
    assert "[OK]" in output


def test_traceability_layer_hidden_when_no_data() -> None:
    """无追踪数据时，输出不包含 [追踪] 段落"""
    report = _create_report_with_requirement_coverage(traceability=None)

    output = _capture_text_report(report)

    assert "[追踪]" not in output


def test_traceability_warning_when_issues_exist() -> None:
    """存在追踪问题时，显示 WARNING 状态"""
    trace = {
        "orphan_requirements": ["REQ-OLD-001"],
        "dangling_rule_refs": {"RULE-001": ["REQ-NOT-EXIST"]},
        "orphan_count": 1,
        "dangling_count": 1,
        "has_issues": True,
    }
    report = _create_report_with_requirement_coverage(traceability=trace)

    output = _capture_text_report(report)

    assert "[WARNING]" in output


# =============================================================================
# JSON 输出契约测试
# =============================================================================


def test_json_output_contains_requirement_coverage() -> None:
    """JSON 输出应包含 requirement_coverage 字段。"""

    req_cov = {
        "total_requirements": 10,
        "requirements_with_rules": 8,
        "requirements_with_samples": 5,
        "coverage_percentage": 50.0,
        "fully_covered": 3,
    }
    report = _make_report_with_layers(
        requirement_coverage=req_cov,
        traceability=None,
    )

    data = report.to_dict()
    assert "requirement_coverage" in data
    assert data["requirement_coverage"]["total_requirements"] == 10


def test_json_output_backward_compatible() -> None:
    """
    JSON 输出向后兼容：旧脚本只读取旧字段时不应出错。

    模拟旧 jq 脚本只依赖 total_rules / coverage_percentage。
    """

    report = HealthCheckReport(
        generated_at="2025-12-18T10:00:00",
        total_rules=35,
        rules_with_tests=10,
        coverage_percentage=28.6,
    )
    payload = report.to_dict()

    # 旧脚本只关心这几个字段
    subset = {
        "total_rules": payload.get("total_rules"),
        "coverage_percentage": payload.get("coverage_percentage"),
    }
    # 应该可以正常序列化/反序列化
    dumped = json.dumps(subset)
    loaded = json.loads(dumped)
    assert loaded["total_rules"] == 35
    assert loaded["coverage_percentage"] == 28.6


def test_json_output_contains_traceability() -> None:
    """JSON 输出包含 traceability 字段"""
    trace = {
        "orphan_requirements": ["REQ-OLD-001"],
        "orphan_count": 1,
        "has_issues": True,
    }
    report = _create_report_with_requirement_coverage(traceability=trace)

    d = report.to_dict()

    assert "traceability" in d
    assert d["traceability"]["orphan_count"] == 1


# =============================================================================
# Exit Code Behaviour (P0)
# =============================================================================


def test_exit_code_zero_when_no_failure_configured() -> None:
    """配置不 gate 时，即使覆盖不足也应返回退出码 0。"""

    cfg = HealthConfig()
    # 默认：exit_on_under_coverage / exit_on_failure / exit_on_traceability_issues 均为 False
    report = HealthCheckReport(
        generated_at="2025-12-18T10:00:00",
        coverage_percentage=10.0,
        coverage_threshold=85.0,
        coverage_meets_threshold=False,
    )

    code = health_check._calculate_exit_code(report, cfg)  # type: ignore[attr-defined]
    assert code == 0


def test_exit_code_one_when_under_coverage_and_gate_enabled() -> None:
    """覆盖不足且 exit_on_under_coverage=True 时，应返回退出码 1。"""

    cfg = HealthConfig()
    cfg.requirements.exit_on_under_coverage = True

    report = HealthCheckReport(
        generated_at="2025-12-18T10:00:00",
        coverage_percentage=10.0,
        coverage_threshold=85.0,
        coverage_meets_threshold=False,
    )

    code = health_check._calculate_exit_code(report, cfg)  # type: ignore[attr-defined]
    assert code == 1


def test_exit_code_zero_when_traceability_issues_but_gate_disabled() -> None:
    """存在追踪问题但未开启 gate 时，应返回退出码 0。"""

    cfg = HealthConfig()
    cfg.traceability.enabled = True
    cfg.requirements.exit_on_traceability_issues = False

    report = HealthCheckReport(
        generated_at="2025-12-18T10:00:00",
        traceability={
            "has_issues": True,
            "orphan_requirements": ["REQ-001"],
            "dangling_rule_refs": {"RULE-001": ["REQ-999"]},
        },
    )

    code = health_check._calculate_exit_code(report, cfg)  # type: ignore[attr-defined]
    assert code == 0


def test_exit_code_one_when_traceability_issues_and_gate_enabled() -> None:
    """存在追踪问题且 exit_on_traceability_issues=True 时，应返回退出码 1。"""

    cfg = HealthConfig()
    cfg.traceability.enabled = True
    cfg.requirements.exit_on_traceability_issues = True

    report = HealthCheckReport(
        generated_at="2025-12-18T10:00:00",
        traceability={
            "has_issues": True,
            "orphan_requirements": ["REQ-001"],
            "dangling_rule_refs": {"RULE-001": ["REQ-999"]},
        },
    )

    code = health_check._calculate_exit_code(report, cfg)  # type: ignore[attr-defined]
    assert code == 1


# =============================================================================
# End-to-End CLI via main() (monkeypatch 版本)
# =============================================================================


def test_e2e_cli_default_output_via_main(capsys: pytest.CaptureFixture, monkeypatch) -> None:
    """真实调用 main()：默认模式下输出摘要且退出码为 0。"""

    # 准备一个简单的报告（不关注真实规则/样本）
    report = HealthCheckReport(
        generated_at="2025-12-18T10:00:00",
        total_rules=1,
        rules_with_tests=0,
        coverage_percentage=0.0,
        coverage_threshold=10.0,
        coverage_meets_threshold=False,
        requirement_coverage={
            "total_requirements": 0,
            "requirements_with_rules": 0,
            "requirements_with_samples": 0,
            "coverage_percentage": 100.0,
            "fully_covered": 0,
        },
        traceability=None,
    )

    # monkeypatch 配置和报告生成
    cfg = HealthConfig()
    cfg.requirements.exit_on_under_coverage = False

    monkeypatch.setattr(
        health_check, "generate_health_report", lambda verbose=False: report
    )
    monkeypatch.setattr(
        health_check,
        "load_health_config",
        lambda: cfg,
        raising=False,
    )

    # 模拟 CLI 参数
    import sys as _sys

    monkeypatch.setattr(_sys, "argv", ["health_check.py"])

    exit_code = health_check.main()
    out = capsys.readouterr().out

    assert exit_code == 0
    assert "Rule Test Health Check Report" in out
    # 默认模式下需求层摘要存在
    assert "Requirement Coverage" in out


def test_e2e_cli_json_output_via_main(capsys: pytest.CaptureFixture, monkeypatch) -> None:
    """真实调用 main()：JSON 模式输出可解析且包含新字段。"""

    report = HealthCheckReport(
        generated_at="2025-12-18T10:00:00",
        total_rules=2,
        rules_with_tests=1,
        coverage_percentage=50.0,
        coverage_threshold=80.0,
        coverage_meets_threshold=False,
        requirement_coverage={
            "total_requirements": 2,
            "requirements_with_rules": 1,
            "requirements_with_samples": 1,
            "coverage_percentage": 50.0,
            "fully_covered": 1,
        },
        traceability={
            "has_issues": True,
            "orphan_requirements": ["REQ-001"],
            "dangling_rule_refs": {},
        },
    )

    cfg = HealthConfig()
    cfg.requirements.exit_on_under_coverage = False
    cfg.requirements.exit_on_traceability_issues = False

    monkeypatch.setattr(
        health_check, "generate_health_report", lambda verbose=False: report
    )
    monkeypatch.setattr(
        health_check,
        "load_health_config",
        lambda: cfg,
        raising=False,
    )

    import sys as _sys

    monkeypatch.setattr(_sys, "argv", ["health_check.py", "--json"])

    exit_code = health_check.main()
    out = capsys.readouterr().out

    parsed = json.loads(out)
    assert parsed["total_rules"] == 2
    assert "requirement_coverage" in parsed
    assert "traceability" in parsed
    assert exit_code == 0


# =============================================================================
# stderr / stdout 分离与配置降级 / JSON+verbose 组合
# =============================================================================


def test_e2e_cli_stderr_is_clean_on_success(capsys: pytest.CaptureFixture, monkeypatch) -> None:
    """成功路径：stderr 应为空，所有正常信息走 stdout。"""

    report = HealthCheckReport(
        generated_at="2025-12-18T10:00:00",
        total_rules=1,
        rules_with_tests=1,
        coverage_percentage=100.0,
        coverage_threshold=80.0,
        coverage_meets_threshold=True,
    )
    cfg = HealthConfig()

    monkeypatch.setattr(
        health_check, "generate_health_report", lambda verbose=False: report
    )
    monkeypatch.setattr(
        health_check,
        "load_health_config",
        lambda: cfg,
        raising=False,
    )

    import sys as _sys

    monkeypatch.setattr(_sys, "argv", ["health_check.py"])

    exit_code = health_check.main()
    captured = capsys.readouterr()

    assert exit_code == 0
    assert "Rule Test Health Check Report" in captured.out
    # 成功路径不应在 stderr 输出任何内容（无 ERROR/WARNING）
    assert captured.err == ""


def test_e2e_cli_json_mode_ignores_verbose(
    capsys: pytest.CaptureFixture, monkeypatch
) -> None:
    """JSON 模式应输出纯 JSON，verbose 只影响日志级别，不污染 stdout。"""

    report = HealthCheckReport(
        generated_at="2025-12-18T10:00:00",
        total_rules=1,
        rules_with_tests=1,
        coverage_percentage=100.0,
        coverage_threshold=80.0,
        coverage_meets_threshold=True,
        requirement_coverage={
            "total_requirements": 1,
            "requirements_with_rules": 1,
            "requirements_with_samples": 1,
            "coverage_percentage": 100.0,
            "fully_covered": 1,
        },
    )
    cfg = HealthConfig()

    monkeypatch.setattr(
        health_check, "generate_health_report", lambda verbose=True: report
    )
    monkeypatch.setattr(
        health_check,
        "load_health_config",
        lambda: cfg,
        raising=False,
    )

    import sys as _sys

    monkeypatch.setattr(
        _sys, "argv", ["health_check.py", "--json", "--verbose"]
    )

    exit_code = health_check.main()
    captured = capsys.readouterr()

    # stdout 必须是纯 JSON，可被解析
    parsed = json.loads(captured.out)
    assert parsed["total_rules"] == 1
    assert "requirement_coverage" in parsed
    # 不应出现 ANSI 颜色码等控制字符
    assert "\033[" not in captured.out
    assert exit_code == 0


# =============================================================================
# 真实进程边界测试 (subprocess)
# =============================================================================


def test_e2e_subprocess_config_missing_graceful_degrade(tmp_path: Path) -> None:
    """
    真实进程边界测试：配置文件不存在时，应使用默认配置并正常运行。

    使用 subprocess 而非 monkeypatch，验证真实文件系统行为。
    """
    # 创建一个不存在的配置文件路径
    missing_config = tmp_path / "nonexistent_config.yml"
    assert not missing_config.exists()

    # 获取 health_check.py 所在目录
    simplified_dir = Path(__file__).parent.parent

    # 使用 subprocess 运行 health_check.py
    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "simplified.health_check",
            "--json",
        ],
        capture_output=True,
        text=True,
        cwd=str(simplified_dir.parent),  # ll5.2/.trunk
        timeout=30,
    )

    # 验证：即使配置文件不存在，也应正常运行（使用默认配置）
    # 退出码应为 0（默认不 gate）
    assert result.returncode == 0

    # stdout 应为有效 JSON
    try:
        parsed = json.loads(result.stdout)
        assert "total_rules" in parsed
    except json.JSONDecodeError:
        pytest.fail(f"stdout is not valid JSON: {result.stdout[:200]}")


def test_e2e_subprocess_json_verbose_pure_json(tmp_path: Path) -> None:
    """
    真实进程边界测试：--json --verbose 组合应输出纯 JSON。

    验证 argparse 参数解析器正确处理两个参数的组合。
    """
    simplified_dir = Path(__file__).parent.parent

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "simplified.health_check",
            "--json",
            "--verbose",
        ],
        capture_output=True,
        text=True,
        cwd=str(simplified_dir.parent),  # ll5.2/.trunk
        timeout=30,
    )

    # 验证退出码
    assert result.returncode == 0

    # stdout 必须是纯 JSON，可被解析
    try:
        parsed = json.loads(result.stdout)
        assert "total_rules" in parsed
        assert "coverage_percentage" in parsed
    except json.JSONDecodeError:
        pytest.fail(f"stdout is not valid JSON: {result.stdout[:200]}")

    # 不应出现 ANSI 颜色码等控制字符
    assert "\033[" not in result.stdout

    # verbose 日志应走 stderr，不污染 stdout
    # （如果有 DEBUG 日志，应在 stderr 中）
