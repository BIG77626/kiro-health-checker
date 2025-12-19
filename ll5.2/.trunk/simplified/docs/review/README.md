# Review Verification System

> 将三阶段审查机制从「隐性知识」变成「任何人可执行、可传承、可演化的团队基础设施」

## 核心原则

1. **行为级验证**：只测「输入→输出」，不测内部实现
2. **Config-as-Policy**：所有策略走 `health_config.yml`，代码无硬编码
3. **五维度审查**：架构、命名、简洁、性能、可运维

## 快速开始

```bash
# 本地运行快速审查（59 tests, < 2s）
python scripts/verify_review.py

# 包含性能基线（62 tests, ~2s）
python scripts/verify_review.py --slow

# 详细输出
python scripts/verify_review.py -v
```

## 审查阶段速查表

| 阶段 | 目标 | 测试文件 | 测试数 | 耗时 |
|------|------|----------|--------|------|
| Stage 1 | 范围/映射 | `test_review_stage1.py` | 5 | < 0.1s |
| Stage 2 | 实现/集成 | `test_review_stage2.py` | 6 | < 0.2s |
| Cross-Stage | 一致性 | `test_review_cross_stage.py` | 5 | < 0.1s |
| Stage 3 PR1 | Traceability | `test_review_traceability.py` | 19 | < 0.3s |
| Stage 3 PR2 | CLI Output | `test_review_cli_output.py` | 24 | < 0.5s |
| Stage 3 PR3 | Performance | `test_review_performance.py` | 5 | ~1.5s |

## 目录结构

```
docs/review/
├── README.md                 # 本文件：审查体系总览
├── OPERATIONS.md            # 运营手册：职责、流程、演化机制
├── WORKFLOW.md              # 日常开发流程与绕过机制
├── STAGE1_SCOPE.md          # 阶段一：如何锁定范围与映射
├── STAGE2_IMPLEMENTATION.md # 阶段二：如何验证实现与行为
├── STAGE3_PERFORMANCE.md    # 阶段三：如何做性能基线
└── CASE_STUDIES.md          # 案例库：典型问题与修复模式
```

## CI 集成

PR 自动触发审查流水线：

- **fast-check**：默认运行，59 tests
- **performance-baseline**：需手动打标签 `run-performance`

详见 `.github/workflows/review-verification.yml`

## 配置文件

| 文件 | 用途 |
|------|------|
| `health_config.yml` | 健康检查策略（阈值、开关） |
| `pytest.ini` | pytest 配置（markers） |

## 关键概念

### 行为级测试 vs 实现级测试

| 类型 | 特征 | 示例 |
|------|------|------|
| 行为级 ✅ | 验证输入→输出契约 | `assert result.orphan_count == 2` |
| 实现级 ❌ | 检查内部 API | `assert "orphan_requirements" in model_fields` |

### Config-as-Policy

```yaml
# health_config.yml
requirements:
  coverage_threshold: 70.0      # 策略：阈值
  exit_on_under_coverage: false # 策略：是否 gate
```

```python
# health_check.py
if cfg.requirements.exit_on_under_coverage:  # 行为：读取策略
    exit_code = 1
```

## 新人 Onboarding

1. 阅读本文档（5 分钟）
2. 运行 `python scripts/verify_review.py`（1 分钟）
3. 阅读 `STAGE1_SCOPE.md`（10 分钟）
4. 尝试修改一个测试，观察 CI 反应（15 分钟）

## 相关文档

- [CLI Output 文档](../cli-output.md)
- [需求覆盖追踪 Spec](../../../.kiro/specs/requirement-coverage-tracking/)
