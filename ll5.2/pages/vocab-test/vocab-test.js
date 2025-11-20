// pages/vocab-test/vocab-test.js
import learningDataManager from '../../utils/learning-data-manager.js'
import timerManager from '../../core/infrastructure/utils/timer-manager.js'
const { createThemeContainer } = require('../../core/infrastructure/di/themeContainer')

// 🏛️ 架构铁律合规: 使用DI容器获取服务
const themeContainer = createThemeContainer('wechat')
const themeService = themeContainer.resolve('IThemeService')

Page({
  __loadStartTime: Date.now(),
  data: {
    themeClass: '',
    
    // 测试配置
    totalQuestions: 20,
    testDuration: 300, // 5分钟 = 300秒
    
    // 测试状态
    currentQuestionIndex: 0,
    currentQuestion: null,
    questions: [],
    
    // 用户答题
    selectedOption: null,
    showResult: false,
    userAnswers: [],
    
    // 统计数据
    correctCount: 0,
    answeredCount: 0,
    timeLeft: '05:00',
    startTime: null,
    
    // AI提示
    showAIHint: false,
    aiHintMessage: '',
    aiHintAction: '',
    
    // 行为监控
    hesitationTimer: null,
    consecutiveWrong: 0,
    viewedAnswerCount: 0
  },

  onLoad(options) {
    console.log('📝 [词汇测试] 页面加载')
    this.initTest(options)
  },

  onReady() {
    // 性能跟踪
    const app = getApp()
    if (app.globalData && app.globalData.perfTest) {
      const loadTime = Date.now() - this.__loadStartTime
      app.globalData.perfTest.recordPagePerformance('vocab-test', { loadTime })
    }
  },

  onUnload() {
    // 清理定时器
    if (this.data.hesitationTimer) {
      clearTimeout(this.data.hesitationTimer)
    }
    if (this.countdownTimer) {
      timerManager.clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
  },

  /**
   * 初始化测试
   */
  async initTest(options) {
    try {
      // 🏛️ 架构铁律合规: 通过服务获取主题
      const theme = await themeService.getCurrentTheme()
      this.setData({ themeClass: theme === 'dark' ? 'theme-dark' : '' })

      // 生成测试题目
      const testConfig = {
        count: options.count ? parseInt(options.count) : 20,
        duration: options.duration ? parseInt(options.duration) : 300,
        source: options.source || 'recent' // recent: 最近学习, all: 全部, weak: 薄弱
      }

      const questions = await this.generateQuestions(testConfig)
      
      if (!questions || questions.length === 0) {
        throw new Error('题目生成失败')
      }

      this.setData({
        totalQuestions: questions.length,
        testDuration: testConfig.duration,
        questions,
        currentQuestion: questions[0],
        startTime: Date.now(),
        timeLeft: this.formatTime(testConfig.duration)
      })

      // 开始倒计时
      this.startCountdown()

      // 开始AI监控
      this.startHesitationMonitoring()

      console.log(`✅ [词汇测试] 测试初始化成功，共${questions.length}题`)

    } catch (error) {
      console.error('❌ [词汇测试] 初始化失败:', error)
      wx.showModal({
        title: '测试初始化失败',
        content: error.message || '请稍后重试',
        showCancel: false,
        success: () => {
          wx.navigateBack()
        }
      })
    }
  },

  /**
   * 生成测试题目
   */
  async generateQuestions(config) {
    const { count, source } = config
    
    // 获取学习数据
    const learnedWords = learningDataManager.getAllLearnedWords()
    
    if (!learnedWords || learnedWords.length < 4) {
      throw new Error('学习的单词太少，无法生成测试题目')
    }

    console.log(`📊 [词汇测试] 从${learnedWords.length}个已学单词中生成题目`)

    // 根据来源筛选单词
    let sourceWords = learnedWords
    if (source === 'recent') {
      // 最近3天学习的单词
      const threeDaysAgo = Date.now() - 3 * 24 * 60 * 60 * 1000
      sourceWords = learnedWords.filter(w => new Date(w.learnedDate).getTime() > threeDaysAgo)
    } else if (source === 'weak') {
      // 标记为"不认识"的单词
      sourceWords = learnedWords.filter(w => w.mastery === 'hard' || w.mastery === 'medium')
    }

    if (sourceWords.length < 4) {
      sourceWords = learnedWords // 降级到全部单词
    }

    // 随机打乱
    sourceWords = this.shuffleArray([...sourceWords])

    // 生成题目
    const questions = []
    const usedWords = new Set()

    for (let i = 0; i < Math.min(count, sourceWords.length); i++) {
      const word = sourceWords[i]
      
      if (usedWords.has(word.id)) continue
      usedWords.add(word.id)

      // 生成4个选项（1个正确 + 3个错误）
      const options = this.generateOptions(word, learnedWords, usedWords)

      questions.push({
        id: `test_${i + 1}`,
        word: word.word,
        phonetic: word.phonetic || '',
        correctAnswer: word.meaning,
        correctIndex: 0, // 正确答案先放在索引0
        options,
        wordId: word.id
      })
    }

    // 随机化每题的正确答案位置
    questions.forEach(q => {
      const correctOption = q.options[0]
      const newIndex = Math.floor(Math.random() * 4)
      q.options.splice(0, 1)
      q.options.splice(newIndex, 0, correctOption)
      q.correctIndex = newIndex
    })

    return questions
  },

  /**
   * 生成选项
   */
  generateOptions(correctWord, allWords, usedWords) {
    const options = [
      {
        label: 'A',
        text: correctWord.meaning,
        isCorrect: true
      }
    ]

    // 获取3个不同的错误选项
    const wrongWords = allWords.filter(w => 
      w.id !== correctWord.id && 
      !usedWords.has(w.id) &&
      w.meaning !== correctWord.meaning
    )

    const shuffled = this.shuffleArray([...wrongWords])
    
    for (let i = 0; i < 3 && i < shuffled.length; i++) {
      options.push({
        label: String.fromCharCode(66 + i), // B, C, D
        text: shuffled[i].meaning,
        isCorrect: false
      })
    }

    // 如果不够4个选项，用模拟数据补充
    while (options.length < 4) {
      options.push({
        label: String.fromCharCode(65 + options.length),
        text: `选项${options.length}（占位）`,
        isCorrect: false
      })
    }

    return options
  },

  /**
   * 随机打乱数组
   */
  shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]]
    }
    return array
  },

  /**
   * 开始倒计时
   */
  startCountdown() {
    const startTime = Date.now()
    const endTime = startTime + this.data.testDuration * 1000

    this.countdownTimer = timerManager.setInterval(() => {
      const now = Date.now()
      const remaining = Math.max(0, Math.floor((endTime - now) / 1000))

      this.setData({
        timeLeft: this.formatTime(remaining)
      })

      // 时间到
      if (remaining === 0) {
        this.finishTest('timeout')
      }

      // 时间不足1分钟时AI提示
      if (remaining === 60 && !this.hasShownTimeWarning) {
        this.hasShownTimeWarning = true
        this.showAIMessage(
          '只剩1分钟了！建议先完成会做的题目',
          '知道了',
          null
        )
      }
    }, 1000)
  },

  /**
   * 格式化时间
   */
  formatTime(seconds) {
    const min = Math.floor(seconds / 60)
    const sec = seconds % 60
    return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
  },

  /**
   * 选择选项
   */
  selectOption(e) {
    if (this.data.showResult) return // 已显示结果，不能再选

    const { index } = e.currentTarget.dataset
    const { currentQuestion } = this.data

    // 停止AI监控
    this.stopHesitationMonitoring()

    const isCorrect = index === currentQuestion.correctIndex

    // 记录答案
    this.setData({
      selectedOption: index,
      showResult: true,
      answeredCount: this.data.answeredCount + 1,
      correctCount: isCorrect ? this.data.correctCount + 1 : this.data.correctCount
    })

    // 记录用户答案
    this.data.userAnswers.push({
      questionId: currentQuestion.id,
      wordId: currentQuestion.wordId,
      selectedIndex: index,
      isCorrect,
      timeSpent: Date.now() - this.questionStartTime
    })

    // 连续错误计数
    if (!isCorrect) {
      this.setData({
        consecutiveWrong: this.data.consecutiveWrong + 1
      })

      // 连续错误2次，AI提示
      if (this.data.consecutiveWrong >= 2) {
        setTimeout(() => {
          this.showAIMessage(
            '连续答错了？试试先看单词，回忆学习时的场景',
            '知道了',
            null
          )
        }, 1500)
      }
    } else {
      this.setData({
        consecutiveWrong: 0
      })
    }

    this.questionStartTime = Date.now()
  },

  /**
   * 跳过题目
   */
  skipQuestion() {
    this.stopHesitationMonitoring()

    // 记录跳过
    this.data.userAnswers.push({
      questionId: this.data.currentQuestion.id,
      wordId: this.data.currentQuestion.wordId,
      selectedIndex: null,
      isCorrect: false,
      skipped: true,
      timeSpent: Date.now() - this.questionStartTime
    })

    this.nextQuestion()
  },

  /**
   * 下一题
   */
  nextQuestion() {
    const { currentQuestionIndex, totalQuestions, questions } = this.data

    if (currentQuestionIndex >= totalQuestions - 1) {
      // 测试完成
      this.finishTest('completed')
      return
    }

    const nextIndex = currentQuestionIndex + 1
    this.setData({
      currentQuestionIndex: nextIndex,
      currentQuestion: questions[nextIndex],
      selectedOption: null,
      showResult: false
    })

    this.questionStartTime = Date.now()

    // 重新开始AI监控
    this.startHesitationMonitoring()
  },

  /**
   * 完成测试
   */
  finishTest(reason) {
    console.log('🎉 [词汇测试] 测试完成:', reason)

    // 清理定时器 (符合M2: 定时器生命周期管理)
    if (this.countdownTimer) {
      timerManager.clearInterval(this.countdownTimer)
      this.countdownTimer = null
    }
    this.stopHesitationMonitoring()

    // 计算统计数据
    const { userAnswers, totalQuestions, startTime } = this.data
    const timeSpent = Math.floor((Date.now() - startTime) / 1000)
    const correctCount = userAnswers.filter(a => a.isCorrect).length
    const accuracy = Math.round((correctCount / totalQuestions) * 100)

    // 保存测试记录
    learningDataManager.saveTestRecord({
      testType: 'vocabulary',
      totalQuestions,
      correctCount,
      accuracy,
      timeSpent,
      answers: userAnswers,
      completedAt: new Date().toISOString()
    })

    // 跳转到成绩页面
    wx.redirectTo({
      url: `/pages/test-result/test-result?correct=${correctCount}&total=${totalQuestions}&time=${timeSpent}&accuracy=${accuracy}`
    })
  },

  /**
   * 退出测试
   */
  quitTest() {
    wx.showModal({
      title: '确定退出测试？',
      content: '当前进度将不会保存',
      confirmText: '确定退出',
      cancelText: '继续测试',
      confirmColor: '#FA5151',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack()
        }
      }
    })
  },

  // ==================== AI监控功能 ====================

  /**
   * 开始犹豫监控
   */
  startHesitationMonitoring() {
    this.stopHesitationMonitoring()
    this.questionStartTime = Date.now()

    this.setData({
      hesitationTimer: setTimeout(() => {
        this.showAIMessage(
          '停留时间较长，试试排除法：先排除明显错误的选项',
          '查看提示',
          () => {
            this.showDetailedHint()
          }
        )
      }, 30000) // 30秒无操作
    })
  },

  /**
   * 停止犹豫监控
   */
  stopHesitationMonitoring() {
    if (this.data.hesitationTimer) {
      clearTimeout(this.data.hesitationTimer)
      this.setData({ hesitationTimer: null })
    }
  },

  /**
   * 显示AI提示消息
   */
  showAIMessage(message, action, callback) {
    this.setData({
      showAIHint: true,
      aiHintMessage: message,
      aiHintAction: action || ''
    })

    this.aiHintCallback = callback
  },

  /**
   * 关闭AI提示
   */
  onDismissHint() {
    this.setData({
      showAIHint: false
    })
    this.aiHintCallback = null

    // 重新开始监控
    if (!this.data.showResult) {
      this.startHesitationMonitoring()
    }
  },

  /**
   * 接受AI提示
   */
  onAcceptHint() {
    this.setData({
      showAIHint: false
    })

    if (this.aiHintCallback) {
      this.aiHintCallback()
      this.aiHintCallback = null
    }
  },

  /**
   * 显示详细提示
   */
  showDetailedHint() {
    // 分析选项，给出提示（不直接透露答案）
    const hints = [
      '注意单词的词性和常见搭配',
      '回忆一下这个单词在例句中的用法',
      '排除与单词词性不符的选项',
      '注意单词的感情色彩（正面/负面）'
    ]

    const randomHint = hints[Math.floor(Math.random() * hints.length)]

    this.showAIMessage(
      randomHint,
      '知道了',
      null
    )

    // 记录查看提示
    this.setData({
      viewedAnswerCount: this.data.viewedAnswerCount + 1
    })
  }
})

