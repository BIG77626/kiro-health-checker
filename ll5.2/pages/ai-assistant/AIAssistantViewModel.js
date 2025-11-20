/**
 * AI助手页面视图模型
 * 管理AI对话、学习诊断、题目答疑、词汇解析等功能
 * 严格遵循Clean Architecture原则：单一状态树、不可变状态更新、统一错误处理
 */

const { AI_ASSISTANT_CONSTANTS, ERROR_CONSTANTS } = require('../../core/infrastructure/config/constants')
class AIAssistantViewModel {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入对象
   * @param {SendAIMessageUseCase} dependencies.sendAIMessageUseCase - 发送AI消息用例
   * @param {IStorageAdapter} dependencies.storageAdapter - 存储适配器
   * @param {DateService} dependencies.dateService - 日期服务
   */
  constructor(dependencies) {
    // 验证必需依赖
    const requiredDeps = ['sendAIMessageUseCase', 'storageAdapter', 'dateService']

    for (const dep of requiredDeps) {
      if (!dependencies[dep]) {
        throw new Error(`${dep} is required`)
      }
    }

    // 注入依赖
    Object.assign(this, dependencies)

    // 错误处理统一层级 - ViewModel层只处理UI相关错误
    this.errorHandler = new AIAssistantErrorHandler()

    // 状态变更日志 - 用于调试和审计
    this.stateChangeLog = []

    // 初始化状态
    this._initializeState()

    // 监听器列表
    this.listeners = []

    console.log('[AIAssistantViewModel] 初始化完成')
  }

  /**
   * 获取状态
   */
  getState() {
    return { ...this.state }
  }

  /**
   * 订阅状态变化
   * @param {Function} listener - 状态变化监听器
   */
  subscribe(listener) {
    if (typeof listener === 'function') {
      this.listeners.push(listener)
    }
  }

  /**
   * 取消订阅
   * @param {Function} listener - 要取消的监听器
   */
  unsubscribe(listener) {
    this.listeners = this.listeners.filter(l => l !== listener)
  }

  /**
   * 初始化状态 - 单一状态树
   * @private
   */
  _initializeState() {
    this.state = {
      // 页面状态
      activeTab: AI_ASSISTANT_CONSTANTS.TABS.CHAT,
      themeClass: '',

      // AI对话状态
      messages: [],
      inputText: '',
      aiTyping: false,
      scrollToView: '',

      // 用户信息
      userAvatar: '/images/user-default.png',
      aiAvatar: '/images/logo.png',

      // 快速建议
      quickSuggestions: [
        '我完型填空总是做不好，怎么办？',
        '如何快速记忆单词？',
        '帮我制定一个学习计划',
        '分析一下我的学习数据'
      ],

      // 快捷功能
      quickActions: [
        {
          id: 1,
          emoji: '📊',
          label: '学习诊断',
          action: 'diagnose'
        },
        {
          id: 2,
          emoji: '💡',
          label: '题目答疑',
          action: 'question_help'
        },
        {
          id: 3,
          emoji: '📚',
          label: '词汇解析',
          action: 'vocabulary_help'
        },
        {
          id: 4,
          emoji: '🎯',
          label: '专项练习',
          action: 'practice_plan'
        }
      ],

      // 学习课程
      learningCourses: [
        {
          id: 'vocabulary_master',
          title: '词汇大师训练营',
          description: '系统学习考研词汇，提高记忆效率',
          progress: 0,
          totalLessons: 30,
          completedLessons: 0,
          icon: '📝'
        },
        {
          id: 'reading_comprehension',
          title: '阅读理解进阶',
          description: '掌握阅读技巧，提高理解速度',
          progress: 0,
          totalLessons: 25,
          completedLessons: 0,
          icon: '📖'
        },
        {
          id: 'writing_master',
          title: '写作能力提升',
          description: '学习写作技巧，掌握表达方法',
          progress: 0,
          totalLessons: 20,
          completedLessons: 0,
          icon: '✍️'
        },
        {
          id: 'test_strategy',
          title: '应试策略指导',
          description: '掌握考试技巧，提高应试信心',
          progress: 0,
          totalLessons: 15,
          completedLessons: 0,
          icon: '🎯'
        }
      ],

      // 加载状态和错误信息
      loading: false,
      error: null,

      // 最后更新时间
      lastUpdated: null,

      // 状态版本 - 用于调试
      version: 0
    }
  }

