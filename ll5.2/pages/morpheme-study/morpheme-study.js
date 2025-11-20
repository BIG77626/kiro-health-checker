// pages/morpheme-study/morpheme-study.js
// 词根学习详情页 - 6阶段学习流程

// 导入模拟数据
const mockMorphemeData = require('../../data/morpheme-data.js')

Page({
  __loadStartTime: Date.now(),
  data: {
    // 当前阶段 (1-6)
    currentStage: 1,
    
    // 阶段列表
    stages: [
      { id: 1, name: '词根理解', status: 'current' },
      { id: 2, name: '词族扩展', status: 'pending' },
      { id: 3, name: '语境阅读', status: 'pending' },
      { id: 4, name: '填空测试', status: 'pending' },
      { id: 5, name: '复述表达', status: 'pending' },
      { id: 6, name: '实战应用', status: 'pending' }
    ],
    
    // 词根数据
    morphemeData: {},
    
    // 阶段1: 倒计时
    countdown: 180, // 3分钟
    countdownDisplay: '03:00',
    countdownTimer: null,
    
    // 阶段3: 文章数据
    article: {},
    readingStartTime: 0,
    readingTime: '00:00',
    readingTimer: null,
    
    // 阶段4: 填空测试
    blanks: [],
    currentBlankIndex: 0,
    testProgressPercent: 0,
    userAnswer: '',
    showHint: false,
    currentHint: '',
    hintLevel: 0,
    
    // 阶段5: 复述表达
    retellingText: '',
    retellingWordCount: 0,
    targetWords: [],
    
    // 阶段6: 实战应用
    scenarios: [],
    
    // AI助手
    showAIHint: false,
    aiHintMessage: '',
    aiHintAction: '',
    
    // 用户行为追踪
    userBehavior: {
      timeSpent: 0,
      errorCount: 0,
      hesitationCount: 0
    }
  },

  onLoad(options) {
    const { morphemeId } = options
    
    // 加载词根数据
    this.loadMorphemeData(morphemeId)
    
    // 开始阶段1的倒计时
    this.startCountdown()
  },

  onReady() {
    // 性能跟踪
    const app = getApp()
    if (app.globalData && app.globalData.perfTest) {
      const loadTime = Date.now() - this.__loadStartTime
      app.globalData.perfTest.recordPagePerformance('morpheme-study', { loadTime })
    }
  },

  /**
   * 加载词根数据
   */
  loadMorphemeData(morphemeId) {
    // TODO: 从云数据库加载真实数据
    // 目前使用模拟数据
    const morphemeData = mockMorphemeData.getMorphemeById(morphemeId)
    
    this.setData({
      morphemeData: morphemeData
    })
  },

  /**
   * 阶段1: 开始倒计时
   */
  startCountdown() {
    this.data.countdownTimer = setInterval(() => {
      const countdown = this.data.countdown - 1
      
      if (countdown <= 0) {
        clearInterval(this.data.countdownTimer)
        this.setData({ 
          countdown: 0,
          countdownDisplay: '00:00'
        })
        // 倒计时结束，自动进入下一阶段
        this.showAIMessage('学习时间到！可以进入下一阶段了。', '下一阶段')
      } else {
        const minutes = Math.floor(countdown / 60)
        const seconds = countdown % 60
        this.setData({
          countdown: countdown,
          countdownDisplay: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
        })
      }
    }, 1000)
  },

  /**
   * 阶段3: 开始阅读计时
   */
  startReadingTimer() {
    this.setData({
      readingStartTime: Date.now()
    })
    
    this.data.readingTimer = setInterval(() => {
      const elapsed = Date.now() - this.data.readingStartTime
      const minutes = Math.floor(elapsed / 60000)
      const seconds = Math.floor((elapsed % 60000) / 1000)
      
      this.setData({
        readingTime: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      })
    }, 1000)
  },

  /**
   * 下一阶段
   */
  onNextStage() {
    const nextStage = this.data.currentStage + 1
    
    if (nextStage > 6) {
      // 已完成所有阶段
      this.onCompleteStudy()
      return
    }
    
    // 更新阶段状态
    this.updateStageStatus(nextStage)
    
    // 执行阶段切换逻辑
    this.handleStageTransition(this.data.currentStage, nextStage)
    
    this.setData({
      currentStage: nextStage
    })
  },

  /**
   * 上一阶段
   */
  onPrevStage() {
    const prevStage = this.data.currentStage - 1
    
    if (prevStage < 1) {
      return
    }
    
    this.updateStageStatus(prevStage)
    this.setData({
      currentStage: prevStage
    })
  },

  /**
   * 跳过阶段
   */
  onSkipStage() {
    wx.showModal({
      title: '确认跳过',
      content: '跳过当前阶段会影响学习效果，确定要跳过吗？',
      success: (res) => {
        if (res.confirm) {
          this.onNextStage()
        }
      }
    })
  },

  /**
   * 更新阶段状态
   */
  updateStageStatus(newStage) {
    const stages = this.data.stages.map((stage, index) => {
      if (index < newStage - 1) {
        return { ...stage, status: 'completed' }
      } else if (index === newStage - 1) {
        return { ...stage, status: 'current' }
      } else {
        return { ...stage, status: 'pending' }
      }
    })
    
    this.setData({ stages })
  },

  /**
   * 处理阶段切换逻辑
   */
  handleStageTransition(fromStage, toStage) {
    // 离开阶段的清理工作
    if (fromStage === 1 && this.data.countdownTimer) {
      clearInterval(this.data.countdownTimer)
    } else if (fromStage === 3 && this.data.readingTimer) {
      clearInterval(this.data.readingTimer)
    }
    
    // 进入新阶段的初始化工作
    if (toStage === 3) {
      // 生成语境文章（这里使用模拟数据）
      this.generateArticle()
      this.startReadingTimer()
    } else if (toStage === 4) {
      // 生成填空题
      this.generateBlanks()
    } else if (toStage === 5) {
      // 初始化复述表达
      this.initRetelling()
    } else if (toStage === 6) {
      // 初始化实战应用
      this.initScenarios()
    }
  },

  /**
   * 阅读完成
   */
  onReadingComplete() {
    clearInterval(this.data.readingTimer)
    
    // 显示阅读总结
    this.showAIMessage(
      `阅读完成！用时 ${this.data.readingTime}。现在进入填空测试阶段，检验你的理解程度。`,
      '开始测试'
    )
    
    setTimeout(() => {
      this.onNextStage()
    }, 2000)
  },

  /**
   * 生成语境文章（模拟）
   */
  generateArticle() {
    // TODO: 调用AI生成文章
    // 目前使用模拟数据
    this.setData({
      article: {
        title: 'The Ancient Roman Construction System',
        content: 'The Romans were masters of construction. Their engineers built impressive infrastructure across the empire, including roads, aqueducts, and public buildings. However, time and wars led to the destruction of many structures. Today, archaeologists study the ruins to understand their construction techniques and the social structure of ancient Rome.'
      }
    })
  },

  /**
   * 生成填空题
   */
  generateBlanks() {
    // 防御性检查：morphemeData可能为null
    if (!this.data.morphemeData) {
      console.warn('[MorphemeStudy] 生成填空题失败：词根数据未加载')
      wx.showToast({
        title: '数据加载中，请稍后',
        icon: 'none'
      })
      return
    }

    // TODO: 智能生成填空题
    // 目前使用模拟数据
    const words = this.data.morphemeData.derivedWords || []
    
    // 检查是否有足够的派生词
    if (words.length === 0) {
      console.warn('[MorphemeStudy] 没有可用的派生词')
      wx.showToast({
        title: '暂无题目数据',
        icon: 'none'
      })
      return
    }

    const blanks = words.slice(0, 3).map(word => ({
      context: 'The Romans built impressive ________.',
      answer: word.word,
      hints: [
        '提示: 这个词和基础设施有关',
        `提示: ${word.prefix || ''} + ${this.data.morphemeData.name} + ${word.suffix || ''}`,
        `提示: ${word.word.slice(0, 5)}...`
      ]
    }))
    
    this.setData({
      blanks: blanks,
      currentBlankIndex: 0,
      testProgressPercent: 0
    })
  },

  /**
   * 用户输入答案
   */
  onAnswerInput(e) {
    this.setData({
      userAnswer: e.detail.value
    })
  },

  /**
   * 请求提示
   */
  onRequestHint() {
    const blank = this.data.blanks[this.data.currentBlankIndex]
    const hintLevel = Math.min(this.data.hintLevel, blank.hints.length - 1)
    
    this.setData({
      showHint: true,
      currentHint: blank.hints[hintLevel],
      hintLevel: hintLevel + 1
    })
  },

  /**
   * 提交答案
   */
  onSubmitAnswer() {
    const blank = this.data.blanks[this.data.currentBlankIndex]
    const isCorrect = this.data.userAnswer.toLowerCase().trim() === blank.answer.toLowerCase()
    
    if (isCorrect) {
      wx.showToast({
        title: '正确！',
        icon: 'success'
      })
      
      // 下一题
      const nextIndex = this.data.currentBlankIndex + 1
      if (nextIndex >= this.data.blanks.length) {
        // 完成所有填空
        setTimeout(() => {
          this.onNextStage()
        }, 1000)
      } else {
        this.setData({
          currentBlankIndex: nextIndex,
          testProgressPercent: Math.round((nextIndex / this.data.blanks.length) * 100),
          userAnswer: '',
          showHint: false,
          hintLevel: 0
        })
      }
    } else {
      wx.showToast({
        title: '再试试',
        icon: 'none'
      })
      
      // 记录错误
      this.data.userBehavior.errorCount++
      
      // 连续错2次，AI主动提示
      if (this.data.userBehavior.errorCount >= 2) {
        this.onRequestHint()
      }
    }
  },

  /**
   * 初始化复述表达
   */
  initRetelling() {
    // 防御性检查：morphemeData可能为null
    if (!this.data.morphemeData) {
      console.warn('[MorphemeStudy] 初始化复述失败：词根数据未加载')
      this.setData({ targetWords: [] })
      return
    }

    const words = this.data.morphemeData.derivedWords || []
    this.setData({
      targetWords: words.slice(0, 3).map(w => ({
        word: w.word,
        used: false
      }))
    })
  },

  /**
   * 复述输入
   */
  onRetellingInput(e) {
    const text = e.detail.value
    const wordCount = text.trim().split(/\s+/).length
    
    // 检查是否使用了目标词汇
    const targetWords = this.data.targetWords.map(item => ({
      ...item,
      used: text.toLowerCase().includes(item.word.toLowerCase())
    }))
    
    this.setData({
      retellingText: text,
      retellingWordCount: wordCount,
      targetWords: targetWords
    })
  },

  /**
   * 提交复述
   */
  onSubmitRetelling() {
    const usedCount = this.data.targetWords.filter(w => w.used).length
    
    if (usedCount < this.data.targetWords.length) {
      wx.showModal({
        title: '提示',
        content: `你还有 ${this.data.targetWords.length - usedCount} 个新词未使用，建议补充后再提交。`,
        confirmText: '继续修改',
        cancelText: '仍要提交',
        success: (res) => {
          if (!res.confirm) {
            this.onNextStage()
          }
        }
      })
    } else {
      // TODO: 调用AI评估
      this.showAIMessage('复述完成！你成功使用了所有新词，表达流畅。', '下一阶段')
      setTimeout(() => {
        this.onNextStage()
      }, 2000)
    }
  },

  /**
   * 初始化实战应用
   */
  initScenarios() {
    this.setData({
      scenarios: [
        {
          id: 1,
          title: '场景1: 描述你的家乡',
          task: '用50词左右，描述你家乡的基础设施建设',
          answer: '',
          wordCount: 0
        },
        {
          id: 2,
          title: '场景2: 历史事件描述',
          task: '描述一个历史建筑的建造和毁坏过程',
          answer: '',
          wordCount: 0
        },
        {
          id: 3,
          title: '场景3: 未来畅想',
          task: '如果你是城市规划师，你会如何设计城市的基础设施？',
          answer: '',
          wordCount: 0
        }
      ]
    })
  },

  /**
   * 场景写作输入
   */
  onScenarioInput(e) {
    const { index } = e.currentTarget.dataset
    const text = e.detail.value
    const wordCount = text.trim().split(/\s+/).length
    
    const scenarios = this.data.scenarios
    scenarios[index].answer = text
    scenarios[index].wordCount = wordCount
    
    this.setData({ scenarios })
  },

  /**
   * 完成学习
   */
  onCompleteStudy() {
    // 防御性检查：morphemeData可能为null
    const morphemeName = this.data.morphemeData?.name || '该词根'
    
    wx.showModal({
      title: '恭喜完成！',
      content: `你已完成 ${morphemeName} 的全部学习。是否继续学习下一个词根？`,
      confirmText: '继续学习',
      cancelText: '返回首页',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack()
        } else {
          wx.switchTab({
            url: '/pages/home/home'
          })
        }
      }
    })
  },

  /**
   * 显示AI消息
   */
  showAIMessage(message, action = '') {
    this.setData({
      showAIHint: true,
      aiHintMessage: message,
      aiHintAction: action
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
   * 接受AI建议
   */
  onAcceptHint() {
    this.setData({
      showAIHint: false
    })
    
    // 执行AI建议的操作
    if (this.data.aiHintAction === '下一阶段') {
      this.onNextStage()
    } else if (this.data.aiHintAction === '开始测试') {
      this.onNextStage()
    }
  },

  onUnload() {
    // 页面卸载时清理定时器
    if (this.data.countdownTimer) {
      clearInterval(this.data.countdownTimer)
    }
    if (this.data.readingTimer) {
      clearInterval(this.data.readingTimer)
    }
  }
})

