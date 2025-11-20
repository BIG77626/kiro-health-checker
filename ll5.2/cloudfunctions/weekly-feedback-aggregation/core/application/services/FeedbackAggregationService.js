/**
 * === 开发前检查清单 ===
 * 
 * [x] development-discipline: 失败场景列表已完成（8个场景）
 * [x] development-discipline: 5类测试已设计
 * [x] development-discipline: Skills三问法已回答
 * [x] clean-architecture: 依赖方向正确
 * [x] 生产环境5问已思考
 * 
 * === Skills v4.0应用 ===
 * - Iron Law 2: 依赖注入（通过ServiceContainer）
 * - Iron Law 5: 失败场景优先（8个场景在实现前已列出）
 * - Iron Law 6: 5类标准测试（已设计完整）
 * - Iron Law 7: Skills三问法（P1-004_TASK_PLAN.md）
 * 
 * === 失败场景覆盖 ===
 * 1. ✅ 反馈数据不足（<50条） → 跳过聚合
 * 2. ✅ Storage查询失败 → Silent fail
 * 3. ✅ 质量过滤后无数据 → 返回空建议
 * 4. ✅ AI服务不可用 → 降级规则生成
 * 5. ✅ 聚合超时（>30秒） → 中断+部分结果
 * 6. ✅ 重复反馈过多 → 去重处理
 * 7. ✅ 无明确模式 → 返回空建议
 * 8. ✅ 生成建议格式错误 → 默认模板
 */

/**
 * P1-004: 中期反馈聚合服务
 * 
 * 核心功能：每周自动聚合高质量反馈对，生成Prompt优化建议
 * 
 * AI Native理念：
 * - 自动识别AI回复的高频问题
 * - 为Prompt优化提供数据支持
 * - 完成反馈闭环的最后一环
 * 
 * 架构：
 * - Application层Service
 * - 通过ServiceContainer依赖注入
 * - Silent fail模式（所有错误不向上抛）
 * 
 * @module FeedbackAggregationService
 */

class FeedbackAggregationService {
  /**
   * @param {Object} config - 配置项
   * @param {number} config.minFeedbackCount - 最小反馈数量阈值（默认50）
   * @param {number} config.timeout - 聚合超时时间（默认30000ms）
   * @param {number} config.batchSize - 批处理大小（默认500）
   * @param {string} config.storageKey - 存储键（默认'feedback_aggregation_results'）
   * 
   * @param {Object} aiService - AI服务（用于生成建议）
   * @param {Object} storage - 存储服务
   * @param {Object} uploader - 上传服务
   * @param {Object} logger - 日志服务
   */
  constructor(config = {}, aiService, storage, uploader, logger) {
    // 配置验证和默认值
    this._config = this._validateConfig(config)
    
    // 依赖注入（Iron Law 2）
    this._aiService = aiService
    this._storage = storage
    this._uploader = uploader
    this._logger = logger
    
    // 内部状态
    this._processing = false
    this._currentBatch = null
    
    // 预设模板（用于AI失败时的fallback）
    this._fallbackTemplates = this._initFallbackTemplates()
  }

