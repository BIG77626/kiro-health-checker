#!/bin/bash
# =============================================================================
# 首次审查运行脚本
# 
# 用途：新成员运行完整审查，生成个人证据包
# 运行：bash scripts/onboarding/run_first_review.sh
# =============================================================================

set -e

echo "=========================================="
echo "Running First Review Verification"
echo "=========================================="

# 创建证据目录
evidence_dir="review_evidence_$(date +%Y%m%d_%H%M%S)"
mkdir -p "$evidence_dir"

echo ""
echo "[1/3] Running fast review tests..."
python -m pytest \
    .trunk/simplified/tests/test_review_stage1.py \
    .trunk/simplified/tests/test_review_stage2.py \
    .trunk/simplified/tests/test_review_cross_stage.py \
    .trunk/simplified/tests/test_review_traceability.py \
    .trunk/simplified/tests/test_review_cli_output.py \
    .trunk/simplified/tests/test_review_performance.py \
    -m "not slow" \
    --junitxml="$evidence_dir/fast_tests.xml" \
    -v

echo ""
echo "[2/3] Running performance baseline tests..."
python -m pytest \
    .trunk/simplified/tests/test_review_performance.py \
    -m slow \
    --junitxml="$evidence_dir/performance_tests.xml" \
    -v

echo ""
echo "[3/3] Running health check..."
python -m simplified.health_check --json > "$evidence_dir/health_report.json"
python -m simplified.health_check > "$evidence_dir/health_report.txt"

echo ""
echo "=========================================="
echo "Review Complete!"
echo "=========================================="
echo ""
echo "Evidence package created: $evidence_dir/"
echo ""
ls -la "$evidence_dir/"
echo ""
echo "Next steps:"
echo "1. Review the health_report.txt"
echo "2. Check any failed tests in fast_tests.xml"
echo "3. Share this evidence package with your mentor"
echo ""
