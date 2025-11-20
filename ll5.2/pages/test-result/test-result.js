// pages/test-result/test-result.js
const { createThemeContainer } = require('../../core/infrastructure/di/themeContainer')

// 🏛️ 架构铁律合规: 使用DI容器获取服务
const themeContainer = createThemeContainer('wechat')
const themeService = themeContainer.resolve('IThemeService')

Page({
  data: {
    themeClass: '',
    correctCount: 0,
    totalQuestions: 20,
    accuracy: 0,
    timeSpent: 0,
    timeSpentDisplay: '0分0秒',
    scoreLevel: 'good',
    scoreTitle: '成绩不错',
    scoreSubtitle: '继续保持',
    aiEvaluation: '',
    suggestions: []
  },

  async onLoad(options) {
    console.log('📊 [测试成绩] 页面加载', options)

    // 🏛️ 架构铁律合规: 通过服务获取主题
    const theme = await themeService.getCurrentTheme()
    this.setData({ themeClass: theme === 'dark' ? 'theme-dark' : '' })

    // 解析参数
    const correctCount = parseInt(options.correct) || 0
    const totalQuestions = parseInt(options.total) || 20
    const timeSpent = parseInt(options.time) || 0
    const accuracy = parseInt(options.accuracy) || 0

    // 格式化时间
    const minutes = Math.floor(timeSpent / 60)
    const seconds = timeSpent % 60
    const timeSpentDisplay = `${minutes}分${seconds}秒`

    // 计算等级
    const { level, title, subtitle } = this.calculateScoreLevel(accuracy)

    // 生成AI评价
    const aiEvaluation = this.generateAIEvaluation(accuracy, correctCount, totalQuestions, timeSpent)

    // 生成建议
    const suggestions = this.generateSuggestions(accuracy, timeSpent, totalQuestions)

    this.setData({
      correctCount,
      totalQuestions,
      accuracy,
      timeSpent,
      timeSpentDisplay,
      scoreLevel: level,
      scoreTitle: title,
      scoreSubtitle: subtitle,
      aiEvaluation,
      suggestions
    })
  },

  /**
   * 计算成绩等级
   */
  calculateScoreLevel(accuracy) {
    if (accuracy >= 90) {
      return {
        level: 'excellent',
        title: '优秀',
        subtitle: '词汇掌握非常扎实'
      }
    } else if (accuracy >= 80) {
      return {
        level: 'good',
        title: '良好',
        subtitle: '继续保持'
      }
    } else if (accuracy >= 60) {
      return {
        level: 'pass',
        title: '及格',
        subtitle: '还有提升空间'
      }
    } else {
      return {
        level: 'fail',
        title: '需加强',
        subtitle: '建议多复习'
      }
    }
  },

  /**
   * 生成AI评价
   */
  generateAIEvaluation(accuracy, correctCount, totalQuestions, timeSpent) {
    const wrongCount = totalQuestions - correctCount
    const avgTimePerQuestion = Math.round(timeSpent / totalQuestions)

    let evaluation = ''

    if (accuracy >= 90) {
      evaluation = `太棒了！你答对了${correctCount}题，正确率达到${accuracy}%，词汇掌握得非常扎实。`
    } else if (accuracy >= 80) {
      evaluation = `表现不错！答对了${correctCount}题，有${wrongCount}题需要巩固。继续保持学习节奏。`
    } else if (accuracy >= 60) {
      evaluation = `还需努力！答对了${correctCount}题，有${wrongCount}题出现错误。建议重点复习错题。`
    } else {
      evaluation = `本次测试答对${correctCount}题，错误${wrongCount}题。需要加强词汇记忆和复习。`
    }

    if (avgTimePerQuestion < 10) {
      evaluation += '答题速度很快，注意准确性。'
    } else if (avgTimePerQuestion > 20) {
      evaluation += '答题时间较长，建议提升熟练度。'
    } else {
      evaluation += '答题节奏掌握得很好。'
    }

    return evaluation
  },

  /**
   * 生成建议
   */
  generateSuggestions(accuracy, timeSpent, totalQuestions) {
    const suggestions = []
    const avgTimePerQuestion = Math.round(timeSpent / totalQuestions)

    if (accuracy < 80) {
      suggestions.push('重点复习错题，加深对单词释义的理解')
      suggestions.push('尝试使用词根词缀法记忆单词')
    }

    if (accuracy < 60) {
      suggestions.push('降低每日学习量，提升学习质量')
      suggestions.push('增加单词复习频率，利用遗忘曲线')
    }

    if (avgTimePerQuestion > 20) {
      suggestions.push('提升单词识别速度，多进行快速测试')
    }

    if (suggestions.length === 0) {
      suggestions.push('保持当前的学习节奏')
      suggestions.push('可以适当增加每日学习量')
    }

    return suggestions
  },

  /**
   * 查看错题
   */
  reviewWrong() {
    wx.showToast({
      title: '错题本功能开发中',
      icon: 'none'
    })
    // TODO: 跳转到错题详情页
  },

  /**
   * 再测一次
   */
  retakeTest() {
    wx.redirectTo({
      url: '/pages/vocab-test/vocab-test?source=recent&count=20&duration=300'
    })
  },

  /**
   * 返回首页
   */
  backToHome() {
    wx.switchTab({
      url: '/pages/home/home'
    })
  }
})

