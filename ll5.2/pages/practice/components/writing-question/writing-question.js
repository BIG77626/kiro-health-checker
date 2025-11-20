// components/writing-question/writing-question.js
const { mockSentences, categories } = require('../../../../data/golden-sentences/mock-data.js')

Component({
  properties: {
    writingData: {
      type: Object,
      value: {}
    },
    currentQuestionIndex: {
      type: Number,
      value: 0
    },
    gradingResult: {
      type: Object,
      value: null,
      observer: function(newVal, oldVal) {
        // 当父页面传入批改结果时，更新组件状态
        if (newVal && newVal !== oldVal && newVal.timestamp) {
          this.handleGradingComplete({ detail: { gradingResult: newVal } })
        }
      }
    }
  },

  data: {
    essayContent: '',
    wordCount: 0,
    charCount: 0,
    isSubmitted: false,
    isGrading: false,
    gradingResult: null,
    autoSaveTimer: null,
    lastSaveTime: '',
    showSampleEssay: false,
    showAnalysisModal: false,

    // 万金油句库相关
    showSentenceDrawer: false,
    showDetailModal: false,
    selectedSentence: {},
    allSentences: [],
    filteredSentences: [],
    searchKeyword: '',
    activeTier: 'all',
    activePosition: 'all',
    showFavoriteOnly: false,
    favoriteSentenceIds: [],

    // 分类数据
    tiers: [
      { id: 'all', name: '全部' },
      { id: 'basic', name: '基础' },
      { id: 'advanced', name: '进阶' },
      { id: 'extended', name: '拓展' }
    ],
    positions: [],
    tierNames: {
      'basic': '基础',
      'advanced': '进阶',
      'extended': '拓展'
    },

    // AI推荐相关
    aiRecommendEnabled: false,
    recommendedSentences: []
  },

  observers: {
    'writingData': function(newData) {
      console.log('🔄 writingData 更新:', newData)
      if (newData && newData.title) {
        console.log('✅ 题目标题:', newData.title)
        console.log('✅ 题目内容:', newData.topic)
      } else {
        console.warn('⚠️ writingData 缺少 title 字段:', newData)
      }
    }
  },

  lifetimes: {
    attached() {
      console.log('📝 写作组件加载, writingData:', this.data.writingData)
      console.log('📝 题目标题:', this.data.writingData.title)
      console.log('📝 题目内容:', this.data.writingData.topic)
      
      // 尝试恢复草稿
      this.loadDraft()
      // 初始化句库数据
      this.initSentenceData()
      // 加载收藏
      this.loadFavorites()
    },

    detached() {
      // 清除自动保存定时器
      if (this.data.autoSaveTimer) {
        clearTimeout(this.data.autoSaveTimer)
      }
    }
  },

  methods: {
    /**
     * 处理输入
     */
    onInput(e) {
      const value = e.detail.value
      const { wordCount, charCount } = this.countWords(value)

      this.setData({
        essayContent: value,
        wordCount: wordCount,
        charCount: charCount
      })

      // 触发自动保存
      this.autoSave()
    },

    /**
     * 计算字数
     */
    countWords(text) {
      if (!text) {return { wordCount: 0, charCount: 0 }}

      // 字符数（包括空格）
      const charCount = text.length

      // 英文单词数
      const englishWords = text.match(/[a-zA-Z]+/g) || []
      const wordCount = englishWords.length

      return { wordCount, charCount }
    },

    /**
     * 自动保存
     */
    autoSave() {
      // 清除之前的定时器
      if (this.data.autoSaveTimer) {
        clearTimeout(this.data.autoSaveTimer)
      }

      // 3秒后保存
      const timer = setTimeout(() => {
        this.saveDraft()
      }, 3000)

      this.setData({
        autoSaveTimer: timer
      })
    },

    /**
     * 保存草稿
     */
    async saveDraft() {
      const { essayContent, wordCount } = this.data
      const { writingData } = this.data

      if (!essayContent.trim()) {return}

      try {
        const draftKey = `essay_draft_${writingData.id}`
        await wx.setStorage({
          key: draftKey,
          data: {
            content: essayContent,
            wordCount: wordCount,
            savedAt: new Date().toLocaleTimeString()
          }
        })

        this.setData({
          lastSaveTime: new Date().toLocaleTimeString()
        })

        console.log('✅ 草稿已自动保存')
      } catch (error) {
        console.error('保存草稿失败:', error)
      }
    },

    /**
     * 加载草稿
     */
    async loadDraft() {
      const { writingData } = this.data
      const draftKey = `essay_draft_${writingData.id}`

      try {
        const res = await wx.getStorage({ key: draftKey })
        if (res.data && res.data.content) {
          wx.showModal({
            title: '发现草稿',
            content: `发现 ${res.data.savedAt} 保存的草稿，是否继续编辑？`,
            success: (modalRes) => {
              if (modalRes.confirm) {
                const { wordCount, charCount } = this.countWords(res.data.content)
                this.setData({
                  essayContent: res.data.content,
                  wordCount: wordCount,
                  charCount: charCount,
                  lastSaveTime: res.data.savedAt
                })
              }
            }
          })
        }
      } catch (error) {
        // 没有草稿，忽略错误
      }
    },

    /**
     * 提交作文进行AI批改
     */
    submitEssay() {
      const { essayContent, charCount } = this.data
      const { writingData } = this.data

      if (!essayContent.trim()) {
        wx.showToast({
          title: '请输入作文内容',
          icon: 'none'
        })
        return
      }

      if (charCount < writingData.minWords) {
        wx.showModal({
          title: '字数不足',
          content: `作文要求至少 ${writingData.minWords} 词，当前仅 ${charCount} 字`,
          showCancel: false
        })
        return
      }

      this.setData({ isGrading: true })

      // 触发提交事件，让父页面调用ViewModel的gradeEssay方法
      // 父页面会通过handleWritingSubmit方法处理，然后通过gradingComplete事件返回结果
      this.triggerEvent('submit', {
        essay: essayContent,
        charCount: charCount,
        questionId: this.data.writingData?.id || null
      })
    },

    /**
     * 处理父页面返回的批改结果（通过properties传入）
     * @param {Object} event - 包含gradingResult的对象
     */
    handleGradingComplete(event) {
      const { gradingResult } = event.detail || event || {}
      
      if (!gradingResult) {
        console.error('❌ 批改结果为空')
        this.setData({
          isGrading: false,
          isSubmitted: false
        })
        wx.hideLoading()
        wx.showToast({
          title: '批改失败',
          icon: 'error'
        })
        return
      }

      // 转换批改结果格式（适配组件内部使用的格式）
      const formattedResult = {
        totalScore: gradingResult.totalScore || 0,
        contentScore: gradingResult.contentScore || 0,
        languageScore: gradingResult.languageScore || 0,
        structureScore: gradingResult.structureScore || 0,
        comments: gradingResult.comments || '',
        strengths: gradingResult.strengths || [],
        suggestions: gradingResult.suggestions || [],
        improvedVersion: null,
        isFallback: gradingResult.isFallback || false
      }

      this.setData({
        isSubmitted: true,
        isGrading: false,
        gradingResult: formattedResult
      })

      wx.hideLoading()
      wx.showToast({
        title: '批改完成！',
        icon: 'success'
      })
    },

    /**
     * 解析AI批改结果
     */
    parseGradingResult(data) {
      // 假设AI返回的是JSON格式或结构化文本
      // 这里需要根据实际API返回格式调整

      try {
        // 如果是JSON字符串，先解析
        const result = typeof data === 'string' ? JSON.parse(data) : data

        return {
          contentScore: result.content_score || result.contentScore || 0,
          languageScore: result.language_score || result.languageScore || 0,
          structureScore: result.structure_score || result.structureScore || 0,
          totalScore: result.total_score || result.totalScore || 0,
          comments: result.comments || result.feedback || '',
          suggestions: result.suggestions || [],
          strengths: result.strengths || [],
          weaknesses: result.weaknesses || [],
          improvedVersion: result.improved_version || result.improvedVersion || ''
        }
      } catch (error) {
        console.error('解析批改结果失败:', error)
        // 返回默认结构
        return {
          contentScore: 0,
          languageScore: 0,
          structureScore: 0,
          totalScore: 0,
          comments: data.toString(),
          suggestions: [],
          strengths: [],
          weaknesses: [],
          improvedVersion: ''
        }
      }
    },

    /**
     * 重新编辑
     */
    reEdit() {
      this.setData({
        isSubmitted: false,
        gradingResult: null
      })
    },

    /**
     * 查看范文
     */
    toggleSampleEssay() {
      this.setData({
        showSampleEssay: !this.data.showSampleEssay
      })
    },

    /**
     * 显示解析
     */
    showAnalysis() {
      this.setData({ showAnalysisModal: true })
    },

    /**
     * 隐藏解析
     */
    hideAnalysis() {
      this.setData({ showAnalysisModal: false })
    },

    // ========== 万金油句库相关方法 ==========

    /**
     * 初始化句库数据
     */
    initSentenceData() {
      const allSentences = mockSentences
      const positions = [
        { id: 'all', name: '全部', icon: '📝' },
        ...categories.positions
      ]

      this.setData({
        allSentences,
        filteredSentences: allSentences,
        positions
      })
    },

    /**
     * 加载收藏数据
     */
    async loadFavorites() {
      try {
        const res = await wx.getStorage({ key: 'favorite_sentences' })
        this.setData({ favoriteSentenceIds: res.data || [] })
      } catch (e) {
        this.setData({ favoriteSentenceIds: [] })
      }
    },

    /**
     * 打开万金油句库抽屉
     */
    openSentenceDrawer() {
      this.setData({ showSentenceDrawer: true })
    },

    /**
     * 关闭句库抽屉
     */
    closeSentenceDrawer() {
      this.setData({ showSentenceDrawer: false })
    },

    /**
     * 搜索句子
     */
    onSearchSentence(e) {
      const keyword = e.detail.value
      this.setData({ searchKeyword: keyword }, () => {
        this.filterSentences()
      })
    },

    /**
     * 清除搜索
     */
    clearSearch() {
      this.setData({ searchKeyword: '' }, () => {
        this.filterSentences()
      })
    },

    /**
     * 层级切换
     */
    onTierChange(e) {
      const tier = e.currentTarget.dataset.tier
      this.setData({ activeTier: tier }, () => {
        this.filterSentences()
      })
    },

    /**
     * 位置切换
     */
    onPositionChange(e) {
      const position = e.currentTarget.dataset.position
      this.setData({ activePosition: position }, () => {
        this.filterSentences()
      })
    },

    /**
     * 切换收藏筛选
     */
    toggleFavoriteFilter() {
      this.setData({ showFavoriteOnly: !this.data.showFavoriteOnly }, () => {
        this.filterSentences()
      })
    },

    /**
     * 筛选句子
     */
    filterSentences() {
      let result = this.data.allSentences

      // 按层级筛选
      if (this.data.activeTier !== 'all') {
        result = result.filter(s => s.tier === this.data.activeTier)
      }

      // 按位置筛选
      if (this.data.activePosition !== 'all') {
        result = result.filter(s => s.category.position === this.data.activePosition)
      }

      // 搜索关键词
      if (this.data.searchKeyword) {
        const keyword = this.data.searchKeyword.toLowerCase()
        result = result.filter(s =>
          s.english.toLowerCase().includes(keyword) ||
          s.chinese.includes(this.data.searchKeyword) ||
          s.tags.some(tag => tag.includes(this.data.searchKeyword))
        )
      }

      // 只显示收藏
      if (this.data.showFavoriteOnly) {
        result = result.filter(s => this.data.favoriteSentenceIds.includes(s.id))
      }

      this.setData({ filteredSentences: result })
    },

    /**
     * 插入句子到编辑器
     */
    insertSentence(e) {
      const sentence = e.currentTarget.dataset.sentence || e.detail.sentence
      if (!sentence) {return}

      const insertText = `${sentence.english} `
      const newContent = this.data.essayContent + insertText
      const { wordCount, charCount } = this.countWords(newContent)

      this.setData({
        essayContent: newContent,
        wordCount,
        charCount
      })

      // 关闭抽屉
      this.closeSentenceDrawer()
      this.closeDetailModal()

      // 保存草稿
      this.saveDraft()

      // 检查模板使用率
      this.checkTemplateUsage()

      wx.showToast({
        title: '已插入',
        icon: 'success'
      })
    },

    /**
     * 显示句子详情
     */
    showSentenceDetail(e) {
      const sentence = e.currentTarget.dataset.sentence
      this.setData({
        selectedSentence: sentence,
        showDetailModal: true
      })
    },

    /**
     * 关闭详情弹窗
     */
    closeDetailModal() {
      this.setData({ showDetailModal: false })
    },

    /**
     * 收藏/取消收藏句子
     */
    async toggleFavoriteSentence(e) {
      const sentenceId = e.currentTarget.dataset.id || e.detail.sentenceId
      let favorites = [...this.data.favoriteSentenceIds]

      if (favorites.includes(sentenceId)) {
        favorites = favorites.filter(id => id !== sentenceId)
        wx.showToast({ title: '已取消收藏', icon: 'none' })
      } else {
        favorites.push(sentenceId)
        wx.showToast({ title: '已收藏', icon: 'success' })
      }

      this.setData({ favoriteSentenceIds: favorites })
      await wx.setStorage({ key: 'favorite_sentences', data: favorites })

      // 如果当前是收藏筛选模式，重新筛选
      if (this.data.showFavoriteOnly) {
        this.filterSentences()
      }
    },

    // ========== AI推荐相关 ==========

    /**
     * 切换AI推荐开关
     */
    toggleAIRecommendation() {
      const enabled = !this.data.aiRecommendEnabled
      this.setData({ aiRecommendEnabled: enabled })

      if (enabled) {
        this.updateAIRecommendations()
        wx.showToast({
          title: 'AI推荐已开启',
          icon: 'success'
        })
      } else {
        wx.showToast({
          title: 'AI推荐已关闭',
          icon: 'none'
        })
      }
    },

    /**
     * 更新AI推荐
     */
    updateAIRecommendations() {
      // 简单逻辑：根据已写内容推荐下一句
      const content = this.data.essayContent
      let recommended = []

      if (!content || content.length < 10) {
        // 开头：推荐开头句
        recommended = this.data.allSentences
          .filter(s => s.category.position === 'opening')
          .slice(0, 3)
      } else if (this.data.wordCount < 50) {
        // 主体：推荐分析句
        recommended = this.data.allSentences
          .filter(s => s.category.position === 'body')
          .slice(0, 3)
      } else {
        // 结尾：推荐结尾句
        recommended = this.data.allSentences
          .filter(s => s.category.position === 'conclusion')
          .slice(0, 3)
      }

      this.setData({ recommendedSentences: recommended })
    },

    /**
     * 插入推荐句子
     */
    insertRecommended(e) {
      const sentence = e.currentTarget.dataset.sentence
      this.insertSentence({ currentTarget: { dataset: { sentence } } })
      this.updateAIRecommendations()
    },

    /**
     * 检查模板使用率并提醒
     */
    checkTemplateUsage() {
      const content = this.data.essayContent
      if (!content) {return}

      // 简单计算：检测有多少句子来自模板
      let templateMatchCount = 0
      const sentences = content.split(/[.!?]+/).filter(s => s.trim())

      sentences.forEach(sentence => {
        const found = this.data.allSentences.some(template => {
          // 移除占位符进行匹配
          const pattern = template.english.replace(/\[.*?\]/g, '').trim()
          return sentence.includes(pattern.substring(0, 20))
        })
        if (found) {templateMatchCount++}
      })

      const usageRate = sentences.length > 0 ? templateMatchCount / sentences.length : 0

      // 如果使用率超过70%，弹窗提醒
      if (usageRate > 0.7 && sentences.length >= 5) {
        wx.showModal({
          title: '⚠️ 模板使用提醒',
          content: `您的作文中模板句占比较高（约${(usageRate * 100).toFixed(0)}%）。\n\n建议在主体段增加更多个人观点和具体例子，这样更容易获得高分！`,
          showCancel: false,
          confirmText: '我知道了',
          confirmColor: '#4F7FE8'
        })
      }
    }
  }
})

