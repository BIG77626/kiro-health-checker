"""
Meta-level tests for the review system itself.

自指性验证：审查体系必须能审查自身，否则就是空中楼阁。

这些测试验证：
1. 审查测试确实调用了核心模块（不是空壳）
2. 审查测试覆盖了关键功能点
3. 审查体系的文档与实现一致
4. CLI 行为对标业界标准（Git --porcelain）
"""

from __future__ import annotations

import inspect
import json
import subprocess
import sys
from pathlib import Path

import pytest


# =============================================================================
# 第一层：自指性验证（审查体系审查自身）
# =============================================================================


class TestReviewSystemTestsItself:
    """验证审查测试确实调用了核心模块"""

    def test_stage1_tests_import_core_modules(self):
        """Stage 1 测试必须导入核心模块"""
        from simplified.tests import test_review_stage1

        source = inspect.getsource(test_review_stage1)

        # 必须引用这些核心模块/概念
        assert "requirement_models" in source or "Requirement" in source
        assert "health_config" in source or "HealthConfig" in source

    def test_stage2_tests_verify_config_as_policy(self):
        """Stage 2 测试必须验证 Config-as-Policy 原则"""
        from simplified.tests import test_review_stage2

        source = inspect.getsource(test_review_stage2)

        # 必须验证配置驱动行为
        assert "coverage_threshold" in source
        assert "HealthConfig" in source or "load_health_config" in source

    def test_traceability_tests_cover_orphan_and_dangling(self):
        """Traceability 测试必须覆盖孤儿需求和悬空引用"""
        from simplified.tests import test_review_traceability

        source = inspect.getsource(test_review_traceability)

        # 必须测试这两种核心场景
        assert "orphan" in source.lower()
        assert "dangling" in source.lower()

    def test_cli_output_tests_verify_json_purity(self):
        """CLI 输出测试必须验证 JSON 纯净性"""
        from simplified.tests import test_review_cli_output

        source = inspect.getsource(test_review_cli_output)

        # 必须验证 JSON 输出
        assert "json" in source.lower()
        assert "subprocess" in source or "main" in source


class TestReviewTestsCoverKeyFunctionality:
    """验证审查测试覆盖了关键功能点"""

    def test_minimum_test_count_per_stage(self):
        """每个阶段必须有足够的测试"""
        from simplified.tests import (
            test_review_stage1,
            test_review_stage2,
            test_review_cross_stage,
            test_review_traceability,
            test_review_cli_output,
        )

        # 统计每个模块的测试函数数量
        stage1_tests = [
            name
            for name in dir(test_review_stage1)
            if name.startswith("test_")
        ]
        stage2_tests = [
            name
            for name in dir(test_review_stage2)
            if name.startswith("test_")
        ]
        cross_tests = [
            name
            for name in dir(test_review_cross_stage)
            if name.startswith("test_")
        ]
        trace_tests = [
            name
            for name in dir(test_review_traceability)
            if name.startswith("test_")
        ]
        cli_tests = [
            name
            for name in dir(test_review_cli_output)
            if name.startswith("test_")
        ]

        # 最低测试数量要求
        assert len(stage1_tests) >= 3, f"Stage 1 tests: {len(stage1_tests)} < 3"
        assert len(stage2_tests) >= 3, f"Stage 2 tests: {len(stage2_tests)} < 3"
        assert len(cross_tests) >= 3, f"Cross-stage tests: {len(cross_tests)} < 3"
        assert len(trace_tests) >= 10, f"Traceability tests: {len(trace_tests)} < 10"
        assert len(cli_tests) >= 10, f"CLI output tests: {len(cli_tests)} < 10"

    def test_total_review_tests_minimum(self):
        """审查测试总数必须达到最低要求"""
        from simplified.tests import (
            test_review_stage1,
            test_review_stage2,
            test_review_cross_stage,
            test_review_traceability,
            test_review_cli_output,
            test_review_performance,
        )

        modules = [
            test_review_stage1,
            test_review_stage2,
            test_review_cross_stage,
            test_review_traceability,
            test_review_cli_output,
            test_review_performance,
        ]

        total = sum(
            len([name for name in dir(m) if name.startswith("test_")])
            for m in modules
        )

        # 最低 50 个测试
        assert total >= 50, f"Total review tests: {total} < 50"


# =============================================================================
# 第二层：外部锚定（与业界公认标准对比）
# =============================================================================


