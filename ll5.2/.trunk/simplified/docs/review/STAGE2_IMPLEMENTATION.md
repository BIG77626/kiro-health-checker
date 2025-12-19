# Stage 2: 实现与集成审查

## 目标

验证 Config-as-Policy 模式正确实现，开关行为符合预期。

## 测试文件

`tests/test_review_stage2.py` - 6 个测试

## 审查维度

### 1. Config-as-Policy 验证

**原则**：策略在 YAML，行为在 Python。

```yaml
# health_config.yml
requirements:
  enabled: true
  coverage_threshold: 70.0
  exit_on_under_coverage: false
```

```python
def test_config_as_policy_implemented():
    """验证 Config-as-Policy 模式"""
    cfg = load_health_config()
    
    # 策略字段存在
    assert hasattr(cfg.requirements, "coverage_threshold")
    assert hasattr(cfg.requirements, "exit_on_under_coverage")
    
    # 策略值可读取
    assert isinstance(cfg.requirements.coverage_threshold, float)
```

### 2. 开关行为验证

```python
def test_requirement_layer_disabled_returns_none():
    """requirements.enabled=False 时，不计算需求层"""
    cfg = HealthConfig()
    cfg.requirements.enabled = False
    
    # 模拟 run_health_check 行为
    # 当 enabled=False 时，requirement_coverage 应为 None
    ...

def test_requirement_layer_enabled_returns_coverage_data():
    """requirements.enabled=True 时，返回覆盖数据"""
    cfg = HealthConfig()
    cfg.requirements.enabled = True
    
    # 当 enabled=True 时，应返回有效数据
    ...
```

### 3. 配置加载行为

```python
def test_health_config_default_values():
    """验证默认配置值"""
    cfg = HealthConfig()
    assert cfg.requirements.coverage_threshold == 10.0
    assert cfg.requirements.exit_on_under_coverage == False

def test_health_config_yaml_loading(tmp_path):
    """验证 YAML 加载行为"""
    config_file = tmp_path / "health_config.yml"
    config_file.write_text("requirements:\n  coverage_threshold: 85.0")
    
    cfg = load_health_config(config_file)
    assert cfg.requirements.coverage_threshold == 85.0

def test_health_config_missing_file_uses_defaults():
    """配置文件不存在时使用默认值"""
    cfg = load_health_config(Path("/nonexistent/config.yml"))
    assert cfg.requirements.coverage_threshold == 10.0  # 默认值
```

## Config-as-Policy 设计模式

### 策略层（YAML）

```yaml
# 只放「什么」，不放「怎么做」
requirements:
  coverage_threshold: 70.0      # 阈值是多少
  exit_on_under_coverage: false # 是否 gate
  
traceability:
  enabled: true                 # 是否启用
  warn_on_orphans: true         # 是否警告
```

### 行为层（Python）

```python
# 只放「怎么做」，不放「什么」
def _calculate_exit_code(report, cfg):
    if cfg.requirements.exit_on_under_coverage:
        if not report.coverage_meets_threshold:
            return 1
    return 0
```

### 好处

1. **可审计**：策略变更只需看 YAML diff
2. **可测试**：行为测试不依赖具体阈值
3. **可运维**：无需改代码即可调整策略

## 检查清单

- [ ] Config-as-Policy 模式正确实现
- [ ] `enabled=False` 时跳过计算
- [ ] `enabled=True` 时返回有效数据
- [ ] 默认配置值正确
- [ ] YAML 加载行为正确
- [ ] 配置文件缺失时优雅降级
