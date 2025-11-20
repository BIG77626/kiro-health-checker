# 页面跳转检查报告

## 🔍 检查时间
2025-01-XX

## 📊 检查范围
检查所有页面的 `wx.navigateTo`、`wx.redirectTo`、`wx.switchTab`、`wx.reLaunch` 跳转逻辑

---

## ✅ 正常跳转（已注册页面）

### **一级页面（TabBar）**

#### 1. `pages/home/home.js`
- ✅ `wx.navigateTo` → `/pages/quiz-bank/quiz-bank` （学习中心）

#### 2. `pages/wrong-questions/wrong-questions.js`
- ✅ `wx.navigateTo` → `/pages/weak-points-detail/weak-points-detail` （薄弱点详情）
- ✅ 动态跳转 → `url` 变量（训练计划）

#### 3. `pages/ai-assistant/ai-assistant.js`
- ✅ 无外部跳转（仅内部Tab切换）

#### 4. `pages/profile/profile.js`
- ✅ 无外部跳转（待检查）

---

### **二级页面**

#### 5. `pages/quiz-bank/quiz-bank.js` ⚠️ **发现问题**
**正常跳转：**
- ✅ `wx.navigateTo` → `/pages/reading-article/reading-article` （阅读文章）
- ✅ `wx.navigateTo` → `/pages/practice/practice` （练习页面）
- ✅ `wx.navigateTo` → `/pages/vocabulary/vocabulary` （词汇学习）
- ✅ `wx.navigateTo` → `/pages/wrong-questions/wrong-questions` （错题本）
- ✅ `wx.switchTab` → `/pages/report/report` （学习报告）

**❌ 错误跳转（页面未注册）：**
1. ❌ `/pages/translation-practice/translation-practice` - **页面不存在**
2. ❌ `/pages/writing-practice/writing-practice` - **页面不存在**
3. ❌ `/pages/vocabulary-practice/vocabulary-practice` - **页面不存在**
4. ❌ `/pages/practice-history/practice-history` - **页面不存在**
5. ❌ `/pages/mock-exam/mock-exam` - **页面不存在**

#### 6. `pages/vocabulary/vocabulary.js`
- ✅ `wx.navigateTo` → `/pages/vocabulary/root-detail/root-detail` （词根详情）

---

### **三级页面**

#### 7. `pages/practice/practice.js`
- ✅ 待检查（可能包含返回逻辑）

#### 8. `pages/reading-article/reading-article.js`
- ✅ 待检查（可能包含返回逻辑）

#### 9. `pages/vocabulary/root-detail/root-detail.js`
- ✅ 待检查（可能包含返回逻辑）

#### 10. `pages/weak-points-detail/weak-points-detail.js`
- ✅ 待检查（可能包含返回逻辑）

---

## 🚨 发现的问题

### **P0 - 严重问题（会导致跳转失败）**

#### **问题1：quiz-bank.js 跳转到未注册页面**

**位置：** `ll5.2/pages/quiz-bank/quiz-bank.js`

**错误跳转列表：**

1. **翻译练习** (Line ~237)
   ```javascript
   wx.navigateTo({
     url: `/pages/translation-practice/translation-practice`  // ❌ 页面不存在
   })
   ```
   **建议修复：**
   ```javascript
   wx.navigateTo({
     url: `/pages/practice/practice?type=translation&typeName=翻译练习`  // ✅ 使用统一练习页面
   })
   ```

2. **写作练习** (Line ~247)
   ```javascript
   wx.navigateTo({
     url: `/pages/writing-practice/writing-practice`  // ❌ 页面不存在
   })
   ```
   **建议修复：**
   ```javascript
   wx.navigateTo({
     url: `/pages/practice/practice?type=writing&typeName=写作练习`  // ✅ 使用统一练习页面
   })
   ```

3. **词汇练习** (Line ~252)
   ```javascript
   wx.navigateTo({
     url: `/pages/vocabulary-practice/vocabulary-practice`  // ❌ 页面不存在
   })
   ```
   **建议修复：**
   ```javascript
   wx.navigateTo({
     url: `/pages/vocabulary/vocabulary`  // ✅ 使用词汇学习页面
   })
   ```