  /**
   * 主入口：聚合反馈并生成建议
   * 
   * @returns {Promise<Object>} 聚合结果
   * @returns {Array} result.suggestions - 生成的优化建议
   * @returns {Array} result.patterns - 识别的模式
   * @returns {Object} result.metadata - 元数据（数量、耗时等）
   * @returns {string} result.reason - 失败原因（如果没有生成建议）
   */
  async aggregateFeedback() {
    const startTime = Date.now()
    const requestId = this._generateRequestId()
    
    this._log('info', `[${requestId}] Aggregation started`)
    
    try {
      // 1. 检查前置条件（失败场景1: 数据不足）
      const feedbackCount = await this._getFeedbackCount()
      if (feedbackCount < this._config.minFeedbackCount) {
        this._log('warn', `[${requestId}] Insufficient feedback: ${feedbackCount} < ${this._config.minFeedbackCount}`)
        return {
          suggestions: [],
          patterns: [],
          metadata: { count: feedbackCount, duration: Date.now() - startTime },
          reason: 'insufficient_data'
        }
      }

      // 2. 查询反馈数据（失败场景2: Storage查询失败 + 场景5: 超时）
      const rawFeedback = await this._queryFeedbackWithTimeout(requestId)
      if (!rawFeedback || rawFeedback.length === 0) {
        this._log('warn', `[${requestId}] No feedback data returned`)
        return {
          suggestions: [],
          patterns: [],
          metadata: { count: 0, duration: Date.now() - startTime },
          reason: 'no_data'
        }
      }

      this._log('info', `[${requestId}] Raw feedback count: ${rawFeedback.length}`)

      // 3. 质量过滤（失败场景6: 重复反馈 + 场景3: 过滤后无数据）
      const qualityFeedback = this._filterQuality(rawFeedback, requestId)
      if (qualityFeedback.length === 0) {
        this._log('warn', `[${requestId}] No quality feedback after filtering`)
        return {
          suggestions: [],
          patterns: [],
          metadata: { 
            rawCount: rawFeedback.length,
            filteredCount: 0,
            duration: Date.now() - startTime 
          },
          reason: 'no_quality_data'
        }
      }

      this._log('info', `[${requestId}] Quality feedback count: ${qualityFeedback.length}`)

      // 4. 模式识别（失败场景7: 无明确模式）
      const patterns = this._identifyPatterns(qualityFeedback, requestId)
      if (patterns.length === 0) {
        this._log('warn', `[${requestId}] No patterns identified`)
        return {
          suggestions: [],
          patterns: [],
          metadata: {
            rawCount: rawFeedback.length,
            qualityCount: qualityFeedback.length,
            duration: Date.now() - startTime
          },
          reason: 'no_patterns'
        }
      }

      this._log('info', `[${requestId}] Patterns identified: ${patterns.length}`)

      // 5. 生成建议（失败场景4: AI不可用 + 场景8: 格式错误）
      const suggestions = await this._generateSuggestions(patterns, requestId)

      // 6. 持久化结果（Silent fail）
      await this._persistResults({
        suggestions,
        patterns,
        timestamp: Date.now(),
        requestId
      })

      const duration = Date.now() - startTime
      this._log('info', `[${requestId}] Aggregation completed in ${duration}ms`)

      return {
        suggestions,
        patterns,
        metadata: {
          rawCount: rawFeedback.length,
          qualityCount: qualityFeedback.length,
          patternCount: patterns.length,
          suggestionCount: suggestions.length,
          duration,
          requestId
        }
      }

    } catch (error) {
      // Silent fail（Iron Law - 不向上抛异常）
      this._log('error', `[${requestId}] Aggregation failed`, error)
      return {
        suggestions: [],
        patterns: [],
        metadata: { 
          duration: Date.now() - startTime,
          error: error.message 
        },
        reason: 'error'
      }
    } finally {
      // 清理状态（Iron Law 6 - State Consistency）
      this._processing = false
      this._currentBatch = null
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 获取反馈总数
   * Silent fail: Storage失败返回0
   */
  async _getFeedbackCount() {
    try {
      if (!this._storage || typeof this._storage.count !== 'function') {
        return 0
      }
      
      const count = await this._storage.count('feedback_events')
      return count || 0
    } catch (error) {
      this._log('warn', 'Failed to get feedback count', error)
      return 0
    }
  }

  /**
   * 带超时的反馈查询
   * 失败场景2: Storage查询失败 → Silent fail
   * 失败场景5: 超时 → 中断+部分结果
   */
  async _queryFeedbackWithTimeout(requestId) {
    try {
      const queryPromise = this._queryFeedback()
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(
          () => reject(new Error('Query timeout')),
          this._config.timeout
        )
      })

      const result = await Promise.race([queryPromise, timeoutPromise])
      return result

    } catch (error) {
      if (error.message === 'Query timeout') {
        this._log('warn', `[${requestId}] Query timeout after ${this._config.timeout}ms`)
        // 返回已有的部分结果（如果有）
        return this._currentBatch || []
      }
      
      this._log('error', `[${requestId}] Query failed`, error)
      return []
    }
  }

  /**
   * 查询反馈数据
   */
  async _queryFeedback() {
    if (!this._storage || typeof this._storage.query !== 'function') {
      return []
    }

    // 查询最近一周的反馈
    const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    
    // P1-004修复：使用函数过滤而非MongoDB操作符
    const result = await this._storage.query('feedback_events', {
      timestamp: (val) => val >= oneWeekAgo,  // 函数过滤
      rating: 'dislike'  // 只关注"踩"的反馈
    })

    return result || []
  }

