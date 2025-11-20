# Infrastructure Services

This directory contains core infrastructure services following Clean Architecture principles.

## 📁 Structure

```
services/
├── BehaviorTracker.js          # 行为追踪核心服务
└── __tests__/
    └── BehaviorTracker.test.js # 单元测试
```

## 🎯 BehaviorTracker

用户行为追踪服务，基于 P1-001 Skill 实现。

### Iron Laws (必须遵守)

```
NO PLATFORM API (wx.*) IN BEHAVIORTRACKER
NO THROWING EXCEPTIONS TO CALLER
NO SYNCHRONOUS BLOCKING > 5ms
```

### Features

- ✅ 5种事件类型追踪
- ✅ 批量上报（默认10个一批）
- ✅ 离线缓存支持（上传失败自动fallback）
- ✅ Silent fail（异常不影响主流程）
- ✅ 依赖注入（可测试、可替换）
- ✅ 可注入Logger（可观测性增强）
- ✅ 配置边界验证（防御性编程）

### Quick Start

```javascript
const BehaviorTracker = require('./BehaviorTracker');

// 创建实例
const tracker = new BehaviorTracker(
  { maxBufferSize: 10, flushInterval: 30000 },
  storageAdapter,
  uploaderAdapter,
  loggerAdapter // 可选，用于监控
);

// 追踪事件
tracker.trackAnswer('q1', 'A', true, 5000);
tracker.trackHesitation('q2', 3500);
tracker.trackWordLookup('abandon', 'context...');

// 手动flush（页面卸载时）
tracker.flush();
```

### 离线缓存策略

```
1. 优先上报 (uploader存在时)
2. 上报失败 → fallback到storage (如果有storage)
3. 无uploader → 直接存储到storage
4. 都没有 → silent fail，事件丢失但不crash
```

## 🧪 Running Tests

### Install Dependencies

```bash
cd ll5.2
npm install --save-dev jest
```

### Run Tests

```bash
# Run all tests
npm test

# Run BehaviorTracker tests only
npm test core/infrastructure/services/__tests__/BehaviorTracker.test.js

# Run with coverage
npm run test:coverage
```

### Expected Results

```
Test Suites: 1 passed, 1 total
Tests:       42 passed, 42 total
Coverage:    > 85%
Time:        ~2s
```

## ✅ Validation Checklist (P1-001 Day 1)

- [x] No `wx.*` in BehaviorTracker code
- [x] All methods wrapped in try/catch
- [x] Buffer flushes at maxBufferSize
- [x] No exceptions thrown to caller
- [x] 5 event types implemented
- [x] Dependency injection used
- [x] Test coverage ≥ 80%

## 📚 Related Skills

- `.claude/skills/quick-refs/P1-001-BEHAVIOR-TRACKER.md`
- `.claude/skills/quick-refs/CLEAN-ARCHITECTURE-CHECKLIST.md`
- `.claude/skills/community/miniprogram-testing/SKILL.md`

## 🔄 Next Steps

1. Create adapters (StorageAdapter, UploaderAdapter)
2. Create ServiceContainer
3. Integrate into Page
4. E2E testing

See `docs/P1-001_IMPLEMENTATION_PLAN.md` for details.
