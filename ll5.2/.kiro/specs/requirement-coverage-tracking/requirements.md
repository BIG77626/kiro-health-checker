# Requirements Document

## Introduction

在已完成的规则测试样本库（rule-test-samples）基础上，建立需求层覆盖检查和双向追踪机制。

**前置依赖**：
- rule-test-samples spec 已完成（规则测试样本库、RuleTestRunner、SamplePromoter）
- 现有 10 条规则有测试文件（覆盖率 28.6%）
- health_check.py 已实现基础报告功能

**核心目标**：
1. 建立需求层（REQ-*.yml）作为规则的上游追踪
2. 实现双向追踪：REQ → 规则 ↔ 规则 → REQ
3. 在 health_check 中增加需求层覆盖统计
4. 为未来场景层测试预留扩展点

**设计原则**（与用户共识）：
- 物理文件 = 逻辑边界（一条需求一个文件）
- 阈值在配置里（不硬编码）
- 操作幂等
- Runner/Promoter 架构不推翻，只做增量

**架构边界说明**：
- health_check 只消费 RuleTestRunner 的 summary，不重写执行逻辑
- 所有需求相关逻辑只出现在 health_check 和未来 scenario runner 中
- 所有新增字段/文件都是可选、增量，老规则/老测试不变

**配置文件位置**：
- `rule_tests/config.yml`：现有配置（coverage_threshold, high_priority_rules）
- `health_config.yml`：新增健康检查配置（与 health_check.py 同级，顶层目录）
- `requirements/`：需求文件目录（独立顶层，与 rules/ 并列）

## Glossary

- **Requirement**: 需求，描述系统应满足的业务/安全约束
- **REQ_File**: 需求文件，格式为 `requirements/REQ-{DOMAIN}-{NNN}.yml`
- **Covered_By_Rules**: 需求被哪些规则覆盖（REQ 文件中声明）
- **Requirement_IDs**: 规则覆盖哪些需求（规则 YAML 中声明）
- **Bidirectional_Traceability**: 双向追踪，REQ 和规则互相引用且一致
- **Health_Gate**: 健康门禁，根据阈值决定 CI 是否通过
- **Scenario**: 场景测试，描述业务语义而非规则ID（未来扩展）
- **Risk_Level**: 风险等级，枚举值为 `high | medium | low`，默认 `medium`

## Requirements

### Requirement 1

**User Story:** As a rule maintainer, I want to define requirements in separate YAML files, so that each requirement has clear boundaries and can be version controlled independently.

#### Acceptance Criteria

1. THE system SHALL store requirements in `requirements/REQ-{DOMAIN}-{NNN}.yml` format where DOMAIN is 2-4 uppercase letters and NNN is 3 digits
2. WHEN a requirement file is loaded THEN the system SHALL validate required fields: id, title, risk_level, covered_by_rules
3. WHEN a requirement file has invalid format THEN the system SHALL log a warning and skip the file without crashing
4. THE system SHALL support optional fields: description, tags, min_positive_samples, min_negative_samples

### Requirement 2

**User Story:** As a rule maintainer, I want rules to declare which requirements they cover, so that I can trace from rules back to requirements.

#### Acceptance Criteria

1. THE Rule YAML schema SHALL accept an optional `requirement_ids` field as a list of strings
2. WHEN loading rules without `requirement_ids` THEN the system SHALL default to an empty list
3. THE system SHALL remain backward compatible with existing rule files that lack `requirement_ids`

### Requirement 3

**User Story:** As a rule maintainer, I want bidirectional traceability validation, so that REQ and rule references stay consistent.

#### Acceptance Criteria

1. WHEN running health check THEN the system SHALL detect orphan references: REQ claims coverage by a rule that doesn't exist
2. WHEN running health check THEN the system SHALL detect missing backlinks: REQ claims coverage by a rule, but the rule doesn't list that REQ in requirement_ids
3. WHEN running health check THEN the system SHALL detect dangling references: rule lists a REQ that doesn't exist
4. THE system SHALL report all traceability violations in the health check output

### Requirement 4

**User Story:** As a rule maintainer, I want requirement coverage statistics in health check, so that I can see which requirements have rule and sample coverage.

#### Acceptance Criteria

1. WHEN running health check THEN the system SHALL report: total requirements, requirements with rules, requirements with rules AND samples
2. WHEN running health check THEN the system SHALL calculate requirement coverage percentage as (requirements_with_rules_and_samples / total_requirements) * 100
3. THE system SHALL support a configurable `requirement_coverage_threshold` in health_thresholds.yml
4. WHEN requirement coverage is below threshold THEN the system SHALL log a warning (not block CI in V1)
5. WHEN total_requirements is 0 THEN requirement coverage SHALL be reported as 100% (or N/A) and SHALL NOT cause division-by-zero error

### Requirement 5

**User Story:** As a rule maintainer, I want the health check to output requirement layer statistics, so that I can answer "is REQ-X covered by rules and samples?"

#### Acceptance Criteria

1. WHEN running health check with --verbose THEN the system SHALL output per-requirement status: rule coverage, sample coverage, test pass/fail
2. WHEN running health check with --json THEN the system SHALL include requirement_stats in the JSON output
3. THE system SHALL group requirements by risk_level (high/medium/low) in the summary

### Requirement 6

**User Story:** As a rule maintainer, I want a pretty-printer for requirement coverage, so that I can quickly see the coverage status.

#### Acceptance Criteria

1. WHEN printing requirement coverage THEN the system SHALL use format: `[需求层] 总数: N / 无规则覆盖: M / 有规则无样本: K / 完全覆盖: L`
2. WHEN a high-risk requirement lacks coverage THEN the system SHALL highlight it in the output
3. THE system SHALL support both text and JSON output formats

### Requirement 7 (P2 - Future Extension)

**User Story:** As a rule maintainer, I want to associate scenarios with requirements, so that future health checks can include scenario coverage.

#### Acceptance Criteria

1. THE system SHALL allow associating Scenarios with requirement_ids in scenario YAML files
2. THE health_check MAY include scenario coverage by requirement in requirement_stats in future versions
3. THE scenario layer design SHALL NOT be implemented in V1, but the data model SHALL support future extension

