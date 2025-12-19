# Rule Test Samples

规则测试样本库，用于验证规则检测的正确性。

## 目录结构

```
rule_tests/
├── README.md           # 本文件
├── config.yml          # 测试配置（阈值等）
├── {RULE_ID}.yml       # 各规则的测试样本
└── candidates/         # 候选样本（待审核）
```

## 样本编写规范

### 敏感信息禁用条款

**严禁使用任何真实敏感信息！**

- ❌ 禁止：真实密钥、账号、Token、生产域名/路径
- ✅ 必须：使用明显的假数据

**假数据命名约定：**

| 类型 | 正确示例 | 错误示例 |
|------|----------|----------|
| 密码 | `DUMMY_PASSWORD_123` | `admin123` |
| API 密钥 | `FAKE_API_KEY_1234567890ABCDEF` | `sk-xxx...` |
| Secret | `FAKE_SECRET_KEY_ABCDEF123456` | `my_secret_key` |
| Token | `FAKE_TOKEN_ABCDEF123456` | `eyJhbGci...` |
| 域名 | `example.com`, `test.example.org` | 真实生产域名 |

**发现疑似真实敏感信息时：**
1. 立即替换为假数据
2. 在 MR/PR 中备注替换原因
3. 通知安全 Owner 审查

### 元数据字段约定

```yaml
positive_cases:
  - code: |
      # 代码片段
    metadata:
      source: manual | false_positive | false_green
      reviewed: true | false
      note: "备注信息"
```

**`reviewed` 字段语义：**

| 值 | 含义 | 谁可以设置 |
|----|------|-----------|
| `true` | 已由规则 Owner 或安全 Owner 审核通过 | 规则 Owner / 安全 Owner |
| `false` | 待审核（候选样本） | 任何人 |

**重要说明：**
- 旧格式样本（纯字符串）在迁移时默认 `reviewed=true`，这仅为兼容策略，**不代表真实审核背书**
- 后续会逐步对历史样本进行二次复核
- 新增样本必须经过审核才能设置 `reviewed=true`

## 测试覆盖阈值

配置位于 `config.yml`：

```yaml
# 最小样本数阈值
min_positive_cases: 1  # 当前值（过渡）
min_negative_cases: 1  # 当前值（过渡）
# 目标值：3

# 覆盖率阈值（百分比）
coverage_threshold: 20.0  # 当前值（过渡），长期目标 50.0
```

调整阈值只需修改配置文件，无需改动测试代码。

## 文件格式

```yaml
# Test cases for rule {RULE_ID}
# 规则描述

rule_id: "{RULE_ID}"
description: "Test cases for {RULE_ID}: 规则描述"

# 正例：应触发规则的代码
positive_cases:
  - |
    # 代码片段（纯字符串格式，向后兼容）
    code_that_should_trigger()
  - code: |
      # 代码片段（扩展格式，带元数据）
      code_with_metadata()
    metadata:
      source: false_positive
      reviewed: true
      note: "来源说明"

# 反例：不应触发规则的代码
negative_cases:
  - |
    # 安全的代码
    safe_code()
```

## 候选样本工作流

1. **发现误报/假绿** → 手工创建 `candidates/{RULE_ID}_{type}_{date}.yml`
2. **人工审核** → 确认样本正确性，标记为正例或反例
3. **晋升** → 运行 `promote_sample` 命令，样本进入正式测试文件
4. **回归测试** → `RuleTestRunner` 自动验证所有样本

## 相关文档

- [设计文档](../../.kiro/specs/rule-test-samples/design.md)
- [需求文档](../../.kiro/specs/rule-test-samples/requirements.md)
- [任务列表](../../.kiro/specs/rule-test-samples/tasks.md)