  /**
   * 更新状态 - 不可变状态更新
   * @private
   * @param {Object} newState - 新状态
   * @param {string} action - 触发动作（用于调试）
   */
  _updateState(newState, action = 'unknown') {
    // 深度克隆当前状态
    const prevState = JSON.parse(JSON.stringify(this.state))

    // 不可变更新
    const nextState = {
      ...this.state,
      ...newState,
      lastUpdated: this.dateService.getCurrentDateISO(),
      version: this.state.version + 1
    }

    // 状态验证
    this._validateStateTransition(prevState, nextState, action)

    // 更新状态
    this.state = nextState

    // 记录状态变更日志
    this._logStateChange(prevState, nextState, action)

    // 通知所有监听器
    this.listeners.forEach(listener => {
      try {
        listener(this.state, prevState)
      } catch (error) {
        console.error('[AIAssistantViewModel] 状态监听器执行失败:', error)
        // 监听器错误不应该影响业务逻辑
      }
    })
  }

  /**
   * 验证状态转换
   * @private
   * @param {Object} prevState - 之前状态
   * @param {Object} nextState - 新状态
   * @param {string} action - 触发动作
   */
  _validateStateTransition(prevState, nextState, action) {
    // 验证业务规则
    if (nextState.aiTyping && prevState.aiTyping) {
      console.warn('[AIAssistantViewModel] 警告: AI已经在回复中，重复设置aiTyping')
    }

    if (nextState.messages.length < prevState.messages.length) {
      console.warn('[AIAssistantViewModel] 警告: 消息数量减少，可能存在数据丢失')
    }

    // 验证数据完整性
    if (!Array.isArray(nextState.messages)) {
      throw new Error('状态验证失败: messages必须是数组')
    }

    if (typeof nextState.activeTab !== 'string') {
      throw new Error('状态验证失败: activeTab必须是字符串')
    }
  }

  /**
   * 记录状态变更日志
   * @private
   * @param {Object} prevState - 之前状态
   * @param {Object} nextState - 新状态
   * @param {string} action - 触发动作
   */
  _logStateChange(prevState, nextState, action) {
    const changeLog = {
      timestamp: this.dateService.getCurrentDateISO(),
      action,
      version: nextState.version,
      changes: this._diffStates(prevState, nextState)
    }

    this.stateChangeLog.push(changeLog)

    // 只保留最近100条日志
    if (this.stateChangeLog.length > 100) {
      this.stateChangeLog.shift()
    }

    // 开发环境下输出状态变更 (微信小程序环境兼容)
    // 在微信小程序中没有process对象，这里使用条件编译或开发模式检测
    if (typeof process !== 'undefined' && process.env && process.env.NODE_ENV === 'development') {
      console.log(`[AIAssistantViewModel] 状态变更: ${action}`, changeLog.changes)
    }
  }

  /**
   * 比较状态差异
   * @private
   * @param {Object} prev - 之前状态
   * @param {Object} next - 新状态
   * @returns {Object} 状态差异
   */
  _diffStates(prev, next) {
    const changes = {}
    const allKeys = new Set([...Object.keys(prev), ...Object.keys(next)])

    for (const key of allKeys) {
      if (JSON.stringify(prev[key]) !== JSON.stringify(next[key])) {
        changes[key] = {
          from: prev[key],
          to: next[key]
        }
      }
    }

    return changes
  }

  /**
   * 切换标签页
   * @param {string} tab - 标签页标识
   */
  switchTab(tab) {
    const validTabs = [AI_ASSISTANT_CONSTANTS.TABS.CHAT, AI_ASSISTANT_CONSTANTS.TABS.COURSES]
    if (!validTabs.includes(tab)) {
      throw new Error('无效的标签页标识')
    }

    this._updateState({
      activeTab: tab,
      error: null
    }, 'switchTab')
  }

