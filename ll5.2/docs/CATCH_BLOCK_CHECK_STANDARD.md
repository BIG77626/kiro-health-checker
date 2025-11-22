# Catch块检查规范 - 新增代码维护标准

**版本**: v1.0  
**生效日期**: 2025-11-22  
**适用范围**: 所有新增和修改的catch块  
**基于**: Iron Law 8 + Logger v2.0

---

## 🎯 核心原则

> **所有catch块必须使用Logger v2.0记录错误，并包含完整的Iron Law 8字段**

---

## ✅ 标准检查清单

### 1. Logger调用检查

**必需项**:
- [ ] 使用`Logger.error()`或`Logger.warn()`
- [ ] 不使用`console.log/error/warn`作为主要错误记录方式
- [ ] 模块名称正确（第一个参数）
- [ ] 操作名称清晰（第二个参数）

**示例**:
```javascript
✅ 正确
catch (error) {
  Logger.error('ModuleName', 'OperationFailed', {
    // Iron Law 8字段...
  })
}

❌ 错误
catch (error) {
  console.error('Error:', error)  // 只用console
}
```

---

### 2. Iron Law 8字段检查

**必需字段**（5个）:

#### 字段1: errorType
- [ ] 字段存在
- [ ] 使用`error.name`或合理的默认值
- [ ] 值有意义（如：'NetworkError', 'ValidationError'）

```javascript
errorType: error.name || 'UnexpectedError'  // ✅
errorType: 'Error'                          // ⚠️ 太泛化
```

#### 字段2: errorMsg
- [ ] 字段存在
- [ ] 使用`error.message`或描述性消息
- [ ] 消息清晰易懂

```javascript
errorMsg: error.message || 'Operation failed'  // ✅
errorMsg: 'Error'                              // ❌ 太模糊
```

#### 字段3: errorCode
- [ ] 字段存在
- [ ] 使用统一前缀（如：ERR_MODULE_）
- [ ] 在文件/模块内唯一
- [ ] 命名清晰描述错误场景

**errorCode命名规范**:
```javascript
// 格式: ERR_[MODULE]_[OPERATION]_[DETAIL]
✅ ERR_STORAGE_SAVE_QUOTA_EXCEEDED
✅ ERR_QWEN_API_TIMEOUT
✅ ERR_CACHE_STORAGE_PARSE_FAILED

❌ ERR_1                    // 无意义
❌ ERROR_STORAGE           // 前缀不统一
❌ STORAGE_ERROR           // 格式错误
```

#### 字段4: fallback
- [ ] 字段存在
- [ ] 清晰描述降级策略
- [ ] 策略可执行

**标准fallback值**:
```javascript
'return_null'              // 返回null
'return_empty_array'       // 返回空数组
'return_false'             // 返回false
'return_default_value'     // 返回默认值
'throw_error'              // 向上抛出异常
'silent_fail'              // 静默失败，不阻断
'retry_with_backoff'       // 重试（带退避）
'skip_operation'           // 跳过操作
'use_cache'                // 使用缓存数据
'return_fallback_response' // 返回降级响应
```

#### 字段5: impact
- [ ] 字段存在
- [ ] 准确评估影响级别

**标准impact值**:
```javascript
'no_impact'              // 无影响
'feature_degradation'    // 功能降级
'data_loss'              // 数据丢失风险
'ui_blocked'             // UI阻塞
'system_critical'        // 系统级严重错误
```

---

### 3. 完整性检查

**模板对照**:
```javascript
try {
  // 业务逻辑
} catch (error) {
  // ✅ 标准结构
  Logger.error('ModuleName', 'OperationFailed', {
    // 可选的上下文字段
    userId: userId,
    requestId: requestId,
    
    // ⭐ 必需的Iron Law 8字段
    errorType: error.name || 'DefaultType',      // 1️⃣
    errorMsg: error.message || 'Default msg',    // 2️⃣
    errorCode: 'ERR_MODULE_OPERATION',           // 3️⃣
    fallback: 'return_null',                     // 4️⃣
    impact: 'feature_degradation'                // 5️⃣
  })
  
  // 执行fallback策略
  return null
}
```

---

## 🔍 自检方法

### 方法1: 快速检查命令

```bash
# 检查文件中是否有catch块未使用Logger
grep -n "catch (" your-file.js | while read line; do
  linenum=$(echo $line | cut -d: -f1)
  nextlines=$(sed -n "${linenum},$((linenum+20))p" your-file.js)
  if ! echo "$nextlines" | grep -q "Logger\."; then
    echo "⚠️ Line $linenum: catch块可能缺少Logger"
  fi
done
```

### 方法2: 字段完整性检查

```javascript
// 在代码审查时使用此正则检查
const ironLaw8Fields = [
  'errorType',
  'errorMsg', 
  'errorCode',
  'fallback',
  'impact'
]

// 手动检查每个catch块是否包含所有字段
```

### 方法3: IDE提示集成

