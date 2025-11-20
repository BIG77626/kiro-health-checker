# 云函数目录迁移计划

**目标**: 统一云函数到 `cloud/functions/` 目录  
**当前状态**: `cloudfunctions/` 标记为废弃  
**执行日期**: 2025-11-20  
**Skill**: ARCHITECTURE-CLEANUP-PATTERN

---

## 📊 现状分析

### 目录结构对比

| 目录 | 云函数数量 | 状态 | 说明 |
|------|----------|------|------|
| `cloudfunctions/` | 4个 | 🔴 旧目录 | 需要迁移 |
| `cloud/functions/` | 8个 | ✅ 新标准 | 目标目录 |

### cloudfunctions/ 清单

1. **translation-grading** (使用中 ✅)
   - 被调用: `pages/practice/components/translation-question/translation-question.js:233`
   - 优先级: P0（必须迁移）

2. **essay-grading** (可能使用中 ⚠️)
   - 需检查调用情况
   - 优先级: P1

3. **ai-service** (状态未知 ❓)
   - 需检查调用情况
   - 优先级: P2

4. **weekly-feedback-aggregation** (较大 102 items)
   - 需检查调用情况
   - 优先级: P2

### cloud/functions/ 清单

已有云函数（无需迁移）:
- addPaper/
- checkLogin/
- functions/
- getPapers/
- getUserInfo/
- login/
- saveStudyRecord/
- test/

---

## 🎯 执行策略

### 方案A: 立即迁移（风险高 ⚠️）

**步骤**:
1. 复制云函数到 cloud/functions/
2. 更新所有调用代码
3. 更新部署配置
4. 测试验证
5. 删除 cloudfunctions/

**风险**:
- 可能破坏现有功能
- 需要云端重新部署
- 测试时间不足（30分钟限制）

### 方案B: 标记 + 计划迁移（推荐 ✅）

**步骤**:
1. ✅ 创建 README_DEPRECATED.md 标记目录
2. ✅ 文档化迁移计划
3. ⏭ Week 2-3 执行实际迁移
4. ⏭ 完整测试后再删除旧目录

**优势**:
- 不破坏现有功能
- 有充分时间测试
- 符合渐进式重构原则

---

## 📋 详细迁移步骤（Week 2-3 执行）

### Phase 1: 审计调用（30分钟）

```bash
# 搜索所有云函数调用
grep -r "wx.cloud.callFunction" pages/ utils/ components/
grep -r "translation-grading\|essay-grading\|ai-service\|weekly-feedback-aggregation"
```

**输出**: 调用清单表格

### Phase 2: 物理迁移（1小时）

```bash
# 1. 复制到新目录
cp -r cloudfunctions/translation-grading cloud/functions/
cp -r cloudfunctions/essay-grading cloud/functions/
cp -r cloudfunctions/ai-service cloud/functions/
cp -r cloudfunctions/weekly-feedback-aggregation cloud/functions/

# 2. 更新 package.json（如果有依赖）
cd cloud/functions/translation-grading
npm install
```

### Phase 3: 更新引用（1小时）

**文件清单**:
- pages/practice/components/translation-question/translation-question.js
- （其他待确认的调用处）

**修改示例**:
```javascript
// ❌ 旧调用（假设云函数路径不变，只是物理位置改变）
const result = await wx.cloud.callFunction({
  name: 'translation-grading',  // 保持不变
  data: {...}
})

// 说明：wx.cloud.callFunction 是通过云端函数名调用，
// 不是通过本地文件路径，所以迁移后调用代码无需修改
```

### Phase 4: 部署配置（30分钟）

**检查项**:
- [ ] 微信开发者工具中的云函数列表
- [ ] 云函数上传配置
- [ ] 环境变量配置

### Phase 5: 测试验证（1小时）

**测试清单**:
- [ ] translation-grading: 翻译题提交测试
- [ ] essay-grading: 作文批改测试
- [ ] ai-service: AI服务调用测试
- [ ] weekly-feedback-aggregation: 反馈聚合测试

### Phase 6: 清理（10分钟）

```bash
# 确认新目录云函数正常工作后
rm -rf cloudfunctions/
```

---

## ✅ 验收标准

- [ ] `cloudfunctions/` 目录已标记为废弃
- [ ] 迁移计划文档完整
- [ ] 所有云函数调用情况已审计
- [ ] （Week 2-3）云函数物理迁移完成
- [ ] （Week 2-3）所有测试通过
- [ ] （Week 2-3）旧目录已删除

---

## 🚩 风险提示

### 风险1: 云端部署配置

**描述**: 云函数迁移后，需要在微信开发者工具中重新上传

**应对**:
- 保留 cloudfunctions/ 目录直到新目录云函数测试通过
- 准备回滚方案

### 风险2: 环境变量丢失

**描述**: 云函数可能依赖环境变量（API密钥等）

**应对**:
- 迁移前记录所有环境变量
- 新目录云函数配置相同环境变量

### 风险3: 依赖包不同步

**描述**: cloud/functions 和 cloudfunctions 可能有不同的依赖版本

**应对**:
- 复制 package.json 和 package-lock.json
- 重新 npm install

---

## 📚 相关文档

| 文档 | 用途 |
|------|------|
| [README_DEPRECATED.md](./cloudfunctions/README_DEPRECATED.md) | 废弃标记 |
| [ARCHITECTURE-CLEANUP-PATTERN](../.claude/skills/quick-refs/ARCHITECTURE-CLEANUP-PATTERN.md) | 重构模式参考 |

---

**创建日期**: 2025-11-20  
**当前阶段**: Phase 0（标记废弃）✅  
**下一阶段**: Phase 1（审计调用，Week 2 执行）  
**预计完成**: Week 3
