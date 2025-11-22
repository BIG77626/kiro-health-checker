# Phase 5 Trunk系统使用指南

**创建时间**: 2025-11-20 22:50  
**目标**: 指导Phase 5全项目Logger升级时如何使用Trunk系统

---

## 🎯 快速开始（30秒）

### Phase 5任务加载

```bash
# 进入项目根目录
cd d:\Quark\LLaMA-Factory

# 加载Phase 5所需Skills
python .claude/skills/_management/skill_trunk_manager.py load \
  Phase5-Logger-Upgrade \
  "全项目Logger v2.0升级（2000+ catch块）" \
  LOGGER-ROLLING-UPGRADE LOG-GOVERNANCE-AND-COST OBSERVABILITY-TOOLKIT development-discipline
```

**效果**:
- ✅ 4个Skills从`_repository/`复制到`_trunk/`
- ✅ AI自动读取主干Skills，严格遵循Iron Laws
- ✅ 主干保持极简（4个vs之前51个）

---

## 📋 当前主干状态

### 查看主干

```bash
python .claude/skills/_management/skill_trunk_manager.py status
```

**预期输出**:

```
=== Trunk Status ===

Active Tasks: 1

Task ID: Phase5-Logger-Upgrade
Description: 全项目Logger v2.0升级（2000+ catch块）
Loaded Skills:
  - LOGGER-ROLLING-UPGRADE (v1.0, warm, 大规模迁移方法论)
  - LOG-GOVERNANCE-AND-COST (v1.0, warm, 日志治理与成本控制)
  - OBSERVABILITY-TOOLKIT (v2.0++, hot, Logger v2.0核心)
  - development-discipline (v6.0, hot, Iron Law 8结构化错误上下文)

Total Skills in Trunk: 4
Trunk Size: ~85KB
```

---

## 🔧 Skills功能快速参考

### 1. LOGGER-ROLLING-UPGRADE.md

**用途**: 大规模迁移方法论（2000+ catch块）

**核心内容**:
- Phase 0: 全局审计（count_catch.ps1）
- Phase 1: 锁死新增（ESLint + Pre-commit Hook）
- Phase 2: P0核心迁移（手工精修）
- Phase 3: P1/P2批量迁移（半自动）
- Phase 4: 治理自动化（CI + 监控）

**Iron Laws**:
1. **增量迁移**: 每次只改1-2个文件
2. **锁死新增**: 禁止新增console.*和空catch
3. **P0优先**: 用户主流程和数据写入优先
4. **可回滚**: 保留v1.0兼容层

**Red Flags**:
- ❌ 任务完成不卸载（主干堆积）
- ❌ 一次加载10+个Skills（违背极简）
- ❌ 跳过P0直接改P2（优先级错误）

---

### 2. LOG-GOVERNANCE-AND-COST.md

**用途**: 日志治理与成本控制

**核心内容**:
- 环境分级（dev/test/staging/prod）
- 采样策略（随机/窗口/智能）
- 保留策略（14天/180天/365天）
- 性能SLO（<1ms, <100条/分钟）
- 成本优化（¥486 → ¥136/月）

**Iron Laws**:
1. **环境分级**: 生产只留ERROR/FATAL
2. **高频采样**: 埋点/心跳采样10-20%
3. **保留策略**: 应用14天，审计180天

**Red Flags**:
- ❌ 生产环境开启DEBUG
- ❌ 审计日志采样（合规要求）
- ❌ 日志永久保留（成本爆炸）

---

### 3. OBSERVABILITY-TOOLKIT v2.0++

**用途**: Logger v2.0核心基础设施

**核心内容**:
- 5级日志（FATAL/ERROR/WARN/INFO/DEBUG）
- W3C Trace Context（trace-id/span-id/parent-id）
- SecurityFilter（PII自动检测）
- §7-9: 全项目推广 + 治理 + 错误码管理

**Iron Laws**:
1. **所有日志使用Logger**: 禁止console.*
2. **W3C context注入**: 所有日志包含trace-id
3. **生产环境分级**: 只输出ERROR/FATAL
4. **PII自动过滤**: 敏感信息不明文
5. **FATAL只用于崩溃**: 避免告警疲劳
6. **嵌套操作用子span**: 性能profiling

**Red Flags**:
- ❌ console.log替代Logger
- ❌ 滥用FATAL级别
- ❌ 明文输出PII
- ❌ 跨服务不传traceparent

---

### 4. development-discipline v6.0

**用途**: Iron Law 8 - 结构化错误上下文

