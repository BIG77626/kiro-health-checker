# 案例库：典型问题与修复模式

## 案例 1：悬空引用（Dangling Reference）

### 问题描述

Rule 引用了不存在的 REQ ID。

```yaml
# network_rules.yml
- id: NET-007
  requirement_ids: ["REQ-NET-001", "REQ-DELETED-001"]  # REQ-DELETED-001 不存在
```

### 检测方式

```python
result = check_traceability(requirements, rules)
assert "NET-007" in result.dangling_rule_refs
assert "REQ-DELETED-001" in result.dangling_rule_refs["NET-007"]
```

### 修复模式

1. 删除无效引用
2. 或创建对应的 REQ 文件

```yaml
# 修复后
- id: NET-007
  requirement_ids: ["REQ-NET-001"]  # 只保留有效引用
```

### 测试用例

```python
def test_check_traceability_dangling_reference():
    """Rule 引用不存在的 REQ 应被检测"""
    req = Requirement(id="REQ-001", title="Test")
    rule = Rule(id="RULE-001", requirement_ids=["REQ-001", "REQ-NOT-EXIST"])
    
    result = check_traceability({"REQ-001": req}, [rule])
    
    assert "RULE-001" in result.dangling_rule_refs
    assert "REQ-NOT-EXIST" in result.dangling_rule_refs["RULE-001"]
```

---

## 案例 2：孤儿需求（Orphan Requirement）

### 问题描述

REQ 文件存在，但没有任何 Rule 引用它。

```yaml
# requirements/REQ-OLD-001.yml
id: REQ-OLD-001
title: "过时的需求"
status: active  # 仍然是 active 状态
```

### 检测方式

```python
result = check_traceability(requirements, rules)
assert "REQ-OLD-001" in result.orphan_requirements
```

### 修复模式

**选项 A**：添加 Rule 引用
```yaml
# 某个 rule 文件
- id: RULE-XXX
  requirement_ids: ["REQ-OLD-001"]
```

**选项 B**：标记为 deprecated（故意孤儿）
```yaml
# requirements/REQ-OLD-001.yml
id: REQ-OLD-001
title: "过时的需求"
status: deprecated  # 标记为 deprecated，不再计入 orphan
```

### 测试用例

```python
def test_deprecated_requirement_not_counted_as_orphan():
    """deprecated REQ 不计入 orphan"""
    req = Requirement(
        id="REQ-OLD-001",
        title="Old requirement",
        status=RequirementStatus.DEPRECATED
    )
    
    result = check_traceability({"REQ-OLD-001": req}, [])
    
    assert "REQ-OLD-001" not in result.orphan_requirements
```

---

## 案例 3：性能退化

### 问题描述

coverage 计算耗时从 O(n+m) 退化为 O(n*m)。

### 检测方式

```python
@pytest.mark.slow
def test_coverage_calculation_scaling_linear():
    t1 = measure(100_items)
    t2 = measure(200_items)
    
    # 如果是 O(n*m)，t2 会是 t1 的 4x
    # 如果是 O(n+m)，t2 应该是 t1 的 ~2x
    assert t2 < t1 * 2.5, f"性能退化: ratio={t2/t1:.2f}"
```

### 修复模式

**问题代码**（O(n*m)）：
```python
for req in requirements:
    for rule in rules:
        if req.id in rule.requirement_ids:
            ...
```

**修复后**（O(n+m)）：
```python
# 预建索引
rule_to_reqs = {rule.id: set(rule.requirement_ids) for rule in rules}
req_to_rules = defaultdict(set)
for rule_id, req_ids in rule_to_reqs.items():
    for req_id in req_ids:
        req_to_rules[req_id].add(rule_id)

# O(1) 查找
for req in requirements:
    covering_rules = req_to_rules.get(req.id, set())
```

---

## 案例 4：JSON 输出污染

### 问题描述

`--json` 模式输出包含非 JSON 内容（如 ANSI 颜色码、日志）。

### 检测方式

```python
def test_e2e_subprocess_json_verbose_pure_json():
    result = subprocess.run([
        sys.executable, "-m", "simplified.health_check",
        "--json", "--verbose"
    ], capture_output=True, text=True)
    
    # 必须是纯 JSON
    parsed = json.loads(result.stdout)
    
    # 无 ANSI 颜色码
    assert "\033[" not in result.stdout
```

### 修复模式

1. 日志走 stderr，不走 stdout
2. JSON 模式下禁用颜色输出
3. verbose 只影响日志级别，不影响 stdout 格式

```python
def main():
    if args.json:
        # JSON 模式：stdout 只输出 JSON
        print(json.dumps(report.to_dict()))
    else:
        # 文本模式：stdout 输出格式化文本
        print_text_report(report)
    
    # 日志始终走 stderr
    logger.info("Report generated")
```

---

## 案例 5：配置缺失导致崩溃

### 问题描述

`health_config.yml` 不存在时，程序崩溃。

### 检测方式

```python
def test_e2e_subprocess_config_missing_graceful_degrade(tmp_path):
    result = subprocess.run([
        sys.executable, "-m", "simplified.health_check", "--json"
    ], capture_output=True, text=True, cwd=tmp_path)
    
    # 应该正常运行，使用默认配置
    assert result.returncode == 0
    parsed = json.loads(result.stdout)
    assert "total_rules" in parsed
```

### 修复模式

```python
def load_health_config(config_path=None):
    if config_path is None:
        config_path = Path(__file__).parent / "health_config.yml"
    
    # 优雅降级
    if not config_path.exists():
        logger.info(f"Config not found at {config_path}, using defaults")
        return HealthConfig()  # 返回默认配置
    
    try:
        return HealthConfig.model_validate(yaml.safe_load(...))
    except Exception as e:
        logger.warning(f"Error loading config: {e}, using defaults")
        return HealthConfig()  # 出错也返回默认配置
```

---

## 问题分类速查

| 问题类型 | 检测文件 | 关键测试 |
|----------|----------|----------|
| 悬空引用 | `test_review_traceability.py` | `test_check_traceability_dangling_reference` |
| 孤儿需求 | `test_review_traceability.py` | `test_check_traceability_orphan_requirement` |
| 性能退化 | `test_review_performance.py` | `test_coverage_calculation_scaling_linear` |
| JSON 污染 | `test_review_cli_output.py` | `test_e2e_subprocess_json_verbose_pure_json` |
| 配置缺失 | `test_review_cli_output.py` | `test_e2e_subprocess_config_missing_graceful_degrade` |