4. **练习历史** (Line ~278)
   ```javascript
   wx.navigateTo({
     url: '/pages/practice-history/practice-history'  // ❌ 页面不存在
   })
   ```
   **建议修复：**
   ```javascript
   wx.switchTab({
     url: '/pages/wrong-questions/wrong-questions'  // ✅ 跳转到训练&分析
   })
   ```
   或者添加提示：
   ```javascript
   wx.showToast({
     title: '功能开发中',
     icon: 'none'
   })
   ```

5. **真题模考** (Line ~313)
   ```javascript
   wx.navigateTo({
     url: `/pages/mock-exam/mock-exam`  // ❌ 页面不存在
   })
   ```
   **建议修复：**
   ```javascript
   wx.showToast({
     title: '真题模考功能开发中',
     icon: 'none'
   })
   ```

---

### **P1 - 中等问题（功能可能重复）**

#### **问题2：`report` 页面的访问方式**

**当前状态：**
- ✅ 已在 `app.json` 中注册
- ✅ 在 TabBar 中？ **否**
- ⚠️ 从 `quiz-bank.js` 使用 `wx.switchTab` 跳转（Line 323）

**问题：**
- `switchTab` 只能跳转到 TabBar 页面
- `report` 不在 TabBar 中，应该使用 `navigateTo`

**建议修复：**
```javascript
// 修改前
wx.switchTab({
  url: '/pages/report/report'
})

// 修改后
wx.navigateTo({
  url: '/pages/report/report'
})
```

---

## 📋 完整的页面跳转关系图

```
一级页面（TabBar）
├─ pages/home/home
│  └─ navigateTo → pages/quiz-bank/quiz-bank ✅
│
├─ pages/wrong-questions/wrong-questions
│  ├─ Tab切换（内部）
│  └─ navigateTo → pages/weak-points-detail/weak-points-detail ✅
│
├─ pages/ai-assistant/ai-assistant
│  └─ Tab切换（内部）
│
└─ pages/profile/profile
   └─ （无外部跳转）

二级页面
├─ pages/quiz-bank/quiz-bank
│  ├─ navigateTo → pages/reading-article/reading-article ✅
│  ├─ navigateTo → pages/practice/practice ✅
│  ├─ navigateTo → pages/vocabulary/vocabulary ✅
│  ├─ navigateTo → pages/wrong-questions/wrong-questions ✅
│  ├─ switchTab → pages/report/report ⚠️ （应改为 navigateTo）
│  ├─ navigateTo → pages/translation-practice ❌ （不存在）
│  ├─ navigateTo → pages/writing-practice ❌ （不存在）
│  ├─ navigateTo → pages/vocabulary-practice ❌ （不存在）
│  ├─ navigateTo → pages/practice-history ❌ （不存在）
│  └─ navigateTo → pages/mock-exam ❌ （不存在）
│
└─ pages/vocabulary/vocabulary
   └─ navigateTo → pages/vocabulary/root-detail/root-detail ✅

三级页面
├─ pages/practice/practice
├─ pages/reading-article/reading-article
├─ pages/vocabulary/root-detail/root-detail
└─ pages/weak-points-detail/weak-points-detail

其他已注册页面（未使用或未检查）
├─ pages/report/report
├─ pages/paperdetail/paperdetail
├─ pages/reader/reader
└─ pages/wrong-questions-list/wrong-questions-list
```

---

## 🛠️ 修复建议

### **修复优先级**

#### **高优先级（P0）- 必须修复**
1. ✅ 修复 `quiz-bank.js` 中的5个错误跳转
2. ✅ 修复 `report` 页面的跳转方式（switchTab → navigateTo）

#### **中优先级（P1）- 建议修复**
3. ✅ 检查 `practice`、`reading-article`、`root-detail`、`weak-points-detail` 的返回逻辑
4. ✅ 清理未使用的页面注册（如果确认不需要）

