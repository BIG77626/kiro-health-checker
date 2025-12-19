#!/bin/bash
# add_case_asset.sh - 案例资产自动沉淀脚本
#
# Task: REQUIREMENT-COVERAGE-TRACKING (Task 28)
# 用法: ./scripts/add_case_asset.sh "标题" "问题描述" "修复方案" [tags] [impact_scope]
#
# 示例:
#   ./scripts/add_case_asset.sh "悬空引用" "Rule引用了不存在的REQ" "添加缺失的REQ文件"
#   ./scripts/add_case_asset.sh "孤儿需求" "REQ无规则覆盖" "添加规则引用" "high-risk,orphan" "REQ-NET-001"

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 参数检查
if [ $# -lt 3 ]; then
    echo -e "${RED}错误: 参数不足${NC}"
    echo ""
    echo "用法: $0 <标题> <问题描述> <修复方案> [tags] [impact_scope]"
    echo ""
    echo "参数:"
    echo "  标题        - 案例标题 (必填)"
    echo "  问题描述    - 问题的详细描述 (必填)"
    echo "  修复方案    - 如何修复此问题 (必填)"
    echo "  tags        - 标签，逗号分隔 (可选，默认: general)"
    echo "  impact_scope - 影响范围，逗号分隔 (可选)"
    echo ""
    echo "示例:"
    echo "  $0 \"悬空引用\" \"Rule引用了不存在的REQ\" \"添加缺失的REQ文件\""
    echo "  $0 \"孤儿需求\" \"REQ无规则覆盖\" \"添加规则引用\" \"high-risk,orphan\" \"REQ-NET-001\""
    exit 1
fi

TITLE="$1"
DESCRIPTION="$2"
FIX="$3"
TAGS="${4:-general}"
IMPACT_SCOPE="${5:-}"

# 路径配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CASES_DIR="$PROJECT_ROOT/.trunk/simplified/docs/review/cases"
CASE_STUDIES_FILE="$PROJECT_ROOT/.trunk/simplified/docs/review/CASE_STUDIES.md"

# 确保目录存在
mkdir -p "$CASES_DIR"

# 生成文件名
DATE=$(date +%Y%m%d)
# 生成唯一ID (基于时间戳的后4位)
ID=$(date +%s | tail -c 5)
FILENAME="${DATE}-${ID}.md"
FILEPATH="$CASES_DIR/$FILENAME"

# 检查文件是否已存在
if [ -f "$FILEPATH" ]; then
    echo -e "${YELLOW}警告: 文件已存在，将覆盖: $FILEPATH${NC}"
fi

# 生成案例文件
cat > "$FILEPATH" << EOF
---
title: "${TITLE}"
date: "$(date +%Y-%m-%d)"
tags: [$(echo "$TAGS" | sed 's/,/", "/g' | sed 's/^/"/;s/$/"/')]
impact_scope: [$(echo "$IMPACT_SCOPE" | sed 's/,/", "/g' | sed 's/^/"/;s/$/"/')]
---

# ${TITLE}

## 问题描述

${DESCRIPTION}

## 修复方案

${FIX}

## 相关资源

- 标签: ${TAGS}
$([ -n "$IMPACT_SCOPE" ] && echo "- 影响范围: ${IMPACT_SCOPE}")

## 时间线

- $(date +%Y-%m-%d): 案例创建
EOF

echo -e "${GREEN}✓ 案例文件已创建: $FILEPATH${NC}"

# 更新 CASE_STUDIES.md 索引
if [ -f "$CASE_STUDIES_FILE" ]; then
    # 检查是否已有此案例的链接
    if ! grep -q "$FILENAME" "$CASE_STUDIES_FILE" 2>/dev/null; then
        # 在文件末尾添加新案例链接
        echo "" >> "$CASE_STUDIES_FILE"
        echo "### $(date +%Y-%m-%d): ${TITLE}" >> "$CASE_STUDIES_FILE"
        echo "" >> "$CASE_STUDIES_FILE"
        echo "- **文件**: [${FILENAME}](cases/${FILENAME})" >> "$CASE_STUDIES_FILE"
        echo "- **标签**: ${TAGS}" >> "$CASE_STUDIES_FILE"
        [ -n "$IMPACT_SCOPE" ] && echo "- **影响范围**: ${IMPACT_SCOPE}" >> "$CASE_STUDIES_FILE"
        echo "" >> "$CASE_STUDIES_FILE"
        echo -e "${GREEN}✓ CASE_STUDIES.md 索引已更新${NC}"
    else
        echo -e "${YELLOW}⚠ CASE_STUDIES.md 中已存在此案例链接${NC}"
    fi
else
    echo -e "${YELLOW}⚠ CASE_STUDIES.md 不存在，跳过索引更新${NC}"
fi

echo ""
echo -e "${GREEN}案例资产沉淀完成!${NC}"
echo "  文件: $FILEPATH"
echo "  标题: $TITLE"
echo "  标签: $TAGS"
[ -n "$IMPACT_SCOPE" ] && echo "  影响范围: $IMPACT_SCOPE"
