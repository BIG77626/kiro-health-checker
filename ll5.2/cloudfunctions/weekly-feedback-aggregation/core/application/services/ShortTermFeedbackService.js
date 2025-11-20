/**
 * ShortTermFeedbackService - P1-003 短期反馈响应
 *
 * === 设计目标 ===
 * - 用户“踩”后 2 秒内给出替代方案
 * - 依赖 AlternativeStrategies + AI 服务生成结果
 * - 失败不崩溃，提供降级模板
 *
 * === 依赖 ===
 * - aiService: 实现 generateHint(prompt) 的对象（IAIService）
 * - storageAdapter: 写入 short_term_feedback 历史
 * - uploaderAdapter: 可选，后续用于埋点/上报
 */

const AlternativeStrategies = require('./AlternativeStrategies')

class ShortTermFeedbackService {
  /**
   * @param {Object} config
   * @param {number} config.responseTimeout - AI响应超时时间（毫秒）
   * @param {number} config.maxHistoryItems - 本地缓存的最大记录数
   * @param {IAIService} aiService
   * @param {StorageAdapter} storageAdapter
   * @param {UploaderAdapter} uploaderAdapter
   * @param {Object} logger
   */
  constructor(
    config = {},
    aiService,
    storageAdapter,
    uploaderAdapter,
    logger = console
  ) {
    this._config = this._validateConfig(config)
    this._aiService = aiService
    this._storage = storageAdapter
    this._uploader = uploaderAdapter
    this._logger = logger || console
    this._historyKey =
      this._config.storageKey || 'short_term_feedback_history'
    this._pending = new Map()
  }

  /**
   * 处理用户反馈，生成替代方案
   * @param {Object} feedbackData
   * @returns {Promise<Object>}
   */
  async handleFeedback(feedbackData) {
    // 生成requestId用于追踪
    const requestId = this._generateRequestId()
    
    if (!this._validateFeedbackData(feedbackData)) {
      this._log('warn', `[${requestId}] Invalid feedback data, skip`, feedbackData)
      return { shouldRetry: false }
    }

    this._log('info', `[${requestId}] handleFeedback start`, {
      contentId: feedbackData.contentId,
      feedbackType: feedbackData.feedbackType
    })

    // Bug修复: timestamp缺失时使用contentId作为去重键
    // 这样同一contentId的重复"踩"会被去重，但首次"踩"和后续"重试"不同
    const cacheKey = feedbackData.timestamp 
      ? `${feedbackData.contentId}_${feedbackData.timestamp}`
      : feedbackData.contentId
    
    if (this._pending.has(cacheKey)) {
      this._log('info', `[${requestId}] Deduplicated request`, { cacheKey })
      return this._pending.get(cacheKey)
    }

    const promise = this._handle(feedbackData, requestId).finally(() => {
      this._pending.delete(cacheKey)
    })
    this._pending.set(cacheKey, promise)
    return promise
  }

  /**
   * 记录用户在替代方案上的操作
   * @param {string} contentId
   * @param {'accept'|'reject'|'retry'} action
   */
  async logUserAction(contentId, action) {
    if (!contentId || !action) {
      return
    }

    try {
      const record = {
        contentId,
        action,
        timestamp: Date.now()
      }

      if (this._uploader) {
        await this._uploader.upload({
          type: 'short_term_feedback_action',
          data: record
        })
      } else if (this._storage) {
        const history = this._storage.load(this._historyKey) || []
        history.push({ ...record, type: 'action' })
        this._trimHistory(history)
        this._storage.save(this._historyKey, history)
      }
    } catch (error) {
      this._log('warn', 'logUserAction failed', error)
    }
  }

  // ==================== 私有方法 ====================

  async _handle(feedbackData, requestId) {
    const start = Date.now()
    const context = this._buildContext(feedbackData)
    const strategy = this._selectStrategy(context)
    const prompt = this._generatePrompt(strategy, feedbackData, context)

    this._log('info', `[${requestId}] Strategy selected: ${strategy.id}`)

    try {
      this._log('info', `[${requestId}] Calling AI service...`)
      const aiStart = Date.now()
      
      const alternativeText = await this._generateAlternative(prompt)
      
      const aiLatency = Date.now() - aiStart
      this._log('info', `[${requestId}] AI returned successfully`, { 
        aiLatency: `${aiLatency}ms`,
        contentLength: alternativeText.length 
      })
      
      const response = this._buildResponse({
        feedbackData,
        strategy,
        resultText: alternativeText,
        latency: Date.now() - start,
        aiLatency
      })

      await this._persistHistory(feedbackData, response)
      
      this._log('info', `[${requestId}] handleFeedback complete`, {
        totalLatency: `${response.latency}ms`,
        isFallback: false
      })
      
      return response
    } catch (error) {
      const errorType = error.message.includes('timeout') ? 'TIMEOUT' : 'AI_FAILURE'
      this._log('warn', `[${requestId}] AI generation failed (${errorType}), fallback to template`, error)
      
      const fallbackText = this._buildFallback(strategy, feedbackData, context)
      const fallbackResponse = this._buildResponse({
        feedbackData,
        strategy,
        resultText: fallbackText,
        latency: Date.now() - start,
        isFallback: true,
        errorType
      })
      
      await this._persistHistory(feedbackData, fallbackResponse, error)
      
      this._log('warn', `[${requestId}] handleFeedback complete with fallback`, {
        totalLatency: `${fallbackResponse.latency}ms`,
        errorType
      })
      
      return fallbackResponse
    }
  }

