/**
 * Practice页面视图模型
 * 统一管理练习会话状态、题目加载、答案提交和4个题型组件的状态协调
 */
class PracticeViewModel {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入对象
   * @param {StartPracticeSessionUseCase} dependencies.startPracticeSessionUseCase
   * @param {SubmitAnswerUseCase} dependencies.submitAnswerUseCase
   * @param {FinishPracticeSessionUseCase} dependencies.finishPracticeSessionUseCase
   * @param {GetSessionStatisticsUseCase} dependencies.getSessionStatisticsUseCase
   * @param {ResumePracticeSessionUseCase} dependencies.resumePracticeSessionUseCase
   * @param {GetNextQuestionUseCase} dependencies.getNextQuestionUseCase
   * @param {GetPaperByIdUseCase} dependencies.getPaperByIdUseCase
   * @param {SubmitAnswersUseCase} dependencies.submitAnswersUseCase
   * @param {RecordAnswerUseCase} dependencies.recordAnswerUseCase
   * @param {GetPracticeStatisticsUseCase} dependencies.getPracticeStatisticsUseCase
   * @param {DateService} dependencies.dateService
   * @param {IStorageAdapter} dependencies.storageAdapter
   * @param {IAIService} dependencies.aiService - AI服务（可选，用于AI提示和批改）
   */
  constructor(dependencies) {
    // 验证必需依赖
    const requiredDeps = [
      'startPracticeSessionUseCase',
      'submitAnswerUseCase',
      'finishPracticeSessionUseCase',
      'getSessionStatisticsUseCase',
      'resumePracticeSessionUseCase',
      'getNextQuestionUseCase',
      'getPaperByIdUseCase',
      'submitAnswersUseCase',
      'recordAnswerUseCase',
      'getPracticeStatisticsUseCase',
      'dateService',
      'storageAdapter'
    ]

    for (const dep of requiredDeps) {
      if (!dependencies[dep]) {
        throw new Error(`${dep} is required`)
      }
    }

    // 注入依赖
    Object.assign(this, dependencies)

    // 初始化状态
    this.state = {
      // 会话状态
      session: null,
      sessionId: null,

      // 试卷和题目
      paper: null,
      questions: [],
      passages: [],
      currentQuestionIndex: 0,
      currentQuestion: null,

      // 用户答案
      userAnswers: {},

      // UI状态
      isLoading: true,
      showResult: false,
      showExplanation: false,
      practiceMode: 'practice', // practice 或 exam

      // 计时器
      startTime: 0,
      timeSpent: 0,
      formattedTime: '0:00',
      timer: null,

      // 答题统计
      stats: {
        total: 0,
        answered: 0,
        correct: 0,
        accuracy: 0
      },

      // 错误信息
      error: null,

      // 最后更新时间
      lastUpdated: null
    }

    // 状态变更监听器
    this.listeners = []
  }

  /**
   * 获取当前状态
   * @returns {Object} 视图状态的副本
   */
  getState() {
    return { ...this.state }
  }

  /**
   * 更新状态并通知监听器
   * @param {Object} updates - 状态更新对象
   * @private
   */
  _updateState(updates) {
    this.state = {
      ...this.state,
      ...updates,
      lastUpdated: this.dateService.getCurrentDateISO()
    }

    // 通知所有监听器
    this.listeners.forEach(listener => {
      try {
        listener(this.getState())
      } catch (error) {
        console.error('PracticeViewModel: 状态监听器执行失败:', error)
      }
    })
  }

