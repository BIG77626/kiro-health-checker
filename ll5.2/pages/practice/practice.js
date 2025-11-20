// pages/practice/practice.js
// 新架构已启用，不再使用CloudDatabase和AIHintGenerator
const { showLoading, hideLoading } = require('../../utils/util.js')
const { progressTracker } = require('../../utils/progress-tracker.js')
const themeUtils = require('../../utils/theme.js')
const { sampleReadingData } = require('../../data/sample-reading.js')
const { sampleClozeData } = require('../../data/sample-cloze.js')
const { sampleTranslationData } = require('../../data/sample-translation.js')
const { sampleWritingData } = require('../../data/sample-writing.js')
const { practiceProgressManager } = require('../../utils/practice-progress.js')
const { friendlyErrorManager } = require('../../utils/friendly-error.js')

// 新架构相关导入（强制使用新架构，旧架构已完全移除）
const PracticeViewModel = require('./PracticeViewModel')
const createPracticeContainer = require('../../core/infrastructure/di/practiceContainer')

console.log('✅ Practice页面：使用新架构 (Clean Architecture)')

Page({
  __loadStartTime: Date.now(),
  data: {
    paper: null,
    questions: [],
    passages: [],
    currentQuestionIndex: 0,
    userAnswers: {},
    isLoading: true,
    showResult: false,
    showExplanation: false,
    startTime: 0,
    timeSpent: 0,
    formattedTime: '0:00',
    timer: null,
    practiceMode: 'practice', // practice 或 exam

    // 答题统计
    stats: {
      total: 0,
      answered: 0,
      correct: 0,
      accuracy: 0
    },

    // 主题设置
    showThemeSetup: false,
    systemTheme: 'light',

    // AI 提示相关
    showHint: false,
    hintMessage: '',
    hintPoints: [],
    hintKeywords: [],
    hintAutoExpand: false,
    idleTime: 0,        // 空闲时间（秒）
    attempts: 0,         // 作答尝试次数

    // 新架构状态（强制使用新架构）
    isNewArchitecture: true,
    viewModelError: null,

    // 写作批改结果（传递给writing-question组件）
    writingGradingResult: null
  },

  onLoad(options) {
    console.log('【练习页面参数】', options) // 调试信息

    // 强制使用新架构（旧架构已完全移除）
    this._initNewArchitecture()

    const { paperId, mode = 'practice', type, typeName, continue: shouldContinue, questionIndex } = options

    // 设置导航栏标题
    if (typeName) {
      wx.setNavigationBarTitle({
        title: typeName
      })
    }

    this.setData({
      paperId: paperId || `sample-${type}-001`,
      practiceMode: mode,
      practiceType: type || 'reading',
      startTime: Date.now()
    })

    // 如果是继续练习，恢复进度
    if (shouldContinue === 'true') {
      const lastProgress = practiceProgressManager.getLastProgress()
      if (lastProgress && lastProgress.userAnswers) {
        this.setData({
          userAnswers: lastProgress.userAnswers,
          currentQuestionIndex: parseInt(questionIndex) || 0,
          startTime: lastProgress.startTime || Date.now()
        })
        console.log('✅ 已恢复练习进度:', lastProgress)
      }
    }

    // 初始化 AI 提示生成器（新架构使用AIService）
    // this.aiHintGenerator = new AIHintGenerator() // 新架构已禁用

    // 启动空闲时间监控（每秒更新）
    this.idleTimer = setInterval(() => {
      const idleTime = this.data.idleTime + 1
      this.setData({ idleTime })

      // 如果空闲超过 30 秒且未显示提示，自动触发
      if (idleTime === 30 && !this.data.showHint && this.data.practiceMode === 'practice') {
        this.triggerAIHint()
      }
    }, 1000)

    // 如果没有 paperId，使用示例数据
    if (!paperId && type) {
      this.loadSampleData(type)
      return
    }

    if (!paperId) {
      console.error('❌ 练习页面参数缺失: paperId 或 type')
      friendlyErrorManager.showBusinessError('parameter error', {
        title: '参数错误',
        message: '缺少必要参数，无法开始练习',
        showModal: true
      })
      setTimeout(() => {
        wx.navigateBack()
      }, 2000)
      return
    }

    this.setData({
      paperId: paperId,
      practiceMode: mode,
      startTime: Date.now()
    })

    // 检查是否有未完成的会话
    const hasUnfinishedSession = progressTracker.restoreSession()
    if (hasUnfinishedSession) {
      const sessionStatus = progressTracker.getSessionStatus()
      if (sessionStatus.isActive && sessionStatus.sessionData.currentPaper.id === paperId) {
        wx.showModal({
          title: '继续学习',
          content: '检测到未完成的练习，是否继续？',
          confirmText: '继续',
          cancelText: '重新开始',
          success: (res) => {
            if (res.confirm) {
              this.setData({
                userAnswers: sessionStatus.sessionData.answers || {},
                startTime: sessionStatus.sessionData.startTime
              })
            } else {
              progressTracker.clearSession()
            }
            this.startNewArchitectureSession(paperId, { mode })
          }
        })
        return
      }
    }

    this.startNewArchitectureSession(paperId, { mode })

    // 检查主题设置
    this.checkThemeSetup()
  },

  onReady() {
    // 性能跟踪
    const app = getApp()
    if (app.globalData && app.globalData.perfTest) {
      const loadTime = Date.now() - this.__loadStartTime
      app.globalData.perfTest.recordPagePerformance('practice', { loadTime })
    }

    // ✅ WebVitals 监控集成（按照AI_NATIVE_DEVELOPMENT_SKILL规范）
    // 注意: 微信小程序环境暂不支持PerformanceObserver API
    // 性能基线测试建议使用手动计时方式
    try {
      // 手动记录加载性能
      const loadTime = Date.now() - this.__loadStartTime
      console.log(`✅ [Performance] Practice页面加载完成: ${loadTime}ms`)
      
      // 保存性能数据到全局（供性能基线测试使用）
      const app = getApp()
      if (app.globalData) {
        if (!app.globalData.performanceMetrics) {
          app.globalData.performanceMetrics = {}
        }
        app.globalData.performanceMetrics.practice = {
          loadTime: loadTime,
          timestamp: Date.now()
        }
      }
    } catch (error) {
      console.error('⚠️ [Performance] 性能数据记录失败:', error)
    }
  },

  /**
   * 处理答题事件
   */
  onAnswer(e) {
    const detail = e.detail
    console.log('📝 答题:', detail)

    // 更新答题记录
    const answers = this.data.userAnswers || {}
    answers[detail.questionId || detail.blankId] = {
      answer: detail.answer,
      isCorrect: detail.isCorrect,
      timestamp: Date.now()
    }

    this.setData({
      userAnswers: answers
    })
  },

  /**
   * 切换到下一篇文章（阅读理解）
   */
  nextPassage() {
    const nextIndex = this.data.currentPassageIndex + 1
    if (nextIndex < this.data.passages.length) {
      this.setData({
        currentPassageIndex: nextIndex,
        currentPassage: this.data.passages[nextIndex],
        questions: this.data.passages[nextIndex].questions
      })

      wx.showToast({
        title: `第 ${nextIndex + 1} 篇`,
        icon: 'success',
        duration: 1000
      })
    } else {
      // 所有文章完成
      wx.showModal({
        title: '练习完成',
        content: '是否提交查看结果？',
        success: (res) => {
          if (res.confirm) {
            this.submitPractice()
          }
        }
      })
    }
  },

  /**
   * 切换到下一道写作题
   */
  nextWritingQuestion() {
    const nextIndex = this.data.currentQuestionIndex + 1
    if (nextIndex < this.data.questions.length) {
      this.setData({
        currentQuestionIndex: nextIndex
      })

      wx.showToast({
        title: `第 ${nextIndex + 1} 题`,
        icon: 'success',
        duration: 1000
      })
    } else {
      // 所有题目完成
      wx.showModal({
        title: '写作练习完成',
        content: '已完成所有题目',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/report/report' })
          }
        }
      })
    }
  },

  /**
   * 返回上一页
   */
  // 开始新的学习会话
  startNewSession(paperId) {
    const paperTitle = this.data.paper?.title || `练习${paperId}`
    progressTracker.startSession(paperId, paperTitle, this.data.practiceMode)
    console.log('🚀 开始新的学习会话:', paperId)
  },

  /**
   * 加载示例数据
   */
  loadSampleData(type) {
    console.log('📝 加载示例数据:', type)

    this.setData({ isLoading: true })

    try {
      let data = null

      switch(type) {
      case 'reading':
        data = {
          passages: sampleReadingData,
          currentPassageIndex: 0,
          currentPassage: sampleReadingData[0],
          questions: sampleReadingData[0].questions
        }
        break

      case 'cloze':
        data = {
          clozeData: sampleClozeData[0],
          questions: sampleClozeData[0].blanks
        }
        break

      case 'translation':
        data = {
          translationData: sampleTranslationData[0],
          questions: [sampleTranslationData[0]] // 用于统计
        }
        break

      case 'writing':
        data = {
          writingData: sampleWritingData,
          questions: sampleWritingData.questions,
          currentQuestionIndex: 0
        }
        break

      default:
        friendlyErrorManager.showBusinessError('no_questions', {
          message: '暂不支持该题型'
        })
        setTimeout(() => wx.navigateBack(), 1500)
        return
      }

      this.setData({
        ...data,
        isLoading: false
      })

      console.log('✅ 示例数据加载完成')
      console.log('📊 当前数据状态:', {
        practiceType: this.data.practiceType,
        hasQuestions: Boolean(this.data.questions),
        questionsLength: this.data.questions?.length,
        currentQuestionIndex: this.data.currentQuestionIndex,
        hasWritingData: Boolean(this.data.writingData)
      })

    } catch (error) {
      console.error('❌ 加载示例数据失败:', error)
      friendlyErrorManager.show(error, {
        title: '加载失败',
        message: '数据加载失败，请重试'
      })
      this.setData({ isLoading: false })
    }
  },

  // 选择答案
  selectAnswer(e) {
    const { option } = e.currentTarget.dataset
    const { currentQuestionIndex, questions } = this.data
    const currentQuestion = questions[currentQuestionIndex]

    console.log('🔍 选择答案:', { questionId: currentQuestion.id, option }) // 调试信息

    // 检查答案是否正确
    const isCorrect = option === currentQuestion.correct_answer
    const timeSpent = Math.floor((Date.now() - this.data.startTime) / 1000 / questions.length)

    // 记录到进度跟踪器
    progressTracker.recordAnswer(
      currentQuestion.id,
      option,
      currentQuestion.correct_answer,
      isCorrect,
      timeSpent
    )

    // 更新用户答案
    const userAnswers = { ...this.data.userAnswers }
    const wasAnswered = Boolean(userAnswers[currentQuestion.id])
    userAnswers[currentQuestion.id] = option

    // 更新统计
    const stats = { ...this.data.stats }
    if (!wasAnswered) {
      stats.answered += 1
    }
    if (isCorrect && !wasAnswered) {
      stats.correct += 1
    } else if (!isCorrect && wasAnswered && userAnswers[currentQuestion.id] === currentQuestion.correct_answer) {
      stats.correct -= 1
    } else if (isCorrect && wasAnswered && userAnswers[currentQuestion.id] !== currentQuestion.correct_answer) {
      stats.correct += 1
    }

    // 重新计算准确率
    stats.accuracy = stats.answered > 0 ? ((stats.correct / stats.answered) * 100).toFixed(1) : 0

    this.setData({
      userAnswers,
      stats
    })

    // 保存练习进度
    practiceProgressManager.saveProgress({
      paperId: this.data.paperId,
      type: this.data.practiceType,
      typeName: this.data.paper?.title || this.data.practiceType,
      questionIndex: this.data.currentQuestionIndex,
      userAnswers: this.data.userAnswers,
      startTime: this.data.startTime
    })

    // 显示即时反馈
    if (this.data.practiceMode === 'practice') {
      const feedbackMsg = isCorrect ? '✅ 回答正确！' : `❌ 正确答案是 ${currentQuestion.correct_answer}`
      wx.showToast({
        title: feedbackMsg,
        icon: 'none',
        duration: 1500
      })
    }
  },

  // 上一题
  prevQuestion() {
    const { currentQuestionIndex } = this.data
    if (currentQuestionIndex > 0) {
      this.setData({
        currentQuestionIndex: currentQuestionIndex - 1,
        showExplanation: false
      })
    }
  },

  // 下一题
  nextQuestion() {
    const { currentQuestionIndex, questions } = this.data
    if (currentQuestionIndex < questions.length - 1) {
      this.setData({
        currentQuestionIndex: currentQuestionIndex + 1,
        showExplanation: false
      })
    }
  },

  // 跳转到指定题目
  goToQuestion(e) {
    const { index } = e.currentTarget.dataset
    this.setData({
      currentQuestionIndex: parseInt(index),
      showExplanation: false
    })
  },

  // 切换解析显示
  toggleExplanation() {
    this.setData({
      showExplanation: !this.data.showExplanation
    })
  },

  // 提交答案
  async submitAnswers() {
    const { stats } = this.data

    // 检查是否所有题目都已回答
    if (stats.answered < stats.total) {
      wx.showModal({
        title: '提示',
        content: `还有 ${stats.total - stats.answered} 道题目未回答，确定要提交吗？`,
        success: (res) => {
          if (res.confirm) {
            this.processResults()
          }
        }
      })
    } else {
      this.processResults()
    }
  },

  // 处理答题结果
  async processResults() {
    showLoading('正在计算结果...')

    const { questions, userAnswers, timeSpent } = this.data
    let correctCount = 0
    let evidenceHitCount = 0

    // 计算正确答案数和证据命中数
    for (const question of questions) {
      const userAnswer = userAnswers[question.id]
      const isCorrect = userAnswer === question.correct_answer

      if (isCorrect) {
        correctCount++
      }

      // 模拟证据命中率（实际应该根据用户的阅读行为判断）
      if (Math.random() > 0.3) {
        evidenceHitCount++
      }
    }

    const accuracy = ((correctCount / questions.length) * 100).toFixed(1)
    const evidenceHitRate = ((evidenceHitCount / questions.length) * 100).toFixed(1)

    // 完成学习会话并获取详细统计
    const finalStats = {
      evidenceHitRate: parseFloat(evidenceHitRate),
      questionTypes: this.analyzeQuestionTypes(questions, userAnswers),
      studyEfficiency: this.calculateStudyEfficiency(timeSpent, correctCount, questions.length),
      improvementSuggestions: this.generateImprovementSuggestions(accuracy, evidenceHitRate, timeSpent)
    }

    try {
      const sessionResult = await progressTracker.completeSession(finalStats)

      if (sessionResult) {
        // 显示详细完成反馈
        this.showCompletionCelebration(sessionResult)

        this.setData({
          showResult: true,
          sessionResult: sessionResult,
          'stats.correct': correctCount,
          'stats.accuracy': accuracy,
          'stats.evidenceHitRate': evidenceHitRate
        })
      }
      
      // 清除练习进度（练习已完成）
      practiceProgressManager.clearProgress()
    } catch (error) {
      console.error('完成学习会话失败:', error)
      // 降级处理：直接显示结果
      this.setData({
        showResult: true,
        'stats.correct': correctCount,
        'stats.accuracy': accuracy,
        'stats.evidenceHitRate': evidenceHitRate
      })
      
      // 清除练习进度（练习已完成）
      practiceProgressManager.clearProgress()
    }

    hideLoading()
  },

  // 显示完成庆祝动画和反馈
  showCompletionCelebration(sessionResult) {
    const { accuracy } = sessionResult

    // 根据成绩显示不同的庆祝信息
    let celebrationMsg = ''
    let celebrationIcon = ''

    if (accuracy >= 90) {
      celebrationMsg = '🎉 优秀！近乎完美的表现！'
      celebrationIcon = 'success'
    } else if (accuracy >= 80) {
      celebrationMsg = '🌟 很棒！继续保持！'
      celebrationIcon = 'success'
    } else if (accuracy >= 70) {
      celebrationMsg = '👍 不错！还有提升空间！'
      celebrationIcon = 'none'
    } else if (accuracy >= 60) {
      celebrationMsg = '💪 加油！多练习会更好！'
      celebrationIcon = 'none'
    } else {
      celebrationMsg = '📚 继续努力！熟能生巧！'
      celebrationIcon = 'none'
    }

    // 显示即时反馈
    wx.showToast({
      title: celebrationMsg,
      icon: celebrationIcon,
      duration: 2000
    })

    // 显示详细成就弹窗
    setTimeout(() => {
      this.showAchievementModal(sessionResult)
    }, 2000)
  },

  // 显示成就详情弹窗
  showAchievementModal(sessionResult) {
    const { accuracy, totalQuestions, correctAnswers, totalTimeSpent } = sessionResult
    const timeMinutes = Math.floor(totalTimeSpent / 60)
    const timeSeconds = totalTimeSpent % 60

    const achievementBadges = []

    // 根据表现给予徽章
    if (accuracy >= 95) {achievementBadges.push('🏆 完美主义者')}
    if (accuracy >= 90) {achievementBadges.push('⭐ 学霸')}
    if (accuracy >= 80) {achievementBadges.push('📚 好学者')}
    if (totalTimeSpent < 300) {achievementBadges.push('⚡ 神速答题')}
    if (totalTimeSpent > 1800) {achievementBadges.push('🐌 深度思考者')}
    if (correctAnswers === totalQuestions) {achievementBadges.push('🎯 百发百中')}

    const modalContent = `
本次练习统计：
• 正确率：${accuracy}%
• 答对题目：${correctAnswers}/${totalQuestions}
• 用时：${timeMinutes}分${timeSeconds}秒
${achievementBadges.length > 0 ? `\n🏅 获得徽章：\n${achievementBadges.join('\n')}` : ''}
    `.trim()

    wx.showModal({
      title: '🎊 练习完成！',
      content: modalContent,
      showCancel: false,
      confirmText: '查看详情',
      success: () => {
        // 可以跳转到详细分析页面
        console.log('用户查看详细成绩')
      }
    })
  },

  // 分析题目类型表现
  analyzeQuestionTypes(questions, userAnswers) {
    const typeStats = {}

    questions.forEach(question => {
      const type = question.type || 'unknown'
      const userAnswer = userAnswers[question.id]
      const isCorrect = userAnswer === question.correct_answer

      if (!typeStats[type]) {
        typeStats[type] = { total: 0, correct: 0 }
      }

      typeStats[type].total += 1
      if (isCorrect) {
        typeStats[type].correct += 1
      }
    })

    return typeStats
  },

  // 计算学习效率
  calculateStudyEfficiency(timeSpent, correctCount, totalQuestions) {
    const avgTimePerQuestion = timeSpent / totalQuestions
    const accuracy = correctCount / totalQuestions

    // 简化的效率算法：准确率 / 平均答题时间
    const efficiency = accuracy / (avgTimePerQuestion / 60) // 每分钟正确题数

    return {
      avgTimePerQuestion: Math.round(avgTimePerQuestion),
      efficiency: efficiency.toFixed(2)
    }
  },

  // 生成改进建议
  generateImprovementSuggestions(accuracy, evidenceHitRate, timeSpent) {
    const suggestions = []

    if (accuracy < 70) {
      suggestions.push('建议加强基础知识练习')
    }
    if (evidenceHitRate < 60) {
      suggestions.push('注意提高定位证据句的能力')
    }
    if (timeSpent < 180) {
      suggestions.push('可以适当放慢速度，仔细思考')
    }
    if (timeSpent > 900) {
      suggestions.push('可以尝试提高答题速度')
    }

    return suggestions
  },

  // 保存学习记录
  async saveStudyRecord(record) {
    try {
      await studyRecordDB.add(record)
      console.log('✅ 答题记录保存成功')
    } catch (error) {
      console.error('❌ 答题记录保存失败:', error)
      throw error
    }
  },

  // 获取错误类型（简化版本）
  getErrorType(question, userAnswer) {
    if (!userAnswer) {return 'no_answer'}

    // 简化的错误类型判断逻辑
    const errorTypes = ['scope_expansion', 'extreme_words', 'detail_error', 'inference_error', 'attitude_misjudge']
    return errorTypes[Math.floor(Math.random() * errorTypes.length)]
  },

  // 重新开始
  restartPractice() {
    // 重新随机化答案顺序
    const randomizedQuestions = this.data.questions.map(question => {
      const options = [...question.options]
      const correctAnswer = question.correct_answer

      // 打乱选项顺序
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]]
      }

      // 找到正确答案的新位置
      const newCorrectAnswer = options.find(option =>
        option.charAt(0) === correctAnswer
      )?.charAt(0) || correctAnswer

      return {
        ...question,
        options: options,
        correct_answer: newCorrectAnswer
      }
    })

    this.setData({
      currentQuestionIndex: 0,
      userAnswers: {},
      showResult: false,
      showExplanation: false,
      startTime: Date.now(),
      timeSpent: 0,
      formattedTime: '0:00',
      'stats.answered': 0,
      'stats.correct': 0,
      'stats.accuracy': 0,
      questions: randomizedQuestions
    })

    // 重新开始学习会话
    this.startNewSession(this.data.paperId)
  },

  // 随机化当前题目答案顺序
  randomizeCurrentQuestion() {
    const { currentQuestionIndex, questions } = this.data
    const currentQuestion = questions[currentQuestionIndex]

    if (!currentQuestion) {return}

    const options = [...currentQuestion.options]
    const correctAnswer = currentQuestion.correct_answer

    // 打乱选项顺序
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [options[i], options[j]] = [options[j], options[i]]
    }

    // 找到正确答案的新位置
    const newCorrectAnswer = options.find(option =>
      option.charAt(0) === correctAnswer
    )?.charAt(0) || correctAnswer

    // 更新题目
    const updatedQuestions = [...questions]
    updatedQuestions[currentQuestionIndex] = {
      ...currentQuestion,
      options: options,
      correct_answer: newCorrectAnswer
    }

    this.setData({
      questions: updatedQuestions
    })

    wx.showToast({
      title: '已重新排列选项',
      icon: 'none',
      duration: 1000
    })
  },

  // 查看详细结果
  viewDetailedResults() {
    // 跳转到报告页面查看详细分析
    wx.navigateTo({
      url: '/pages/report/report'
    })
  },

  // 返回首页
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/home/home'
        })
      }
    })
  },

  // ==================== AI 提示相关方法 ====================

  /**
   * 触发AI提示（使用ViewModel的getHint方法）
   */
  async triggerAIHint() {
    // 防御性检查：确保ViewModel已初始化
    if (!this.viewModel) {
      console.warn('[Practice] AI提示未触发：ViewModel未初始化')
      return
    }

    // 防御性检查：确保题目已加载
    // 检查ViewModel的state，而不是page的data
    const viewModelState = this.viewModel.getState()
    if (!viewModelState) {
      console.warn('[Practice] AI提示未触发：ViewModel状态为空')
      return
    }

    const hasCurrentQuestion = viewModelState.currentQuestion || 
      (viewModelState.questions && viewModelState.questions.length > 0)
    
    if (!hasCurrentQuestion) {
      console.warn('[Practice] AI提示未触发：题目未加载完成')
      return
    }

    // 调用handleGetHint
    await this.handleGetHint({ detail: {} })
  },

  /**
   * 获取当前题目信息
   */
  getCurrentQuestionInfo() {
    const { practiceType, currentPassage, clozeData, questions, currentQuestionIndex } = this.data

    if (practiceType === 'reading' && currentPassage) {
      return {
        material: currentPassage.content,
        question: questions[currentQuestionIndex]?.stem || '',
        options: questions[currentQuestionIndex]?.options || []
      }
    } else if (practiceType === 'cloze' && clozeData) {
      return {
        material: clozeData.passage,
        question: `填空第 ${currentQuestionIndex + 1} 个空格`,
        options: clozeData.questions[currentQuestionIndex]?.options || []
      }
    }

    return null
  },

  /**
   * 根据题型确定 skill
   */
  getQuestionSkill(questionType) {
    const skillMap = {
      'reading': 'reading.detail',
      'cloze': 'cloze.logic',
      'translation': 'translation.syntax',
      'writing': 'writing.structure'
    }
    return skillMap[questionType] || 'reading.detail'
  },

  /**
   * 提示卡片展开事件
   */
  onHintExpand() {
    console.log('👁️ 用户展开提示')
    // 可以记录用户行为
  },

  /**
   * 提示卡片收起事件
   */
  onHintCollapse() {
    console.log('👁️ 用户收起提示')
    this.setData({ showHint: false })
  },

  /**
   * 用户作答时重置空闲时间
   */
  onUserInteraction() {
    this.setData({
      idleTime: 0,
      attempts: this.data.attempts + 1
    })
  },

  onUnload() {
    // 清理定时器
    // P1-优化2: 移除this.timer清理（与startTimer已删除）
    if (this.idleTimer) {
      clearInterval(this.idleTimer)
    }

    // 清理 ViewModel
    if (this.viewModel) {
      if (typeof this.viewModel.destroy === 'function') {
        this.viewModel.destroy()
      }
      if (this.unsubscribe) {
        this.unsubscribe()
      }
    }

    // ✅ 输出性能报告（供性能基线测试使用）
    try {
      const unloadTime = Date.now()
      const totalTime = unloadTime - this.__loadStartTime
      const app = getApp()
      
      if (app.globalData && app.globalData.performanceMetrics && app.globalData.performanceMetrics.practice) {
        const metrics = app.globalData.performanceMetrics.practice
        metrics.unloadTime = unloadTime
        metrics.totalTime = totalTime
        
        console.log('[Performance] Practice 页面性能报告:', {
          loadTime: metrics.loadTime,
          totalTime: totalTime,
          timestamp: metrics.timestamp
        })
        
        // 持久化报告到本地存储（供性能基线测试使用）
        wx.setStorageSync('perf_report_practice_' + Date.now(), JSON.stringify(metrics))
      }
    } catch (error) {
      console.error('⚠️ [Performance] 性能报告生成失败:', error)
    }
  },

  // 检查主题设置
  async checkThemeSetup() {
    // 检查是否已经设置过主题
    const hasSeenThemeSetup = await this.viewModel.checkHasSeenThemeSetup()

    if (!hasSeenThemeSetup) {
      // 获取系统主题
      const systemTheme = themeUtils.getSystemTheme()

      // 延迟显示，让页面先加载完成
      setTimeout(() => {
        this.setData({
          showThemeSetup: true,
          systemTheme
        })
      }, 1000)
    }
  },

  // 主题设置确认
  async onThemeSetupConfirm(e) {
    const { theme, followSystem } = e.detail

    // 根据用户选择设置主题
    if (followSystem) {
      themeUtils.setFollowSystem(true)
    } else {
      themeUtils.setUserTheme(theme)
    }

    // 标记首次设置已完成
    themeUtils.markFirstTimeSetupComplete()
    await this.viewModel.markHasSeenThemeSetup()

    // 关闭弹窗
    this.setData({
      showThemeSetup: false
    })

    console.log('✅ 主题设置完成:', { theme, followSystem })
  },

  // 关闭主题设置
  async onThemeSetupClose() {
    // 标记已查看
    await this.viewModel.markHasSeenThemeSetup()

    this.setData({
      showThemeSetup: false
    })
  },

  /**
   * 新架构初始化
   * @private
   */
  _initNewArchitecture() {
    try {
      console.log('🚀 Practice页面：初始化新架构...')

      // 创建DI容器
      this.container = createPracticeContainer('wechat')

      // 创建ViewModel
      this.viewModel = this.container.resolve('practiceViewModel')

      // 订阅状态变化（优化：合并setData调用，减少渲染次数）
      let pendingUpdate = null
      this.unsubscribe = this.viewModel.subscribe((state) => {
        // 使用nextTick合并多次状态更新为一次setData
        if (pendingUpdate) {
          clearTimeout(pendingUpdate)
        }
        
        pendingUpdate = setTimeout(() => {
          // 合并所有状态更新为一次setData调用
          this.setData({
            // 会话状态
            session: state.session,
            sessionId: state.sessionId,

            // 试卷和题目
            paper: state.paper,
            questions: state.questions,
            passages: state.passages,
            currentQuestionIndex: state.currentQuestionIndex,
            currentQuestion: state.currentQuestion,

            // 用户答案
            userAnswers: state.userAnswers,

            // UI状态
            isLoading: state.isLoading,
            showResult: state.showResult,
            showExplanation: state.showExplanation,
            practiceMode: state.practiceMode,

            // 计时器
            startTime: state.startTime,
            timeSpent: state.timeSpent,
            formattedTime: state.formattedTime,

            // 统计
            stats: state.stats,

            // 错误
            viewModelError: state.error
          })
          pendingUpdate = null
        }, 16) // 约60fps，16ms一帧
      })

      console.log('✅ Practice页面：新架构初始化完成')

    } catch (error) {
      console.error('❌ Practice页面：新架构初始化失败', error)
      this.setData({
        viewModelError: error.message,
        isNewArchitecture: false
      })
      // 如果新架构初始化失败，抛出错误（不再回退到旧架构）
      console.error('❌ 新架构初始化失败，无法继续')
      throw error
    }
  },

  // ✅ _initLegacyArchitecture 已删除 - 旧架构已完全移除

  /**
   * 新架构：开始练习会话
   * @param {string} paperId - 试卷ID
   * @param {Object} config - 配置选项
   */
  async startNewArchitectureSession(paperId, config = {}) {
    if (!this.viewModel) {
      throw new Error('ViewModel未初始化')
    }

    try {
      showLoading('正在加载试卷...')
      const result = await this.viewModel.startSession(paperId, config)

      if (result.success) {
        console.log('✅ 新架构会话开始成功:', result.sessionId)
        return result
      } else {
        throw new Error(result.error || '开始会话失败')
      }
    } catch (error) {
      console.error('❌ 新架构开始会话失败:', error)
      throw error
    } finally {
      hideLoading()
    }
  },

  /**
   * 新架构：提交答案
   * @param {any} answer - 用户答案
   */
  async submitNewArchitectureAnswer(answer) {
    if (!this.viewModel) {
      throw new Error('ViewModel未初始化')
    }

    try {
      const result = await this.viewModel.submitAnswer(answer)

      if (result.success) {
        console.log('✅ 新架构答案提交成功')

        if (!result.hasNext) {
          // 会话结束，显示结果
          wx.showToast({
            title: '练习完成',
            icon: 'success',
            duration: 2000
          })

          // 延迟跳转到报告页面
          setTimeout(() => {
            wx.navigateTo({
              url: '/pages/report/report'
            })
          }, 2000)
        }

        return result
      } else {
        throw new Error(result.error || '提交答案失败')
      }
    } catch (error) {
      console.error('❌ 新架构提交答案失败:', error)
      wx.showToast({
        title: error.message || '提交失败',
        icon: 'none'
      })
      throw error
    }
  },

  /**
   * 新架构：完成会话
   */
  async finishNewArchitectureSession() {
    if (!this.viewModel) {
      throw new Error('ViewModel未初始化')
    }

    try {
      showLoading('正在完成练习...')
      const result = await this.viewModel.finishSession()

      if (result.success) {
        console.log('✅ 新架构会话完成成功')
        return result
      } else {
        throw new Error(result.error || '完成会话失败')
      }
    } catch (error) {
      console.error('❌ 新架构完成会话失败:', error)
      throw error
    } finally {
      hideLoading()
    }
  },

  /**
   * 新架构：获取统计信息
   */
  async getNewArchitectureStatistics() {
    if (!this.viewModel) {
      throw new Error('ViewModel未初始化')
    }

    try {
      const result = await this.viewModel.getStatistics()
      return result
    } catch (error) {
      console.error('❌ 新架构获取统计失败:', error)
      throw error
    }
  },

  /**
   * 新架构：处理写作提交（调用AI批改）
   * @param {Object} event - 组件触发的事件
   * @param {string} event.detail.essay - 作文内容
   * @param {string} event.detail.questionId - 题目ID（可选）
   */
  async handleWritingSubmit(event) {
    if (!this.viewModel) {
      console.error('❌ ViewModel未初始化，无法批改作文')
      wx.showToast({
        title: '系统错误，请重试',
        icon: 'error'
      })
      return
    }

    try {
      const { essay, questionId, charCount } = event.detail || {}
      
      if (!essay) {
        wx.showToast({
          title: '作文内容为空',
          icon: 'error'
        })
        return
      }

      // 获取当前题目ID
      const currentQuestionId = questionId || this.data.currentQuestion?.id || this.data.questions[this.data.currentQuestionIndex]?.id
      
      if (!currentQuestionId) {
        throw new Error('无法获取题目ID')
      }

      wx.showLoading({
        title: 'AI批改中...',
        mask: true
      })

      // 调用ViewModel的gradeEssay方法
      const gradingResult = await this.viewModel.gradeEssay(essay, currentQuestionId, {
        charCount,
        questionType: 'writing'
      })

      wx.hideLoading()

      // Silent Fail: 即使失败也显示降级结果
      if (gradingResult.success || gradingResult.isFallback) {
        // 更新页面数据，传递给writing-question组件
        this.setData({
          writingGradingResult: {
            totalScore: gradingResult.scores?.total || 0,
            contentScore: gradingResult.scores?.content || 0,
            languageScore: gradingResult.scores?.language || 0,
            structureScore: gradingResult.scores?.structure || 0,
            comments: gradingResult.detailedComments || '',
            strengths: gradingResult.feedback?.strengths || [],
            suggestions: gradingResult.suggestions || [],
            isFallback: gradingResult.isFallback || false,
            timestamp: Date.now() // 添加时间戳，确保组件能检测到变化
          }
        })

        // 根据结果类型显示不同提示
        if (gradingResult.success) {
          wx.showToast({
            title: '批改完成！',
            icon: 'success'
          })
        } else {
          // 降级模式提示
          console.warn('[Practice] AI批改降级:', gradingResult.error)
          wx.showToast({
            title: 'AI暂不可用，已提供基础反馈',
            icon: 'none',
            duration: 2000
          })
        }
      } else {
        // 完全失败（无降级数据）
        console.warn('[Practice] AI批改失败:', gradingResult.error)
        wx.showToast({
          title: '批改服务暂时不可用',
          icon: 'none',
          duration: 2000
        })
      }

    } catch (error) {
      // 仅处理意外异常
      console.error('[Practice] 批改作文异常:', error)
      wx.hideLoading()
      wx.showToast({
        title: '批改功能暂时不可用',
        icon: 'none',
        duration: 2000
      })
    }
  },

  /**
   * 新架构：获取AI提示
   * @param {Object} event - 组件触发的事件
   * @param {string} event.detail.questionId - 题目ID（可选）
   */
  async handleGetHint(event) {
    if (!this.viewModel) {
      console.error('❌ ViewModel未初始化，无法获取提示')
      return
    }

    try {
      const { questionId } = event.detail || {}
      
      // 获取当前题目ID
      const currentQuestionId = questionId || this.data.currentQuestion?.id || this.data.questions[this.data.currentQuestionIndex]?.id
      
      if (!currentQuestionId) {
        throw new Error('无法获取题目ID')
      }

      wx.showLoading({
        title: '获取提示中...',
        mask: true
      })

      // 调用ViewModel的getHint方法
      const hintResult = await this.viewModel.getHint(currentQuestionId, {
        questionType: this.data.practiceType
      })

      wx.hideLoading()

      if (hintResult.success) {
        // 更新页面状态，显示提示
        this.setData({
          showHint: true,
          hintMessage: hintResult.hint
        })
      } else {
        // Silent Fail: 显示友好错误，不抛出异常
        console.warn('⚠️ 获取提示失败:', hintResult.error)
        wx.showToast({
          title: hintResult.hint || '提示暂时不可用',
          icon: 'none',
          duration: 2000
        })
      }

    } catch (error) {
      // 仅处理意外错误
      console.error('❌ 获取提示异常:', error)
      wx.hideLoading()
      wx.showToast({
        title: '提示功能暂时不可用',
        icon: 'none',
        duration: 2000
      })
    }
  }
})