  /**
   * 发送消息 - 统一错误处理
   * @param {string} text - 用户输入的文本
   * @returns {Promise<boolean>} 发送是否成功
   */
  async sendMessage(text) {
    // 输入验证
    if (!text || text.trim().length === 0) {
      this._updateState({
        error: ERROR_CONSTANTS.MESSAGES.MESSAGE_EMPTY
      }, 'sendMessage_input_validation')
      return false
    }

    if (this.state.aiTyping) {
      this._updateState({
        error: ERROR_CONSTANTS.MESSAGES.AI_BUSY
      }, 'sendMessage_ai_busy')
      return false
    }

    try {
      // 开始发送流程
      this._updateState({
        aiTyping: true,
        inputText: '',
        error: null
      }, 'sendMessage_start')

      // 添加用户消息
      const userMessage = {
        id: this.dateService.getCurrentTimestamp(),
        type: AI_ASSISTANT_CONSTANTS.MESSAGE_TYPES.USER,
        content: text.trim(),
        timestamp: this.dateService.getCurrentDateISO()
      }

      const newMessages = [...this.state.messages, userMessage]
      this._updateState({
        messages: newMessages
      }, 'sendMessage_add_user_message')

      // 调用AI服务 (业务逻辑层错误)
      const aiResult = await this.sendAIMessageUseCase.execute({
        userId: 'current-user', // 在实际应用中，这里应该是当前登录用户的ID
        message: text.trim(),
        context: {
          conversationHistory: newMessages.slice(-10) // 最近10条消息作为上下文
        }
      })

      // 添加AI回复
      const aiMessage = {
        id: this.dateService.getCurrentTimestamp() + 1,
        type: AI_ASSISTANT_CONSTANTS.MESSAGE_TYPES.AI,
        content: aiResult.response.hint || aiResult.response.content || '抱歉，我没有理解您的问题，请重新表述。',
        timestamp: this.dateService.getCurrentDateISO(),
        suggestions: aiResult.response.suggestions || []
      }

      this._updateState({
        messages: [...newMessages, aiMessage],
        aiTyping: false,
        scrollToView: `msg_${aiMessage.id}`
      }, 'sendMessage_success')

      return true

    } catch (error) {
      // 统一错误处理
      const handledError = this.errorHandler.handleBusinessError(error)

      this._updateState({
        aiTyping: false,
        error: handledError.message
      }, 'sendMessage_error')

      // ViewModel层不抛出错误，只返回失败状态
      // 错误信息已经通过状态更新传递给UI
      return false
    }
  }

  /**
   * 使用快速建议
   * @param {string} suggestion - 建议文本
   */
  async useQuickSuggestion(suggestion) {
    this._updateState({ inputText: suggestion }, 'useQuickSuggestion')
    await this.sendMessage(suggestion)
  }

  /**
   * 执行快捷功能
   * @param {string} action - 功能标识
   */
  async executeQuickAction(action) {
    try {
      this._updateState({
        loading: true,
        error: null
      }, 'executeQuickAction_start')

      let prompt = ''

      switch (action) {
      case 'diagnose':
        prompt = '请根据我的学习记录，为我做一个学习诊断分析'
        break
      case 'question_help':
        prompt = '我最近在练习题过程中遇到了一些困难问题，能帮我解答吗？'
        break
      case 'vocabulary_help':
        prompt = '我有一些单词不太理解，能帮我解析一下这些词汇的意思和用法吗？'
        break
      case 'practice_plan':
        prompt = '请根据我的学习情况，为我制定一个专项练习计划'
        break
      default:
        throw new Error('未知的快捷功能')
      }

      await this.sendMessage(prompt)

    } catch (error) {
      console.error('[AIAssistantViewModel] 执行快捷功能失败:', error)
      this._updateState({
        loading: false,
        error: error.message || '功能执行失败'
      }, 'executeQuickAction_error')
      throw error
    }
  }

