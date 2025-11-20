// pages/vocab-book/vocab-book.js - 生词本页面
import learningDataManager from '../../utils/learning-data-manager.js'
import timerManager from '../../core/infrastructure/utils/timer-manager.js'

const { createThemeContainer } = require('../../core/infrastructure/di/themeContainer')

Page({
  __loadStartTime: Date.now(),

  data: {
    // 页面状态
    pageState: 'loading', // loading, loaded, empty
    themeClass: '',

    // 筛选和排序
    filterType: 'all', // all, thisWeek, thisMonth
    sortType: 'time', // time, frequency, mastery
    searchKeyword: '',

    // 生词本数据
    vocabBook: {
      words: [],
      stats: {
        totalWords: 0,
        reviewedToday: 0,
        masteredWords: 0
      }
    },

    // 显示数据
    filteredWords: [],
    currentPage: 1,
    pageSize: 20,
    hasMore: false,

    // UI状态
    showSearch: false,
    showActions: false,
    selectedWords: [],

    // 复习相关
    showReviewModal: false,
    reviewWord: null,
    reviewOptions: [
      { value: 'easy', text: '简单，7天后复习', color: '#52c41a' },
      { value: 'medium', text: '一般，3天后复习', color: '#faad14' },
      { value: 'hard', text: '困难，1天后复习', color: '#f5222f' }
    ]
  },

  onLoad() {
    console.log('📖 [生词本] 页面加载')
    this.initializePage()
  },

  onReady() {
    // 性能跟踪
    const app = getApp()
    if (app.globalData && app.globalData.perfTest) {
      const loadTime = Date.now() - this.__loadStartTime
      app.globalData.perfTest.recordPagePerformance('vocab-book', { loadTime })
    }
  },

  onShow() {
    // 页面显示时刷新数据
    if (this.data.pageState === 'loaded') {
      this.loadVocabBookData()
    }
  },

  /**
   * 初始化页面
   */
  async initializePage() {
    try {
      // 🏛️ 架构铁律合规: 使用ThemeService获取主题 (A1超时保护)
      const themeContainer = createThemeContainer('wechat')
      const checkThemeStatusUseCase = themeContainer.resolve('checkThemeSetupStatusUseCase')
      const themeStatus = await checkThemeStatusUseCase.executeWithTimeout()

      // 获取当前主题
      const themeService = themeContainer.resolve('IThemeService')
      const currentTheme = await themeService.getCurrentTheme()
      this.setData({
        themeClass: currentTheme === 'dark' ? 'theme-dark' : ''
      })

      // 加载生词本数据
      await this.loadVocabBookData()

    } catch (error) {
      console.error('❌ [生词本] 初始化失败:', error)
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
      this.setData({ pageState: 'error' })
    }
  },

  /**
   * 加载生词本数据
   */
  async loadVocabBookData() {
    try {
      console.log('📖 [生词本] 加载数据')

      // 获取生词本数据
      const vocabBook = learningDataManager.getVocabBook()

      if (!vocabBook || vocabBook.words.length === 0) {
        this.setData({
          pageState: 'empty',
          vocabBook: { words: [], stats: { totalWords: 0, reviewedToday: 0, masteredWords: 0 } }
        })
        return
      }

      // 处理单词数据，添加计算字段
      const processedWords = this.processVocabBookWords(vocabBook.words)

      // 应用筛选和排序
      const filteredWords = this.applyFiltersAndSort(processedWords)

      this.setData({
        pageState: 'loaded',
        vocabBook: {
          ...vocabBook,
          words: processedWords
        },
        filteredWords,
        hasMore: filteredWords.length > this.data.pageSize
      })

      console.log(`✅ [生词本] 加载完成，共${processedWords.length}个单词`)

    } catch (error) {
      console.error('❌ [生词本] 加载数据失败:', error)
      wx.showToast({
        title: '加载数据失败',
        icon: 'none'
      })
    }
  },

  /**
   * 处理生词本单词数据
   */
  processVocabBookWords(words) {
    const now = new Date()

    return words.map(word => {
      // 计算复习状态
      let reviewStatus = 'pending'
      let reviewStatusText = '待复习'

      if (word.mastered) {
        reviewStatus = 'mastered'
        reviewStatusText = '已掌握'
      } else if (word.lastReviewDate) {
        const lastReview = new Date(word.lastReviewDate)
        const daysSinceReview = Math.floor((now - lastReview) / (1000 * 60 * 60 * 24))

        if (word.nextReview && new Date(word.nextReview) <= now) {
          reviewStatus = 'due'
          reviewStatusText = '到期复习'
        } else if (daysSinceReview < 1) {
          reviewStatus = 'recent'
          reviewStatusText = '今日已复习'
        }
      }

      // 计算掌握度
      const masteryRate = word.reviewCount > 0 ?
        Math.min((word.reviewCount / 5) * 100, 100) : 0

      return {
        ...word,
        reviewStatus,
        reviewStatusText,
        masteryRate,
        daysSinceAdded: Math.floor((now - new Date(word.addedDate)) / (1000 * 60 * 60 * 24)),
        displayDate: this.formatDate(word.addedDate)
      }
    })
  },

  /**
   * 应用筛选和排序
   */
  applyFiltersAndSort(words) {
    let filtered = [...words]

    // 应用筛选
    const { filterType } = this.data

    if (filterType === 'thisWeek') {
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)
      filtered = filtered.filter(word => new Date(word.addedDate) >= weekAgo)
    } else if (filterType === 'thisMonth') {
      const monthAgo = new Date()
      monthAgo.setMonth(monthAgo.getMonth() - 1)
      filtered = filtered.filter(word => new Date(word.addedDate) >= monthAgo)
    }

    // 应用搜索
    const { searchKeyword } = this.data
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase()
      filtered = filtered.filter(word =>
        word.word.toLowerCase().includes(keyword) ||
        word.meaning.toLowerCase().includes(keyword)
      )
    }

    // 应用排序
    const { sortType } = this.data

    filtered.sort((a, b) => {
      switch (sortType) {
      case 'frequency':
        return (b.attempts || 0) - (a.attempts || 0)
      case 'mastery':
        return b.masteryRate - a.masteryRate
      case 'time':
      default:
        return new Date(b.addedDate) - new Date(a.addedDate)
      }
    })

    return filtered
  },

  /**
   * 切换筛选类型
   */
  onFilterChange(e) {
    const filterType = e.currentTarget.dataset.type
    console.log('📖 [生词本] 切换筛选:', filterType)

    this.setData({ filterType })
    this.refreshFilteredWords()
  },

  /**
   * 切换排序类型
   */
  onSortChange(e) {
    const sortType = e.currentTarget.dataset.type
    console.log('📖 [生词本] 切换排序:', sortType)

    this.setData({ sortType })
    this.refreshFilteredWords()
  },

  /**
   * 搜索输入
   */
  onSearchInput(e) {
    const searchKeyword = e.detail.value
    this.setData({ searchKeyword })

    // 防抖搜索 (符合M2: 定时器生命周期管理)
    if (this.searchTimer) {
      timerManager.clearTimeout(this.searchTimer)
    }
    this.searchTimer = timerManager.setTimeout(() => {
      this.refreshFilteredWords()
    }, 300, 'search-debounce')
  },

  /**
   * 切换搜索显示
   */
  toggleSearch() {
    this.setData({
      showSearch: !this.data.showSearch
    })
  },

  /**
   * 刷新筛选后的单词列表
   */
  refreshFilteredWords() {
    const filteredWords = this.applyFiltersAndSort(this.data.vocabBook.words)
    this.setData({
      filteredWords,
      currentPage: 1,
      hasMore: filteredWords.length > this.data.pageSize
    })
  },

  /**
   * 获取当前页显示的单词
   */
  getCurrentPageWords() {
    const { filteredWords, currentPage, pageSize } = this.data
    const startIndex = (currentPage - 1) * pageSize
    const endIndex = startIndex + pageSize
    return filteredWords.slice(startIndex, endIndex)
  },

  /**
   * 加载更多
   */
  loadMore() {
    if (!this.data.hasMore) return

    const nextPage = this.data.currentPage + 1
    const startIndex = (nextPage - 1) * this.data.pageSize

    if (startIndex < this.data.filteredWords.length) {
      this.setData({
        currentPage: nextPage,
        hasMore: startIndex + this.data.pageSize < this.data.filteredWords.length
      })
    } else {
      this.setData({ hasMore: false })
    }
  },

  /**
   * 开始复习单词
   */
  onStartReview(e) {
    const wordId = e.currentTarget.dataset.wordId
    const word = this.data.vocabBook.words.find(w => w.wordId === wordId)

    if (!word) {
      wx.showToast({
        title: '单词不存在',
        icon: 'none'
      })
      return
    }

    console.log('📖 [生词本] 开始复习单词:', word.word)

    this.setData({
      showReviewModal: true,
      reviewWord: word
    })
  },

  /**
   * 提交复习结果
   */
  onSubmitReview(e) {
    const performance = e.currentTarget.dataset.performance
    const { reviewWord } = this.data

    if (!reviewWord) return

    console.log('📖 [生词本] 提交复习结果:', reviewWord.word, performance)

    try {
      // 更新复习记录
      const success = learningDataManager.markVocabWordReviewed(reviewWord.wordId, performance)

      if (success) {
        wx.showToast({
          title: '复习完成',
          icon: 'success'
        })

        // 刷新数据
        this.loadVocabBookData()
      } else {
        wx.showToast({
          title: '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('❌ [生词本] 提交复习失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }

    // 关闭模态框
    this.setData({
      showReviewModal: false,
      reviewWord: null
    })
  },

  /**
   * 关闭复习模态框
   */
  onCloseReviewModal() {
    this.setData({
      showReviewModal: false,
      reviewWord: null
    })
  },

  /**
   * 标记单词为已掌握
   */
  onMarkMastered(e) {
    const wordId = e.currentTarget.dataset.wordId
    const word = this.data.vocabBook.words.find(w => w.wordId === wordId)

    if (!word) return

    wx.showModal({
      title: '确认操作',
      content: `确定将"${word.word}"标记为已掌握吗？`,
      success: (res) => {
        if (res.confirm) {
          this.doMarkMastered(wordId)
        }
      }
    })
  },

  /**
   * 执行标记掌握操作
   */
  doMarkMastered(wordId) {
    try {
      const success = learningDataManager.markWordMastered(wordId)

      if (success) {
        wx.showToast({
          title: '已标记为掌握',
          icon: 'success'
        })

        // 刷新数据
        this.loadVocabBookData()
      } else {
        wx.showToast({
          title: '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('❌ [生词本] 标记掌握失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  },

  /**
   * 从生词本移除单词
   */
  onRemoveWord(e) {
    const wordId = e.currentTarget.dataset.wordId
    const word = this.data.vocabBook.words.find(w => w.wordId === wordId)

    if (!word) return

    wx.showModal({
      title: '确认操作',
      content: `确定从生词本中移除"${word.word}"吗？`,
      success: (res) => {
        if (res.confirm) {
          this.doRemoveWord(wordId)
        }
      }
    })
  },

  /**
   * 执行移除操作
   */
  doRemoveWord(wordId) {
    try {
      const success = learningDataManager.removeWordFromVocabBook(wordId)

      if (success) {
        wx.showToast({
          title: '已从生词本移除',
          icon: 'success'
        })

        // 刷新数据
        this.loadVocabBookData()
      } else {
        wx.showToast({
          title: '操作失败',
          icon: 'none'
        })
      }
    } catch (error) {
      console.error('❌ [生词本] 移除单词失败:', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  },

  /**
   * 返回上一页
   */
  onBack() {
    wx.navigateBack()
  },

  /**
   * 格式化日期
   */
  formatDate(dateString) {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = now - date
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

    if (diffDays === 0) {
      return '今天'
    } else if (diffDays === 1) {
      return '昨天'
    } else if (diffDays < 7) {
      return `${diffDays}天前`
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7)
      return `${weeks}周前`
    } else {
      return date.toLocaleDateString()
    }
  },

  /**
   * 下拉刷新
   */
  onPullDownRefresh() {
    this.loadVocabBookData().then(() => {
      wx.stopPullDownRefresh()
    }).catch(() => {
      wx.stopPullDownRefresh()
    })
  },

  /**
   * 触底加载更多
   */
  onReachBottom() {
    this.loadMore()
  },

  /**
   * 页面卸载 - 清理定时器 (符合M2: 定时器生命周期管理)
   */
  onUnload() {
    if (this.searchTimer) {
      timerManager.clearTimeout(this.searchTimer)
      this.searchTimer = null
    }
  }
})
