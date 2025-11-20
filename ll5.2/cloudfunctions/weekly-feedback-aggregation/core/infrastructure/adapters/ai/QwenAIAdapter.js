const IAIService = require('../../../application/interfaces/IAIService')
const PlatformAdapter = require('../../adapters/platform/PlatformAdapter')

/**
 * Qwen AI服务适配器
 * 实现 IAIService 接口，集成Qwen大语言模型
 *
 * ⚠️ 安全警告：
 * 此适配器当前仍支持客户端直接调用厂商API（存在密钥泄露风险）
 * 建议尽快迁移到云函数代理模式（见风险整改方案_P0.md）
 *
 * 架构改进：
 * 1. 添加conversationHistory大小限制（防止内存泄漏）
 * 2. 改进错误处理机制（向用户明确传达错误）
 * 3. 优化方法调用链（减少耦合）
 * 4. 使用PlatformAdapter解决平台兼容性问题
 *
 * @class QwenAIAdapter
 * @implements {IAIService}
 */
class QwenAIAdapter extends IAIService {
  /**
   * 构造函数
   * @param {Object} config - 配置对象
   * @param {string} config.apiKey - Qwen API密钥（⚠️ 不应在客户端传递）
   * @param {string} config.baseURL - Qwen API基础URL
   * @param {string} config.model - 使用的模型名称
   * @param {string} config.customModelURL - 自定义微调模型URL (vLLM)
   * @param {string} config.customModelName - 自定义模型名称
   * @param {number} config.maxHistorySize - 最大历史记录数（默认10）
   */
  constructor(config = {}) {
    super()

    // PlatformAdapter已在文件顶部导入

    // 支持多种AI服务模式：微调模型 > 官方API
    this.customModelURL = config.customModelURL || PlatformAdapter.getConfig('CUSTOM_MODEL_URL')
    this.customModelName = config.customModelName || PlatformAdapter.getConfig('CUSTOM_MODEL_NAME', 'qwen3-14b-finetuned')

    // 官方API配置
    // ⚠️ 安全警告：apiKey不应在客户端获取，应通过云函数代理
    this.apiKey = config.apiKey || PlatformAdapter.getConfig('QWEN_API_KEY')
    this.baseURL = config.baseURL || PlatformAdapter.getConfig('QWEN_BASE_URL', 'https://dashscope.aliyuncs.com/api/v1')
    this.model = config.model || 'qwen-turbo'
    
    // 检测运行环境并发出警告
    if (PlatformAdapter.isWeChatMiniProgram() && !config.apiKey) {
      console.warn('⚠️ [QwenAIAdapter] 在微信小程序环境中，API密钥应通过云函数获取，不应在客户端存储')
    }

    // 内存管理配置（符合M1：Map清理策略）
    this.maxHistorySize = config.maxHistorySize || 10
    this.conversationHistories = new Map() // 按userId存储会话历史
    this.maxUserSessions = config.maxUserSessions || 1000 // 最大用户会话数
    this.sessionTTL = config.sessionTTL || (24 * 60 * 60 * 1000) // 会话TTL: 24小时

    // 定时器管理（符合M2：定时器生命周期管理）
    this.timers = new Set()

    // 定期清理过期会话（每分钟检查一次）
    const { timer: cleanupTimer } = this._createResilientTimer(
      () => this._cleanupExpiredSessions(),
      60000,
      'session-cleanup'
    )
    this.timers.add(cleanupTimer)

    // 优先使用微调模型，如果没有配置则使用官方API
    this.useCustomModel = !!this.customModelURL

    if (this.useCustomModel) {
      console.log('[QwenAIAdapter] 使用微调模型模式:', this.customModelName)
      console.log('[QwenAIAdapter] 微调模型URL:', this.customModelURL)
    } else {
      if (!this.apiKey) {
        throw new Error('Qwen API key is required when not using custom model. Please set QWEN_API_KEY environment variable.')
      }
      console.log('[QwenAIAdapter] 使用官方API模式，模型:', this.model)
    }
  }

  /**
   * 获取用户会话历史（带大小限制）
   * @param {string} userId - 用户ID
   * @returns {Array} 会话历史
   * @private
   */
  _getConversationHistory(userId) {
    if (!this.conversationHistories.has(userId)) {
      this.conversationHistories.set(userId, [])
    }
    return this.conversationHistories.get(userId)
  }

  /**
   * 添加会话记录（符合M1：Map清理策略 - 自动限制大小和TTL）
   * @param {string} userId - 用户ID
   * @param {Object} record - 会话记录
   * @private
   */
  _addConversationRecord(userId, record) {
    // 更新会话的最后访问时间
    const sessionData = this.conversationHistories.get(userId)
    if (sessionData) {
      sessionData.lastAccessTime = Date.now()
    }

    const history = this._getConversationHistory(userId)
    history.push({
      ...record,
      timestamp: Date.now() // 为每条记录添加时间戳
    })

    // 限制历史记录大小，防止内存泄漏（符合M1）
    if (history.length > this.maxHistorySize) {
      history.shift() // 移除最早的记录
    }
  }

