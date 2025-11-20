# Weekly Feedback Aggregation Cloud Function

**功能**: 每周聚合用户反馈，生成Prompt优化建议

**触发方式**: 定时触发（每周日凌晨2点）

**执行时间**: 约10-20秒

**内存需求**: 256MB

---

## 功能说明

此云函数通过P1-004 FeedbackAggregationService聚合一周内的用户反馈数据：

1. 从storage查询feedback_events（最近7天）
2. 过滤出rating='dislike'的反馈
3. 质量过滤（去重、验证）
4. 模式识别（高拒绝率、高重试率等）
5. AI生成优化建议
6. 持久化聚合结果

---

## 定时触发配置

```
Cron: 0 2 * * 0
说明: 每周日凌晨2点（UTC+8北京时间）
验证: https://crontab.guru/#0_2_*_*_0
```

---

## 返回格式

```json
{
  "success": true,
  "duration": 12345,
  "metadata": {
    "rawCount": 100,
    "qualityCount": 80,
    "patternCount": 3,
    "suggestionCount": 3
  },
  "reason": "success"
}
```

---

## 错误处理

- 所有异常都被捕获并记录
- 返回success: false但不抛出异常（避免云函数重试）
- 完整的错误堆栈记录到云日志

---

## 本地测试

```bash
cd cloudfunctions/weekly-feedback-aggregation
node index.js
```

---

## 部署

通过微信开发者工具上传并部署到云端。

---

**创建时间**: 2025-11-17  
**版本**: 1.0.0  
**依赖**: P1-004 FeedbackAggregationService
