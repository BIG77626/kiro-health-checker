#!/bin/bash
# =============================================================================
# 开发环境一键安装脚本
# 
# 用途：新成员加入团队后，一键安装依赖 + 配置预提交钩子
# 运行：bash scripts/onboarding/setup_dev.sh
#
# 风险缓解：
# - R-02: 预提交钩子轻量化（只跑 3 个核心测试，< 1s）
# =============================================================================

set -e

echo "=========================================="
echo "Review Verification System - Dev Setup"
echo "=========================================="

# 1. 检查 Python 版本
echo ""
echo "[1/4] Checking Python version..."
python_version=$(python3 --version 2>&1 | cut -d' ' -f2)
echo "  Python version: $python_version"

# 2. 安装依赖
echo ""
echo "[2/4] Installing dependencies..."
pip install pytest pydantic pyyaml hypothesis --quiet
echo "  ✅ Dependencies installed"

# 3. 配置预提交钩子（轻量化版本）
echo ""
echo "[3/4] Setting up pre-commit hook (lightweight)..."
hook_dir=".git/hooks"
hook_file="$hook_dir/pre-commit"

if [ -d "$hook_dir" ]; then
    cat > "$hook_file" << 'EOF'
#!/bin/bash
# =============================================================================
# Pre-commit hook: 轻量化审查验证（< 1s）
#
# 只跑 3 个核心测试，完整审查在 CI 中执行
# 
# 绕过方式（仅限紧急情况）：
#   git commit --no-verify -m "WIP: experimenting"
#
# 注意：绕过钩子后，CI 仍会强制执行完整审查
# =============================================================================

echo "🔍 Running minimal review checks (3 tests, < 1s)..."

# 只跑最关键的 3 个测试
python -m pytest \
    .trunk/simplified/tests/test_review_stage1.py::test_review_scope_files_exist \
    .trunk/simplified/tests/test_review_stage2.py::test_config_as_policy_implemented \
    .trunk/simplified/tests/test_review_cross_stage.py::test_rule_requirement_ids_affects_coverage_calculation \
    -q --tb=no 2>/dev/null

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Core review checks failed."
    echo ""
    echo "Options:"
    echo "  1. Fix the issue and retry"
    echo "  2. Run 'python scripts/verify_review.py -v' for details"
    echo "  3. Use 'git commit --no-verify' to bypass (not recommended)"
    echo ""
    exit 1
fi

echo "✅ Core checks passed. Full review will run in CI."
EOF
    chmod +x "$hook_file"
    echo "  ✅ Pre-commit hook installed (lightweight: 3 tests)"
else
    echo "  ⚠️  Not a git repository, skipping pre-commit hook"
fi

# 4. 验证安装
echo ""
echo "[4/4] Verifying installation..."
python scripts/verify_review.py > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "  ✅ Verification passed (59 tests)"
else
    echo "  ❌ Verification failed, please check your setup"
    exit 1
fi

echo ""
echo "=========================================="
echo "Setup complete! Next steps:"
echo "=========================================="
echo "1. Read .trunk/simplified/docs/review/README.md"
echo "2. Run: python scripts/verify_review.py -v"
echo "3. Try modifying a test and commit"
echo ""
echo "Pre-commit hook behavior:"
echo "  - Runs 3 core tests (< 1s)"
echo "  - Full 59 tests run in CI"
echo "  - Bypass with: git commit --no-verify"
echo ""