  /**
   * 创建具有容错能力的定时器（强化M2：定时器生命周期管理）
   * @param {Function} fn - 要执行的函数
   * @param {number} interval - 执行间隔
   * @param {string} timerName - 定时器名称（用于日志）
   * @returns {Object} 定时器对象
   * @private
   */
  _createResilientTimer(fn, interval, timerName = 'unnamed') {
    let consecutiveFailures = 0
    const maxConsecutiveFailures = 3
    const backoffMultiplier = 2

    const wrappedFn = async () => {
      try {
        await fn()
        consecutiveFailures = 0 // 重置失败计数
      } catch (error) {
        consecutiveFailures++
        console.error(`[QwenAIAdapter] Timer ${timerName} failed (${consecutiveFailures}/${maxConsecutiveFailures}):`, error)

        // 如果连续失败达到上限，增加间隔或停止定时器
        if (consecutiveFailures >= maxConsecutiveFailures) {
          console.error(`[QwenAIAdapter] Timer ${timerName} stopped due to ${maxConsecutiveFailures} consecutive failures`)
          // 不自动重启，让系统管理员处理
          return
        }

        // 短暂延迟后重试（避免无限递归）
        setTimeout(() => {
          try {
            wrappedFn()
          } catch (retryError) {
            console.error(`[QwenAIAdapter] Timer ${timerName} retry failed:`, retryError)
          }
        }, 1000 * consecutiveFailures) // 递增延迟
      }
    }

    const timer = setInterval(wrappedFn, interval)
    return { timer, wrappedFn, timerName }
  }

  /**
   * 获取会话历史（符合M1：Map清理策略 - 更新访问时间）
   * @param {string} userId - 用户ID
   * @returns {Array} 会话历史
   * @private
   */
  _getConversationHistory(userId) {
    if (!this.conversationHistories.has(userId)) {
      this.conversationHistories.set(userId, {
        history: [],
        lastAccessTime: Date.now(),
        createdAt: Date.now()
      })
    }

    const sessionData = this.conversationHistories.get(userId)
    sessionData.lastAccessTime = Date.now() // 更新访问时间

    return sessionData.history
  }

  /**
   * 清除用户会话历史（符合M1：Map清理策略）
   * @param {string} userId - 用户ID
   */
  clearConversationHistory(userId) {
    // 显式删除以释放内存（符合M1）
    this.conversationHistories.delete(userId)

    // 强制垃圾回收提示（可选，在支持的环境中）
    if (global.gc) {
      global.gc()
    }
  }

  /**
   * 清除所有会话历史（内存管理）
   */
  clearAllConversationHistories() {
    // 清理所有会话历史（符合M1）
    this.conversationHistories.clear()

    // 强制垃圾回收提示（符合M1）
    if (global.gc) {
      global.gc()
    }
  }

  /**
   * 清理过期会话（自动调用）
   * @private
   */
  /**
   * 动态清理策略：基于内存压力和时间双重触发（强化M1：Map清理策略）
   * @returns {boolean} 是否需要清理
   * @private
   */
  _shouldTriggerCleanup() {
    const now = Date.now()
    const currentUsage = this.conversationHistories.size / this.maxUserSessions

    // 内存压力触发：超过90%使用率
    const memoryPressure = currentUsage > 0.9

    // 时间周期触发：每5分钟强制检查一次
    const timePressure = now % (5 * 60 * 1000) === 0

    // 紧急情况：超过100%使用率
    const emergencyPressure = currentUsage > 1.0

    return memoryPressure || timePressure || emergencyPressure
  }

  /**
   * 智能清理会话（强化M1：Map清理策略 - 动态压力感知）
   * @private
   */
  _smartCleanupSessions() {
    try {
      const now = Date.now()
      let totalCleaned = 0
      const cleanStats = { ttl: 0, lru: 0, pressure: 0 }

      // 阶段1: TTL清理 - 时间过期优先
      const ttlExpired = []
      for (const [userId, sessionData] of this.conversationHistories.entries()) {
        if (now - sessionData.lastAccessTime > this.sessionTTL) {
          ttlExpired.push(userId)
        }
      }

      ttlExpired.forEach(userId => {
        this.conversationHistories.delete(userId)
        cleanStats.ttl++
        totalCleaned++
      })

      // 阶段2: 动态压力清理 - 根据当前使用率决定清理力度
      const currentUsage = this.conversationHistories.size / this.maxUserSessions

      if (currentUsage > 0.8) { // 超过80%开始LRU清理
        const sessions = Array.from(this.conversationHistories.entries())
        const sortedByAccessTime = sessions.sort((a, b) =>
          a[1].lastAccessTime - b[1].lastAccessTime
        )

        // 动态计算清理数量：使用率越高，清理越多
        const cleanupRatio = Math.min(0.3, (currentUsage - 0.8) * 2) // 最多清理30%
        const toRemoveCount = Math.max(1, Math.floor(sessions.length * cleanupRatio))

        const toRemove = sortedByAccessTime.slice(0, toRemoveCount)
        toRemove.forEach(([userId]) => {
          this.conversationHistories.delete(userId)
          cleanStats.lru++
          totalCleaned++
        })
      }

      // 阶段3: 紧急清理 - 超过100%强制清理
      if (this.conversationHistories.size > this.maxUserSessions) {
        const sessions = Array.from(this.conversationHistories.entries())
        const sortedByAccessTime = sessions.sort((a, b) =>
          a[1].lastAccessTime - b[1].lastAccessTime
        )

        const emergencyRemove = sortedByAccessTime.slice(0, this.conversationHistories.size - this.maxUserSessions)
        emergencyRemove.forEach(([userId]) => {
          this.conversationHistories.delete(userId)
          cleanStats.pressure++
          totalCleaned++
        })
      }

      if (totalCleaned > 0) {
        console.log(`[QwenAIAdapter] 智能清理完成:`, {
          total: totalCleaned,
          ttl: cleanStats.ttl,
          lru: cleanStats.lru,
          pressure: cleanStats.pressure,
          remaining: this.conversationHistories.size,
          usage: `${(this.conversationHistories.size / this.maxUserSessions * 100).toFixed(1)}%`
        })
      }
    } catch (error) {
      console.error('[QwenAIAdapter] 智能清理失败:', error)
    }
  }