  /**
   * 订阅状态变化
   * @param {Function} listener - 状态变化监听器
   * @returns {Function} 取消订阅函数
   */
  subscribe(listener) {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * 开始练习会话
   * @param {string} paperId - 试卷ID
   * @param {Object} config - 会话配置
   * @returns {Promise<Object>} 开始结果
   */
  async startSession(paperId, config = {}) {
    try {
      this._updateState({ isLoading: true, error: null })

      // 性能优化：并发加载关键数据，减少等待时间
      // 1. 并发获取试卷信息和开始会话（这两个操作可以并行）
      const [paperResult, sessionResult] = await Promise.all([
        this.getPaperByIdUseCase.execute(paperId),
        this.startPracticeSessionUseCase.execute({
          paperId,
          mode: config.mode || 'practice',
          timeLimit: config.timeLimit,
          questionTypes: config.questionTypes
        })
      ])

      // 检查结果
      if (!paperResult.success) {
        throw new Error(paperResult.error || '获取试卷失败')
      }
      if (!sessionResult.success) {
        throw new Error(sessionResult.error || '开始练习会话失败')
      }

      // 2. 先更新关键状态（让用户看到部分内容）
      this._updateState({
        session: sessionResult.session,
        sessionId: sessionResult.session.id,
        paper: paperResult.paper,
        questions: paperResult.questions || [],
        passages: paperResult.passages || [],
        startTime: Date.now(),
        stats: {
          total: paperResult.questions?.length || 0,
          answered: 0,
          correct: 0,
          accuracy: 0
        }
      })

      // 3. 异步获取第一题（不阻塞UI渲染）
      const questionResult = await this.getNextQuestionUseCase.execute(sessionResult.session.id)
      if (!questionResult.success) {
        throw new Error(questionResult.error || '获取题目失败')
      }

      // 4. 更新题目状态并隐藏加载状态
      this._updateState({
        currentQuestion: questionResult.question,
        isLoading: false
      })

      // 5. 启动计时器
      this._startTimer()

      return {
        success: true,
        sessionId: sessionResult.session.id
      }

    } catch (error) {
      console.error('PracticeViewModel: 开始会话失败:', error)
      this._updateState({
        error: error.message,
        isLoading: false
      })
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 提交答案
   * @param {any} answer - 用户答案
   * @returns {Promise<Object>} 提交结果
   */
  async submitAnswer(answer) {
    try {
      if (!this.state.sessionId || !this.state.currentQuestion) {
        throw new Error('没有活跃的练习会话或当前题目')
      }

      // 1. 记录答案
      const recordResult = await this.recordAnswerUseCase.execute({
        sessionId: this.state.sessionId,
        questionId: this.state.currentQuestion.id,
        answer,
        timeSpent: this._getCurrentTimeSpent()
      })

      if (!recordResult.success) {
        throw new Error(recordResult.error || '记录答案失败')
      }

      // 2. 提交答案进行评分
      const submitResult = await this.submitAnswerUseCase.execute({
        sessionId: this.state.sessionId,
        questionId: this.state.currentQuestion.id,
        answer
      })

      if (!submitResult.success) {
        throw new Error(submitResult.error || '提交答案失败')
      }

      // 3. 更新本地状态
      const newUserAnswers = {
        ...this.state.userAnswers,
        [this.state.currentQuestion.id]: answer
      }

      // 4. 获取下一题
      const nextResult = await this.getNextQuestionUseCase.execute(this.state.sessionId)

      if (nextResult.success && nextResult.question) {
        // 还有下一题
        this._updateState({
          userAnswers: newUserAnswers,
          currentQuestion: nextResult.question,
          currentQuestionIndex: this.state.currentQuestionIndex + 1,
          stats: this._calculateStats(newUserAnswers)
        })

        return {
          success: true,
          hasNext: true,
          result: submitResult.result
        }
      } else {
        // 没有下一题，会话结束
        await this.finishSession()
        return {
          success: true,
          hasNext: false,
          result: submitResult.result
        }
      }

    } catch (error) {
      console.error('PracticeViewModel: 提交答案失败:', error)
      this._updateState({
        error: error.message
      })
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 完成练习会话
   * @returns {Promise<Object>} 完成结果
   */
  async finishSession() {
    try {
      if (!this.state.sessionId) {
        throw new Error('没有活跃的练习会话')
      }

      // 1. 完成会话
      const finishResult = await this.finishPracticeSessionUseCase.execute(this.state.sessionId)
      if (!finishResult.success) {
        throw new Error(finishResult.error || '完成会话失败')
      }

      // 2. 获取最终统计
      const statsResult = await this.getSessionStatisticsUseCase.execute(this.state.sessionId)
      if (!statsResult.success) {
        throw new Error(statsResult.error || '获取统计失败')
      }

      // 3. 停止计时器
      this._stopTimer()

      // 4. 更新状态
      this._updateState({
        showResult: true,
        stats: statsResult.statistics,
        session: null,
        sessionId: null
      })

      return {
        success: true,
        statistics: statsResult.statistics,
        session: finishResult.session
      }

    } catch (error) {
      console.error('PracticeViewModel: 完成会话失败:', error)
      this._updateState({
        error: error.message
      })
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 切换到下一题
   * @returns {Promise<Object>} 切换结果
   */
  async nextQuestion() {
    try {
      if (!this.state.sessionId) {
        throw new Error('没有活跃的练习会话')
      }

      const result = await this.getNextQuestionUseCase.execute(this.state.sessionId)

      if (result.success && result.question) {
        this._updateState({
          currentQuestion: result.question,
          currentQuestionIndex: this.state.currentQuestionIndex + 1
        })

        return {
          success: true,
          question: result.question
        }
      } else {
        // 没有更多题目
        await this.finishSession()
        return {
          success: true,
          finished: true
        }
      }

    } catch (error) {
      console.error('PracticeViewModel: 切换题目失败:', error)
      this._updateState({
        error: error.message
      })
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 切换到上一题
   * @returns {Promise<Object>} 切换结果
   */
  async previousQuestion() {
    try {
      const newIndex = Math.max(0, this.state.currentQuestionIndex - 1)

      if (newIndex !== this.state.currentQuestionIndex && this.state.questions[newIndex]) {
        this._updateState({
          currentQuestionIndex: newIndex,
          currentQuestion: this.state.questions[newIndex]
        })

        return {
          success: true,
          question: this.state.questions[newIndex]
        }
      }

      return {
        success: false,
        error: '已经是第一题'
      }

    } catch (error) {
      console.error('PracticeViewModel: 切换到上一题失败:', error)
      this._updateState({
        error: error.message
      })
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 获取会话统计信息
   * @returns {Promise<Object>} 统计结果
   */
  async getStatistics() {
    try {
      if (!this.state.sessionId) {
        throw new Error('没有活跃的练习会话')
      }

      const result = await this.getSessionStatisticsUseCase.execute(this.state.sessionId)

      if (result.success) {
        this._updateState({
          stats: result.statistics
        })
      }

      return result

    } catch (error) {
      console.error('PracticeViewModel: 获取统计失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 启动计时器
   * @private
   */
  _startTimer() {
    this._stopTimer() // 确保没有重复的计时器

    this.state.timer = setInterval(() => {
      const timeSpent = this._getCurrentTimeSpent()
      const formattedTime = this._formatTime(timeSpent)

      this._updateState({
        timeSpent,
        formattedTime
      })
    }, 1000)
  }

  /**
   * 停止计时器
   * @private
   */
  _stopTimer() {
    if (this.state && this.state.timer) {
      clearInterval(this.state.timer)
      this.state.timer = null
    }
  }

  /**
   * 获取当前时间消耗
   * @returns {number} 秒数
   * @private
   */
  _getCurrentTimeSpent() {
    return Math.floor((Date.now() - this.state.startTime) / 1000)
  }

  /**
   * 格式化时间显示
   * @param {number} seconds - 秒数
   * @returns {string} 格式化的时间字符串
   * @private
   */
  _formatTime(seconds) {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  /**
   * 计算统计信息
   * @param {Object} userAnswers - 用户答案
   * @returns {Object} 统计信息
   * @private
   */
  _calculateStats(userAnswers = {}) {
    const answered = Object.keys(userAnswers).length
    const total = this.state.questions.length

    // 这里可以根据实际的评分逻辑计算正确数和准确率
    // 暂时使用简单的统计
    return {
      total,
      answered,
      correct: 0, // 需要根据实际评分计算
      accuracy: 0 // 需要根据实际评分计算
    }
  }

  /**
   * 销毁ViewModel，清理资源
   */
  /**
   * 检查是否已看过主题设置
   * @returns {Promise<boolean>} 是否已看过
   */
  async checkHasSeenThemeSetup() {
    try {
      const hasSeen = await this.storageAdapter.get('hasSeenThemeSetup')
      return Boolean(hasSeen)
    } catch (error) {
      console.error('检查主题设置状态失败:', error)
      return false
    }
  }

  /**
   * 标记已看过主题设置
   */
  async markHasSeenThemeSetup() {
    try {
      await this.storageAdapter.save('hasSeenThemeSetup', true)
      this._updateState({
        hasSeenThemeSetup: true,
        lastUpdated: this.dateService.getCurrentDateISO()
      })
    } catch (error) {
      console.error('标记主题设置状态失败:', error)
      throw error
    }
  }

  /**
   * 获取AI提示（用于练习页面）
   * @param {string} questionId - 题目ID
   * @param {Object} context - 上下文信息（可选）
   * @returns {Promise<Object>} AI生成的提示内容
   */
  async getHint(questionId, context = {}) {
    try {
      if (!this.aiService) {
        throw new Error('AI服务未初始化')
      }

      // 获取当前题目信息（添加安全检查）
      const questions = this.state.questions || []
      const question = this.state.currentQuestion || questions.find(q => q.id === questionId)
      if (!question) {
        throw new Error(`题目不存在: ${questionId}`)
      }

      // 构建上下文
      const hintContext = {
        questionId,
        questionType: question.type || context.questionType,
        question: question.content || question.question,
        passage: question.passage || context.passage,
        userAnswer: this.state.userAnswers[questionId] || context.userAnswer,
        ...context
      }

      // 调用AI服务获取提示
      const hintResult = await this.aiService.getHint(questionId, hintContext)

      return {
        success: true,
        hint: hintResult.hint,
        questionId: hintResult.questionId,
        timestamp: hintResult.timestamp
      }

    } catch (error) {
      console.warn('[PracticeViewModel] AI提示失败，已降级:', error.message)
      return {
        success: false,
        error: error.message,
        hint: '提示功能暂时不可用，请稍后重试。'
      }
    }
  }

  /**
   * 批改作文（用于写作练习）
   * @param {string} essayContent - 作文内容
   * @param {string} questionId - 题目ID
   * @param {Object} context - 上下文信息（可选）
   * @returns {Promise<Object>} 批改结果
   */
  async gradeEssay(essayContent, questionId, context = {}) {
    try {
      if (!this.aiService) {
        throw new Error('AI服务未初始化')
      }

      // 获取当前题目信息（添加安全检查）
      const questions = this.state.questions || []
      const question = this.state.currentQuestion || questions.find(q => q.id === questionId)
      if (!question) {
        throw new Error(`题目不存在: ${questionId}`)
      }

      // 构建上下文
      const gradingContext = {
        question: question.content || question.question,
        requirements: question.requirements || context.requirements,
        scoringCriteria: question.scoringCriteria || context.scoringCriteria,
        ...context
      }

      // 调用AI服务批改作文
      const gradingResult = await this.aiService.gradeEssay(essayContent, questionId, gradingContext)

      return {
        success: true,
        ...gradingResult
      }

    } catch (error) {
      console.warn('[PracticeViewModel] AI批改失败，已降级:', error.message)
      // Silent Fail: 返回降级结果
      return {
        success: false,
        error: error.message,
        scores: {
          content: 0,
          structure: 0,
          language: 0,
          total: 0
        },
        feedback: {
          strengths: [],
          improvements: ['批改服务暂时不可用，请稍后重试']
        },
        suggestions: [],
        detailedComments: `批改服务暂时不可用：${error.message}。请稍后重试。`,
        isFallback: true
      }
    }
  }

  /**
   * 销毁ViewModel，清理所有资源
   * 
   * 应用Skill: TEST-PATTERNS-LIBRARY Pattern 3（异步资源清理）
   * 
   * 清理内容：
   * - 定时器（_stopTimer）
   * - AI服务（aiService.destroy）
   * - 监听器（listeners）
   * - 状态（state）
   * 
   * 幂等性：可安全地多次调用
   */
  destroy() {
    // 清理定时器
    this._stopTimer()
    
    // Pattern 3: 清理注入的服务（防止定时器泄漏）
    // P1-003修复：ViewModel持有aiService引用，必须在destroy时清理
    if (this.aiService && typeof this.aiService.destroy === 'function') {
      this.aiService.destroy()
    }
    
    // 清理监听器和状态
    this.listeners = []
    this.state = null
  }
}

module.exports = PracticeViewModel