**VS Code snippet**（推荐）:
```json
{
  "Logger Error Catch": {
    "prefix": "logcatch",
    "body": [
      "} catch (error) {",
      "  Logger.error('${1:ModuleName}', '${2:OperationFailed}', {",
      "    ${3:// 上下文字段}",
      "    errorType: error.name || '${4:UnexpectedError}',",
      "    errorMsg: error.message || '${5:Operation failed}',",
      "    errorCode: 'ERR_${6:MODULE}_${7:OPERATION}',",
      "    fallback: '${8|return_null,return_false,return_empty_array,throw_error,silent_fail|}',",
      "    impact: '${9|no_impact,feature_degradation,data_loss,ui_blocked,system_critical|}'",
      "  })",
      "  $0",
      "}"
    ]
  }
}
```

---

## 📝 代码审查检查点

### Pull Request审查清单

审查员必须验证:

- [ ] **所有新增catch块**都使用了Logger
- [ ] **所有Logger调用**都包含完整的Iron Law 8字段
- [ ] **errorCode**在模块内唯一且命名规范
- [ ] **fallback**策略与实际代码逻辑一致
- [ ] **impact**评估准确
- [ ] **无console.error替代Logger的情况**（除非是临时调试代码）

### 常见问题标记

```javascript
// ❌ 问题1: 缺少Logger
catch (error) {
  console.error('Error:', error)
  return null
}

// ❌ 问题2: 字段不完整
catch (error) {
  Logger.error('Module', 'Failed', {
    errorMsg: error.message
    // 缺少其他4个字段
  })
}

// ❌ 问题3: errorCode不规范
catch (error) {
  Logger.error('Module', 'Failed', {
    errorCode: 'error1',  // 不符合命名规范
    // ...
  })
}

// ❌ 问题4: fallback与实际不符
catch (error) {
  Logger.error('Module', 'Failed', {
    fallback: 'throw_error',  // 声称会抛异常
    // ...
  })
  return null  // 但实际返回null
}
```

---

## 🎓 最佳实践

### 1. 按错误级别选择Logger方法

```javascript
// 严重错误 - 使用Logger.error
catch (error) {
  Logger.error('Module', 'CriticalFailure', {
    errorCode: 'ERR_CRITICAL',
    impact: 'system_critical',
    // ...
  })
}

// 降级场景 - 使用Logger.warn
catch (error) {
  Logger.warn('Module', 'FallbackUsed', {
    errorCode: 'ERR_FALLBACK',
    impact: 'no_impact',
    // ...
  })
}
```

### 2. 添加有价值的上下文

```javascript
catch (error) {
  Logger.error('StorageAdapter', 'SaveFailed', {
    // 👍 有价值的上下文
    key: key,
    valueSize: valueStr.length,
    storageUsage: getCurrentStorageUsage(),
    
    // Iron Law 8字段
    errorType: error.name || 'StorageError',
    errorMsg: error.message || 'Save failed',
    errorCode: 'ERR_STORAGE_SAVE',
    fallback: 'return_false',
    impact: 'data_loss'
  })
}
```

### 3. 保持fallback策略一致

```javascript
catch (error) {
  Logger.error('Module', 'Failed', {
    errorCode: 'ERR_MODULE_OP',
    fallback: 'return_empty_array',  // 声明策略
    impact: 'no_impact'
  })
  return []  // ✅ 与声明一致
}
```

---

## 🚨 反模式警告

### 反模式1: 空catch块
```javascript
❌ 永远不要这样
catch (error) {
  // 什么都不做
}
```

### 反模式2: 只用console
```javascript
❌ 不符合规范
catch (error) {
  console.error('Failed:', error)
}
```

### 反模式3: 字段值硬编码
```javascript
❌ 不好
catch (error) {
  Logger.error('Module', 'Failed', {
    errorType: 'Error',           // 太泛化
    errorMsg: 'Something wrong',  // 太模糊
    errorCode: 'ERR_1',           // 无意义
    fallback: 'unknown',          // 不规范
    impact: 'bad'                 // 不规范
  })
}
```

---

## 📚 参考资源

### 内部文档
- [Iron Law 8规范](../.claude/skills/quick-refs/OBSERVABILITY-TOOLKIT.md)
- [Logger v2.0 API](../core/infrastructure/logging/README.md)
- [Phase 5完成报告](./archives/phase5/PHASE_5.9_FINAL_COMPLETION_REPORT.md)

### 示例代码
- [StorageAdapter.js](../adapters/StorageAdapter.js) - Silent fail模式
- [QwenAIAdapter.js](../core/infrastructure/adapters/ai/QwenAIAdapter.js) - AI服务降级
- [OptimisticLockManager.js](../utils/concurrency/OptimisticLockManager.js) - 并发控制

---

## 🔄 更新记录

| 版本 | 日期 | 变更说明 |
|------|------|----------|
| v1.0 | 2025-11-22 | 初版发布，基于Phase 5完成经验总结 |

---

**维护者**: 开发团队  
**更新周期**: 根据实践反馈持续优化  
**问题反馈**: 通过Issue或PR提交

---

## ✨ 结语

遵循此规范可以：
- ✅ 提升代码质量
- ✅ 简化问题排查
- ✅ 统一错误处理标准
- ✅ 改善系统可观测性

**记住**: 每一个规范的catch块，都是对未来维护者的一份善意 ❤️