  /**
   * 清理过期会话（强化M1：Map清理策略 - TTL和LRU双重清理）
   * @private
   */
  _cleanupExpiredSessions() {
    // 只有在需要清理时才执行，提高效率
    if (this._shouldTriggerCleanup()) {
      this._smartCleanupSessions()
    }
  }

  /**
   * 销毁适配器，清理所有资源（符合M2：定时器生命周期管理）
   */
  destroy() {
    // 清理所有定时器（符合M2）
    if (this.timers) {
      this.timers.forEach(timer => clearInterval(timer))
      this.timers.clear()
    }

    // 清理所有会话历史（符合M1）
    this.conversationHistories.clear()

    // 防止循环引用（符合M3）
    Object.keys(this).forEach(key => {
      if (this[key] instanceof Map || this[key] instanceof Set) {
        this[key].clear()
      }
    })
  }

  /**
   * 验证API响应格式
   * @param {Object} response - API响应
   * @throws {Error} 响应格式无效时抛出异常
   * @private
   */
  _validateAPIResponse(response) {
    if (!response || typeof response !== 'object') {
      throw new Error('[QwenAIAdapter] Invalid API response: response must be an object')
    }

    if (!response.content || typeof response.content !== 'string') {
      throw new Error('[QwenAIAdapter] Invalid API response: missing or invalid content field')
    }

    // 验证content长度（防止恶意响应）
    if (response.content.length > 50000) { // 50KB限制
      throw new Error('[QwenAIAdapter] Invalid API response: content too large')
    }

    return response
  }

  /**
   * 生成学习提示
   * @param {string} question - 用户的问题或学习内容
   * @param {Object} context - 上下文信息
   * @param {string} context.context - 上下文标识（如题目类型、学习阶段等）
   * @param {Array} context.conversationHistory - 对话历史
   * @returns {Promise<Object>} 包含hint和suggestions的响应对象
   */
  async generateHint(question, context = {}) {
    try {
      const normalizedQuestion = typeof question === 'string'
        ? question
        : question
          ? JSON.stringify(question, null, 2)
          : ''

      console.log('[QwenAIAdapter] 生成提示:', { question: normalizedQuestion.substring(0, 100), context: context.context })

      const prompt = this._buildHintPrompt(normalizedQuestion, context)

      const response = await this._callAIService(prompt, {
        temperature: 0.3,
        max_tokens: 800,
        context: context
      })

      // 验证API响应格式
      this._validateAPIResponse(response)

      const result = this._parseResponse(response)

      console.log('[QwenAIAdapter] 提示生成成功')
      return result

    } catch (error) {
      console.error('[QwenAIAdapter] 生成提示失败:', error)

      return this._buildFallbackHintResponse()
    }
  }

  /**
   * 分析学习数据
   * @param {Object} learningData - 学习数据
   * @returns {Promise<Object>} 学习分析结果
   */
  async analyzeLearningData(learningData) {
    try {
      console.log('[QwenAIAdapter] 分析学习数据')

      const prompt = this._buildAnalysisPrompt(learningData)

      const response = await this._callAIService(prompt, {
        temperature: 0.2,
        max_tokens: 1000
      })

      return this._parseAnalysisResponse(response)

    } catch (error) {
      console.error('[QwenAIAdapter] 学习数据分析失败:', error)

      return {
        diagnosis: '数据分析暂时不可用',
        recommendations: ['继续保持学习习惯', '定期复习已学内容'],
        strengths: [],
        weaknesses: []
      }
    }
  }

  /**
   * 生成学习计划
   * @param {Object} userProfile - 用户信息
   * @param {Object} learningGoals - 学习目标
   * @returns {Promise<Object>} 个性化学习计划
   */
  async generateLearningPlan(userProfile, learningGoals) {
    try {
      console.log('[QwenAIAdapter] 生成学习计划')

      const prompt = this._buildPlanPrompt(userProfile, learningGoals)

      const response = await this._callAIService(prompt, {
        temperature: 0.4,
        max_tokens: 1200
      })

      return this._parsePlanResponse(response)

    } catch (error) {
      console.error('[QwenAIAdapter] 学习计划生成失败:', error)

      return this._buildFallbackPlan()
    }
  }

  /**
   * 构建提示词
   * @private
   * @param {string} question - 用户问题
   * @param {Object} context - 上下文
   * @returns {string} 完整的提示词
   */
  _buildHintPrompt(question, context) {
    const systemPrompt = `你是一位专业的考研英语辅导老师，擅长帮助学生解决英语学习中的各种问题。
请根据用户的问题提供准确、有针对性的指导和建议。

回答要求：
1. 语言亲切友好，鼓励学生
2. 内容准确专业，逻辑清晰
3. 适当提供学习方法和技巧
4. 必要时给出具体例子
5. 控制回答长度，简洁明了

用户的问题：${question}

上下文信息：${context.context || '一般问题'}`

    if (context.conversationHistory && context.conversationHistory.length > 0) {
      systemPrompt += `\n\n对话历史：\n${context.conversationHistory.slice(-3).map(msg =>
        `${msg.type === 'user' ? '学生' : '老师'}: ${msg.content.substring(0, 100)}`
      ).join('\n')}`
    }

    return systemPrompt
  }

