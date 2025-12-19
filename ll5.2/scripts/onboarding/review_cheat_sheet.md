# Review Verification 速查卡

## 常用命令

```bash
# 快速审查（59 tests, < 2s）
python scripts/verify_review.py

# 包含性能测试（62 tests）
python scripts/verify_review.py --slow

# 详细输出
python scripts/verify_review.py -v

# 健康检查报告
python -m simplified.health_check
python -m simplified.health_check --json
python -m simplified.health_check --verbose
```

## 测试文件速查

| 文件 | 测试数 | 内容 |
|------|--------|------|
| `test_review_stage1.py` | 5 | 范围/映射 |
| `test_review_stage2.py` | 6 | Config-as-Policy |
| `test_review_cross_stage.py` | 5 | 一致性 |
| `test_review_traceability.py` | 19 | 追踪完整性 |
| `test_review_cli_output.py` | 24 | CLI 输出 |
| `test_review_performance.py` | 5 | 性能基线 |

## 关键概念

### 行为级 vs 实现级

```python
# ❌ 实现级（不好）
assert "field" in Model.model_fields

# ✅ 行为级（好）
obj = Model(field="value")
assert obj.field == "value"
```

### Config-as-Policy

```yaml
# health_config.yml - 策略
requirements:
  coverage_threshold: 70.0
```

```python
# Python - 行为
if cfg.requirements.exit_on_under_coverage:
    exit(1)
```

## 常见问题

### Q: 测试失败怎么办？

1. 运行 `python scripts/verify_review.py -v` 查看详情
2. 查看 `docs/review/CASE_STUDIES.md` 找类似案例
3. 问 mentor

### Q: 如何添加新测试？

1. 确定属于哪个 Stage
2. 在对应的 `test_review_stageX.py` 中添加
3. 遵循行为级测试原则

### Q: CI 失败怎么办？

1. 查看 GitHub Actions 日志
2. 下载 Evidence Artifact
3. 本地复现：`python scripts/verify_review.py -v`

## 文档链接

- [README](../../.trunk/simplified/docs/review/README.md)
- [Stage 1](../../.trunk/simplified/docs/review/STAGE1_SCOPE.md)
- [Stage 2](../../.trunk/simplified/docs/review/STAGE2_IMPLEMENTATION.md)
- [Stage 3](../../.trunk/simplified/docs/review/STAGE3_PERFORMANCE.md)
- [案例库](../../.trunk/simplified/docs/review/CASE_STUDIES.md)
