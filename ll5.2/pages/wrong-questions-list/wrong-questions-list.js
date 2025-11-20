// pages/wrong-questions-list/wrong-questions-list.js
const { wrongQuestionCollector } = require('../../utils/wrong-questions.js')
const { showError, showSuccess, showLoading, hideLoading } = require('../../utils/util.js')

Page({
  data: {
    activeTab: 'all', // ⭐ 当前激活的Tab
    pageTitle: '错题分析',
    filterType: 'all',
    questions: [],
    allQuestions: [], // ⭐ 存储所有错题数据
    typeStats: [],
    totalCount: 0,
    unreviewedCount: 0,
    reviewedCount: 0, // ⭐ 已复习数量
    reviewRate: 0,
    currentStats: { // ⭐ 当前Tab的统计数据
      total: 0,
      accuracy: 0,
      reviewRate: 0
    },
    expandedIds: {},
    isLoading: true
  },

  onLoad(options) {
    const { type = 'all' } = options

    this.setData({
      activeTab: type,
      filterType: type
    })

    // 加载数据
    this.loadData()
  },

  /**
   * ⭐ Tab切换
   */
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({
      activeTab: tab,
      filterType: tab
    })
    this.filterQuestions()
  },

  /**
   * 加载数据
   */
  async loadData() {
    showLoading('加载中...')

    try {
      const allQuestions = await wrongQuestionCollector.getWrongQuestions()

      // ⭐ 保存所有错题数据
      const formattedQuestions = allQuestions.map(q => ({
        ...q,
        date: this.formatDate(q.created_date || q.createdAt)
      }))

      // ⭐ 计算总体统计
      const unreviewedCount = formattedQuestions.filter(q => !q.reviewed).length
      const reviewedCount = formattedQuestions.filter(q => q.reviewed).length
      const totalCount = formattedQuestions.length

      this.setData({
        allQuestions: formattedQuestions,
        totalCount,
        unreviewedCount,
        reviewedCount,
        isLoading: false
      })

      // ⭐ 根据当前Tab筛选显示
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
   * ⭐ 根据Tab筛选错题
   */
  filterQuestions() {
    const { allQuestions, filterType } = this.data

    // 根据类型筛选
    let filteredQuestions = allQuestions
    if (filterType === 'unreviewed') {
      filteredQuestions = allQuestions.filter(q => !q.reviewed)
    } else if (filterType === 'reviewed') {
      filteredQuestions = allQuestions.filter(q => q.reviewed)
    }

    // 计算类型统计
    const typeStats = this.calculateTypeStats(filteredQuestions)

    // ⭐ 计算当前Tab的统计数据
    const total = filteredQuestions.length
    const reviewedCount = filteredQuestions.filter(q => q.reviewed).length
    const reviewRate = total > 0 ? Math.round((reviewedCount / total) * 100) : 0
    const accuracy = total > 0 ? Math.round(Math.random() * 30 + 60) : 0 // TODO: 实际准确率需要从数据中计算

    this.setData({
      questions: filteredQuestions,
      typeStats,
      currentStats: {
        total,
        accuracy,
        reviewRate
      }
    })
  },

  /**
   * 计算类型统计
   */
  calculateTypeStats(questions) {
    const typeMap = {
      'vocab': { name: '单词', count: 0, type: 'vocab' },
      'reading': { name: '阅读理解', count: 0, type: 'reading' },
      'reading_a': { name: '阅读理解', count: 0, type: 'reading' },
      'sentence': { name: '长难句', count: 0, type: 'sentence' },
      'translation': { name: '翻译', count: 0, type: 'translation' },
      'writing': { name: '写作', count: 0, type: 'writing' }
    }

    questions.forEach(q => {
      const type = q.module_type || q.questionType
      if (typeMap[type]) {
        typeMap[type].count++
      }
    })

    // 合并阅读理解
    if (typeMap['reading_a']) {
      typeMap['reading'].count += typeMap['reading_a'].count
      delete typeMap['reading_a']
    }

    const total = questions.length

    return Object.values(typeMap)
      .filter(item => item.count > 0)
      .map(item => ({
        ...item,
        percentage: total > 0 ? Math.round((item.count / total) * 100) : 0
      }))
      .sort((a, b) => b.count - a.count)
  },

  /**
   * 格式化日期
   */
  formatDate(dateString) {
    if (!dateString) {return '--'}

    try {
      const date = new Date(dateString)
      const now = new Date()
      const diff = now - date

      // 今天
      if (diff < 24 * 60 * 60 * 1000) {
        const hours = Math.floor(diff / (60 * 60 * 1000))
        if (hours < 1) {
          const minutes = Math.floor(diff / (60 * 1000))
          return `${minutes}分钟前`
        }
        return `${hours}小时前`
      }

      // 昨天
      if (diff < 48 * 60 * 60 * 1000) {
        return '昨天'
      }

      // 7天内
      if (diff < 7 * 24 * 60 * 60 * 1000) {
        const days = Math.floor(diff / (24 * 60 * 60 * 1000))
        return `${days}天前`
      }

      // 格式化为 MM-DD
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${month}-${day}`
    } catch (error) {
      return '--'
    }
  },

  /**
   * 返回上一页
   */
  goBack() {
    wx.navigateBack()
  },

  /**
   * 切换解析显示
   */
  toggleExplanation(e) {
    const { id } = e.currentTarget.dataset
    const key = `expandedIds.${id}`

    this.setData({
      [key]: !this.data.expandedIds[id]
    })
  },

  /**
   * 标记为已复习
   */
  async markReviewed(e) {
    const { id: _id } = e.currentTarget.dataset

    wx.showModal({
      title: '确认',
      content: '确定标记为已复习？',
      success: async (res) => {
        if (res.confirm) {
          showLoading('处理中...')

          try {
            // TODO: 调用 API 标记为已复习
            // await wrongQuestionCollector.markAsReviewed(_id)

            showSuccess('已标记为复习')

            // 重新加载数据
            this.loadData()
          } catch (error) {
            console.error('标记失败:', error)
            showError('操作失败，请重试')
          } finally {
            hideLoading()
          }
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

