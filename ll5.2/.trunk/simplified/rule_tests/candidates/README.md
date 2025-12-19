# Candidate Samples Directory

候选样本目录，用于存放待审核的误报/假绿样本。

> **Schema 唯一源文件**: `simplified/rule_test_runner.py` 中的 `CandidateSample` 类
> 
> **注意**: RuleTestRunner 不会读取此子目录，正式样本请放在 `rule_tests/` 顶层

## 工作流程

1. **发现问题**：从 `TOOL_TEST_ANALYSIS.md` 或日常使用中发现误报/假绿
2. **创建候选文件**：按命名约定创建 YAML 文件
3. **人工审核**：确认样本正确性，标记为正例或反例
4. **晋升到正式样本**：使用 `promote` CLI 将样本合并到 `rule_tests/{RULE_ID}.yml`

## 命名约定

```
{RULE_ID}_{type}_{date}.yml
```

- `RULE_ID`: 规则ID，格式为 2-4 个大写字母 + 3 位数字（如 `NET-007`, `ERR-003`, `SEC-001`）
  - 当前约定：`^[A-Z]{2,4}-\d{3}$`，后续变更需同步 schema 与文档
- `type`: 样本类型
  - `fp` = false_positive（误报：不应触发但触发了）
  - `fg` = false_green（假绿：应触发但未触发）
- `date`: 创建日期，格式 `YYYYMMDD`

**示例**：
- `NET-007_fp_20251218.yml` - NET-007 规则的误报样本
- `ERR-003_fg_20251218.yml` - ERR-003 规则的假绿样本

## 候选文件格式

### 字段说明

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `rule_id` | ✅ 是 | string | 规则ID，格式 `XXX-NNN` |
| `type` | ✅ 是 | enum | `false_positive` 或 `false_green` |
| `code` | ✅ 是 | string | 代码片段（不能为空） |
| `note` | ❌ 否 | string | 备注，建议填写上下文说明 |
| `source_file` | ❌ 否 | string | 来源文件名 |
| `source_line` | ❌ 否 | int | 来源行号（≥1） |
| `event_id` | ❌ 否 | string | 关联的事件ID |
| `created_at` | ❌ 否 | string | 创建时间，ISO 8601 格式 |

### 示例

```yaml
# 必填字段
rule_id: "NET-007"
type: "false_positive"  # false_positive | false_green
code: |
  api_key = self.config.get_api_key()

# 可选字段（建议填写 note 提供上下文）
note: "函数参数被误判为 URL 参数"
source_file: "claude_client.py"
source_line: 206
event_id: "evt_12345"  # 关联的事件ID（如有）
created_at: "2025-12-18T10:30:00"
```

## 敏感数据规范

**禁止在样本中包含真实敏感数据**，必须使用占位符：

| 数据类型 | 占位符格式 | 示例 |
|----------|-----------|------|
| 密码 | `DUMMY_PASSWORD_xxx` | `DUMMY_PASSWORD_123` |
| API Key | `FAKE_API_KEY_xxx` | `FAKE_API_KEY_1234567890ABCDEF` |
| Token | `FAKE_TOKEN_xxx` | `FAKE_TOKEN_abcdef123456` |
| 域名 | `example.com` | `https://api.example.com` |
| 邮箱 | `user@example.com` | `admin@example.com` |

## 晋升命令

```bash
# 将候选样本晋升为正例
python -m simplified.promote_sample candidates/NET-007_fp_20251218.yml NET-007 positive

# 将候选样本晋升为反例
python -m simplified.promote_sample candidates/NET-007_fp_20251218.yml NET-007 negative
```

晋升流程：
1. 验证样本产生预期结果（正例触发规则，反例不触发）
2. 检查与现有样本的冲突
3. 合并到 `rule_tests/{RULE_ID}.yml`
4. 设置 `metadata.reviewed = true`
5. 删除候选文件

## 注意事项

- 候选文件在晋升前必须经过人工审核
- 验证失败的样本不会被晋升
- 与现有样本冲突的样本不会被晋升
- 晋升成功后候选文件会被自动删除
