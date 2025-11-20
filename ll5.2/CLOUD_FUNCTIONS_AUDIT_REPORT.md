# 云函数调用审计报告

**审计日期**: 2025-11-20 14:10  
**审计目的**: 确认cloudfunctions/下云函数的使用情况

---

## 📊 审计结果

### 1. translation-grading（使用中 ✅）

**调用位置**:
- `pages/practice/components/translation-question/translation-question.js:232-233`

**调用代码**:
```javascript
const result = await wx.cloud.callFunction({
  name: 'translation-grading',
  data: {
    userTranslation: userAnswer,
    referenceTranslation: translationData.referenceAnswer,
    context: translationData.context
  }
})
```

**优先级**: P0（必须迁移）  
**迁移建议**: 保留此云函数，迁移到 `cloud/functions/translation-grading`

---

### 2. ai-service（使用中 ✅）

**调用位置**:
- `core/infrastructure/adapters/ai/WeChatCloudAIServiceProxy.js:31`

**调用代码**:
```javascript
this.cloudFunctionName = 'ai-service' // 统一的AI服务云函数名称
```

**优先级**: P0（必须迁移）  
**迁移建议**: 保留此云函数，迁移到 `cloud/functions/ai-service`

---

### 3. essay-grading（未使用 ❌）

**调用位置**: 无  
**搜索结果**: 仅在云函数目录内部文件中出现  
**优先级**: P2（可选）  
**迁移建议**: 
- 选项A: 暂不迁移，标记为待清理
- 选项B: 迁移并保留备用

---

### 4. weekly-feedback-aggregation（未使用 ❌）

**调用位置**: 无  
**搜索结果**: 仅在云函数目录内部文件中出现  
**优先级**: P2（可选）  
**迁移建议**: 
- 选项A: 暂不迁移，标记为待清理
- 选项B: 迁移并保留备用

---

## 🎯 迁移决策

### 必须迁移（P0）

1. **translation-grading** ✅
   - 理由: 翻译题功能正在使用
   - 操作: 复制到 cloud/functions/

2. **ai-service** ✅
   - 理由: AI服务正在使用
   - 操作: 复制到 cloud/functions/

### 可选迁移（P2）

3. **essay-grading** ⚠️
   - 理由: 未找到调用代码，可能是未来功能
   - 操作: 保留在 cloudfunctions/ 待后续决策

4. **weekly-feedback-aggregation** ⚠️
   - 理由: 未找到调用代码，可能是未来功能
   - 操作: 保留在 cloudfunctions/ 待后续决策

---

## 📋 执行计划

### Phase 2: 物理迁移（执行P0云函数）

```bash
# 1. 复制 translation-grading
cp -r cloudfunctions/translation-grading cloud/functions/

# 2. 复制 ai-service
cp -r cloudfunctions/ai-service cloud/functions/
```

### Phase 3: 验证（无需修改代码）

**原因**: `wx.cloud.callFunction` 通过云端函数名调用，不依赖本地路径

**验证点**:
- [ ] translation-grading 在 cloud/functions/ 存在
- [ ] ai-service 在 cloud/functions/ 存在
- [ ] 云端重新部署后功能正常

---

## 📝 备注

**未迁移的云函数**:
- essay-grading: 保留待决策
- weekly-feedback-aggregation: 保留待决策

**下一步**:
1. Week 2-3: 在云端部署新位置的云函数
2. 测试验证翻译题和AI服务功能
3. 确认无问题后删除 cloudfunctions/translation-grading 和 ai-service
4. Week 3: 决策是否保留 essay-grading 和 weekly-feedback-aggregation

---

**审计人**: AI Assistant  
**审计方法**: grep搜索 + 代码审查  
**可信度**: 高（已搜索所有.js/.json/.wxml文件）
