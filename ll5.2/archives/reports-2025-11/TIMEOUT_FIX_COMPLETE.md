# ✅ 完整修复：request:fail timeout

## 🎯 已完成的修复

### 1. ✅ 更新前端配置
- 修改 `localhost` → `192.168.3.4`
- 增加超时时间：10秒 → 30秒
- 优化健康检查：快速 ping 代替完整生成

### 2. ✅ 创建网络诊断工具
- 新增 `pages/network-test` 页面
- 提供基础连接、健康检查、模型列表三种测试
- 实时显示测试结果和诊断建议

---

## 🧪 使用诊断工具

### Step 1: 打开诊断页面

1. **编译项目** (Ctrl+K)
2. **自动打开** `network-test` 页面（已设为首页）

### Step 2: 运行测试

1. **基础连接测试** - 测试能否访问 API 根路径
2. **健康检查测试** - 测试模型状态
3. **模型列表测试** - 测试 OpenAI 兼容接口

### Step 3: 查看结果

- ✅ **绿色** = 成功
- ❌ **红色** = 失败（查看错误信息）

---

## 🔍 常见错误及解决方案

### 错误1: `request:fail timeout`

**原因**：
1. API 服务未运行
2. IP 地址不正确
3. 防火墙阻止
4. 微信开发者工具未配置

**解决方案**：

#### ✅ 检查1: API 服务是否运行？

终端应显示：
```
INFO: Uvicorn running on http://0.0.0.0:8000
>>> 模型加载完成！
>>> 模型设备: cuda:0
```

如果没有，运行：
```powershell
python start_qwen_simple.py
```

#### ✅ 检查2: IP 地址是否正确？

```powershell
ipconfig | findstr "IPv4"
# 应显示: 192.168.3.4
```

如果不同，修改两处：
1. `ll5.2/pages/network-test/network-test.js` 第 3 行
2. `ll5.2/utils/short-chain-thinking/local-qwen-adapter.js` 第 13 行

#### ✅ 检查3: 微信开发者工具配置

**详情 → 本地设置 → 勾选：**
- ☑️ 不校验合法域名
- ☑️ 不校验安全域名

#### ✅ 检查4: 防火墙

**管理员权限运行 PowerShell**：
```powershell
netsh advfirewall firewall add rule name="Allow Port 8000" dir=in action=allow protocol=TCP localport=8000
```

---

### 错误2: `request:fail url not in domain list`

**原因**：未勾选"不校验安全域名"

**解决方案**：
- 微信开发者工具 → 详情 → 本地设置 → 勾选

---

### 错误3: 连接成功但响应异常

**原因**：API 服务未完全启动或模型加载失败

**解决方案**：
1. 检查终端是否有错误日志
2. 确认看到 "模型加载完成" 提示
3. 等待模型加载（首次启动需 1-2 分钟）

---

## 📊 诊断结果解读

### ✅ 成功示例

```
✅ 基础连接测试
   时间: 245ms
   状态码: 200
   响应: {"status":"ok","model":"Qwen3-14B",...}

✅ 健康检查
   时间: 312ms
   模型: Qwen3-14B
   CUDA: 可用
   已加载: 是

✅ 模型列表
   时间: 198ms
   可用模型: Qwen3-14B
```

---

### ❌ 失败示例及解决

#### 示例1: 连接超时

```
❌ 基础连接测试
   时间: 10002ms
   错误: request:fail timeout
```

**原因**: API 服务未运行或 IP 不正确

**解决**: 
1. 运行 `python start_qwen_simple.py`
2. 检查 IP 地址是否正确

---

#### 示例2: 连接被拒绝

```
❌ 基础连接测试
   时间: 156ms
   错误: request:fail connect ECONNREFUSED
```

**原因**: 端口未开放或服务绑定错误

**解决**:
1. 确认服务绑定到 `0.0.0.0`（而非 `localhost`）
2. 检查防火墙

---

#### 示例3: 域名不在白名单

```
❌ 基础连接测试
   错误: request:fail url not in domain list
```

**原因**: 未勾选"不校验安全域名"

**解决**: 微信开发者工具 → 详情 → 本地设置 → 勾选

---

## ✅ 验证清单

完成以下所有步骤后，应该可以正常连接：

- [ ] API 服务正在运行（终端有 "Uvicorn running"）
- [ ] IP 地址正确（`ipconfig` 查看）
- [ ] 微信开发者工具已勾选"不校验安全域名"
- [ ] 防火墙允许 8000 端口
- [ ] 编译项目（Ctrl+K）
- [ ] 打开 `network-test` 页面
- [ ] 运行"基础连接测试" → ✅ 成功
- [ ] 运行"健康检查测试" → ✅ 成功
- [ ] 运行"模型列表测试" → ✅ 成功

---

## 🚀 下一步

所有测试通过后：

1. **切换回测试页面**：
   - 修改 `app.json` 第3行，将 `network-test` 改为 `test-ai-hint`
   - 或在微信开发者工具中手动导航到 `test-ai-hint`

2. **测试 AI 生成**：
   - 点击"健康检查" → 应显示 ✅
   - 选择题型
   - 点击"测试生成" → 2-5秒后显示提示内容

3. **集成到 practice 页面**：
   - 完成测试后开始集成到实际答题页面

---

## 📚 相关文档

- `QUICK_FIX_TIMEOUT.md` - 3步快速修复
- `WECHAT_LOCAL_CONFIG.md` - 完整配置指南
- `QWEN_API_SUCCESS.md` - API 启动成功指南
- `DEPENDENCY_ANALYSIS.md` - 依赖问题分析

---

## 🎯 总结

**已创建**：
- ✅ 网络诊断工具 (`network-test` 页面)
- ✅ 优化健康检查（快速 ping）
- ✅ 详细的故障排查指南

**现在请**：
1. 编译项目 (Ctrl+K)
2. 使用诊断工具测试连接
3. 根据结果查看对应的解决方案
4. 所有测试通过后，切换回 `test-ai-hint` 测试 AI 生成

**需要帮助？** 查看终端日志和诊断工具的错误信息！