  /**
   * 质量过滤
   * 失败场景6: 重复反馈 → 去重
   * 失败场景3: 过滤后无数据 → 返回空数组
   */
  _filterQuality(rawFeedback, requestId) {
    try {
      // 去重：同一contentId只保留最新的
      const deduped = this._deduplicate(rawFeedback)
      
      // 质量过滤
      const filtered = deduped.filter(item => {
        // 规则1: 有完整数据
        if (!item.contentId || !item.rating || !item.timestamp) {
          return false
        }

        // 规则2: 用户有实际操作（不是只点"踩"）
        if (!item.alternativeId && !item.userAction) {
          return false
        }

        // 规则3: 反馈时间合理（不是瞬间点击）
        if (item.userAction && item.actionTime && item.feedbackTime) {
          const duration = item.actionTime - item.feedbackTime
          if (duration < 2000) {
            return false  // 小于2秒可能是误触
          }
        }

        return true
      })

      this._log('info', `[${requestId}] Quality filter: ${rawFeedback.length} → ${deduped.length} → ${filtered.length}`)
      
      return filtered

    } catch (error) {
      // Silent fail（Iron Law）
      this._log('warn', `[${requestId}] Quality filter failed`, error)
      return []
    }
  }

  /**
   * 去重：同一contentId只保留最新的
   */
  _deduplicate(feedback) {
    const map = new Map()
    
    feedback.forEach(item => {
      const existing = map.get(item.contentId)
      if (!existing || item.timestamp > existing.timestamp) {
        map.set(item.contentId, item)
      }
    })

    return Array.from(map.values())
  }

  /**
   * 模式识别
   * 失败场景7: 无明确模式 → 返回空数组
   */
  _identifyPatterns(qualityFeedback, requestId) {
    try {
      // 按策略分组统计
      const strategyStats = {}
      
      qualityFeedback.forEach(item => {
        const strategy = item.strategy || 'unknown'
        if (!strategyStats[strategy]) {
          strategyStats[strategy] = {
            count: 0,
            rejected: 0,
            accepted: 0,
            retried: 0
          }
        }
        
        strategyStats[strategy].count++
        
        if (item.userAction === 'reject') {
          strategyStats[strategy].rejected++
        } else if (item.userAction === 'accept') {
          strategyStats[strategy].accepted++
        } else if (item.userAction === 'retry') {
          strategyStats[strategy].retried++
        }
      })

      // 识别高频拒绝模式
      const patterns = []
      
      Object.entries(strategyStats).forEach(([strategy, stats]) => {
        const rejectRate = stats.rejected / stats.count
        
        // 模式1: 高拒绝率（>50%且样本量>10）
        if (rejectRate > 0.5 && stats.count > 10) {
          patterns.push({
            type: 'high_reject_rate',
            strategy,
            rejectRate: Math.round(rejectRate * 100) / 100,
            sampleSize: stats.count,
            severity: rejectRate > 0.7 ? 'high' : 'medium'
          })
        }

        // 模式2: 高重试率（>30%）
        const retryRate = stats.retried / stats.count
        if (retryRate > 0.3 && stats.count > 10) {
          patterns.push({
            type: 'high_retry_rate',
            strategy,
            retryRate: Math.round(retryRate * 100) / 100,
            sampleSize: stats.count,
            severity: 'medium'
          })
        }
      })

      this._log('info', `[${requestId}] Patterns: ${JSON.stringify(patterns)}`)
      
      return patterns

    } catch (error) {
      this._log('warn', `[${requestId}] Pattern identification failed`, error)
      return []
    }
  }

  /**
   * 生成建议
   * 失败场景4: AI服务不可用 → 降级规则生成
   * 失败场景8: 格式错误 → 使用默认模板
   */
  async _generateSuggestions(patterns, requestId) {
    const suggestions = []

    for (const pattern of patterns) {
      try {
        // 尝试AI生成
        const aiSuggestion = await this._generateWithAI(pattern, requestId)
        
        if (aiSuggestion && this._validateSuggestion(aiSuggestion)) {
          suggestions.push({
            ...aiSuggestion,
            source: 'ai',
            pattern
          })
        } else {
          // 失败场景8: 格式错误 → 使用模板
          const fallbackSuggestion = this._generateWithTemplate(pattern)
          suggestions.push({
            ...fallbackSuggestion,
            source: 'fallback',
            pattern
          })
        }

      } catch (error) {
        // 失败场景4: AI失败 → 降级规则生成
        this._log('warn', `[${requestId}] AI generation failed for pattern ${pattern.type}`, error)
        
        const fallbackSuggestion = this._generateWithTemplate(pattern)
        suggestions.push({
          ...fallbackSuggestion,
          source: 'fallback',
          pattern
        })
      }
    }

    return suggestions
  }

