// pages/practice/practice-with-tracking.js
// Clean Architecture版本的练习页面 + BehaviorTracker 集成
// 
// 遵循 P1-001 Skill Day 3 集成指南
// ✅ GOOD: 从 App 获取 Tracker（依赖注入），不在 Page 中 new

const { container } = require('../../core/infrastructure/di/container')
const { BEHAVIOR_CONFIG, shouldSample } = require('../../behavior-config')

Page({
  __loadStartTime: Date.now(),
  __sessionId: null,  // 会话ID（用于 trackPracticeDuration）
  __hoverTimers: {},  // 选项悬停计时器

  data: {
    // 试卷和题目相关
    paper: null,
    questions: [],
    currentQuestionIndex: 0,
    userAnswers: {},
    isLoading: true,

    // 答题统计
    stats: {
      total: 0,
      answered: 0,
      correct: 0,
      accuracy: 0
    },

    // 界面状态
    showResult: false,
    practiceMode: 'practice', // practice 或 exam
    startTime: 0,
    timeSpent: 0,
    formattedTime: '0:00',

    // 结果相关
    showExplanation: false,
    practiceResult: null,

    // BehaviorTracker 状态
    trackingEnabled: BEHAVIOR_CONFIG.enableSwitch
  },

  async onLoad(options) {
    // [1] 初始化依赖（业务逻辑）
    this.getPaperByIdUseCase = container.resolve('getPaperByIdUseCase')
    this.recordAnswerUseCase = container.resolve('recordAnswerUseCase')
    this.submitAnswersUseCase = container.resolve('submitAnswersUseCase')

    // [2] ✅ GOOD: 从 App 获取 BehaviorTracker（依赖注入）
    // ❌ BAD: this.tracker = new BehaviorTracker(...) - 违反 Clean Architecture
    const app = getApp()
    this.tracker = app.globalData.tracker
    
    if (this.tracker) {
      // [3] 生成会话ID
      this.__sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      console.log('[Practice] Using global tracker, session:', this.__sessionId)
    } else {
      console.log('[Practice] Tracker not available (disabled or init failed)')
    }

    const { paperId, mode = 'practice', continue: shouldContinue, questionIndex } = options

    this.setData({
      paperId: paperId || 'sample-reading-001',
      practiceMode: mode,
      startTime: Date.now()
    })

    // 如果是继续练习，恢复进度
    if (shouldContinue === 'true') {
      await this.restoreProgress(questionIndex)
    }

    // 加载试卷
    await this.loadPaper()

    // 启动计时器
    this.startTimer()
  },

  onReady() {
    // 性能跟踪
    const app = getApp()
    if (app.globalData && app.globalData.perfTest) {
      const loadTime = Date.now() - this.__loadStartTime
      app.globalData.perfTest.recordPagePerformance('practice-clean', { loadTime })
    }
  },

  /**
   * 页面卸载
   * 
   * ⚠️ RED LINE 3: 必须 await tracker.destroy()
   */
  async onUnload() {
    // [1] 清理计时器
    if (this.timer) {
      clearInterval(this.timer)
    }

    // [2] 记录会话时长（如果用户做了题）
    if (this.tracker && this.__sessionId && this.data.stats.answered > 0) {
      const duration = Date.now() - this.data.startTime
      this.tracker.trackPracticeDuration(this.__sessionId, duration)
    }

    // [3] ✅ GOOD: await destroy() 确保所有事件 flush
    if (this.tracker) {
      try {
        console.log('[Practice] Destroying tracker...')
        await this.tracker.destroy()
        console.log('[Practice] Tracker destroyed successfully')
      } catch (e) {
        console.error('[Practice] Tracker destroy failed:', e)
      }
    }
  },

  // ==================== 数据加载 ====================
  async loadPaper() {
    try {
      this.setData({ isLoading: true })
      
      const paper = await this.getPaperByIdUseCase.execute(this.data.paperId)
      
      this.setData({
        paper,
        questions: paper.questions || [],
        stats: {
          ...this.data.stats,
          total: paper.questions?.length || 0
        },
        isLoading: false
      })
    } catch (error) {
      console.error('[Practice] loadPaper failed:', error)
      wx.showToast({
        title: '加载试卷失败',
        icon: 'error'
      })
      this.setData({ isLoading: false })
    }
  },

  // ==================== 事件采集集成 ====================

  /**
   * 选项悬停开始（采集犹豫事件）
   */
  onOptionHoverStart(e) {
    if (!this.tracker || !shouldSample(BEHAVIOR_CONFIG.sampleRate)) return

    const { questionId, optionIndex } = e.currentTarget.dataset
    const hoverId = `${questionId}_${optionIndex}`
    
    // 记录悬停开始时间
    this.__hoverTimers[hoverId] = Date.now()
  },

  /**
   * 选项悬停结束（采集犹豫事件）
   */
  onOptionHoverEnd(e) {
    if (!this.tracker || !shouldSample(BEHAVIOR_CONFIG.sampleRate)) return

    const { questionId, optionIndex } = e.currentTarget.dataset
    const hoverId = `${questionId}_${optionIndex}`
    
    // 计算悬停时长
    if (this.__hoverTimers[hoverId]) {
      const duration = Date.now() - this.__hoverTimers[hoverId]
      
      // 只有超过 3 秒的犹豫才会被采集（Tracker 内部已过滤）
      this.tracker.trackHesitation(questionId, duration)
      
      delete this.__hoverTimers[hoverId]
    }
  },

  /**
   * 用户选择答案
   */
  onAnswerSelect(e) {
    const { questionId, answer } = e.detail
    
    // 记录答案（业务逻辑）
    this.recordAnswerUseCase.execute(questionId, answer)
    
    // 更新统计
    const answered = Object.keys(this.data.userAnswers).length + 1
    this.setData({
      [`userAnswers.${questionId}`]: answer,
      'stats.answered': answered
    })
  },

  /**
   * 用户点击词汇查询（采集查词事件）
   */
  onWordLookup(e) {
    if (!this.tracker || !shouldSample(BEHAVIOR_CONFIG.sampleRate)) return

    const { word, context } = e.detail
    
    // ✅ GOOD: 调用公开 API
    this.tracker.trackWordLookup(word, context || '')
  },

  /**
   * 用户返回查看之前的题目（采集回看事件）
   */
  onReviewQuestion(e) {
    if (!this.tracker || !shouldSample(BEHAVIOR_CONFIG.sampleRate)) return

    const { questionId } = e.detail
    const currentQuestion = this.data.questions[this.data.currentQuestionIndex]
    
    // 只有当前不是该题时才算回看
    if (currentQuestion && currentQuestion.id !== questionId) {
      this.tracker.trackReview(questionId, 1)
    }
  },

  /**
   * 用户跳过题目（采集跳过事件）
   */
  onSkipQuestion(e) {
    if (!this.tracker || !shouldSample(BEHAVIOR_CONFIG.sampleRate)) return

    const questionId = this.data.questions[this.data.currentQuestionIndex]?.id
    const reason = e.detail?.reason || 'user_skip'
    
    if (questionId) {
      this.tracker.trackSkip(questionId, reason)
    }

    // 跳转到下一题（业务逻辑）
    this.nextQuestion()
  },

  // ==================== 导航 ====================
  nextQuestion() {
    const next = this.data.currentQuestionIndex + 1
    if (next < this.data.questions.length) {
      this.setData({ currentQuestionIndex: next })
    }
  },

  prevQuestion() {
    const prev = this.data.currentQuestionIndex - 1
    if (prev >= 0) {
      this.setData({ currentQuestionIndex: prev })
    }
  },

  // ==================== 其他方法 ====================
  startTimer() {
    this.timer = setInterval(() => {
      const timeSpent = Math.floor((Date.now() - this.data.startTime) / 1000)
      const minutes = Math.floor(timeSpent / 60)
      const seconds = timeSpent % 60
      this.setData({
        timeSpent,
        formattedTime: `${minutes}:${seconds.toString().padStart(2, '0')}`
      })
    }, 1000)
  },

  async restoreProgress(questionIndex) {
    // 恢复进度逻辑
    if (questionIndex) {
      this.setData({
        currentQuestionIndex: parseInt(questionIndex) || 0
      })
    }
  }
})
