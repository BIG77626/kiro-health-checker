# Design Document: Requirement Coverage Tracking

## Overview

在已完成的规则测试样本库基础上，增加需求层覆盖检查和双向追踪机制。

**设计目标**：
- 最小改动：复用现有 health_check.py，仅扩展功能
- 向后兼容：现有规则文件无需修改即可继续工作
- 增量扩展：新增 requirements/ 目录和 Requirement 模型
- 可测试性：核心逻辑封装为纯函数，便于单元测试

**架构边界**：
- health_check 只消费 RuleTestRunner 的 summary，不重写执行逻辑
- 需求加载逻辑独立于规则加载逻辑
- 双向追踪验证在 health_check 中执行，不影响规则执行

**重要定位声明**：
> 需求覆盖度只代表 **在已声明需求范围内** 没有发现违约，不代表整体系统安全。
> 这是 **Risk Radar（风险雷达）**，不是 Safety Proof（安全证明）。

**REQ 资产管理原则**：
- REQ 的增删改视为"架构决策"，走设计文档同级别的 review 流程
- 严格限制"谁能新增/修改 REQ"（仅项目 Owner）
- 先从 `risk_level=high` 的需求开始，控制 REQ 增速

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                 Requirement Coverage Tracking                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [需求层]                                                        │
│  requirements/REQ-NET-001.yml ─────┐                            │
│  requirements/REQ-SEC-001.yml ─────┼─► RequirementLoader        │
│  requirements/REQ-AUTH-001.yml ────┘        │                   │
│                                             ▼                   │
│                                    List[Requirement]            │
│                                             │                   │
│  [规则层]                                   │                   │
│  rules/network_rules.yml ──────────┐        │                   │
│  rules/security_rules.yml ─────────┼─► RuleRegistry             │
│  rules/core_rules.yml ─────────────┘        │                   │
│                                             ▼                   │
│                                    List[Rule] (with req_ids)    │
│                                             │                   │
│  [测试层]                                   │                   │
│  rule_tests/*.yml ─────────────────► RuleTestRunner             │
│                                             │                   │
│                                             ▼                   │
│                                    RuleTestSummary              │
│                                             │                   │
│  [健康检查]                                 │                   │
│  health_check.py ◄─────────────────────────┘                   │
│      │                                                          │
│      ├─► check_requirement_coverage()                           │
│      ├─► check_bidirectional_traceability()                     │
│      └─► print_requirement_stats()                              │
│                                                                  │
│  [配置]                                                          │
│  rule_tests/health_thresholds.yml                               │
│      - requirement_coverage_threshold: 10                       │
│      - high_risk_must_have_samples: true                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Requirement Model

需求的 Pydantic 模型，对应 `requirements/REQ-*.yml` 文件。

```python
class RiskLevel(str, Enum):
    """风险等级"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

class Requirement(BaseModel):
    """需求模型 (REQ-1.1, REQ-1.2)"""
    
    # 必填字段
    id: str = Field(
        description="需求ID，格式 REQ-{DOMAIN}-{NNN}",
        pattern=r"^REQ-[A-Z]{2,4}-\d{3}$"
    )
    title: str = Field(min_length=1, description="需求标题")
    risk_level: RiskLevel = Field(
        default=RiskLevel.MEDIUM,
        description="风险等级"
    )
    covered_by_rules: List[str] = Field(
        default_factory=list,
        description="覆盖此需求的规则ID列表"
    )
    
    # 可选字段
    description: str = Field(default="", description="需求描述")
    tags: List[str] = Field(default_factory=list, description="标签")
    min_positive_samples: int = Field(default=3, ge=0, description="最少正例数")
    min_negative_samples: int = Field(default=3, ge=0, description="最少反例数")
```

### 2. RequirementLoader

加载 requirements/ 目录下的所有需求文件。

```python
class RequirementLoader:
    """需求加载器 (REQ-1.1, REQ-1.3)"""
    
    def __init__(self, requirements_dir: Path = None):
        """
        Args:
            requirements_dir: 需求目录，默认 rule_tests/requirements/
        """
        ...
    
    def load_all(self) -> Dict[str, Requirement]:
        """
        加载所有需求文件
        
        Returns:
            Dict[str, Requirement]: req_id -> Requirement 映射
            
        Note:
            - 无效文件只 log warning，不抛异常
            - 文件名必须匹配 REQ-*.yml 格式
        """
        ...
```

### 3. Extended Rule Model

扩展现有 Rule 模型，添加 requirement_ids 字段。

```python
# 在 models.py 中扩展 Rule 类
class Rule(BaseModel):
    # ... 现有字段 ...
    
    # 新增字段（可选，向后兼容）
    requirement_ids: List[str] = Field(
        default_factory=list,
        description="此规则覆盖的需求ID列表"
    )
```

### 4. RequirementCoverageChecker

检查需求覆盖状态和双向追踪一致性。

```python
class RequirementCoverageResult(BaseModel):
    """需求覆盖检查结果"""
    
    # 统计
    total_requirements: int
    requirements_with_rules: int
    requirements_with_samples: int
    coverage_percentage: float
    
    # 按风险等级分组
    by_risk_level: Dict[str, RequirementGroupStats]
    
    # 追踪违规
    orphan_references: List[str]      # REQ 引用不存在的规则
    missing_backlinks: List[str]      # REQ 引用规则但规则没有反向引用
    dangling_references: List[str]    # 规则引用不存在的 REQ
    
    # 详细状态
    requirement_stats: List[RequirementStatus]

class RequirementCoverageChecker:
    """需求覆盖检查器 (REQ-3, REQ-4)"""
    
    def check(
        self,
        requirements: Dict[str, Requirement],
        rules: List[Rule],
        rule_test_summary: RuleTestSummary,
    ) -> RequirementCoverageResult:
        """
        检查需求覆盖状态
        
        Args:
            requirements: 需求字典
            rules: 规则列表
            rule_test_summary: 规则测试汇总
            
        Returns:
            RequirementCoverageResult: 检查结果
        """
        ...
    
    def check_bidirectional_traceability(
        self,
        requirements: Dict[str, Requirement],
        rules: List[Rule],
    ) -> Tuple[List[str], List[str], List[str]]:
        """
        检查双向追踪一致性 (REQ-3.1, REQ-3.2, REQ-3.3)
        
        Returns:
            Tuple[orphan_refs, missing_backlinks, dangling_refs]
        """
        ...
```

### 5. Extended HealthCheckReport

扩展现有 HealthCheckReport，添加需求层统计。

```python
@dataclass
class HealthCheckReport:
    # ... 现有字段 ...
    
    # 新增：需求层统计
    requirement_coverage: Optional[RequirementCoverageResult] = None
```

## Data Models

### Requirement YAML Schema

```yaml
# requirements/REQ-NET-001.yml
id: "REQ-NET-001"
title: "所有外部 HTTP 请求必须启用证书校验"
description: "禁止 verify=False，禁止不安全 SSL 上下文"
risk_level: "high"
tags: ["network", "security"]
covered_by_rules:
  - "NET-007"
  - "NET-001"
# 可选：样本数要求
min_positive_samples: 3
min_negative_samples: 3
```

### Extended Rule YAML Schema

```yaml
# rules/network_rules.yml (扩展)
- id: "NET-007"
  name: "检测不安全的网络请求"
  pattern: "requests.get\\(.*verify=False"
  severity: "high"
  # 新增字段
  requirement_ids:
    - "REQ-NET-001"
    - "REQ-SEC-015"
```

### Health Config (策略层结构化设计)

**设计原则**：
- 固定两级结构：`domain → key`，不超过 2-3 层嵌套
- 每个 domain 对应一个"关注点"
- 显式 schema + Pydantic 校验
- 所有新开关必须符合"域.动作"命名模式

```yaml
# .trunk/simplified/health_config.yml（与 health_check.py 同级）
version: 1  # 显式版本号，便于将来演进

requirements:
  coverage_threshold: 10.0        # V1：低，仅用于点亮仪表盘
  exit_on_failure: false          # V1 不 gate，V2 再考虑
  high_risk_gate_enabled: false   # 预留，默认关闭

traceability:
  warn_on_missing_backlinks: true
  warn_on_orphans: true
  warn_on_dangling: true

rules:
  min_positive_cases: 1           # 与 rule_tests/config.yml 对齐
  min_negative_cases: 1

output:
  show_requirement_layer: true
  show_traceability_details: true
```

### HealthConfig Pydantic 模型

```python
class RequirementsPolicy(BaseModel):
    """需求层策略"""
    coverage_threshold: float = 10.0
    exit_on_failure: bool = False
    high_risk_gate_enabled: bool = False

class TraceabilityPolicy(BaseModel):
    """追踪策略"""
    warn_on_missing_backlinks: bool = True
    warn_on_orphans: bool = True
    warn_on_dangling: bool = True

class RulesPolicy(BaseModel):
    """规则策略"""
    min_positive_cases: int = 1
    min_negative_cases: int = 1

class OutputPolicy(BaseModel):
    """输出策略"""
    show_requirement_layer: bool = True
    show_traceability_details: bool = True

class HealthConfig(BaseModel):
    """健康检查配置（策略层）"""
    version: int = 1
    requirements: RequirementsPolicy = RequirementsPolicy()
    traceability: TraceabilityPolicy = TraceabilityPolicy()
    rules: RulesPolicy = RulesPolicy()
    output: OutputPolicy = OutputPolicy()
```

### 配置项说明表

| Key | 默认值 | 含义 | 影响范围 |
|-----|--------|------|----------|
| requirements.coverage_threshold | 10.0 | 需求覆盖率低于该值时标记为 warning | 报表 + JSON 标记 |
| requirements.exit_on_failure | false | 覆盖率低于阈值时是否 exit 1 | 仅 health_check 退出码 |
| requirements.high_risk_gate_enabled | false | 是否对高风险 REQ 开启强 gate | 未来 V2 |
| traceability.warn_on_orphans | true | 是否在存在孤儿引用时打印 warning | 日志 & JSON |
| traceability.warn_on_missing_backlinks | true | 是否在缺失反向链接时打印 warning | 日志 & JSON |
| traceability.warn_on_dangling | true | 是否在存在悬空引用时打印 warning | 日志 & JSON |

### V1 行为约定（锁死在文档里）

1. **requirements/ 不存在时**：
   - 完全跳过需求层，不输出需求统计
   - 不改变 exit code（仍由 rule 测试 pass/fail 决定）

2. **存在 REQ 文件时**：
   - 计算需求覆盖率，写入 text + JSON 报告
   - 当覆盖率低于 `requirement_coverage_threshold` 时：
     - 在日志里打印 warning
     - 在 JSON 中标记 `requirement_risk: "warning"`
     - **不改变 exit code**

3. **追踪违规（orphan/missing_backlinks/dangling）**：
   - 全部只做 warning，不 gate

### V2 行为（Future Work，不在 V1 实现）

- 当 `high_risk_gate_enabled: true` 时：
  - 对 `risk_level=high` 的 REQ 额外进行 Gate
  - 可细化策略（如：高风险 REQ 必须有样本）

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Requirement schema validation
*For any* YAML file with missing required fields (id, title, covered_by_rules), loading it SHALL fail validation and the loader SHALL skip the file with a warning.
**Validates: Requirements 1.2, 1.3**

### Property 2: Rule backward compatibility
*For any* existing rule file without `requirement_ids` field, loading it SHALL succeed and `requirement_ids` SHALL default to an empty list.
**Validates: Requirements 2.2, 2.3**

### Property 3: Orphan reference detection
*For any* requirement that references a rule_id not in the rule registry, the health check SHALL report it as an orphan reference.
**Validates: Requirements 3.1**

### Property 4: Missing backlink detection
*For any* (req_id, rule_id) pair where REQ.covered_by_rules contains rule_id but Rule.requirement_ids does not contain req_id, the health check SHALL report it as a missing backlink.
**Validates: Requirements 3.2**

### Property 5: Coverage percentage calculation
*For any* set of requirements and rules, the coverage percentage SHALL equal (requirements_with_rules_and_samples / total_requirements) * 100, with 0 requirements yielding 100%.
**Validates: Requirements 4.2, 4.5**

### Property 6: Risk level grouping
*For any* set of requirements with different risk_levels, the summary SHALL correctly group them by high/medium/low.
**Validates: Requirements 5.3**

## Error Handling

| Error Scenario | Handling Strategy |
|----------------|-------------------|
| YAML parse error in REQ file | Log warning, skip file, continue loading others |
| Missing required field in REQ | Log warning with field name, skip file |
| Invalid risk_level value | Default to "medium", log warning |
| Division by zero (0 requirements) | Return 100% coverage, log info |
| Rule not found for REQ reference | Add to orphan_references list |
| REQ not found for rule reference | Add to dangling_references list |

## Testing Strategy

### Unit Tests
- Test Requirement model with/without optional fields
- Test RequirementLoader with valid/invalid YAML files
- Test backward compatibility with existing rule files
- Test coverage calculation with edge cases (0 requirements)

### Property-Based Tests (using Hypothesis)
- **Property 1**: Generate random YAML with missing fields, verify validation
- **Property 2**: Generate rules without requirement_ids, verify defaults
- **Property 3**: Generate REQ/rule combinations with orphan refs, verify detection
- **Property 4**: Generate mismatched REQ/rule pairs, verify backlink detection
- **Property 5**: Generate random REQ/rule/sample combinations, verify coverage math
- **Property 6**: Generate REQs with random risk_levels, verify grouping

### Integration Tests
- End-to-end: Create REQ files → Load → Run health check → Verify output
- Verify existing health_check behavior unchanged when no REQ files exist

## Implementation Notes

### 文件位置约定

```
.trunk/simplified/
├── requirements/               # 新增：需求文件目录（独立顶层，与 rules/ 并列）
│   ├── REQ-NET-001.yml
│   ├── REQ-SEC-001.yml
│   └── README.md
├── scenarios/                  # 预留：场景测试目录（Day 3 再用）
│   └── .gitkeep
├── health_config.yml           # 新增：健康检查配置（顶层，与 health_check.py 同级）
├── rule_tests/
│   ├── config.yml              # 现有：规则测试配置
│   └── *.yml                   # 现有：规则测试文件
├── health_check.py             # 扩展：增加需求层检查
├── requirement_loader.py       # 新增：需求加载器
└── models.py                   # 扩展：Rule 增加 requirement_ids
```

**物理边界原则**：
- `requirements/` 是独立业务实体，与 `rules/` 并列，不放在 `rule_tests/` 下
- `health_config.yml` 是全局策略，放在顶层便于查找和修改
- `scenarios/` 预留目录，Day 3 再实现

### 向后兼容策略

1. **Rule.requirement_ids**：可选字段，默认空列表
2. **requirements/ 目录**：不存在时跳过需求层检查
3. **health_thresholds.yml**：不存在时使用默认阈值
4. **health_check 输出**：无 REQ 文件时不显示需求层统计

### 日志要求

```python
# 加载需求时
logger.info(f"Loading requirements from {requirements_dir}")
logger.info(f"Loaded {len(requirements)} requirements")

# 发现追踪违规时
logger.warning(f"Orphan reference: {req_id} -> {rule_id} (rule not found)")
logger.warning(f"Missing backlink: {req_id} -> {rule_id} (rule doesn't reference REQ)")
logger.warning(f"Dangling reference: {rule_id} -> {req_id} (REQ not found)")

# 覆盖率统计
logger.info(f"[需求层] 总数: {total} / 无规则覆盖: {no_rules} / 有规则无样本: {no_samples} / 完全覆盖: {covered}")
```

### Day 0 启动前检查清单（不写代码）

1. **创建物理边界目录**：
   ```bash
   mkdir -p .trunk/simplified/requirements
   mkdir -p .trunk/simplified/scenarios
   touch .trunk/simplified/requirements/.gitkeep
   touch .trunk/simplified/scenarios/.gitkeep
   ```

2. **编写回滚脚本**（先写 rollback，再写 migrate）：
   ```python
   # scripts/migrate_to_req_coverage.py
   def rollback():
       shutil.rmtree("requirements/", ignore_errors=True)
       print("✅ 回滚完成：需求层已移除")
   ```

3. **定义第一个 REQ 文件模板**

### 24小时内最小可行目标

1. 新建 `requirements/REQ-NET-001.yml` 至少 1 条
2. 实现 `RequirementLoader` + `Requirement` 模型
3. 在 health_check 中：
   - 加载 requirements/
   - 统计 REQ 总数、covered_by_rules 非空的数量
   - 打印 `[需求层]` 统计文本
4. 用 `health_config.yml` 的阈值决定是否 warning
5. **验收标准**：能回答"REQ-NET-001 是绿了还是红了？"

### 72小时内 CI 集成目标

1. 完成双向追踪验证
2. 在 CI 中运行 `python -m simplified.health_check`
3. 用退出码决定是否标记构建为风险（V1 只 warning）

### 回滚机制

```python
# scripts/rollback_req_coverage.py
"""一键回滚：删除 requirements/ 目录，health_check 恢复旧行为"""
import shutil
from pathlib import Path

def rollback():
    req_dir = Path(".trunk/simplified/requirements")
    if req_dir.exists():
        shutil.rmtree(req_dir)
        print("✅ 回滚完成：需求层已移除")
    else:
        print("ℹ️ requirements/ 目录不存在，无需回滚")

if __name__ == "__main__":
    rollback()
```

**原则**：若方案不可回滚，则它不可用（RFC 1925）
