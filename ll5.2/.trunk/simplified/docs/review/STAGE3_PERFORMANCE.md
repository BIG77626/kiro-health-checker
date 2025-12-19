# Stage 3: 性能基线与可观测性审查

## 目标

验证性能复杂度为 O(n+m)，输出格式符合契约，退出码策略正确。

## 测试文件

- `tests/test_review_traceability.py` - 19 个测试（Traceability）
- `tests/test_review_cli_output.py` - 24 个测试（CLI Output）
- `tests/test_review_performance.py` - 5 个测试（Performance）

## 审查维度

### 1. Traceability 追踪完整性

**检测两类问题**：

| 问题类型 | 定义 | 示例 |
|----------|------|------|
| orphan_requirements | REQ 存在但无 Rule 引用 | REQ-OLD-001 无人实现 |
| dangling_rule_refs | Rule 引用不存在的 REQ | NET-007 → REQ-DELETED |

**关键设计决策**：

- 只检查单向：`Rule.requirement_ids → Requirement.id`
- 无 `missing_backlink`（当前设计无双向指针）
- `deprecated` 状态的 REQ 不算 orphan（故意孤儿）
- 悬空引用只 warn，不 raise

```python
def test_deprecated_requirement_not_counted_as_orphan():
    """deprecated REQ 不计入 orphan"""
    req = Requirement(id="REQ-OLD-001", status=RequirementStatus.DEPRECATED)
    result = check_traceability({"REQ-OLD-001": req}, [])
    assert "REQ-OLD-001" not in result.orphan_requirements
```

### 2. CLI Output 输出契约

**三种模式**：

| 模式 | 特征 | 用途 |
|------|------|------|
| 默认 | 只显示摘要（数量） | 人类快速浏览 |
| verbose | 显示详细 ID 列表 | 排查问题 |
| JSON | 机器可解析 | CI 集成 |

```python
def test_default_output_shows_summary_only():
    """默认模式只显示摘要，不泄露 ID 列表"""
    output = capture_text_report(report, verbose=False)
    assert "孤儿需求 (无规则引用): 2" in output
    assert "REQ-001" not in output  # 不显示具体 ID

def test_verbose_output_shows_traceability_details():
    """verbose 模式显示详细 ID 列表"""
    output = capture_text_report(report, verbose=True)
    assert "孤儿需求列表:" in output
    assert "REQ-001" in output  # 显示具体 ID
```

### 3. 退出码策略

| 配置 | 条件 | 退出码 |
|------|------|--------|
| `exit_on_under_coverage: false` | 任何情况 | 0 |
| `exit_on_under_coverage: true` | 覆盖率 < threshold | 1 |
| `exit_on_traceability_issues: true` | 存在 orphan/dangling | 1 |

```python
def test_exit_code_zero_when_no_failure_configured():
    cfg = HealthConfig()  # 默认不 gate
    report = HealthCheckReport(coverage_meets_threshold=False)
    assert _calculate_exit_code(report, cfg) == 0

def test_exit_code_one_when_under_coverage_and_gate_enabled():
    cfg = HealthConfig()
    cfg.requirements.exit_on_under_coverage = True
    report = HealthCheckReport(coverage_meets_threshold=False)
    assert _calculate_exit_code(report, cfg) == 1
```

### 4. 性能基线

**验证复杂度，不验证绝对速度**：

```python
@pytest.mark.slow
def test_coverage_calculation_scaling_linear():
    """规模翻倍，耗时 < 2.5x → O(n+m) 复杂度"""
    t1 = measure(benchmark_dataset)   # 100 REQ, 100 Rules
    t2 = measure(doubled_dataset)     # 200 REQ, 200 Rules
    assert t2 < t1 * 2.5
```

**Benchmark Dataset**：
- 100 REQ, 100 Rules
- 20% HIGH risk
- 每个 Rule 引用 1-2 个 REQ

### 5. 真实进程边界测试

使用 `subprocess` 而非 `monkeypatch`：

```python
def test_e2e_subprocess_json_verbose_pure_json():
    """真实进程边界：--json --verbose 输出纯 JSON"""
    result = subprocess.run([
        sys.executable, "-m", "simplified.health_check",
        "--json", "--verbose"
    ], capture_output=True, text=True)
    
    assert result.returncode == 0
    parsed = json.loads(result.stdout)  # 必须是纯 JSON
    assert "\033[" not in result.stdout  # 无 ANSI 码
```

## 运行性能测试

```bash
# 默认跳过 slow 测试
python scripts/verify_review.py

# 包含性能测试
python scripts/verify_review.py --slow
```

## 检查清单

### Traceability
- [ ] orphan_requirements 检测正确
- [ ] dangling_rule_refs 检测正确
- [ ] deprecated REQ 不计入 orphan
- [ ] 悬空引用只 warn 不 raise

### CLI Output
- [ ] 默认模式只显示摘要
- [ ] verbose 模式显示详情
- [ ] JSON 输出可解析
- [ ] JSON 向后兼容

### Exit Code
- [ ] 默认不 gate（exit 0）
- [ ] exit_on_under_coverage 生效
- [ ] exit_on_traceability_issues 生效

### Performance
- [ ] coverage 计算 O(n+m)
- [ ] traceability 检查 O(n+m)
- [ ] 打印开销 < 计算开销 2x
