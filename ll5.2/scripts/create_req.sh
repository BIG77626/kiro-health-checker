#!/bin/bash
# 批量创建 REQ 文件脚本
#
# 用法: ./scripts/create_req.sh <DOMAIN> <NUM>
# 示例: ./scripts/create_req.sh CON 001
#       ./scripts/create_req.sh SEC 002

set -e

DOMAIN=$1
NUM=$2

if [ -z "$DOMAIN" ] || [ -z "$NUM" ]; then
    echo "用法: $0 <DOMAIN> <NUM>"
    echo "示例: $0 CON 001"
    exit 1
fi

TEMPLATE=".trunk/simplified/requirements/TEMPLATE.yml"
TARGET=".trunk/simplified/requirements/REQ-${DOMAIN}-${NUM}.yml"

if [ ! -f "$TEMPLATE" ]; then
    echo "❌ 模板文件不存在: $TEMPLATE"
    exit 1
fi

if [ -f "$TARGET" ]; then
    echo "⚠️ 文件已存在: $TARGET"
    exit 1
fi

sed "s/{DOMAIN}/${DOMAIN}/g; s/{NNN}/${NUM}/g" "$TEMPLATE" > "$TARGET"
echo "✅ 创建: $TARGET"
echo "📝 请编辑文件填写具体内容"
