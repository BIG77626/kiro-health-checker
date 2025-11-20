// pages/weak-points-detail/weak-points-detail.js
Page({
  data: {
    isLoading: true,
    wrongQuestions: [],
    weakPoints: [],
    typeColors: {
      'vocab': {
        gradient: 'from-orange-500 to-amber-500',
        bg: 'bg-orange-500',
        light: 'bg-orange-50',
        text: 'text-orange-700',
        border: 'border-orange-200'
      },
      'reading': {
        gradient: 'from-blue-500 to-cyan-500',
        bg: 'bg-blue-500',
        light: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200'
      },
      'sentence': {
        gradient: 'from-purple-500 to-indigo-500',
        bg: 'bg-purple-500',
        light: 'bg-purple-50',
        text: 'text-purple-700',
        border: 'border-purple-200'
      },
      'translation': {
        gradient: 'from-green-500 to-emerald-500',
        bg: 'bg-green-500',
        light: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200'
      },
      'writing': {
        gradient: 'from-pink-500 to-rose-500',
        bg: 'bg-pink-500',
        light: 'bg-pink-50',
        text: 'text-pink-700',
        border: 'border-pink-200'
      }
    }
  },

  onLoad(_options) {
    console.log('薄弱点详情页加载')
    this.loadWrongQuestions()
  },

  /**
   * 加载错题数据
   */
  loadWrongQuestions() {
    this.setData({ isLoading: true })

    // TODO: 替换为实际的API调用
    // 示例数据
    setTimeout(() => {
      const mockData = [
        {
          id: 1,
          module_type: '阅读理解',
          question_content: '示例阅读理解题目...',
          user_answer: 'A',
          correct_answer: 'B',
          reviewed: false,
          date: '2024-01-15'
        },
        {
          id: 2,
          module_type: '阅读理解',
          question_content: '另一个阅读理解题目...',
          user_answer: 'C',
          correct_answer: 'D',
          reviewed: false,
          date: '2024-01-14'
        },
        {
          id: 3,
          module_type: '长难句',
          question_content: '示例长难句题目...',
          user_answer: 'B',
          correct_answer: 'A',
          reviewed: true,
          date: '2024-01-13'
        },
        {
          id: 4,
          module_type: '长难句',
          question_content: '另一个长难句题目...',
          user_answer: 'D',
          correct_answer: 'C',
          reviewed: false,
          date: '2024-01-12'
        },
        {
          id: 5,
          module_type: '单词',
          question_content: '示例单词题目...',
          user_answer: 'A',
          correct_answer: 'B',
          reviewed: false,
          date: '2024-01-11'
        },
        {
          id: 6,
          module_type: '翻译',
          question_content: '示例翻译题目...',
          user_answer: 'C',
          correct_answer: 'A',
          reviewed: true,
          date: '2024-01-10'
        },
        {
          id: 7,
          module_type: '写作',
          question_content: '示例写作题目...',
          user_answer: 'B',
          correct_answer: 'D',
          reviewed: false,
          date: '2024-01-09'
        }
      ]

      this.setData({
        wrongQuestions: mockData
      }, () => {
        this.calculateWeakPoints()
      })
    }, 800)
  },

  /**
   * 计算薄弱点
   */
  calculateWeakPoints() {
    const { wrongQuestions } = this.data

    // 按类型统计
    const typeStats = {}
    const typeMapping = {
      '单词': 'vocab',
      '阅读理解': 'reading',
      '长难句': 'sentence',
      '翻译': 'translation',
      '写作': 'writing'
    }

    wrongQuestions.forEach(question => {
      const type = question.module_type
      if (!typeStats[type]) {
        typeStats[type] = {
          count: 0,
          unreviewedCount: 0
        }
      }
      typeStats[type].count++
      if (!question.reviewed) {
        typeStats[type].unreviewedCount++
      }
    })

    const totalCount = wrongQuestions.length

    // 转换为薄弱点数组并排序
    const weakPoints = Object.entries(typeStats)
      .map(([type, stats]) => {
        const percentage = totalCount > 0 ? Math.round((stats.count / totalCount) * 100) : 0
        let severity = 'mild'
        let severityText = '轻微'

        if (percentage > 30) {
          severity = 'severe'
          severityText = '严重'
        } else if (percentage > 15) {
          severity = 'moderate'
          severityText = '中等'
        }

        return {
          typeName: type,
          type: typeMapping[type] || 'vocab',
          count: stats.count,
          unreviewedCount: stats.unreviewedCount,
          percentage: percentage,
          severity: severity,
          severityText: severityText
        }
      })
      .sort((a, b) => b.count - a.count)

    console.log('薄弱点数据:', weakPoints)

    this.setData({
      weakPoints: weakPoints,
      isLoading: false
    })
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack()
  },

  /**
   * 开始专项训练
   */
  startTraining(e) {
    const { type } = e.currentTarget.dataset
    console.log('开始训练:', type)

    wx.showToast({
      title: '功能开发中',
      icon: 'none',
      duration: 2000
    })

    // TODO: 跳转到专项训练页面
    // wx.navigateTo({
    //   url: `/pages/training/training?type=${type}`
    // });
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    console.log('下拉刷新')
    this.loadWrongQuestions()
    setTimeout(() => {
      wx.stopPullDownRefresh()
    }, 1000)
  }
})

