// pages/ai-assistant/ai-assistant-clean.js
// Clean Architecture版本的AI助手页面

const { container } = require('../../core/infrastructure/di/container')

Page({
  __loadStartTime: Date.now(),

  data: {
    // 主题相关
    themeClass: '',

    // Tab切换
    activeTab: 'chat', // chat 或 courses

    // ==================== AI对话相关 ====================
    messages: [],
    inputText: '',
    aiTyping: false,
    scrollToView: '',

    // 用户头像和AI头像
    userAvatar: '/images/user-default.png',
    aiAvatar: '/images/logo.png',

    // 快速建议问题
    quickSuggestions: [
      '我完型填空总是做不好，怎么办？',
      '如何快速记忆单词？',
      '帮我制定一个学习计划',
      '分析一下我的学习数据'
    ],

    // 快捷功能按钮
    quickActions: [
      {
        id: 1,
        emoji: '📊',
        label: '学习诊断',
        action: 'diagnose'
      },
      {
        id: 2,
        emoji: '❓',
        label: '题目答疑',
        action: 'question_help'
      },
      {
        id: 3,
        emoji: '📖',
        label: '词汇解析',
        action: 'vocabulary_help'
      },
      {
        id: 4,
        emoji: '📅',
        label: '制定计划',
        action: 'make_plan'
      },
      {
        id: 5,
        emoji: '🎯',
        label: '学习建议',
        action: 'advice'
      },
      {
        id: 6,
        emoji: '😊',
        label: '心理辅导',
        action: 'psychology'
      }
    ],

    // ==================== 课程相关 ====================
    selectedCategory: 'all',
    courseCategories: [
      { id: 'all', name: '全部' },
      { id: 'reading', name: '阅读理解' },
      { id: 'cloze', name: '完型填空' },
      { id: 'translation', name: '翻译写作' },
      { id: 'vocabulary', name: '词汇语法' }
    ],
    courses: [],
    filteredCourses: []
  },

  async onLoad(options) {
    // 初始化依赖
    this.sendAIMessageUseCase = container.resolve('sendAIMessageUseCase')
    this.getRecommendedCoursesUseCase = container.resolve('getRecommendedCoursesUseCase')
    this.getCourseDetailUseCase = container.resolve('getCourseDetailUseCase')

    // 初始化课程数据
    await this.loadCourses()

    // 如果有传入的问题，直接发送
    if (options.question) {
      await this.sendQuickQuestion({ currentTarget: { dataset: { question: options.question } } })
    }
  },

  onReady() {
    // 性能跟踪
    const app = getApp()
    if (app.globalData && app.globalData.perfTest) {
      const loadTime = Date.now() - this.__loadStartTime
      app.globalData.perfTest.recordPagePerformance('ai-assistant-clean', { loadTime })
    }
  },

  async onShow() {
    // 刷新用户学习数据（如果需要）
    // 这里可以调用相关的UseCase来刷新数据
  },

  // ==================== Tab切换 ====================
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ activeTab: tab })

    if (tab === 'courses') {
      this.filterCourses()
    }
  },

  // ==================== 课程功能 ====================
  async loadCourses() {
    try {
      const courses = await this.getRecommendedCoursesUseCase.execute({
        category: 'all',
        limit: 20
      })

      this.setData({
        courses: courses,
        filteredCourses: courses
      })
    } catch (error) {
      console.error('加载课程失败:', error)
      wx.showToast({
        title: '加载课程失败',
        icon: 'none'
      })
    }
  },

  filterCourses() {
    const { courses, selectedCategory } = this.data

    let filtered
    if (selectedCategory === 'all') {
      filtered = courses
    } else {
      filtered = courses.filter(course => course.category === selectedCategory)
    }

    this.setData({ filteredCourses: filtered })
  },

  switchCategory(e) {
    const category = e.currentTarget.dataset.category
    this.setData({ selectedCategory: category }, () => {
      this.filterCourses()
    })
  },

  onCourseSelect(e) {
    const courseId = e.currentTarget.dataset.courseId
    // 这里可以跳转到课程详情页面
    wx.showToast({
      title: `选择课程 ${courseId}`,
      icon: 'none'
    })
  },

  // ==================== AI对话功能 ====================
  onInput(e) {
    this.setData({
      inputText: e.detail.value
    })
  },

  clearInput() {
    this.setData({ inputText: '' })
  },

  async sendMessage() {
    const { inputText } = this.data

    if (!inputText || !inputText.trim()) {
      return
    }

    // 添加用户消息到UI
    this.addUserMessage(inputText.trim())

    // 清空输入框
    this.setData({ inputText: '' })

    // 显示AI打字中
    this.setData({ aiTyping: true })

    try {
      // 调用UseCase处理AI消息
      const result = await this.sendAIMessageUseCase.execute({
        userId: 'current_user', // 这里应该从用户服务获取真实的用户ID
        message: inputText.trim(),
        context: {
          // 可以添加更多的上下文信息
        }
      })

      // 隐藏AI打字中
      this.setData({ aiTyping: false })

      // 添加AI回复到UI
      this.addAIMessage(result.message, result.actionCard)

    } catch (error) {
      console.error('发送消息失败:', error)
      this.setData({ aiTyping: false })

      wx.showToast({
        title: '发送失败，请重试',
        icon: 'none'
      })
    }
  },

  addUserMessage(content) {
    const messages = this.data.messages
    const messageId = `msg-${Date.now()}`

    messages.push({
      id: messageId,
      role: 'user',
      content: content,
      avatar: this.data.userAvatar,
      time: this.formatTime(new Date())
    })

    this.setData({
      messages: messages,
      scrollToView: messageId
    })
  },

  addAIMessage(content, actionCard = null) {
    const messages = this.data.messages
    const messageId = `msg-${Date.now()}`

    messages.push({
      id: messageId,
      role: 'ai',
      content: content,
      avatar: this.data.aiAvatar,
      time: this.formatTime(new Date()),
      actionCard: actionCard,
      // AI Native: 为反馈按钮提供上下文
      feedbackContext: {
        messageContent: content,
        hasActionCard: Boolean(actionCard),
        timestamp: Date.now()
      }
    })

    this.setData({
      messages: messages,
      scrollToView: messageId
    })
  },

  async sendQuickQuestion(e) {
    const question = e.currentTarget.dataset.question
    this.setData({ inputText: question })
    await this.sendMessage()
  },

  async sendQuickAction(e) {
    const action = e.currentTarget.dataset.action

    const actionMessages = {
      'diagnose': '帮我诊断一下最近的学习情况',
      'question_help': '我有一道题目不会做',
      'vocabulary_help': '帮我分析一个单词',
      'make_plan': '帮我制定一个学习计划',
      'advice': '给我一些学习建议',
      'psychology': '我最近学习压力很大'
    }

    const message = actionMessages[action] || '你好'
    this.setData({ inputText: message })
    await this.sendMessage()
  },

  handleActionCard(e) {
    const { action, params } = e.currentTarget.dataset

    switch(action) {
    case 'start_practice':
      wx.navigateTo({
        url: `/pages/practice/practice?type=${params.type}`
      })
      break
    case 'start_vocabulary':
      wx.showToast({
        title: '单词学习页面开发中',
        icon: 'none'
      })
      break
    case 'generate_plan':
      wx.showToast({
        title: '学习计划生成中...',
        icon: 'none'
      })
      break
    case 'view_report':
      wx.navigateTo({
        url: '/pages/report/report'
      })
      break
    default:
      wx.showToast({
        title: `执行操作: ${action}`,
        icon: 'none'
      })
    }
  },

  // ==================== AI Native: 反馈处理 (P1-002集成) ====================
  /**
   * 处理反馈提交
   * 
   * === AI Native理念 ===
   * 1. 所有AI建议都可以反馈
   * 2. 反馈数据用于实时调整和长期优化
   * 3. 用户"踩"后立即记录，可选补充说明
   * 
   * === 失败场景处理 ===
   * - FeedbackService未初始化: 组件内Silent fail
   * - 网络断开: 离线缓存（FeedbackService处理）
   * - 快速连续点击: 组件内防抖
   * 
   * @param {Object} e - 事件对象
   * @param {Object} e.detail - 反馈详情
   * @param {string} e.detail.type - 反馈类型（thumbUp/thumbDown/cancel）
   * @param {string} e.detail.comment - 评论内容
   * @param {boolean} e.detail.success - 是否成功
   */
  onFeedbackSubmit(e) {
    const { type, comment, success } = e.detail
    
    if (!success) {
      console.warn('[AI-Assistant] Feedback submission failed, but it is handled by FeedbackService')
      return
    }
    
    console.log('[AI-Assistant] Feedback received:', { type, comment })
    
    // 未来扩展: 可以基于反馈实时调整AI响应
    // 例如用户"踩"了AI建议，可以触发P1-003短期反馈机制
    // 提供替代方案
  },

  // ==================== 工具方法 ====================
  formatTime(date) {
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`
  }
})