class TestExternalAnchor:
    """验证 CLI 行为对标业界标准"""

    def test_json_output_is_pure_like_git_porcelain(self):
        """--json 输出必须纯净，类似 git --porcelain"""
        # 运行健康检查
        result = subprocess.run(
            [sys.executable, "health_check.py", "--json"],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent,
        )

        # JSON 必须可解析
        try:
            parsed = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            pytest.fail(f"JSON output is not valid: {e}\nOutput: {result.stdout[:500]}")

        # 无 ANSI 颜色码（类似 git --porcelain）
        assert "\033[" not in result.stdout, "JSON output contains ANSI codes"
        assert "\x1b[" not in result.stdout, "JSON output contains ANSI codes"

        # 必须包含核心字段
        assert "total_rules" in parsed
        assert "coverage_percentage" in parsed

    def test_default_output_is_human_readable(self):
        """默认输出必须人类可读（非 JSON）"""
        result = subprocess.run(
            [sys.executable, "health_check.py"],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent,
        )

        # 默认输出不应该是纯 JSON
        try:
            json.loads(result.stdout)
            # 如果能解析为 JSON，说明默认输出是 JSON，这不符合预期
            pytest.fail("Default output should be human-readable, not JSON")
        except json.JSONDecodeError:
            pass  # 预期：默认输出不是 JSON

        # 应该包含人类可读的标题
        assert "Health Check" in result.stdout or "Coverage" in result.stdout

    def test_verbose_does_not_pollute_json(self):
        """--verbose 不应该污染 --json 输出"""
        result = subprocess.run(
            [sys.executable, "health_check.py", "--json", "--verbose"],
            capture_output=True,
            text=True,
            cwd=Path(__file__).parent.parent,
        )

        # 即使加了 --verbose，JSON 仍然必须纯净
        try:
            parsed = json.loads(result.stdout)
        except json.JSONDecodeError as e:
            pytest.fail(
                f"JSON output with --verbose is not valid: {e}\n"
                f"Output: {result.stdout[:500]}"
            )

        assert "total_rules" in parsed


# =============================================================================
# 第三层：文档一致性验证
# =============================================================================


class TestDocumentationConsistency:
    """验证文档与实现一致"""

    def test_case_studies_mentions_dangling_reference(self):
        """CASE_STUDIES.md 必须包含悬空引用案例"""
        case_studies_path = (
            Path(__file__).parent.parent / "docs" / "review" / "CASE_STUDIES.md"
        )

        if not case_studies_path.exists():
            pytest.skip("CASE_STUDIES.md not found")

        content = case_studies_path.read_text(encoding="utf-8")

        # 必须包含悬空引用的定义和修复模式
        assert "悬空引用" in content or "Dangling" in content
        assert "修复" in content or "fix" in content.lower()

    def test_case_studies_mentions_orphan_requirement(self):
        """CASE_STUDIES.md 必须包含孤儿需求案例"""
        case_studies_path = (
            Path(__file__).parent.parent / "docs" / "review" / "CASE_STUDIES.md"
        )

        if not case_studies_path.exists():
            pytest.skip("CASE_STUDIES.md not found")

        content = case_studies_path.read_text(encoding="utf-8")

        # 必须包含孤儿需求的定义和修复模式
        assert "孤儿需求" in content or "Orphan" in content
        assert "deprecated" in content.lower() or "修复" in content

    def test_operations_manual_exists(self):
        """运营手册必须存在"""
        ops_path = (
            Path(__file__).parent.parent / "docs" / "review" / "OPERATIONS.md"
        )

        assert ops_path.exists(), "OPERATIONS.md not found"

        content = ops_path.read_text(encoding="utf-8")

        # 必须包含核心章节
        assert "运营职责" in content or "Who" in content
        assert "运营流程" in content or "How" in content

    def test_readme_mentions_all_stages(self):
        """README.md 必须提及所有审查阶段"""
        readme_path = (
            Path(__file__).parent.parent / "docs" / "review" / "README.md"
        )

        if not readme_path.exists():
            pytest.skip("README.md not found")

        content = readme_path.read_text(encoding="utf-8")

        # 必须提及所有阶段
        assert "Stage 1" in content or "stage1" in content.lower()
        assert "Stage 2" in content or "stage2" in content.lower()
        assert "Stage 3" in content or "stage3" in content.lower() or "Traceability" in content


# =============================================================================
# 第四层：CI 工作流验证
# =============================================================================


def _find_repo_root() -> Path:
    """找到仓库根目录（包含 .github 的目录）"""
    current = Path(__file__).parent
    for _ in range(10):  # 最多向上查找 10 层
        if (current / ".github").exists():
            return current
        if (current / ".git").exists():
            return current
        parent = current.parent
        if parent == current:
            break
        current = parent
    # 如果找不到，返回 ll5.2 目录
    return Path(__file__).parent.parent.parent.parent


class TestCIWorkflowIntegrity:
    """验证 CI 工作流完整性"""

    def test_ci_workflow_exists(self):
        """CI 工作流文件必须存在"""
        repo_root = _find_repo_root()
        workflow_path = repo_root / ".github" / "workflows" / "review-verification.yml"

        assert workflow_path.exists(), f"CI workflow not found at {workflow_path}"

    def test_ci_workflow_has_required_jobs(self):
        """CI 工作流必须包含必要的 jobs"""
        repo_root = _find_repo_root()
        workflow_path = repo_root / ".github" / "workflows" / "review-verification.yml"

        if not workflow_path.exists():
            pytest.skip("CI workflow not found")

        content = workflow_path.read_text(encoding="utf-8")

        # 必须包含这些 jobs
        assert "fast-check" in content, "Missing fast-check job"
        assert "review-summary" in content, "Missing review-summary job"

    def test_ci_workflow_runs_verify_review(self):
        """CI 工作流必须运行 verify_review.py"""
        repo_root = _find_repo_root()
        workflow_path = repo_root / ".github" / "workflows" / "review-verification.yml"

        if not workflow_path.exists():
            pytest.skip("CI workflow not found")

        content = workflow_path.read_text(encoding="utf-8")

        # 必须调用 verify_review.py
        assert "verify_review" in content, "CI workflow doesn't run verify_review.py"
