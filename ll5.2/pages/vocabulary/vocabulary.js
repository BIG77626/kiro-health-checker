// pages/vocabulary/vocabulary.js - 智能学习流程
// Phase 3.1: 已迁移到 Clean Architecture (2025-11-07)
import learningDataManager from '../../utils/learning-data-manager.js'
import smartLearningPlanner from '../../utils/smart-learning-planner.js'

// Clean Architecture 组件
const { createLearningContainer } = require('../../core/infrastructure/di/learningContainer')
const { createThemeContainer } = require('../../core/infrastructure/di/themeContainer')
const VocabularyViewModel = require('./VocabularyViewModel')

Page({
  __loadStartTime: Date.now(),
  
  // ViewModel 实例（新架构）
  viewModel: null,
  
  data: {
    // 页面状态：loading, learning, completed, already_completed
    pageState: 'loading',
    themeClass: '',

    // 快速设置
    showQuickSetup: false,

    // 学习数据
    dailyGoal: 50,
    learnedCount: 0,
    progress: 0,
    currentWord: null,
    wordsToLearn: [],
    currentIndex: 0,

    // 完成页面数据
    sessionStats: {
      learnedCount: 0,
      timeSpent: 0,
      accuracy: 0
    },
    showTestSuggestion: false,
    testSuggestionMessage: '',

    // 已完成页面数据
    streak: 0,
    todayLearned: 0,
    totalLearned: 0,
    accuracy: 0,

    // AI提示
    showAIHint: false,
    aiHintMessage: '',
    aiHintAction: '',

    // 生词本提示弹窗
    showVocabBookPrompt: false,
    vocabBookWordData: null,
    vocabBookAttempts: 0,
    vocabBookHardCount: 0,

    // 最小化生词本提示（右下角）
    showMiniVocabToast: false,

    // 行为监控
    hesitationTimer: null,
    errorCount: 0
  },

  onLoad() {
    console.log('📖 [词汇学习] 页面加载')
    
    // Phase 3.1: 初始化 ViewModel（新架构）
    try {
      const container = createLearningContainer('wechat')
      this.viewModel = new VocabularyViewModel({
        startLearningSessionUseCase: container.resolve('StartLearningSessionUseCase'),
        recordReviewResultUseCase: container.resolve('RecordReviewResultUseCase')
      })
      console.log('✅ [词汇学习] ViewModel 初始化成功')
    } catch (error) {
      console.error('❌ [词汇学习] ViewModel 初始化失败:', error)
      // 失败不影响旧逻辑运行
    }
    
    this.initializePage()
  },

  onReady() {
    // 性能跟踪
    const app = getApp()
    if (app.globalData && app.globalData.perfTest) {
      const loadTime = Date.now() - this.__loadStartTime
      app.globalData.perfTest.recordPagePerformance('vocabulary', { loadTime })
    }
  },

  onUnload() {
    // 清理定时器
    if (this.data.hesitationTimer) {
      clearTimeout(this.data.hesitationTimer)
    }
  },

  /**
   * 初始化页面
   */
  async initializePage() {
    console.log('🔄 [词汇学习] 开始初始化页面...')
    try {
      // 🏛️ 架构铁律合规: 使用ThemeService获取主题
      console.log('📝 [词汇学习] 步骤1: 创建主题容器...')
      const themeContainer = createThemeContainer('wechat')
      console.log('📝 [词汇学习] 步骤2: 解析主题服务...')
      const themeService = themeContainer.resolve('IThemeService')
      console.log('📝 [词汇学习] 步骤3: 获取当前主题...')
      const currentTheme = await themeService.getCurrentTheme()
      console.log('✅ [词汇学习] 当前主题:', currentTheme)
      this.setData({
        themeClass: currentTheme === 'dark' ? 'theme-dark' : ''
      })

      // 使用智能规划器判断状态
      console.log('📝 [词汇学习] 步骤4: 判断学习状态...')
      const state = smartLearningPlanner.decideLearningState()
      console.log('🔍 [词汇学习] 学习状态:', state)

      // 根据状态执行相应操作
      switch (state.action) {
      case 'show_setup':
        // 首次使用，显示快速设置
        this.setData({
          pageState: 'loading',
          showQuickSetup: true
        })
        break

      case 'resume_learning':
        // 恢复学习
        this.resumeLearning(state.session)
        break

      case 'show_achievement':
        // 显示成就页面
        this.showAchievement(state.stats)
        break

      case 'show_test_suggestion':
        // 显示测试建议
        this.showTestSuggestionPage(state)
        break

      case 'start_learning':
        // 开始新学习
        this.startNewLearning(state)
        break

      default:
        console.error('❌ [词汇学习] 未知状态:', state.action)
        this.setData({ pageState: 'loading' })
      }

    } catch (error) {
      console.error('❌ [词汇学习] 初始化失败:', error)
      console.error('错误详情:', error.message, error.stack)
      
      // 降级方案：显示快速设置，让用户可以开始学习
      this.setData({
        pageState: 'loading',
        showQuickSetup: true
      })
      
      wx.showToast({
        title: '初始化失败，请重试',
        icon: 'none',
        duration: 2000
      })
    }
  },

  /**
   * 快速设置确认
   */
  onSetupConfirm(e) {
    const { dailyGoal, difficultyLevel } = e.detail
    
    // 保存设置
    learningDataManager.saveUserSettings({
      dailyGoal,
      difficultyLevel,
      isFirstTime: false
    })

    console.log('✅ [词汇学习] 设置已保存:', { dailyGoal, difficultyLevel })

    // 关闭设置弹窗
    this.setData({
      showQuickSetup: false
    })

    // 开始学习
    this.startNewLearning({
      state: 'new_day',
      message: '开始学习！'
    })
  },

  /**
   * 跳过设置
   */
  onSetupSkip(e) {
    const { dailyGoal, difficultyLevel } = e.detail
    
    // 保存默认设置
    learningDataManager.saveUserSettings({
      dailyGoal,
      difficultyLevel,
      isFirstTime: false
    })

    this.setData({
      showQuickSetup: false
    })

    this.startNewLearning({
      state: 'new_day',
      message: '开始学习！'
    })
  },

  /**
   * 开始新学习（Clean Architecture）
   */
  async startNewLearning(_state) {
    try {
      if (!this.viewModel) {
        console.error('❌ [词汇学习] ViewModel 未初始化')
        wx.showToast({
          title: '初始化失败，请重启页面',
          icon: 'none'
        })
        return
      }

      // 🏛️ 架构铁律合规: 使用数据管理器获取用户ID
      const userId = learningDataManager.getUserId()
      
      const result = await this.viewModel.startSession(userId)

      if (!result.success) {
        console.error('❌ [词汇学习-新] 获取会话失败:', result.error)
        wx.showToast({
          title: result.error,
          icon: 'none'
        })
        return
      }

      const { session } = result

      if (session.wordsToLearn.length === 0) {
        wx.showToast({
          title: '暂无需要复习的单词',
          icon: 'none'
        })
        return
      }

      // 设置数据（使用新架构返回的数据格式）
      this.setData({
        pageState: 'learning',
        dailyGoal: session.reviewCount, // 使用今日复习数量
        learnedCount: 0,
        progress: 0,
        wordsToLearn: session.wordsToLearn,
        currentIndex: session.currentIndex,
        currentWord: session.currentWord
      })

      // 开始AI监控
      this.startHesitationMonitoring()

      console.log(`✅ [词汇学习] 开始学习，共${session.wordsToLearn.length}个单词`)
      console.log('📊 [词汇学习] 会话数据:', {
        totalCount: session.totalCount,
        reviewCount: session.reviewCount,
        firstWord: session.currentWord?.word
      })

    } catch (error) {
      console.error('❌ [词汇学习] 开始学习失败:', error)
      wx.showToast({
        title: '开始学习失败',
        icon: 'none'
      })
    }
  },

  /**
   * 恢复学习
   */
  resumeLearning(session) {
    const { dailyGoal, learnedWords } = session

    // 获取剩余单词
    const words = smartLearningPlanner.getNextWords(dailyGoal - learnedWords.length)

    this.setData({
      pageState: 'learning',
      dailyGoal,
      learnedCount: learnedWords.length,
      progress: Math.round((learnedWords.length / dailyGoal) * 100),
      wordsToLearn: words,
      currentIndex: 0,
      currentWord: words[0]
    })

    console.log(`✅ [词汇学习] 恢复学习，已学${learnedWords.length}个`)
  },

  /**
   * 标记单词（Clean Architecture + 生词本难度追踪）
   */
  async markWord(e) {
    const { mastery } = e.currentTarget.dataset
    const { currentWord, currentIndex, wordsToLearn, dailyGoal } = this.data

    // 停止AI监控
    this.stopHesitationMonitoring()

    try {
      if (!this.viewModel) {
        console.error('❌ [词汇学习] ViewModel 未初始化')
        // 继续执行，避免卡住用户
      } else {
        // 使用新架构记录复习结果
        const result = await this.viewModel.recordAnswer(currentWord.id, mastery)

        if (!result.success) {
          console.error('❌ [词汇学习] 记录答案失败:', result.error)
        } else {
          console.log('✅ [词汇学习] 答案已记录:', {
            vocabularyId: currentWord.id,
            mastery,
            newInterval: result.vocabulary?.interval,
            nextReviewDate: result.vocabulary?.nextReviewDate
          })
        }
      }

      // 🏛️ 架构铁律合规: 更新单词难度追踪
      const isHard = mastery === 'hard'
      this.updateWordDifficultyTracking(currentWord, isHard)

      // 📖 自动添加到生词本（如果还没添加且未掌握）
      await this.autoAddToVocabBook(currentWord, isHard)

      // 更新进度
      const newLearnedCount = this.data.learnedCount + 1
      const newProgress = Math.round((newLearnedCount / dailyGoal) * 100)

      // 检查是否完成
      if (newLearnedCount >= dailyGoal) {
        this.completeLearning()
        return
      }

      // 下一个单词
      const nextIndex = currentIndex + 1
      if (nextIndex < wordsToLearn.length) {
        this.setData({
          learnedCount: newLearnedCount,
          progress: newProgress,
          currentIndex: nextIndex,
          currentWord: wordsToLearn[nextIndex],
          errorCount: 0
        })

        // 重新开始AI监控
        this.startHesitationMonitoring()
      } else {
        this.completeLearning()
      }

    } catch (error) {
      console.error('❌ [词汇学习] 标记单词异常:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  },

  /**
   * 完成学习
   */
  completeLearning() {
    console.log('🎉 [词汇学习] 完成学习')

    // 停止AI监控
    this.stopHesitationMonitoring()

    // 完成会话
    const completedSession = learningDataManager.completeSession()

    // 计算统计数据
    const easyCount = completedSession.learnedWords.filter(w => w.mastery === 'easy').length
    const accuracy = Math.round((easyCount / completedSession.learnedWords.length) * 100)

    // 检查是否需要测试
    const testStatus = learningDataManager.shouldTriggerTest()

    this.setData({
      pageState: 'completed',
      sessionStats: {
        learnedCount: completedSession.learnedWords.length,
        timeSpent: completedSession.duration,
        accuracy
      },
      showTestSuggestion: testStatus.trigger,
      testSuggestionMessage: testStatus.message || '根据你的学习情况，现在测试效果最好'
    })
  },

  /**
   * 暂停学习
   */
  pauseLearning() {
    learningDataManager.pauseSession()
    
    wx.showModal({
      title: '确定暂停学习？',
      content: '学习进度将会保存，下次可以继续',
      confirmText: '确定暂停',
      cancelText: '继续学习',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack()
        }
      }
    })
  },

  /**
   * 显示成就页面
   */
  showAchievement(stats) {
    const testStatus = learningDataManager.shouldTriggerTest()

    this.setData({
      pageState: 'already_completed',
      streak: stats.streak || 0,
      todayLearned: stats.todayLearned || 0,
      totalLearned: stats.totalLearned || 0,
      accuracy: Math.round(stats.accuracy || 0),
      showTestSuggestion: testStatus.trigger,
      testSuggestionMessage: testStatus.message
    })
  },

  /**
   * 显示测试建议页面
   */
  showTestSuggestionPage(state) {
    const record = learningDataManager.getLearningRecord()

    this.setData({
      pageState: 'already_completed',
      streak: record.streak || 0,
      todayLearned: record.todayLearned || 0,
      totalLearned: record.totalLearned || 0,
      accuracy: Math.round(record.accuracy || 0),
      showTestSuggestion: true,
      testSuggestionMessage: state.message
    })
  },

  /**
   * 开始测试
   */
  startTest() {
    console.log('📝 [词汇学习] 开始测试')
    
    wx.navigateTo({
      url: '/pages/vocab-test/vocab-test?source=recent&count=20&duration=300'
    })
  },

  /**
   * 返回首页
   */
  backToHome() {
    wx.navigateBack()
  },

  // ==================== AI监控功能 ====================

  /**
   * 开始犹豫监控
   */
  startHesitationMonitoring() {
    this.stopHesitationMonitoring()

    const timer = setTimeout(() => {
      this.showAIMessage(
        '遇到困难了吗？如果不确定，可以先标记为"不认识"，之后会有更多机会复习',
        '查看提示',
        null
      )
    }, 15000) // 15秒

    this.setData({ hesitationTimer: timer })
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
   * 显示AI提示
   */
  showAIMessage(message, action, secondaryAction) {
    this.setData({
      showAIHint: true,
      aiHintMessage: message,
      aiHintAction: action || '',
      aiHintSecondaryAction: secondaryAction || ''
    })
  },

  /**
   * 关闭AI提示
   */
  onDismissHint() {
    this.setData({
      showAIHint: false
    })
  },

  /**
   * 接受AI提示
   */
  onAcceptHint() {
    this.setData({
      showAIHint: false
    })
    // 可以添加具体的提示逻辑
  },

  // ==================== 生词本功能 ====================

  /**
   * 更新单词难度追踪
   */
  updateWordDifficultyTracking(wordData, isHard) {
    try {
      // 🏛️ 架构铁律合规: 调用数据管理器更新难度追踪
      const shouldPrompt = learningDataManager.updateWordDifficulty(wordData.id, isHard)

      if (shouldPrompt.shouldPrompt) {
        console.log('📖 [生词本] 触发生词本提示:', shouldPrompt.word.word)

        // 显示生词本提示弹窗
        this.showVocabBookPrompt(shouldPrompt.word, shouldPrompt.attempts, shouldPrompt.hardCount)
      }
    } catch (error) {
      console.error('❌ [词汇学习] 更新单词难度追踪失败:', error)
    }
  },

  /**
   * 显示生词本提示弹窗
   */
  showVocabBookPrompt(wordData, attempts, hardCount) {
    console.log('📖 [生词本] 显示提示弹窗:', wordData.word)

    this.setData({
      showVocabBookPrompt: true,
      vocabBookWordData: wordData,
      vocabBookAttempts: attempts,
      vocabBookHardCount: hardCount
    })
  },

  /**
   * 隐藏生词本提示弹窗
   */
  hideVocabBookPrompt() {
    console.log('📖 [生词本] 隐藏提示弹窗')

    this.setData({
      showVocabBookPrompt: false,
      vocabBookWordData: null,
      vocabBookAttempts: 0,
      vocabBookHardCount: 0
    })
  },

  /**
   * 用户选择加入生词本
   */
  onAddToVocabBook(e) {
    const { wordData, dontShowAgain } = e.detail

    console.log('📖 [生词本] 用户选择加入:', wordData.word)

    try {
      // 🏛️ 架构铁律合规: 调用数据管理器添加单词到生词本
      const success = learningDataManager.addWordToVocabBook(wordData)

      if (success) {
        // 如果用户选择不再提示，更新单词历史
        if (dontShowAgain) {
          this.markWordAsDontPromptAgain(wordData.id)
        }

        wx.showToast({
          title: '已加入生词本',
          icon: 'success',
          duration: 1500
        })
      } else {
        wx.showToast({
          title: '添加失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('❌ [词汇学习] 加入生词本失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }

    // 隐藏弹窗
    this.hideVocabBookPrompt()
  },

  /**
   * 用户选择暂不加入生词本
   */
  onSkipVocabBook(e) {
    const { wordData, dontShowAgain } = e.detail

    console.log('📖 [生词本] 用户选择暂不加入:', wordData.word)

    // 如果用户选择不再提示，更新单词历史
    if (dontShowAgain) {
      this.markWordAsDontPromptAgain(wordData.id)
    }

    // 隐藏弹窗
    this.hideVocabBookPrompt()

    // 显示提示
    if (!dontShowAgain) {
      wx.showToast({
        title: '好的，下次再问',
        icon: 'none',
        duration: 1500
      })
    }
  },

  /**
   * 标记单词为不再提示
   */
  markWordAsDontPromptAgain(wordId) {
    try {
      const history = learningDataManager.getWordHistory()
      const word = history.find(w => w.wordId === wordId)

      if (word) {
        word.userDeclinedPrompt = true
        word.neverPromptAgainDate = new Date().toISOString()
        learningDataManager.saveWordHistory(history)

        console.log('📖 [生词本] 已标记单词不再提示:', wordId)
      }
    } catch (error) {
      console.error('❌ [词汇学习] 标记不再提示失败:', error)
    }
  },

  /**
   * 自动添加到生词本（最小化设计）
   * 规则：点击单词就添加，但已经添加过的或已掌握的不再添加
   */
  async autoAddToVocabBook(wordData, isHard) {
    try {
      // 检查是否已经在生词本中
      if (learningDataManager.isWordInVocabBook(wordData.id)) {
        console.log('📖 [生词本] 单词已在生词本中，跳过:', wordData.word)
        return // 已经在生词本中，不显示任何信息
      }

      // 检查单词是否已经在生词本中且已掌握
      const vocabBook = learningDataManager.getVocabBook()
      const vocabWord = vocabBook.words.find(w => w.wordId === wordData.id)

      // 如果单词已经在生词本中且被标记为掌握，不再重复添加
      if (vocabWord && vocabWord.mastered) {
        console.log('📖 [生词本] 单词已在生词本中且已掌握，跳过:', wordData.word)
        return // 已掌握，不显示任何信息
      }

      // 添加到生词本
      const success = learningDataManager.addWordToVocabBook({
        wordId: wordData.id,
        word: wordData.word,
        meaning: wordData.meaning,
        phonetic: wordData.phonetic,
        hardCount: isHard ? 1 : 0,
        easyCount: isHard ? 0 : 1,
        attempts: 1
      })

      if (success) {
        console.log('📖 [生词本] 自动添加成功:', wordData.word)
        // 显示右下角最小化弹窗
        this.showMiniVocabToast()
      }
    } catch (error) {
      console.error('❌ [词汇学习] 自动添加生词本失败:', error)
    }
  },

  /**
   * 显示右下角最小化生词本提示
   */
  showMiniVocabToast() {
    // 使用自定义弹窗替代wx.showToast，更小的尺寸，右下角位置
    this.setData({
      showMiniVocabToast: true
    })

    // 1.5秒后自动隐藏
    setTimeout(() => {
      this.setData({
        showMiniVocabToast: false
      })
    }, 1500)
  }
})