**核心内容**:
- Iron Law 8: 5个必选字段
  - errorType: error.name || 'DefaultError'
  - errorMsg: error.message || 'Error occurred'
  - errorCode: 'ERR_XXX'（从ERROR_CODE_REGISTRY.md注册）
  - fallback: 8选1（cached_data/empty_array/...）
  - impact: 4选1（no_impact/feature_degradation/data_loss/ui_blocked）

**Red Flags**:
- ❌ 空catch块
- ❌ 缺少errorCode/fallback/impact
- ❌ fallback描述与return不一致
- ❌ 可能泄露PII

---

## 🚀 工作流示例

### 场景1: P0核心文件迁移（learning-data-manager.js）

```bash
# 1. 确认主干已加载
python .claude/skills/_management/skill_trunk_manager.py status

# 2. 开始迁移
# AI会严格遵循主干4个Skills的Iron Laws

# 3. 对话示例
User: "开始迁移learning-data-manager.js（24个catch）"

AI（自动检查主干）:
"根据_trunk/LOGGER-ROLLING-UPGRADE.md Phase 2步骤:

Step 1: 列出所有catch块（24个）
Step 2: 分类（存储/云函数/埋点）
Step 3: 应用模板

根据_trunk/development-discipline.md Iron Law 8:
每个catch必须包含5个字段...

开始迁移第1个catch..."
```

### 场景2: 需要临时查看其他Skill

```bash
# ❌ 错误方式：直接读取_repository/
User: "看一下_repository/specialized/GRAPH-DATABASE.md"

AI:
"⚠️ 注意：_repository/是Skills仓库，不应直接使用。

正确流程:
```bash
python .claude/skills/_management/skill_trunk_manager.py load Phase5 ... GRAPH-DATABASE
```

这样可以保持主干极简。"
```

---

## 📦 任务完成后

### Phase 5.2完成（P0迁移完成）

```bash
# 如果Phase 5全部完成，卸载Skills
python .claude/skills/_management/skill_trunk_manager.py unload Phase5-Logger-Upgrade
```

**效果**:
- 自动检查依赖（是否有其他任务共享）
- 卸载4个Skills到`_meta/unloaded/`
- 主干恢复极简

### Phase 5.2未完成（需要继续）

```bash
# 保留主干不卸载
# 下次继续时直接开始，无需重新加载
```

---

## 🎯 AI集成规则（自动遵守）

根据`AI_TRUNK_INTEGRATION_PROTOCOL.md`，AI会:

1. ✅ **只读主干**: 只读取`_trunk/*.md`，不读取`_repository/`
2. ✅ **严格遵循**: 主干Skills的Iron Laws是强制约束
3. ✅ **引用编号**: 每次实现都引用Iron Law编号
4. ✅ **完成提醒**: 任务结束主动提醒卸载

---

## 📊 效率对比

### 传统方式（无Trunk）

```
51个Skills → "我该遵循哪些？"
→ 5分钟选择 + 30分钟阅读
→ 85%规则遵循（选择性失忆）
```

### Trunk方式（Phase 5）

```
4个Skills → 明确范围
→ 30秒加载 + 5分钟阅读
→ 100%规则遵循（强制）
```

**效率提升**: 90%+ ⚡

---

## 🔍 常见问题

### Q1: 主干为空怎么办？

```bash
# 执行加载命令
python .claude/skills/_management/skill_trunk_manager.py load Phase5 ...
```

### Q2: 需要额外Skill怎么办？

```bash
# 追加加载（保留现有Skills）
python .claude/skills/_management/skill_trunk_manager.py load \
  Phase5-Logger-Upgrade \
  "全项目Logger升级 + 额外功能" \
  LOGGER-ROLLING-UPGRADE LOG-GOVERNANCE-AND-COST OBSERVABILITY-TOOLKIT development-discipline <NEW_SKILL>
```

### Q3: 任务中断了，主干会保留吗？

会保留。主干状态持久化到`ACTIVE_TASKS.json`，重启后自动恢复。

### Q4: 多人协作怎么办？

每个人独立使用Trunk，通过Git同步Skills源文件（`_repository/`）。

---

## 📚 相关文档

| 文档 | 用途 |
|------|------|
| `AI_TRUNK_INTEGRATION_PROTOCOL.md` | AI如何使用Trunk |
| `TRUNK_SYSTEM_OVERVIEW.md` | Trunk系统完整概览 |
| `TRUNK_WORKFLOW_GUIDE.md` | 日常工作流程 |
| `SKILL_VERSION_INDEX.md` | Skills版本索引 |

---

**Philosophy**: "主干极简，任务驱动，100%遵循"

**Created**: 2025-11-20 22:50  
**Maintained by**: Cascade + Zhang