  _validateConfig(config) {
    return {
      responseTimeout: Math.min(Math.max(config.responseTimeout || 2000, 500), 5000),
      maxHistoryItems: Math.min(Math.max(config.maxHistoryItems || 200, 1), 1000),  // 最小1，不是10
      storageKey: config.storageKey || 'short_term_feedback_history'
    }
  }

  _validateFeedbackData(data) {
    if (!data) return false
    if (data.rating !== 'dislike') return false
    if (!data.contentId) return false
    if (!data.feedbackType) return false
    return true
  }

  _buildContext(feedbackData) {
    const context = feedbackData.context || {}
    return {
      contentId: feedbackData.contentId,  // Bug修复: 传递contentId用于查历史
      originalContent: context.originalContent || context.aiContent || '',
      userMessage: context.userMessage || '',
      metadata: context.metadata || {},
      dissatisfactionReason:
        context.dissatisfactionReason ||
        context.feedbackReason ||
        'clarity'
    }
  }

  _selectStrategy(context) {
    // Bug修复: 策略智能选择 - 基于历史记录自动切换策略
    
    let triedStrategies = []
    
    // 1. 查历史：看这个contentId已经尝试过哪些策略（Silent fail）
    try {
      const history = this._storage?.load(this._historyKey) || []
      const contentHistory = history.filter(h => h.contentId === context.contentId)
      triedStrategies = contentHistory.map(h => h.strategy).filter(Boolean)
    } catch (error) {
      // Storage失败不影响策略选择，继续用默认逻辑
      this._log('warn', 'Failed to load history for strategy selection', error)
    }
    
    // 2. 如果有明确的dissatisfactionReason（非默认'clarity'），优先使用
    if (context.dissatisfactionReason && 
        context.dissatisfactionReason !== 'clarity' &&
        triedStrategies.length === 0) {
      return AlternativeStrategies.selectBestStrategy(context.dissatisfactionReason)
    }
    
    // 3. 策略循环：按顺序尝试未用过的策略
    const allStrategies = AlternativeStrategies.getAllStrategies()
    for (const strategy of allStrategies) {
      if (!triedStrategies.includes(strategy.id)) {
        return strategy
      }
    }
    
    // 4. 全部尝试过了，回到第一个（重新开始循环）
    return allStrategies[0]
  }

  _generatePrompt(strategy, feedbackData, context) {
    return strategy.generatePrompt({
      contentType: feedbackData.feedbackType,
      originalContent: context.originalContent || '[原始内容缺失]',
      metadata: {
        ...context.metadata,
        userMessage: context.userMessage
      }
    })
  }

  async _generateAlternative(prompt) {
    if (!this._aiService || typeof this._aiService.generateHint !== 'function') {
      throw new Error('AI service not available')
    }

    const aiPromise = this._aiService.generateHint(prompt, {
      source: 'short_term_feedback'
    })

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(
        () => reject(new Error('ShortTermFeedback timeout')),
        this._config.responseTimeout
      )
    })

    const aiResult = await Promise.race([aiPromise, timeoutPromise])

    if (!aiResult) {
      throw new Error('AI returned empty result')
    }

    return (
      aiResult.hint ||
      aiResult.response ||
      aiResult.content ||
      (aiResult.data && aiResult.data.text) ||
      JSON.stringify(aiResult)
    )
  }

  _buildFallback(strategy, feedbackData, context) {
    const template = AlternativeStrategies.getFallbackTemplate(
      feedbackData.feedbackType,
      strategy.id
    )

    const snippet = (context.originalContent || '').slice(0, 60)

    return template.replace(/\[.*?\]/g, match => {
      if (match.includes('核心观点')) {
        return snippet || '换个说法可能会更合适。'
      }
      if (match.includes('译文')) {
        return snippet || '我会重新为你翻译这段内容。'
      }
      if (match.includes('步骤')) {
        return '1. 明确问题  2. 换个角度思考  3. 再试一次'
      }
      return snippet || ''
    })
  }

  _buildResponse({ feedbackData, strategy, resultText, latency, isFallback }) {
    const explanationMap = {
      simplify: '我尝试用更简单、更直白的方式重新表达刚才的建议。',
      elaborate: '我补充了更多背景信息和细节，帮助你深入理解原因。',
      reframe: '我换了一个角度重新阐述，也许新的视角更适合你。'
    }

    return {
      shouldRetry: true,
      alternativeResult: resultText,
      strategy: strategy.id,
      strategyName: strategy.name,
      explanation: explanationMap[strategy.id] || '我为你调整了表达方式。',
      latency,
      isFallback: !!isFallback
    }
  }

  async _persistHistory(feedbackData, response, error) {
    if (!this._storage) {
      return
    }

    try {
      const history = this._storage.load(this._historyKey) || []
      history.push({
        contentId: feedbackData.contentId,
        feedbackType: feedbackData.feedbackType,
        rating: feedbackData.rating,
        strategy: response.strategy,
        latency: response.latency,
        isFallback: response.isFallback,
        timestamp: Date.now(),
        error: error ? error.message : null
      })
      this._trimHistory(history)
      this._storage.save(this._historyKey, history)
    } catch (storageError) {
      this._log('warn', 'Persist history failed', storageError)
    }
  }

  _trimHistory(history) {
    if (!Array.isArray(history)) return
    while (history.length > this._config.maxHistoryItems) {
      history.shift()
    }
  }

  _generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  _log(level, message, payload) {
    const text = `[ShortTermFeedbackService] ${message}`
    if (!this._logger) {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        text,
        payload
      )
      return
    }

    if (typeof this._logger[level] === 'function') {
      this._logger[level](text, payload)
    } else if (typeof this._logger.log === 'function') {
      this._logger.log(text, payload)
    }
  }
}

module.exports = ShortTermFeedbackService


