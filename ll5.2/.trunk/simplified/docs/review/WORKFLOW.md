# Review Verification Workflow

## 日常开发流程

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   编写代码   │ ──▶ │  git commit │ ──▶ │  Push PR    │
└─────────────┘     └─────────────┘     └─────────────┘
                          │                    │
                          ▼                    ▼
                    ┌─────────────┐     ┌─────────────┐
                    │ Pre-commit  │     │   CI 审查   │
                    │ (3 tests)   │     │ (59 tests)  │
                    └─────────────┘     └─────────────┘
```

## Pre-commit 钩子

### 行为

- 运行 3 个核心测试（< 1 秒）
- 失败时阻塞 commit
- 成功时继续 commit

### 何时可以绕过

| 场景 | 是否可绕过 | 方式 |
|------|-----------|------|
| WIP Commit | ✅ 可以 | `git commit --no-verify -m "WIP: experimenting"` |
| 紧急修复 | ✅ 可以 | 在 PR 描述中注明「Bypassed pre-commit due to urgency」 |
| 钩子本身故障 | ✅ 可以 | 提 Issue 修复钩子，而非长期绕过 |
| 正常开发 | ❌ 不建议 | 修复问题后再 commit |

> ⚠️ 绕过钩子后，CI 仍会强制执行完整审查，因此无法逃避质量门禁。

### 绕过命令

```bash
# WIP commit
git commit --no-verify -m "WIP: experimenting with new approach"

# 紧急修复
git commit --no-verify -m "HOTFIX: critical bug in production"
```

## CI 审查流水线

### 触发条件

PR 修改以下路径时自动触发：
- `.trunk/simplified/**`
- `.trunk/simplified/tests/test_review*.py`
- `.kiro/specs/**`
- `scripts/verify_review.py`

### Job 说明

| Job | 测试数 | 耗时 | 阻塞合并 |
|-----|--------|------|----------|
| fast-check | 59 | < 2s | ✅ 是 |
| performance-baseline | 62 | ~2s | ❌ 否（需打标签触发） |

### 性能测试触发

1. 在 PR 上打标签 `run-performance`
2. CI 自动触发性能基线测试
3. 结果作为 PR Comment，不强制失败

### 查看结果

1. 打开 PR 页面
2. 查看 Checks 状态
3. 点击 Details 查看详细日志
4. 下载 Artifact 获取 JUnit XML 报告

## 本地调试

```bash
# 快速审查（与 pre-commit 相同）
python scripts/verify_review.py

# 详细输出
python scripts/verify_review.py -v

# 包含性能测试
python scripts/verify_review.py --slow

# 生成 JUnit XML 报告
python scripts/verify_review.py --xml review_evidence.xml
```

## 常见问题

### Q: Pre-commit 太慢怎么办？

A: 当前版本只跑 3 个测试（< 1s）。如果仍然太慢，检查：
- Python 环境是否正确
- 是否有其他 pre-commit 钩子

### Q: CI 失败但本地通过？

A: 可能原因：
1. Python 版本差异（CI 跑 3.10/3.11/3.12 矩阵）
2. 依赖版本差异
3. 环境变量差异

调试步骤：
```bash
# 检查 Python 版本
python --version

# 重新安装依赖
pip install pytest pydantic pyyaml hypothesis --upgrade

# 运行完整测试
python scripts/verify_review.py -v
```

### Q: 如何跳过性能测试？

A: 性能测试默认不运行，只有打 `run-performance` 标签才触发。

### Q: 如何添加新的审查测试？

A: 
1. 确定属于哪个 Stage
2. 在对应的 `test_review_stageX.py` 中添加
3. 遵循行为级测试原则
4. 更新 `docs/review/STAGEX_*.md` 文档
