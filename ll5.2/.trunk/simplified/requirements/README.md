# Requirements Directory

需求文件目录，存放 `REQ-{DOMAIN}-{NNN}.yml` 格式的需求定义文件。

## ⚠️ 重要声明

> **需求覆盖度是 Risk Radar（风险雷达），不是 Safety Proof（安全证明）。**
>
> 需求覆盖度只代表"在已声明需求范围内"没有发现违约，不代表整体系统安全。

## 文件命名规范

```
REQ-{DOMAIN}-{NNN}.yml
```

- `DOMAIN`: 2-4 个大写字母，表示领域（如 `NET`, `SEC`, `AUTH`, `ERR`）
- `NNN`: 3 位数字序号

示例：
- `REQ-NET-001.yml` - 网络相关需求
- `REQ-SEC-001.yml` - 安全相关需求
- `REQ-AUTH-001.yml` - 认证相关需求

## 文件格式

```yaml
id: "REQ-NET-001"
title: "所有外部 HTTP 请求必须启用证书校验"
description: "禁止 verify=False，禁止不安全 SSL 上下文"
risk_level: "high"  # high | medium | low
tags:
  - network
  - security
covered_by_rules:
  - "NET-007"
  - "NET-001"
# 可选：样本数要求
min_positive_samples: 3
min_negative_samples: 3
```

## 必填字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 需求ID，格式 `REQ-{DOMAIN}-{NNN}` |
| `title` | string | 需求标题 |
| `risk_level` | enum | 风险等级：`high` / `medium` / `low` |
| `covered_by_rules` | list | 覆盖此需求的规则ID列表 |

## 可选字段

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `description` | string | `""` | 需求描述 |
| `tags` | list | `[]` | 标签列表 |
| `min_positive_samples` | int | `3` | 最少正例数 |
| `min_negative_samples` | int | `3` | 最少反例数 |

## 所有权规则

- REQ 的增删改视为"架构决策"，走设计文档同级别的 review 流程
- 严格限制"谁能新增/修改 REQ"（仅项目 Owner）
- 先从 `risk_level=high` 的需求开始，控制 REQ 增速

## 双向追踪

需求和规则之间需要保持双向引用一致：

1. **REQ → Rule**: 需求文件中的 `covered_by_rules` 列出覆盖此需求的规则
2. **Rule → REQ**: 规则文件中的 `requirement_ids` 列出此规则覆盖的需求

健康检查会验证双向追踪一致性，发现以下问题时会警告：
- **孤儿引用**: REQ 引用不存在的规则
- **缺失反向链接**: REQ 引用规则，但规则没有反向引用 REQ
- **悬空引用**: 规则引用不存在的 REQ
