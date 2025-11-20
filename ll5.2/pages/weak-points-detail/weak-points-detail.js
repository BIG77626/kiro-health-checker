// pages/weak-points-detail/weak-points-detail.js
const { wrongQuestionCollector } = require('../../utils/wrong-questions.js')

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
   * 加载错题数据（Issue #7: 从云数据库获取用户弱点详细数据）
   * 
   * 失败场景（5个）:
   * 1. storage不可用 → Silent fail，使用空数组
   * 2. 数据不存在 → 显示空状态
   * 3. 数据格式错误 → 数据验证+降级
   * 4. 计算失败 → Silent fail，显示空薄弱点
   * 5. 重复调用 → 状态检查
   * 
   * Skills: development-discipline v5.2 (Iron Law 5: 失败场景优先)
   */
  async loadWrongQuestions() {
    try {
      // 场景5: 防御性检查 - 避免重复加载
      if (this.data.isLoading && this.data.wrongQuestions.length > 0) {
        console.log('[WeakPoints] 数据正在加载中，跳过重复调用')
        return
      }

      this.setData({ isLoading: true })

      console.log('[WeakPoints] 开始加载错题数据')

      // 场景1 & 2 & 3: 从storage获取真实错题数据（Silent fail）
      let wrongQuestions = []
      try {
        const allWrongQuestions = wrongQuestionCollector.getWrongQuestions()
        
        // 场景3: 数据验证
        if (Array.isArray(allWrongQuestions)) {
          // 转换为页面所需格式
          wrongQuestions = allWrongQuestions.map(q => ({
            id: q.questionId,
            module_type: this._mapQuestionType(q.questionType),
            question_content: q.questionContent || '题目内容',
            user_answer: q.userAnswer,
            correct_answer: q.correctAnswer,
            reviewed: q.reviewed || false,
            date: this._formatDate(q.lastWrongTime || q.firstWrongTime)
          }))
          
          console.log('[WeakPoints] 成功加载错题数据:', wrongQuestions.length)
        } else {
          // 场景3: 数据格式错误
          console.warn('[WeakPoints] 数据格式错误，使用空数组')
        }
      } catch (error) {
        // 场景1: Silent fail - storage读取失败
        console.error('[WeakPoints] 获取错题数据失败（Silent Fail）', error)
      }

      // 场景2: 数据不存在 - 显示空状态
      if (wrongQuestions.length === 0) {
        console.log('[WeakPoints] 暂无错题数据')
      }

      // 更新页面数据
      this.setData({
        wrongQuestions: wrongQuestions
      }, () => {
        // 场景4: 计算薄弱点（带异常处理）
        this.calculateWeakPoints()
      })

    } catch (error) {
      // Silent fail: 不阻塞页面显示
      console.error('[WeakPoints] 加载数据异常（Silent Fail）', error)
      this.setData({
        wrongQuestions: [],
        isLoading: false
      })
    }
  },

  /**
   * 映射题目类型到模块类型（私有方法）
   * @private
   */
  _mapQuestionType(questionType) {
    const typeMapping = {
      'vocabulary': '单词',
      'vocab': '单词',
      'reading': '阅读理解',
      'sentence': '长难句',
      'translation': '翻译',
      'writing': '写作',
      'cloze': '完形填空'
    }
    
    return typeMapping[questionType] || questionType || '其他'
  },

  /**
   * 格式化日期（私有方法）
   * @private
   */
  _formatDate(isoString) {
    if (!isoString) return '未知日期'
    
    try {
      const date = new Date(isoString)
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    } catch (error) {
      console.warn('[WeakPoints] 日期格式化失败', error)
      return '未知日期'
    }
  },

  /**
   * 计算薄弱点（场景4: 带异常处理）
   */
  calculateWeakPoints() {
    try {
      const { wrongQuestions } = this.data

      // 防御性检查
      if (!Array.isArray(wrongQuestions)) {
        console.warn('[WeakPoints] wrongQuestions不是数组')
        this.setData({
          weakPoints: [],
          isLoading: false
        })
        return
      }

      // 按类型统计
      const typeStats = {}
      const typeMapping = {
        '单词': 'vocab',
        '阅读理解': 'reading',
        '长难句': 'sentence',
        '翻译': 'translation',
        '写作': 'writing',
        '完形填空': 'cloze',
        '其他': 'vocab'
      }

      wrongQuestions.forEach(question => {
        const type = question.module_type || '其他'
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

      console.log('[WeakPoints] 薄弱点计算完成:', weakPoints.length)

      this.setData({
        weakPoints: weakPoints,
        isLoading: false
      })

    } catch (error) {
      // 场景4: Silent fail - 计算失败不阻塞页面
      console.error('[WeakPoints] 计算薄弱点失败（Silent Fail）', error)
      this.setData({
        weakPoints: [],
        isLoading: false
      })
    }
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

