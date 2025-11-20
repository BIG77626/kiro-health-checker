// pages/practice/practice-clean.js
// Clean Architecture版本的练习页面

const { container } = require('../../core/infrastructure/di/container')

Page({
  __loadStartTime: Date.now(),

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
    practiceResult: null
  },

  async onLoad(options) {
    // 初始化依赖
    this.getPaperByIdUseCase = container.resolve('getPaperByIdUseCase')
    this.recordAnswerUseCase = container.resolve('recordAnswerUseCase')
    this.submitAnswersUseCase = container.resolve('submitAnswersUseCase')

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

  onUnload() {
    // 清理计时器
    if (this.timer) {
      clearInterval(this.timer)
    }
  },

  // ==================== 数据加载 ====================
  async loadPaper() {
    try {
      this.setData({ isLoading: true })

      const paper = await this.getPaperByIdUseCase.execute(this.data.paperId)

      if (!paper) {
        wx.showToast({
          title: '试卷不存在',
          icon: 'none'
        })
        wx.navigateBack()
        return
      }

      this.setData({
        paper: paper,
        questions: paper.questions,
        isLoading: false,
        stats: {
          ...this.data.stats,
          total: paper.questions.length
        }
      })

    } catch (error) {
      console.error('加载试卷失败:', error)
      this.setData({ isLoading: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  async restoreProgress(questionIndex) {
    // 这里应该从存储中恢复进度
    // 暂时设置当前题目索引
    if (questionIndex) {
      this.setData({
        currentQuestionIndex: parseInt(questionIndex)
      })
    }
  },

  // ==================== 答题功能 ====================
  async onAnswerChange(e) {
    const { questionId, answer } = e.detail || e.currentTarget.dataset

    if (!questionId) return

    const userAnswers = {
      ...this.data.userAnswers,
      [questionId]: {
        answer,
        timestamp: new Date().toISOString()
      }
    }

    this.setData({ userAnswers })
    this.updateStats()

    // 记录答案（异步，不阻塞UI）
    try {
      await this.recordAnswerUseCase.execute({
        userId: 'current_user', // 应该从用户服务获取
        paperId: this.data.paperId,
        questionId,
        answer,
        timeSpent: Date.now() - this.data.startTime
      })
    } catch (error) {
      console.error('记录答案失败:', error)
    }
  },

  updateStats() {
    const { questions, userAnswers } = this.data
    let answered = 0

    questions.forEach(question => {
      if (userAnswers[question.id] !== undefined) {
        answered++
      }
    })

    this.setData({
      stats: {
        ...this.data.stats,
        answered
      }
    })
  },

  // ==================== 导航功能 ====================
  goToNext() {
    const { currentQuestionIndex, questions } = this.data

    if (currentQuestionIndex < questions.length - 1) {
      this.setData({
        currentQuestionIndex: currentQuestionIndex + 1,
        showExplanation: false
      })
    }
  },

  goToPrevious() {
    const { currentQuestionIndex } = this.data

    if (currentQuestionIndex > 0) {
      this.setData({
        currentQuestionIndex: currentQuestionIndex - 1,
        showExplanation: false
      })
    }
  },

  goToQuestion(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      currentQuestionIndex: index,
      showExplanation: false
    })
  },

  // ==================== 提交功能 ====================
  async submitAnswers() {
    try {
      wx.showLoading({ title: '提交中...' })

      const result = await this.submitAnswersUseCase.execute({
        userId: 'current_user', // 应该从用户服务获取
        paperId: this.data.paperId,
        userAnswers: this.data.userAnswers,
        totalTimeSpent: this.data.timeSpent
      })

      wx.hideLoading()

      this.setData({
        showResult: true,
        practiceResult: result
      })

    } catch (error) {
      wx.hideLoading()
      console.error('提交答案失败:', error)
      wx.showToast({
        title: '提交失败',
        icon: 'none'
      })
    }
  },

  // ==================== 结果展示 ====================
  toggleExplanation() {
    this.setData({
      showExplanation: !this.data.showExplanation
    })
  },

  restartPractice() {
    this.setData({
      showResult: false,
      currentQuestionIndex: 0,
      userAnswers: {},
      startTime: Date.now(),
      timeSpent: 0,
      formattedTime: '0:00',
      stats: {
        total: this.data.questions.length,
        answered: 0,
        correct: 0,
        accuracy: 0
      }
    })

    // 重新启动计时器
    this.startTimer()
  },

  // ==================== 工具方法 ====================
  startTimer() {
    this.timer = setInterval(() => {
      const timeSpent = Math.floor((Date.now() - this.data.startTime) / 1000)
      const minutes = Math.floor(timeSpent / 60)
      const seconds = timeSpent % 60
      const formattedTime = `${minutes}:${seconds.toString().padStart(2, '0')}`

      this.setData({
        timeSpent,
        formattedTime
      })
    }, 1000)
  },

  // 获取当前题目
  get currentQuestion() {
    const { questions, currentQuestionIndex } = this.data
    return questions[currentQuestionIndex] || null
  },

  // 获取当前题目的用户答案
  get currentAnswer() {
    const { userAnswers } = this.data
    const currentQuestion = this.currentQuestion
    return currentQuestion ? userAnswers[currentQuestion.id] : null
  }
})