  /**
   * 构建分析提示词
   * @private
   * @param {Object} learningData - 学习数据
   * @returns {string} 分析提示词
   */
  _buildAnalysisPrompt(learningData) {
    return `请分析以下学习数据，并给出学习建议：

学习数据：${JSON.stringify(learningData, null, 2)}

请从以下方面进行分析：
1. 学习进度评估
2. 薄弱环节识别
3. 学习方法建议
4. 时间规划建议`
  }

  /**
   * 构建计划提示词
   * @private
   * @param {Object} userProfile - 用户信息
   * @param {Object} learningGoals - 学习目标
   * @returns {string} 计划提示词
   */
  _buildPlanPrompt(userProfile, learningGoals) {
    return `请根据用户信息和学习目标制定个性化学习计划：

用户信息：${JSON.stringify(userProfile, null, 2)}
学习目标：${JSON.stringify(learningGoals, null, 2)}

请制定包含以下内容的完整学习计划：
1. 总体学习策略
2. 分阶段计划
3. 每日学习任务
4. 注意事项和建议`
  }

  /**
   * 调用AI服务（支持微调模型和官方API）
   * @private
   * @param {string} prompt - 提示词
   * @param {Object} options - 调用选项
   * @returns {Promise<Object>} API响应
   */
  async _callAIService(prompt, options = {}) {
    if (this.useCustomModel) {
      return this._callCustomModel(prompt, options)
    } else {
      return this._callQwenOfficialAPI(prompt, options)
    }
  }