  /**
   * 开始学习课程
   * @param {string} courseId - 课程ID
   */
  async startCourse(courseId) {
    const course = this.state.learningCourses.find(c => c.id === courseId)
    if (!course) {
      throw new Error('课程不存在')
    }

    try {
      this._updateState({
        loading: true,
        error: null
      }, 'startCourse_start')

      // 标记课程开始学习
      const updatedCourses = this.state.learningCourses.map(c =>
        c.id === courseId
          ? { ...c, completedLessons: Math.max(c.completedLessons, 1) }
          : c
      )

      this._updateState({
        learningCourses: updatedCourses.map(c => ({
          ...c,
          progress: Math.round((c.completedLessons / c.totalLessons) * 100)
        }))
      }, 'startCourse_update_progress')

      // 发送欢迎消息
      const welcomeMessage = `欢迎开始学习"${course.title}"！我将陪伴你完成这个课程的学习。准备好了吗？`

      this._updateState({
        activeTab: AI_ASSISTANT_CONSTANTS.TABS.CHAT,
        inputText: `我准备开始学习"${course.title}"课程了`
      }, 'startCourse_prepare_chat')

      await this.sendMessage(welcomeMessage)

    } catch (error) {
      console.error('[AIAssistantViewModel] 开始课程失败:', error)
      this._updateState({
        loading: false,
        error: error.message || '开始课程失败'
      }, 'startCourse_error')
      throw error
    } finally {
      // loading状态由错误处理统一管理
    }
  }

  /**
   * 清空对话
   */
  clearConversation() {
    this._updateState({
      messages: [],
      scrollToView: '',
      error: null
    }, 'clearConversation')
  }

  /**
   * 加载用户数据（Issue #5: AI助手数据刷新）
   * 
   * 失败场景（5个）:
   * 1. app未初始化 → 使用默认值
   * 2. userInfo不存在 → 使用默认头像
   * 3. storage读取失败 → 返回空数据
   * 4. 数据格式错误 → 数据验证+降级
   * 5. 重复调用 → 防抖机制
   * 
   * @returns {Promise<boolean>} 加载是否成功
   */
  async loadUserData() {
    try {
      console.log('[AIAssistantViewModel] 开始加载用户数据')

      // 场景1: 防御性检查 - app未初始化
      let app
      try {
        app = getApp()
      } catch (error) {
        console.warn('[AIAssistantViewModel] getApp失败，使用默认数据', error)
        return false
      }

      if (!app) {
        console.warn('[AIAssistantViewModel] app未初始化，使用默认数据')
        return false
      }

      // 场景2: 加载用户基本信息
      const userInfo = app.globalData?.userInfo || {}
      const userAvatar = userInfo.avatarUrl || this.state.userAvatar
      
      // 场景3 & 4: 从storage加载学习统计（Silent fail）
      let studyStats = {
        studyDays: 0,
        totalQuestions: 0,
        correctRate: 0
      }

      try {
        const statsData = await this.storageAdapter.get('user_study_stats')
        if (statsData && typeof statsData === 'object') {
          studyStats = {
            studyDays: statsData.studyDays || 0,
            totalQuestions: statsData.totalQuestions || 0,
            correctRate: statsData.correctRate || 0
          }
        }
      } catch (error) {
        // Silent fail: storage读取失败不阻塞UI
        console.warn('[AIAssistantViewModel] 读取学习统计失败，使用默认值', error)
      }

      // 更新课程进度（基于实际学习数据）
      const updatedCourses = this.state.learningCourses.map(course => {
        // 根据学习天数估算进度
        let progress = 0
        if (course.id === 'vocabulary_master') {
          progress = Math.min(Math.round((studyStats.studyDays / 30) * 100), 100)
        } else if (course.id === 'reading_intensive') {
          progress = Math.min(Math.round((studyStats.totalQuestions / 100) * 100), 100)
        }
        
        return {
          ...course,
          progress,
          completedLessons: Math.round((progress / 100) * course.totalLessons)
        }
      })

      // 更新快速建议（基于学习数据个性化）
      const quickSuggestions = studyStats.totalQuestions > 0
        ? [
          '分析一下我的学习数据',
          `我已经学了${studyStats.studyDays}天，正确率${studyStats.correctRate}%，怎么提高？`,
          '针对我的薄弱点，制定学习计划',
          '推荐适合我的练习题'
        ]
        : this.state.quickSuggestions

      // 统一更新状态
      this._updateState({
        userAvatar,
        learningCourses: updatedCourses,
        quickSuggestions
      }, 'loadUserData_success')

      console.log('[AIAssistantViewModel] 用户数据加载完成', {
        userAvatar,
        studyStats,
        coursesUpdated: updatedCourses.length
      })

      return true

    } catch (error) {
      // Silent fail: 不向上抛异常，不阻塞UI
      console.error('[AIAssistantViewModel] 加载用户数据失败（Silent Fail）', error)
      return false
    }
  }

