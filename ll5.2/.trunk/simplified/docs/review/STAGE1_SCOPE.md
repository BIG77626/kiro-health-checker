# Stage 1: 范围与映射审查

## 目标

锁定审查范围，验证核心模型字段存在且行为正确。

## 测试文件

`tests/test_review_stage1.py` - 5 个测试

## 审查维度

### 1. 文件存在性检查

验证关键文件存在：

```python
def test_review_scope_files_exist():
    """验证审查范围内的关键文件存在"""
    assert (simplified_dir / "requirement_models.py").exists()
    assert (simplified_dir / "requirement_coverage.py").exists()
    assert (simplified_dir / "health_config_models.py").exists()
```

### 2. 模型字段行为验证

**原则**：不检查 Pydantic 内部 API，只验证字段行为。

❌ 错误做法（实现级）：
```python
# 检查 Pydantic 内部 API
assert "requirement_ids" in Rule.model_fields
```

✅ 正确做法（行为级）：
```python
# 验证字段行为
def test_rule_requirement_ids_field_behavior():
    rule = Rule(id="TEST-001", ...)
    assert rule.requirement_ids == []  # 默认值行为
    
    rule_with_refs = Rule(id="TEST-002", requirement_ids=["REQ-001"])
    assert rule_with_refs.requirement_ids == ["REQ-001"]  # 赋值行为
```

### 3. ID 格式验证

```python
def test_requirement_id_format_validation():
    """验证 REQ ID 格式校验行为"""
    # 有效格式
    req = Requirement(id="REQ-NET-001", title="Test")
    assert req.id == "REQ-NET-001"
    
    # 无效格式应抛出 ValidationError
    with pytest.raises(ValidationError):
        Requirement(id="INVALID", title="Test")
```

## 常见问题

### Q: 为什么不直接检查 `model_fields`？

A: `model_fields` 是 Pydantic 内部 API，可能在版本升级时变化。行为级测试更稳定。

### Q: 如何判断一个测试是行为级还是实现级？

A: 问自己：「如果内部实现变了，但外部行为不变，这个测试会失败吗？」
- 如果会失败 → 实现级（不好）
- 如果不会失败 → 行为级（好）

## 检查清单

- [ ] 关键文件存在
- [ ] Rule.requirement_ids 字段行为正确
- [ ] RequirementCoverageResult 字段行为正确
- [ ] Requirement 模型字段行为正确
- [ ] REQ ID 格式验证行为正确