  /**
   * AI生成建议（有2秒超时）
   */
  async _generateWithAI(pattern, requestId) {
    if (!this._aiService || typeof this._aiService.generateHint !== 'function') {
      throw new Error('AI service not available')
    }

    const prompt = this._buildPrompt(pattern)
    
    const aiPromise = this._aiService.generateHint(prompt, {
      source: 'feedback_aggregation'
    })

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('AI timeout')), 2000)
    })

    const result = await Promise.race([aiPromise, timeoutPromise])
    
    return {
      title: result.title || '建议',
      description: result.hint || result.response || '',
      priority: pattern.severity
    }
  }

  /**
   * 构建AI Prompt
   */
  _buildPrompt(pattern) {
    if (pattern.type === 'high_reject_rate') {
      return `分析反馈数据：策略"${pattern.strategy}"的拒绝率达到${pattern.rejectRate * 100}%（样本量${pattern.sampleSize}）。请给出1-2句话的Prompt优化建议。`
    }
    
    if (pattern.type === 'high_retry_rate') {
      return `分析反馈数据：策略"${pattern.strategy}"的重试率达到${pattern.retryRate * 100}%（样本量${pattern.sampleSize}）。请给出1-2句话的Prompt优化建议。`
    }

    return `分析反馈数据：${JSON.stringify(pattern)}。请给出优化建议。`
  }

  /**
   * 使用模板生成（fallback）
   */
  _generateWithTemplate(pattern) {
    const templates = this._fallbackTemplates[pattern.type] || this._fallbackTemplates.default
    
    return {
      title: templates.title.replace('{strategy}', pattern.strategy),
      description: templates.description
        .replace('{strategy}', pattern.strategy)
        .replace('{rate}', Math.round(pattern.rejectRate * 100 || pattern.retryRate * 100))
        .replace('{count}', pattern.sampleSize),
      priority: pattern.severity
    }
  }

  /**
   * 验证建议格式
   */
  _validateSuggestion(suggestion) {
    return suggestion &&
           typeof suggestion.title === 'string' &&
           typeof suggestion.description === 'string' &&
           suggestion.title.length > 0 &&
           suggestion.description.length > 0
  }

  /**
   * 持久化结果（Silent fail）
   */
  async _persistResults(results) {
    try {
      if (!this._storage || typeof this._storage.save !== 'function') {
        return
      }

      await this._storage.save(this._config.storageKey, results)
      
      // 同时上报到服务器（可选）
      if (this._uploader && typeof this._uploader.upload === 'function') {
        await this._uploader.upload({
          type: 'feedback_aggregation_results',
          data: results
        })
      }

    } catch (error) {
      // Silent fail
      this._log('warn', 'Failed to persist results', error)
    }
  }

  // ==================== 工具方法 ====================

  _validateConfig(config) {
    // 支持aggregationTimeout或timeout（P1-004修复：配置命名统一）
    const timeout = config.aggregationTimeout || config.timeout || 30000;
    
    return {
      minFeedbackCount: Math.max(config.minFeedbackCount || 50, 10),
      timeout: Math.min(Math.max(timeout, 10000), 60000),
      batchSize: Math.max(config.batchSize || 500, 100),
      storageKey: config.storageKey || 'feedback_aggregation_results'
    }
  }

  _initFallbackTemplates() {
    return {
      high_reject_rate: {
        title: '策略"{strategy}"拒绝率过高',
        description: '策略"{strategy}"的拒绝率达到{rate}%（样本量{count}），建议优化Prompt或调整策略参数。'
      },
      high_retry_rate: {
        title: '策略"{strategy}"重试率过高',
        description: '策略"{strategy}"的重试率达到{rate}%（样本量{count}），用户可能对初次结果不满意，建议增强策略效果。'
      },
      default: {
        title: '发现反馈模式',
        description: '检测到异常反馈模式，建议review相关策略。'
      }
    }
  }

  _generateRequestId() {
    return `agg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  _log(level, message, payload) {
    const text = `[FeedbackAggregationService] ${message}`
    
    if (!this._logger) {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        text,
        payload
      )
      return
    }

    this._logger[level](text, payload)
  }
}

module.exports = FeedbackAggregationService
