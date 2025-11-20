// pages/wrong-questions/wrong-questions.js
const { wrongQuestionCollector } = require('../../utils/wrong-questions.js')
const { showError, showLoading, hideLoading } = require('../../utils/util.js')

Page({
  data: {
    // ⭐ Tab切换
    activeTab: 'all', // all, unreviewed, reviewed, weak

    // 统计数据
    stats: {
      total: 0,
      unreviewed: 0,
      reviewed: 0
    },

    // ⭐ 错题数据
    allQuestions: [], // 所有错题
    filteredQuestions: [], // 当前Tab筛选后的错题

    // 薄弱点
    weakPoints: [],

    // 训练计划
    trainingPlans: [],

    // 加载状态
    isLoading: true
  },

  onLoad(_options) {
    this.loadData()
  },

  onShow() {
    // 每次显示页面时刷新数据
    this.loadData()
  },

  /**
   * ⭐ Tab切换
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })
    this.filterQuestions()
  },

  /**
   * ⭐ 筛选错题
   */
  filterQuestions() {
    const { allQuestions, activeTab } = this.data

    let filteredQuestions = allQuestions
    if (activeTab === 'unreviewed') {
      filteredQuestions = allQuestions.filter(q => !q.reviewed)
    } else if (activeTab === 'reviewed') {
      filteredQuestions = allQuestions.filter(q => q.reviewed)
    } else if (activeTab === 'weak') {
      // 薄弱点Tab不显示错题列表
      filteredQuestions = []
    }

    this.setData({ filteredQuestions })
  },

  /**
   * 加载所有数据
   */
  async loadData() {
    showLoading('加载中...')

    try {
      // ⭐ 先尝试加载真实数据，失败则使用假数据
      let questions = []
      try {
        questions = await wrongQuestionCollector.getWrongQuestions()
      } catch (e) {
        console.log('使用假数据')
        questions = this.getMockData()
      }

      // 如果没有数据，使用假数据
      if (questions.length === 0) {
        questions = this.getMockData()
      }

      // ⭐ 格式化错题数据
      const formattedQuestions = questions.map(q => ({
        ...q,
        date: this.formatDate(q.created_date || q.createdAt),
        typeName: this.getTypeName(q.module_type || q.questionType),
        content: q.question_content || q.content || '暂无内容'
      }))

      // 计算统计数据
      const stats = this.calculateStats(formattedQuestions)

      // 识别薄弱点
      const weakPoints = this.identifyWeakPoints(formattedQuestions)

      // 生成训练计划
      const trainingPlans = this.generateTrainingPlans(weakPoints)

      this.setData({
        allQuestions: formattedQuestions,
        stats,
        weakPoints,
        trainingPlans,
        isLoading: false
      })

      // ⭐ 根据当前Tab筛选错题
      this.filterQuestions()

      hideLoading()
    } catch (error) {
      console.error('加载数据失败:', error)
      showError('加载失败，请重试')
      this.setData({ isLoading: false })
      hideLoading()
    }
  },

  /**
   * ⭐ 获取假数据（用于演示）
   */
  getMockData() {
    const now = new Date()
    return [
      // 阅读理解 - 5题（薄弱点1）
      {
        id: '1',
        module_type: 'reading',
        question_content: 'According to the passage, the main reason for climate change is ____.',
        created_date: new Date(now - 1 * 24 * 3600 * 1000).toISOString(),
        reviewed: false
      },
      {
        id: '3',
        module_type: 'reading',
        question_content: 'What can be inferred about the author\'s attitude towards technology?',
        created_date: new Date(now - 3 * 24 * 3600 * 1000).toISOString(),
        reviewed: false
      },
      {
        id: '6',
        module_type: 'reading',
        question_content: 'The passage suggests that sustainable development requires ____.',
        created_date: new Date(now - 6 * 24 * 3600 * 1000).toISOString(),
        reviewed: false
      },
      {
        id: '10',
        module_type: 'reading',
        question_content: 'Which of the following is NOT mentioned as a factor contributing to economic inequality?',
        created_date: new Date(now - 10 * 24 * 3600 * 1000).toISOString(),
        reviewed: true
      },
      {
        id: '12',
        module_type: 'reading',
        question_content: 'The author mentions historical examples primarily to ____.',
        created_date: new Date(now - 12 * 24 * 3600 * 1000).toISOString(),
        reviewed: true
      },
      // 完形填空 - 4题（薄弱点2）
      {
        id: '4',
        module_type: 'cloze',
        question_content: 'The research team discovered that the new material has ____ properties that make it ideal for solar panels.',
        created_date: new Date(now - 4 * 24 * 3600 * 1000).toISOString(),
        reviewed: false
      },
      {
        id: '11',
        module_type: 'cloze',
        question_content: 'Despite numerous challenges, the expedition team ____ to reach the summit.',
        created_date: new Date(now - 11 * 24 * 3600 * 1000).toISOString(),
        reviewed: false
      },
      {
        id: '13',
        module_type: 'cloze',
        question_content: 'The new policy is expected to have a ____ impact on the economy.',
        created_date: new Date(now - 13 * 24 * 3600 * 1000).toISOString(),
        reviewed: false
      },
      {
        id: '14',
        module_type: 'cloze',
        question_content: 'Scientists have ____ a breakthrough in renewable energy research.',
        created_date: new Date(now - 14 * 24 * 3600 * 1000).toISOString(),
        reviewed: true
      },
      // 单词 - 3题（薄弱点3）
      {
        id: '2',
        module_type: 'vocab',
        question_content: 'The word "substantial" in the context means ____.',
        created_date: new Date(now - 2 * 24 * 3600 * 1000).toISOString(),
        reviewed: true
      },
      {
        id: '9',
        module_type: 'vocab',
        question_content: 'The company\'s innovative approach has led to ____ growth in the market.',
        created_date: new Date(now - 9 * 24 * 3600 * 1000).toISOString(),
        reviewed: false
      },
      {
        id: '15',
        module_type: 'vocab',
        question_content: 'The word "elaborate" in this passage most nearly means ____.',
        created_date: new Date(now - 15 * 24 * 3600 * 1000).toISOString(),
        reviewed: false
      },
      // 翻译 - 2题
      {
        id: '5',
        module_type: 'translation',
        question_content: '随着科技的发展，人工智能在医疗领域的应用越来越广泛。',
        created_date: new Date(now - 5 * 24 * 3600 * 1000).toISOString(),
        reviewed: true
      },
      {
        id: '16',
        module_type: 'translation',
        question_content: '教育公平是社会进步的重要标志，也是实现可持续发展的关键。',
        created_date: new Date(now - 16 * 24 * 3600 * 1000).toISOString(),
        reviewed: false
      },
      // 长难句 - 1题
      {
        id: '7',
        module_type: 'sentence',
        question_content: 'It is not the tools a scientist uses but how he uses them that makes him a scientist.',
        created_date: new Date(now - 7 * 24 * 3600 * 1000).toISOString(),
        reviewed: true
      },
      // 写作 - 1题
      {
        id: '8',
        module_type: 'writing',
        question_content: 'Some people believe that universities should focus on practical skills, while others think theoretical knowledge is more important. Discuss both views.',
        created_date: new Date(now - 8 * 24 * 3600 * 1000).toISOString(),
        reviewed: false
      }
    ]
  },

  /**
   * ⭐ 格式化日期
   */
  formatDate(dateStr) {
    if (!dateStr) {return '未知时间'}
    const date = new Date(dateStr)
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}月${day}日`
  },

  /**
   * ⭐ 获取题型名称
   */
  getTypeName(type) {
    const typeMap = {
      'vocab': '单词',
      'reading': '阅读理解',
      'reading_a': '阅读理解',
      'sentence': '长难句',
      'translation': '翻译',
      'writing': '写作',
      'cloze': '完形填空'
    }
    return typeMap[type] || '其他'
  },

  /**
   * 计算统计数据
   */
  calculateStats(questions) {
    const total = questions.length
    const unreviewed = questions.filter(q => !q.reviewed).length
    const reviewed = total - unreviewed

    return {
      total,
      unreviewed,
      reviewed
    }
  },

  /**
   * 识别薄弱点
   */
  identifyWeakPoints(questions) {
    // 按类型统计
    const typeMap = {
      'vocab': { name: '单词', count: 0, type: 'vocab' },
      'reading': { name: '阅读理解', count: 0, type: 'reading' },
      'reading_a': { name: '阅读理解', count: 0, type: 'reading' },
      'sentence': { name: '长难句', count: 0, type: 'sentence' },
      'translation': { name: '翻译', count: 0, type: 'translation' },
      'writing': { name: '写作', count: 0, type: 'writing' }
    }

    questions.forEach(q => {
      const type = q.questionType || q.module_type
      if (typeMap[type]) {
        typeMap[type].count++
      }
    })

    // 合并阅读理解
    if (typeMap['reading_a']) {
      typeMap['reading'].count += typeMap['reading_a'].count
      delete typeMap['reading_a']
    }

    // 转换为数组并排序
    const weakPoints = Object.values(typeMap)
      .filter(item => item.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 3) // 取前3个
      .map(item => ({
        type: item.type,
        typeName: item.name,
        count: item.count,
        percentage: Math.round((item.count / questions.length) * 100)
      }))

    return weakPoints
  },

  /**
   * 生成训练计划
   */
  generateTrainingPlans(weakPoints) {
    return weakPoints.map(weak => {
      const exercises = Math.min(weak.count * 2, 20)
      const duration = Math.ceil(exercises * 1.5) // 每题约1.5分钟

      return {
        type: weak.type,
        typeName: weak.typeName,
        title: `${weak.typeName}专项突破`,
        description: `针对${weak.count}个错题进行强化训练`,
        duration: `${duration}分钟`,
        difficulty: weak.count > 5 ? '重点' : '一般',
        exercises: exercises
      }
    })
  },

  /**
   * 跳转到所有错题
   */
  /**
   * ⭐ 点击错题卡片 - 跳转到详情
   */
  goToQuestionDetail(e) {
    const { id } = e.currentTarget.dataset
    // TODO: 跳转到错题详情页面
    console.log('查看错题详情:', id)
    wx.showToast({
      title: '错题详情开发中',
      icon: 'none'
    })
  },

  /**
   * 跳转到薄弱点详情（保留）
   */
  goToWeakPoints() {
    wx.navigateTo({
      url: '/pages/weak-points-detail/weak-points-detail'
    })
  },

  /**
   * 跳转到题库页面
   */
  goToQuizBank() {
    wx.switchTab({
      url: '/pages/quiz-bank/quiz-bank'
    })
  },

  /**
   * 开始训练
   */
  startTraining(e) {
    const { type } = e.currentTarget.dataset

    if (!type) {
      showError('训练类型缺失')
      return
    }

    // 根据类型跳转到相应的练习页面
    let url = ''
    let typeName = ''

    switch(type) {
    case 'vocab':
      url = '/pages/vocabulary/vocabulary'
      typeName = '单词'
      break
    case 'reading':
      url = '/pages/practice/practice?type=reading&typeName=阅读理解'
      typeName = '阅读理解'
      break
    case 'sentence':
      url = '/pages/practice/practice?type=sentence&typeName=长难句分析'
      typeName = '长难句'
      break
    case 'translation':
      url = '/pages/practice/practice?type=translation&typeName=翻译练习'
      typeName = '翻译'
      break
    case 'writing':
      url = '/pages/practice/practice?type=writing&typeName=写作练习'
      typeName = '写作'
      break
    default:
      showError('暂不支持该题型')
      return
    }

    wx.showModal({
      title: '开始训练',
      content: `准备开始${typeName}专项训练，是否继续？`,
      confirmText: '开始',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({
            url: url
          })
        }
      }
    })
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadData().then(() => {
      wx.stopPullDownRefresh()
    })
  }
})