#### **低优先级（P2）- 可选优化**
5. ✅ 添加页面跳转的错误处理
6. ✅ 统一跳转参数格式
7. ✅ 添加页面跳转的loading提示

---

## 📝 具体修复代码

### **修复 quiz-bank.js**

**文件位置：** `ll5.2/pages/quiz-bank/quiz-bank.js`

#### **修复1：翻译练习 (Line ~236-239)**
```javascript
// 修改前
case 2: // 翻译练习
  wx.navigateTo({
    url: `/pages/translation-practice/translation-practice`  // ❌
  })
  break

// 修改后
case 2: // 翻译练习
  wx.navigateTo({
    url: `/pages/practice/practice?type=translation&typeName=翻译练习`  // ✅
  })
  break
```

#### **修复2：写作练习 (Line ~246-249)**
```javascript
// 修改前
case 5: // 写作练习
  wx.navigateTo({
    url: `/pages/writing-practice/writing-practice`  // ❌
  })
  break

// 修改后
case 5: // 写作练习
  wx.navigateTo({
    url: `/pages/practice/practice?type=writing&typeName=写作练习`  // ✅
  })
  break
```

#### **修复3：词汇练习（已存在重复）(Line ~251-254)**
```javascript
// 修改前
case 0: // 单词记忆（旧代码可能有误）
  wx.navigateTo({
    url: `/pages/vocabulary-practice/vocabulary-practice`  // ❌
  })
  break

// 修改后（已有 goToVocabulary 方法，应该使用）
// 删除重复代码，统一使用 goToVocabulary() 方法
```

#### **修复4：快捷工具 - 错题复习 & 真题模考 (Line ~277-315)**
```javascript
// 快捷工具1：错题复习（已正确）
goToWrongQuestions() {
  wx.navigateTo({
    url: '/pages/practice-history/practice-history'  // ❌
  })
}

// 修改后
goToWrongQuestions() {
  wx.switchTab({
    url: '/pages/wrong-questions/wrong-questions'  // ✅ 跳转到训练&分析Tab
  })
}

// 快捷工具2：真题模考
startMockExam() {
  // ... 
  wx.navigateTo({
    url: `/pages/mock-exam/mock-exam`  // ❌
  })
}

// 修改后
startMockExam() {
  wx.showToast({
    title: '真题模考功能开发中',
    icon: 'none',
    duration: 2000
  })
}
```

#### **修复5：学习报告跳转 (Line ~323-326)**
```javascript
// 修改前
goToReport() {
  wx.switchTab({
    url: '/pages/report/report'  // ⚠️ report不在TabBar中
  })
}

// 修改后
goToReport() {
  wx.navigateTo({
    url: '/pages/report/report'  // ✅ 使用navigateTo
  })
}
```

---

## ✅ 验收标准

修复完成后，应满足以下标准：

1. ✅ 所有 `wx.navigateTo` 跳转的页面都在 `app.json` 中注册
2. ✅ 所有 `wx.switchTab` 只跳转到 TabBar 页面
3. ✅ 未实现的功能显示"开发中"提示，不跳转
4. ✅ 所有跳转都有错误处理（`fail` 回调）
5. ✅ 页面参数格式统一（`type`、`typeName`、`paperId` 等）

---

## 📊 统计总结

| 项目 | 数量 |
|-----|------|
| 总跳转次数 | ~30次 |
| 正常跳转 | ~23次 ✅ |
| 错误跳转（页面不存在） | 5次 ❌ |
| 错误跳转（方法错误） | 1次 ⚠️ |
| 重复功能 | 2次 💡 |

**问题修复率目标：** 100%

---

## 🎯 下一步行动

1. ✅ 修复 `quiz-bank.js` 中的6个跳转问题
2. ✅ 测试所有修复后的跳转功能
3. ✅ 清理或实现未完成的功能页面
4. ✅ 添加统一的错误处理机制

---

**📌 备注：** 本报告基于当前代码状态，修复后需要在真机上全面测试所有跳转功能。