  /**
   * 调用自定义微调模型（vLLM）
   * @private
   * @param {string} prompt - 提示词
   * @param {Object} options - 调用选项
   * @returns {Promise<Object>} API响应
   */
  async _callCustomModel(prompt, options = {}) {
    try {
      const requestBody = {
        model: this.customModelName,
        messages: [
          {
            role: 'system',
            content: '你是一位专业的考研英语辅导老师，经过专门微调，能够提供精准的英语学习指导。请用中文回答问题。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: options.temperature || 0.3,
        max_tokens: options.max_tokens || 800,
        stream: false
      }

      console.log(`[QwenAIAdapter] 调用微调模型: ${this.customModelURL}`)

      const response = await fetch(`${this.customModelURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Custom model API request failed: ${response.status} ${errorText}`)
      }

      const result = await response.json()

      if (!result.choices || !result.choices[0] || !result.choices[0].message) {
        throw new Error('Invalid response format from custom model API')
      }

      return {
        content: result.choices[0].message.content,
        usage: result.usage || {}
      }

    } catch (error) {
      console.error('[QwenAIAdapter] 微调模型调用失败:', error)
      // 如果微调模型失败，尝试降级到官方API
      if (this.apiKey) {
        console.log('[QwenAIAdapter] 降级到官方API')
        return this._callQwenOfficialAPI(prompt, options)
      }
      throw error
    }
  }

  /**
   * 调用Qwen官方API
   * @private
   * @param {string} prompt - 提示词
   * @param {Object} options - 调用选项
   * @returns {Promise<Object>} API响应
   */
  async _callQwenOfficialAPI(prompt, options = {}) {
    const requestBody = {
      model: this.model,
      messages: [
        {
          role: 'system',
          content: '你是一位专业的考研英语辅导老师，请用中文回答问题。'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: options.temperature || 0.3,
      max_tokens: options.max_tokens || 800,
      stream: false
    }

    // 使用PlatformAdapter替代fetch（解决平台兼容性）
    const response = await PlatformAdapter.request(
      `${this.baseURL}/services/aigc/text-generation/generation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
          'X-DashScope-SSE': 'disable'
        },
        body: JSON.stringify(requestBody)
      }
    )

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Qwen API request failed: ${response.status} ${errorText}`)
    }

    const result = await response.json()

    if (!result.output || !result.output.text) {
      throw new Error('Invalid response format from Qwen API')
    }

    return {
      content: result.output.text,
      usage: result.usage || {}
    }
  }

  /**
   * 解析响应
   * @private
   * @param {Object} response - API响应
   * @returns {Object} 解析后的结果
   */
  _parseResponse(response) {
    const content = response.content || ''

    // 尝试提取建议
    const suggestions = []
    const suggestionPatterns = [
      /建议[：:]\s*(.+?)(?:\n|$)/g,
      /可以[：:]\s*(.+?)(?:\n|$)/g,
      /试试[：:]\s*(.+?)(?:\n|$)/g
    ]

    suggestionPatterns.forEach(pattern => {
      let match
      while ((match = pattern.exec(content)) !== null) {
        if (match[1] && match[1].length < 50) {
          suggestions.push(match[1].trim())
        }
      }
    })

    // 如果没有找到建议，提供默认建议
    if (suggestions.length === 0) {
      suggestions.push('多做练习题', '注意积累词汇', '定期复习')
    }

    return {
      hint: content,
      suggestions: suggestions.slice(0, 3), // 最多3个建议
      metadata: {
        model: this.useCustomModel ? this.customModelName : this.model,
        usage: response.usage
      }
    }
  }

  /**
   * 解析分析响应
   * @private
   * @param {Object} response - API响应
   * @returns {Object} 分析结果
   */
  _parseAnalysisResponse(response) {
    const content = response.content || ''

    return {
      diagnosis: content,
      recommendations: this._extractListItems(content, '建议'),
      strengths: this._extractListItems(content, '优势|优点'),
      weaknesses: this._extractListItems(content, '薄弱|不足|需要改进')
    }
  }

  /**
   * 解析计划响应
   * @private
   * @param {Object} response - API响应
   * @returns {Object} 学习计划
   */
  _parsePlanResponse(response) {
    const content = response.content || ''

    const phases = this._extractListItems(content, '阶段|phase')
    const dailyTasks = this._extractListItems(content, '每日|每天|任务')
    const notes = this._extractListItems(content, '注意|提醒|建议')
    const focusAreas = this._extractListItems(content, '重点|focus|关注|能力|薄弱')
    const weeklyGoals = this._extractWeeklyGoals(content, phases)
    const schedule = this._extractSchedule(content)

    return {
      plan: content,
      phases,
      dailyTasks,
      notes,
      focusAreas: focusAreas.length > 0 ? focusAreas : this._buildDefaultFocusAreas(),
      weeklyGoals: weeklyGoals.length > 0 ? weeklyGoals : this._buildWeeklyGoalsFromPhases(phases),
      schedule: schedule.length > 0 ? schedule : this._buildDefaultSchedule(dailyTasks, phases),
      metadata: {
        model: this.useCustomModel ? this.customModelName : this.model,
        usage: response.usage || {}
      }
    }
  }

  /**
   * 从文本中提取列表项
   * @private
   * @param {string} text - 文本内容
   * @param {string} keyword - 关键词
   * @returns {Array<string>} 提取的列表项
   */
  _extractListItems(text, keyword) {
    const items = []
    const lines = text.split('\n')

    for (const line of lines) {
      if (new RegExp(keyword, 'i').test(line)) {
        const cleanLine = line.replace(/^[\d\.\-\*\s]+/, '').trim()
        if (cleanLine.length > 0 && cleanLine.length < 100) {
          items.push(cleanLine)
        }
      }
    }

    return items
  }

  _extractWeeklyGoals(text, phases = []) {
    const weeklyMatches = []
    const regex = /(第[一二三四五六七八九十\d]+周[：:，,-]?\s*)(.+)/gi
    let match
    while ((match = regex.exec(text)) !== null) {
      const goal = match[2].trim()
      if (goal && goal.length < 120) {
        weeklyMatches.push(`${match[1].trim()} ${goal}`)
      }
    }

    if (weeklyMatches.length === 0 && phases.length > 0) {
      return this._buildWeeklyGoalsFromPhases(phases)
    }

    return weeklyMatches
  }

  _extractSchedule(text) {
    const schedule = []
    const regex = /(周[一二三四五六日天]|Mon|Tue|Wed|Thu|Fri|Sat|Sun)[：:，,-]?\s*(.+)/gi
    let match
    while ((match = regex.exec(text)) !== null) {
      const item = match[0].trim()
      if (item.length > 0 && item.length < 120) {
        schedule.push(item)
      }
    }
    return schedule
  }

  _buildWeeklyGoalsFromPhases(phases = []) {
    if (!Array.isArray(phases) || phases.length === 0) {
      return ['第1周：夯实基础知识', '第2周：强化重点能力', '第3周：实战演练与查漏补缺']
    }

    return phases.slice(0, 4).map((phase, index) => {
      const weekNumber = index + 1
      return `第${weekNumber}周：${phase}`
    })
  }

  _buildDefaultSchedule(dailyTasks = [], phases = []) {
    if (Array.isArray(dailyTasks) && dailyTasks.length > 0) {
      return [
        `周一：${dailyTasks[0]}`,
        `周三：${dailyTasks[1] || dailyTasks[0]}`,
        '周五：复盘与查漏补缺'
      ]
    }

    if (Array.isArray(phases) && phases.length > 0) {
      return phases.slice(0, 3).map((phase, index) => {
        const day = ['周一', '周三', '周五'][index] || '周末'
        return `${day}：聚焦${phase}`
      })
    }

    return ['周一：词汇巩固', '周三：阅读精练', '周五：写作训练']
  }

  _buildDefaultFocusAreas() {
    return ['词汇积累与记忆', '阅读理解能力提升', '写作表达逻辑与结构']
  }

  _buildFallbackHintResponse() {
    return {
      hint: '抱歉，我暂时无法提供详细解答。请检查网络连接或稍后重试。',
      suggestions: [
        '请重新描述您的问题',
        '尝试提供更多上下文信息',
        '查看相关学习资料'
      ]
    }
  }

  _buildFallbackPlan() {
    return {
      plan: '标准学习计划',
      phases: [
        '阶段1：夯实基础知识（2周）',
        '阶段2：强化重点能力（3周）',
        '阶段3：冲刺与查漏补缺（1周）'
      ],
      dailyTasks: ['每日单词复习', '定时阅读训练', '每周写作练习'],
      weeklyGoals: [
        '第1周：完成核心词汇学习并建立记忆卡片',
        '第2周：强化长难句分析能力',
        '第3周：完成阅读理解精练'
      ],
      focusAreas: this._buildDefaultFocusAreas(),
      schedule: ['周一：词汇巩固', '周三：阅读练习', '周五：写作训练'],
      notes: ['保持固定学习时间', '记录错题并每周复盘', '关注身心健康，合理作息'],
      metadata: {
        model: this.useCustomModel ? this.customModelName : this.model,
        usage: {},
        fallback: true
      }
    }
  }

  _buildChatResponse(payload, { reason = null } = {}) {
    const timestamp = Date.now()
    const hint = payload.hint || payload.content || ''
    const suggestions = Array.isArray(payload.suggestions) ? payload.suggestions : []
    const metadata = payload.metadata || {}

    return {
      content: hint,
      suggestions,
      timestamp,
      metadata: {
        model: metadata.model || (this.useCustomModel ? this.customModelName : this.model),
        usage: metadata.usage || payload.usage || {},
        fallback: !payload.metadata || !!reason,
        reason: reason || metadata.reason || null
      }
    }
  }

  _buildInvalidInputResponse() {
    return this._buildChatResponse({
      hint: '请输入想咨询的问题，我会根据你的学习情况提供帮助。',
      suggestions: [
        '描述你遇到的具体问题',
        '告诉我希望提升的模块',
        '提供当前的学习目标'
      ],
      metadata: {
        reason: 'INVALID_INPUT',
        usage: {}
      }
    }, { reason: 'INVALID_INPUT' })
  }

  /**
   * 构建服务不可用响应（改进的错误处理）
   * @param {string} errorDetail - 错误详情
   * @returns {Object} 服务不可用响应
   * @private
   */
  _buildServiceUnavailableResponse(errorDetail = '') {
    const fallbackResponse = this._buildFallbackHintResponse()
    
    // 向用户明确传达错误信息
    const userMessage = errorDetail 
      ? `AI服务暂时不可用。错误详情：${errorDetail}`
      : 'AI服务暂时不可用，请稍后重试。'
    
    return this._buildChatResponse({
      ...fallbackResponse,
      content: userMessage,
      error: {
        message: errorDetail,
        code: 'SERVICE_UNAVAILABLE',
        timestamp: new Date().toISOString()
      }
    }, {
      reason: 'SERVICE_UNAVAILABLE'
    })
  }

  // ==================== IAIService 接口实现 ====================

  /**
   * 分析用户学习数据并提供诊断（接口实现）
   * @param {string} userId - 用户ID
   * @param {Object} data - 学习数据
   * @returns {Promise<Object>} 分析报告
   */
  async analyzeData(userId, data) {
    return this.analyzeLearningData(data)
  }

  /**
   * 根据用户目标和数据生成学习计划（接口实现）
   * @param {string} userId - 用户ID
   * @param {Object} goals - 学习目标
   * @returns {Promise<Object>} 学习计划
   */
  async generatePlan(userId, goals) {
    return this.generateLearningPlan({ userId }, goals)
  }

  /**
   * 处理AI对话消息（接口实现）
   * @param {string} userId - 用户ID
   * @param {string} message - 用户消息
   * @returns {Promise<Object>} AI回复
   */
  /**
   * 发送消息到AI助手
   * 架构改进：不依赖generateHint，直接调用AI服务
   * 
   * @param {string} userId - 用户ID
   * @param {string} message - 用户消息
   * @returns {Promise<Object>} AI响应
   */
  async sendMessage(userId, message) {
    const sanitizedMessage = (message || '').toString().trim()

    if (!sanitizedMessage) {
      return this._buildInvalidInputResponse()
    }

    try {
      // 获取用户的会话历史
      const conversationHistory = this._getConversationHistory(userId)
      
      // 构建聊天提示词
      const prompt = this._buildChatPrompt(sanitizedMessage, conversationHistory)

      // 直接调用AI服务（避免通过generateHint间接调用）
      const response = await this._callAIService(prompt, {
        temperature: 0.7,  // 聊天场景使用更高的温度
        max_tokens: 1000,
        context: { context: 'ai_assistant_chat' }
      })

      // 验证API响应格式
      this._validateAPIResponse(response)

      // 保存会话记录（带大小限制）
      this._addConversationRecord(userId, {
        role: 'user',
        content: sanitizedMessage,
        timestamp: Date.now()
      })
      this._addConversationRecord(userId, {
        role: 'assistant',
        content: response.content,
        timestamp: Date.now()
      })

      return this._buildChatResponse(response)
    } catch (error) {
      console.error('[QwenAIAdapter] sendMessage failed:', error)
      
      // 改进的错误处理：向用户明确传达错误信息
      return this._buildServiceUnavailableResponse(error.message)
    }
  }

  /**
   * 构建聊天提示词（带文本截断保护）
   * @param {string} message - 用户消息
   * @param {Array} conversationHistory - 会话历史
   * @returns {string} 提示词
   * @private
   */
  _buildChatPrompt(message, conversationHistory = []) {
    // 文本长度限制常量
    const MAX_MESSAGE_LENGTH = 10000  // 单条消息最大长度
    const MAX_HISTORY_TEXT_LENGTH = 5000  // 历史记录总长度
    const MAX_TOTAL_PROMPT_LENGTH = 15000  // 总提示词长度
    const MAX_HISTORY_RECORDS = 6  // 最多保留的历史记录数

    // 截断用户消息
    let truncatedMessage = (message || '').toString().substring(0, MAX_MESSAGE_LENGTH)

    let historyText = ''
    let totalHistoryLength = 0

    // 添加历史上下文（最近3轮对话，带长度控制）
    const recentHistory = conversationHistory.slice(-MAX_HISTORY_RECORDS)
    if (recentHistory.length > 0) {
      historyText += '对话历史：\n'

      for (const record of recentHistory) {
        if (totalHistoryLength >= MAX_HISTORY_TEXT_LENGTH) break

        const role = record.role === 'user' ? '用户' : '助手'
        const content = (record.content || '').toString().substring(0, 500) // 单条历史记录截断

        const line = `${role}: ${content}\n`
        if (totalHistoryLength + line.length > MAX_HISTORY_TEXT_LENGTH) break

        historyText += line
        totalHistoryLength += line.length
      }

      historyText += '\n'
    }

    // 构建完整提示词
    let prompt = `你是一位专业的考研英语AI助手，请回答用户的问题。\n\n${historyText}当前问题: ${truncatedMessage}`

    // 最终长度检查
    if (prompt.length > MAX_TOTAL_PROMPT_LENGTH) {
      // 如果超出长度，优先保留当前问题，截断历史
      const questionPart = `当前问题: ${truncatedMessage}`
      const availableLength = MAX_TOTAL_PROMPT_LENGTH - questionPart.length - 100 // 预留空间
      const truncatedHistory = historyText.substring(0, Math.max(0, availableLength))
      prompt = `你是一位专业的考研英语AI助手，请回答用户的问题。\n\n${truncatedHistory}\n${questionPart}`
    }

    return prompt
  }

  /**
   * 获取推荐课程（接口实现）
   * @param {Object} params - 查询参数
   * @param {string} params.category - 课程类别
   * @param {number} params.limit - 限制数量
   * @returns {Promise<Array>} 推荐课程列表
   */
  async getRecommendedCourses(params = {}) {
    // 模拟课程推荐逻辑
    const mockCourses = [
      {
        id: 'vocabulary_master',
        title: '词汇大师训练营',
        description: '系统学习考研词汇，提高记忆效率',
        category: 'vocabulary',
        difficulty: 'intermediate',
        estimatedTime: '30天',
        rating: 4.8
      },
      {
        id: 'reading_comprehension',
        title: '阅读理解进阶',
        description: '掌握阅读技巧，提高理解速度',
        category: 'reading',
        difficulty: 'advanced',
        estimatedTime: '25天',
        rating: 4.6
      },
      {
        id: 'writing_master',
        title: '写作能力提升',
        description: '学习写作技巧，掌握表达方法',
        category: 'writing',
        difficulty: 'advanced',
        estimatedTime: '20天',
        rating: 4.7
      }
    ]

    // 根据参数过滤课程
    let filteredCourses = mockCourses
    if (params.category) {
      filteredCourses = mockCourses.filter(course => course.category === params.category)
    }

    // 限制数量
    const limit = params.limit || 10
    filteredCourses = filteredCourses.slice(0, limit)

    return filteredCourses
  }

  /**
   * 获取课程详情（接口实现）
   * @param {string} courseId - 课程ID
   * @returns {Promise<Object>} 课程详情
   */
  async getCourseDetail(courseId) {
    const courseDetails = {
      vocabulary_master: {
        id: 'vocabulary_master',
        title: '词汇大师训练营',
        description: '系统学习考研词汇，提高记忆效率',
        category: 'vocabulary',
        difficulty: 'intermediate',
        estimatedTime: '30天',
        totalLessons: 30,
        completedLessons: 0,
        rating: 4.8,
        instructor: 'AI词汇专家',
        features: [
          '每日单词学习计划',
          '智能记忆复习',
          '词根词缀剖析',
          '真题词汇练习'
        ],
        syllabus: [
          { week: 1, title: '基础词汇积累', lessons: 7 },
          { week: 2, title: '词根词缀学习', lessons: 7 },
          { week: 3, title: '同义词辨析', lessons: 7 },
          { week: 4, title: '专项练习强化', lessons: 9 }
        ]
      },
      reading_comprehension: {
        id: 'reading_comprehension',
        title: '阅读理解进阶',
        description: '掌握阅读技巧，提高理解速度',
        category: 'reading',
        difficulty: 'advanced',
        estimatedTime: '25天',
        totalLessons: 25,
        completedLessons: 0,
        rating: 4.6,
        instructor: 'AI阅读专家',
        features: [
          '阅读技巧系统讲解',
          '真题精析与练习',
          '时间管理策略',
          '解题思维训练'
        ],
        syllabus: [
          { week: 1, title: '阅读基础技巧', lessons: 6 },
          { week: 2, title: '题型专项突破', lessons: 6 },
          { week: 3, title: '真题实战演练', lessons: 7 },
          { week: 4, title: '冲刺提分阶段', lessons: 6 }
        ]
      },
      writing_master: {
        id: 'writing_master',
        title: '写作能力提升',
        description: '学习写作技巧，掌握表达方法',
        category: 'writing',
        difficulty: 'advanced',
        estimatedTime: '20天',
        totalLessons: 20,
        completedLessons: 0,
        rating: 4.7,
        instructor: 'AI写作专家',
        features: [
          '作文结构解析',
          '范文精讲点评',
          '写作技巧训练',
          '批改纠错指导'
        ],
        syllabus: [
          { week: 1, title: '作文基础框架', lessons: 5 },
          { week: 2, title: '范文学习赏析', lessons: 5 },
          { week: 3, title: '写作技巧提升', lessons: 5 },
          { week: 4, title: '实战写作练习', lessons: 5 }
        ]
      }
    }

    const course = courseDetails[courseId]
    if (!course) {
      throw new Error(`Course not found: ${courseId}`)
    }

    return course
  }

  /**
   * 获取题目提示（用于练习页面）
   * @param {string} questionId - 题目ID
   * @param {Object} context - 上下文信息（包含题目内容、用户答案、题型等）
   * @returns {Promise<Object>} AI生成的提示内容
   */
  async getHint(questionId, context = {}) {
    try {
      const { question, questionType, userAnswer, passage } = context

      // 构建题目提示词
      let prompt = `你是一位专业的考研英语辅导老师。请为以下题目提供学习提示，帮助学生理解题目要点和解题思路。

题目ID: ${questionId}
题型: ${questionType || '未知'}`

      if (passage) {
        prompt += `\n\n文章内容:\n${passage.substring(0, 500)}`
      }

      if (question) {
        prompt += `\n\n题目:\n${question}`
      }

      if (userAnswer) {
        prompt += `\n\n学生当前答案:\n${userAnswer}`
        prompt += `\n\n请根据学生的答案，提供有针对性的提示，不要直接给出答案。`
      } else {
        prompt += `\n\n请提供解题思路和关键提示，帮助学生理解题目要求。`
      }

      prompt += `\n\n提示要求：
1. 语言简洁明了，控制在100字以内
2. 不要直接给出答案
3. 提供解题思路和关键点
4. 鼓励学生思考`

      const response = await this._callAIService(prompt, {
        temperature: 0.3,
        max_tokens: 200,
        context: { context: 'practice_hint', questionId, questionType }
      })

      // 验证API响应格式
      this._validateAPIResponse(response)

      return {
        hint: response.content || '请仔细阅读题目，注意关键信息。',
        questionId,
        timestamp: Date.now()
      }

    } catch (error) {
      console.error('[QwenAIAdapter] getHint failed:', error)
      return {
        hint: '提示功能暂时不可用，请稍后重试。',
        questionId,
        timestamp: Date.now(),
        error: error.message
      }
    }
  }

  /**
   * 批改作文（用于写作练习）
   * @param {string} essayContent - 作文内容
   * @param {string} questionId - 题目ID
   * @param {Object} context - 上下文信息（包含题目要求、评分标准等）
   * @returns {Promise<Object>} 批改结果，包含评分、反馈、建议等
   */
  async gradeEssay(essayContent, questionId, context = {}) {
    try {
      const { question, requirements, scoringCriteria } = context

      // 构建批改提示词
      let prompt = `你是一位专业的考研英语作文批改老师。请对以下作文进行评分和批改。

题目ID: ${questionId}`

      if (question) {
        prompt += `\n\n题目要求:\n${question}`
      }

      if (requirements) {
        prompt += `\n\n具体要求:\n${requirements}`
      }

      if (scoringCriteria) {
        prompt += `\n\n评分标准:\n${scoringCriteria}`
      } else {
        prompt += `\n\n评分标准（总分30分）:
- 内容完整性（10分）：是否完整回答了题目要求
- 结构逻辑（10分）：文章结构是否清晰，逻辑是否连贯
- 语言表达（10分）：词汇使用、语法准确性、句式多样性`

      prompt += `\n\n学生作文:\n${essayContent}`

      prompt += `\n\n请按照以下格式提供批改结果（JSON格式）:
{
  "scores": {
    "content": 0-10,
    "structure": 0-10,
    "language": 0-10,
    "total": 0-30
  },
  "feedback": {
    "strengths": ["优点1", "优点2"],
    "improvements": ["改进点1", "改进点2"]
  },
  "suggestions": ["具体建议1", "具体建议2"],
  "detailedComments": "详细评语（100-200字）"
}`

      const response = await this._callAIService(prompt, {
        temperature: 0.2,
        max_tokens: 800,
        context: { context: 'essay_grading', questionId }
      })

      // 验证API响应格式
      this._validateAPIResponse(response)

      // 尝试解析JSON格式的响应
      let gradingResult
      try {
        // 尝试提取JSON部分
        const jsonMatch = response.content.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          gradingResult = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('No JSON found in response')
        }
      } catch (parseError) {
        // 如果解析失败，使用降级方案
        console.warn('[QwenAIAdapter] Failed to parse JSON response, using fallback')
        gradingResult = this._buildFallbackGradingResult(essayContent)
      }

      return {
        ...gradingResult,
        questionId,
        timestamp: Date.now()
      }

    } catch (error) {
      console.error('[QwenAIAdapter] gradeEssay failed:', error)
      return this._buildFallbackGradingResult(essayContent, questionId, error.message)
    }
  }

  /**
   * 构建降级批改结果（当AI服务不可用时）
   * @param {string} essayContent - 作文内容
   * @param {string} questionId - 题目ID
   * @param {string} errorMessage - 错误信息
   * @returns {Object} 降级批改结果
   * @private
   */
  _buildFallbackGradingResult(essayContent, questionId = null, errorMessage = null) {
    const charCount = essayContent.length

    // 基于字数的简单评分（降级方案）
    const contentScore = Math.min(10, Math.floor(charCount / 20) + 6)
    const languageScore = Math.min(10, Math.floor(charCount / 25) + 5)
    const structureScore = Math.min(10, Math.floor(charCount / 22) + 6)
    const totalScore = contentScore + languageScore + structureScore

    return {
      scores: {
        content: contentScore,
        structure: structureScore,
        language: languageScore,
        total: totalScore
      },
      feedback: {
        strengths: ['字数符合要求'],
        improvements: ['AI批改服务暂时不可用，请稍后重试']
      },
      suggestions: [
        '检查文章结构是否完整',
        '注意语法和拼写错误',
        '确保回答了题目要求'
      ],
      detailedComments: errorMessage 
        ? `批改服务暂时不可用：${errorMessage}。已提供基础评分，请稍后重试获取详细批改。`
        : '批改服务暂时不可用，已提供基础评分。请稍后重试获取详细批改。',
      questionId,
      timestamp: Date.now(),
      isFallback: true
    }
  }
}

module.exports = QwenAIAdapter
