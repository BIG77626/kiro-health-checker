# CLI Output 文档

## 输出模式

### 默认模式（人类快速浏览）

```bash
$ python -m simplified.health_check

============================================================
Rule Test Health Check Report
============================================================
Generated: 2025-12-19T10:00:00
Source: RuleRegistry (rules/*.yml)
Scope: 有专门测试文件的规则，排除 DEPRECATED

------------------------------------------------------------
Coverage Summary
------------------------------------------------------------
  Total rules (active): 100
  Rules with tests: 85
  Coverage: 85.0%
  Threshold: 20.0%
  Status: [OK] Coverage meets threshold

------------------------------------------------------------
[需求层] Requirement Coverage
------------------------------------------------------------
  总数: 100 / 有规则: 80 / 有样本: 75 / 完全覆盖: 70
  覆盖率: 70.0%

  [HIGH-RISK] 未完全覆盖的高风险需求: 3 个

------------------------------------------------------------
[追踪] Traceability Check
------------------------------------------------------------
  孤儿需求 (无规则引用): 2
  悬空引用 (规则指向不存在的 REQ): 1
  状态: [WARNING] 存在追踪问题

============================================================
```

### verbose 模式（排查详情）

```bash
$ python -m simplified.health_check --verbose

# ... 同上摘要 ...

------------------------------------------------------------
[需求层] Requirement Coverage
------------------------------------------------------------
  总数: 100 / 有规则: 80 / 有样本: 75 / 完全覆盖: 70
  覆盖率: 70.0%

  [HIGH-RISK] 未完全覆盖的高风险需求: 3 个
    - REQ-NET-001
    - REQ-AUTH-003
    - REQ-PAY-007

------------------------------------------------------------
[追踪] Traceability Check
------------------------------------------------------------
  孤儿需求 (无规则引用): 2
  悬空引用 (规则指向不存在的 REQ): 1
  状态: [WARNING] 存在追踪问题

  孤儿需求列表:
    - REQ-ORPHAN-001
    - REQ-ORPHAN-002

  悬空引用列表:
    - RULE-001 -> ['REQ-NOT-EXIST']
```

### quiet 模式（CI 摘要）

```bash
$ python -m simplified.health_check --quiet

============================================================
Rule Test Health Check Report
============================================================
Generated: 2025-12-19T10:00:00
Source: RuleRegistry (rules/*.yml)
Scope: 有专门测试文件的规则，排除 DEPRECATED

------------------------------------------------------------
Coverage Summary
------------------------------------------------------------
  Total rules (active): 100
  Rules with tests: 85
  Coverage: 85.0%
  Threshold: 20.0%
  Status: [OK] Coverage meets threshold

------------------------------------------------------------
[需求层] Requirement Coverage
------------------------------------------------------------
  总数: 100 / 有规则: 80 / 有样本: 75 / 完全覆盖: 70
  覆盖率: 70.0%

------------------------------------------------------------
[追踪] Traceability Check
------------------------------------------------------------
  孤儿需求 (无规则引用): 2
  悬空引用 (规则指向不存在的 REQ): 1
  状态: [WARNING] 存在追踪问题

============================================================
```

### JSON 模式（机器解析）

```bash
$ python -m simplified.health_check --json
```

```json
{
  "generated_at": "2025-12-19T10:00:00",
  "total_rules": 100,
  "rules_with_tests": 85,
  "coverage_percentage": 85.0,
  "coverage_threshold": 20.0,
  "coverage_meets_threshold": true,
  "passed_rules": 80,
  "failed_rules": 5,
  "requirement_coverage": {
    "total_requirements": 100,
    "requirements_with_rules": 80,
    "requirements_with_samples": 75,
    "coverage_percentage": 70.0,
    "fully_covered": 70
  },
  "traceability": {
    "orphan_requirements": ["REQ-ORPHAN-001", "REQ-ORPHAN-002"],
    "dangling_rule_refs": {
      "RULE-001": ["REQ-NOT-EXIST"]
    },
    "orphan_count": 2,
    "dangling_count": 1,
    "has_issues": true
  }
}
```

## 退出码策略

| 配置 | 条件 | 退出码 |
|------|------|--------|
| `exit_on_under_coverage: false` (默认) | 任何情况 | 0 |
| `exit_on_under_coverage: true` | 覆盖率 < threshold | 1 |
| `exit_on_traceability_issues: true` | 存在 orphan 或 dangling | 1 |
| `exit_on_failure: true` (兼容字段) | 覆盖率 < threshold | 1 |

## 配置示例

```yaml
# health_config.yml
version: 1

requirements:
  enabled: true
  coverage_threshold: 70.0
  exit_on_under_coverage: false  # V1 默认不 gate
  exit_on_traceability_issues: false

traceability:
  enabled: true
  warn_on_orphans: true
  warn_on_dangling: true

output:
  show_requirement_layer: true
  show_traceability_details: true
```

## 日志事件

| 事件 | 级别 | 触发条件 |
|------|------|----------|
| `config_load_fallback` | WARNING | health_config.yml 不存在 |
| `traceability_non_fatal` | WARNING | 存在追踪问题但未开启 gate |

## 性能基线

- coverage_calculation: O(n+m) 复杂度
- traceability_check: O(n+m) 复杂度
- print_overhead: < 计算开销的 2x

运行性能测试：
```bash
pytest .trunk/simplified/tests/test_review_performance.py -m slow -v
```