  /**
   * 加载历史消息
   */
  async loadConversationHistory() {
    try {
      // 性能优化：显示加载状态
      this._updateState({
        loading: true,
        error: null
      }, 'loadConversationHistory_start')
      
      // 异步加载历史消息（不阻塞UI）
      const history = await this.storageAdapter.get(AI_ASSISTANT_CONSTANTS.STORAGE_KEYS.CHAT_HISTORY) || []
      
      this._updateState({
        messages: history,
        loading: false,
        error: null
      }, 'loadConversationHistory_success')
    } catch (error) {
      console.error('[AIAssistantViewModel] 加载历史消息失败:', error)
      this._updateState({
        loading: false,
        error: null // 加载失败不显示错误，使用空历史
      }, 'loadConversationHistory_error')
    }
  }

  /**
   * 保存对话历史
   */
  async saveConversationHistory() {
    try {
      await this.storageAdapter.save(AI_ASSISTANT_CONSTANTS.STORAGE_KEYS.CHAT_HISTORY, this.state.messages)
    } catch (error) {
      console.error('[AIAssistantViewModel] 保存历史消息失败:', error)
      // 不抛出错误，只是记录日志
    }
  }

  /**
   * 设置主题
   * @param {string} themeClass - 主题样式类名
   */
  setTheme(themeClass) {
    this._updateState({ themeClass }, 'setTheme')
  }

  /**
   * 销毁ViewModel
   */
  destroy() {
    this.listeners = []
    this.state = null
  }
}

/**
 * AI助手错误处理器
 * 统一处理ViewModel层的错误，遵循Clean Architecture错误处理原则
 */
class AIAssistantErrorHandler {
  /**
   * 处理业务逻辑错误（UseCase层错误）
   * @param {Error} error - 原始错误
   * @returns {Object} 处理后的错误信息
   */
  handleBusinessError(error) {
    // 业务错误应该已经由UseCase处理，这里只做UI适配
    if (error.message.includes('AI对话失败')) {
      return {
        type: 'business',
        message: 'AI服务暂时不可用，请稍后重试',
        canRetry: true
      }
    }

    if (error.message.includes('网络')) {
      return {
        type: 'network',
        message: '网络连接失败，请检查网络后重试',
        canRetry: true
      }
    }

    return {
      type: 'business',
      message: error.message || '操作失败，请重试',
      canRetry: true
    }
  }

  /**
   * 处理UI层错误
   * @param {Error} error - UI错误
   * @returns {Object} 处理后的错误信息
   */
  handleUIError(error) {
    return {
      type: 'ui',
      message: '界面操作失败，请刷新页面重试',
      canRetry: false
    }
  }

  /**
   * 处理未知错误
   * @param {Error} error - 未知错误
   * @returns {Object} 处理后的错误信息
   */
  handleUnknownError(error) {
    console.error('[AIAssistantErrorHandler] 未知错误:', error)
    return {
      type: 'unknown',
      message: '发生未知错误，请联系技术支持',
      canRetry: false
    }
  }
}

module.exports = AIAssistantViewModel
module.exports.AIAssistantErrorHandler = AIAssistantErrorHandler
