# 审查体系运营手册

> 将三阶段审查从「隐性知识」变成「团队显性制度」

## 1. 体系总览（What）

本体系通过 78 个行为级测试，确保「需求覆盖 + 双向追踪」功能的：

- **架构正确性**：无巨石化、单向依赖
- **性能基线**：O(n+m) 复杂度，overhead < 2x
- **可观测性**：JSON 日志 + Prometheus Metrics（可选）
- **向后兼容**：旧版 CLI/JSON 消费者无感知

### 测试分布

| 阶段 | 测试文件 | 测试数 | 耗时 |
|------|----------|--------|------|
| Stage 1 | `test_review_stage1.py` | 5 | < 0.1s |
| Stage 2 | `test_review_stage2.py` | 6 | < 0.2s |
| Cross-Stage | `test_review_cross_stage.py` | 5 | < 0.1s |
| Traceability | `test_review_traceability.py` | 19 | < 0.3s |
| CLI Output | `test_review_cli_output.py` | 22 | < 0.5s |
| Performance | `test_review_performance.py` | 5 (3 slow) | ~1.5s |
| Meta | `test_review_meta.py` | 16 | < 2s |

**总计**：75 tests (default) / 78 tests (--slow)

## 2. 运营职责（Who）

| 角色 | 职责 |
|------|------|
| **开发者** | 每次 PR 前本地运行 `python scripts/verify_review.py` |
| **Reviewer** | 审查 PR 时检查 CI 评论中的 Review Evidence |
| **On-Call** | 收到 `CoverageDropped` 告警时，查看 `docs/review/CASE_STUDIES.md` |
| **新成员** | 入职第一天跑 `bash scripts/onboarding/run_first_review.sh` |

## 3. 运营流程（How）

### 日常开发

```bash
# 1. 开发前 - 确保基线通过
python scripts/verify_review.py

# 2. 开发中 - pre-commit 钩子自动跑快速检查
git add . && git commit -m "feat: xxx"

# 3. 提交 PR
# CI 自动评论审查结果，Reviewer 根据结果批准/拒绝
```

### 性能退化处理

```bash
# 1. 发现 CI 性能测试警告
# 评论中会显示: "Performance degradation detected"

# 2. 本地复现
python scripts/verify_review.py --slow -v

# 3. 对比基线
# 查看 docs/review/STAGE3_PERFORMANCE.md 中的基线数据
# 如果确认退化，提 Issue 并打 `performance` 标签
```

### 告警响应

```bash
# 收到告警 "CoverageDropped < 70%"

# 1. 查看健康检查报告
python -m simplified.health_check --json | jq '.requirement_coverage'

# 2. 定位问题
# 通常是 requirements/*.yml 新增但未关联规则
# 或者规则删除但 REQ 文件未更新

# 3. 修复后重新运行审查
python scripts/verify_review.py -v
```

## 4. 演化机制（When）

### 新增审查维度

例如：新增安全扫描维度

1. 在 `docs/review/STAGE5_SECURITY.md` 中编写设计
2. 新增 `tests/test_review_security.py` 行为级测试
3. 更新 CI 流水线，加入 security 检查 job
4. 在 `CASE_STUDIES.md` 中补充安全案例

### 性能基线更新

1. 每季度手动运行 `python scripts/verify_review.py --slow`
2. 将新的基线数据写入 `docs/review/STAGE3_PERFORMANCE.md`
3. 在本文档中记录更新时间

### 配置变更

所有策略变更通过 `health_config.yml`：

```yaml
# 示例：开启覆盖率门禁
requirements:
  coverage_threshold: 70.0
  exit_on_under_coverage: true  # V2 开启
```

## 5. 验收检查清单

### CI 真实阻塞验证

- [ ] 提交破坏性 PR，CI 自动评论失败详情
- [ ] 合并按钮变灰（需配置 GitHub 分支保护）
- [ ] PR 作者能在评论中看到失败详情

### 新人 Onboarding 验证

- [ ] 新成员按 `docs/review/README.md` 成功运行审查
- [ ] 30 分钟内完成首次审查并生成证据包
- [ ] 能理解「行为级测试」vs「实现级测试」区别

### 知识库可检索验证

- [ ] 在 `CASE_STUDIES.md` 中搜索「悬空引用」能找到定义
- [ ] 在 `CASE_STUDIES.md` 中搜索「孤儿需求」能找到修复模式

## 6. GitHub 分支保护配置

访问 `https://github.com/<org>/<repo>/settings/branches`，添加规则：

```
Branch name pattern: main
✅ Require status checks to pass before merging
   - review-verification / Fast Review Check (Python 3.12)
✅ Require conversation resolution before merging
✅ Do not allow bypassing the above settings
```

## 7. 可观测性配置（可选）

### 结构化日志

健康检查已支持 JSON 输出：

```bash
python -m simplified.health_check --json > health_report.json
```

输出示例：

```json
{
  "generated_at": "2024-12-19T14:30:00",
  "coverage_percentage": 85.0,
  "requirement_coverage": {
    "total_requirements": 10,
    "coverage_percentage": 80.0
  },
  "traceability": {
    "orphan_count": 0,
    "dangling_count": 0,
    "has_issues": false
  }
}
```

### Prometheus Metrics（未来扩展）

如需 Prometheus 集成，可在 `health_check.py` 中添加：

```python
# simplified/metrics.py (轻量级，不引入新依赖)
from prometheus_client import Counter, Histogram, Gauge

COVERAGE_PERCENTAGE = Gauge(
    'health_check_coverage_percentage',
    'Current requirement coverage percentage'
)

TRACEABILITY_ISSUES = Counter(
    'health_check_traceability_issues_total',
    'Total traceability issues found',
    ['type']  # orphan, dangling
)
```

## 8. 版本历史

| 日期 | 版本 | 变更 |
|------|------|------|
| 2024-12-19 | v1.0 | 初始版本，62 tests |

---

## 附录：快速命令速查

```bash
# 快速审查（59 tests）
python scripts/verify_review.py

# 完整审查（62 tests，含性能）
python scripts/verify_review.py --slow

# 详细输出
python scripts/verify_review.py -v

# 生成 JUnit XML 报告
python scripts/verify_review.py --xml review_evidence.xml

# 健康检查 JSON 输出
python -m simplified.health_check --json

# 新人首次审查
bash scripts/onboarding/run_first_review.sh
```
