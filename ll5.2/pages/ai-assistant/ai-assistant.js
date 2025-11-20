// pages/ai-assistant/ai-assistant.js
// 新架构已启用，旧架构已完全移除

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

    // 用户头像
    userAvatar: '/images/user-default.png',

    // AI头像
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
        emoji: '💡',
        label: '题目答疑',
        action: 'question_help'
      },
      {
        id: 3,
        emoji: '📚',
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
        emoji: '💪',
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

    courses: [
      {
        id: 1,
        title: '2024年考研英语阅读真题精讲',
        instructor: '张老师',
        category: 'reading',
        rating: 4.9,
        students: 1258,
        lessons: 20,
        duration: '10小时',
        difficulty: '★★★★☆',
        progress: 25,
        cover: ''
      },
      {
        id: 2,
        title: '完型填空高分技巧突破',
        instructor: '李老师',
        category: 'cloze',
        rating: 4.8,
        students: 856,
        lessons: 15,
        duration: '8小时',
        difficulty: '★★★☆☆',
        progress: 0,
        cover: ''
      },
      {
        id: 3,
        title: '考研英语词汇记忆法',
        instructor: '王老师',
        category: 'vocabulary',
        rating: 4.7,
        students: 2134,
        lessons: 30,
        duration: '15小时',
        difficulty: '★★☆☆☆',
        progress: 60,
        cover: ''
      },
      {
        id: 4,
        title: '英译汉翻译技巧精讲',
        instructor: '赵老师',
        category: 'translation',
        rating: 4.9,
        students: 745,
        lessons: 12,
        duration: '6小时',
        difficulty: '★★★★☆',
        progress: 0,
        cover: ''
      }
    ],

    filteredCourses: [],
    
    // 加载状态（用于骨架屏）
    isLoading: false
  },

  onLoad(options) {
    // 强制使用新架构（旧架构已完全移除）
    this._initNewArchitecture()

    // 如果有传入的问题，直接发送
    if (options.question) {
      this.viewModel.sendMessage(options.question).catch(error => {
        console.error('自动发送问题失败:', error)
      })
    }
  },

  onReady() {
    // 性能跟踪
    const app = getApp()
    if (app.globalData && app.globalData.perfTest) {
      const loadTime = Date.now() - this.__loadStartTime
      app.globalData.perfTest.recordPagePerformance('ai-assistant', { loadTime })
    }
  },

  onShow() {
    // 刷新用户数据
    // TODO: 从云数据库获取用户学习数据
  },

  // ==================== 🆕 新架构实现 ====================

  /**
   * 新架构初始化
   * @private
   */
  _initNewArchitecture() {
    try {
      console.log('🤖 [AI-Assistant] 初始化新架构...')

      // 创建DI容器
      const createAIAssistantContainer = require('../../core/infrastructure/di/aiAssistantContainer')
      const container = createAIAssistantContainer('wechat')

      // 获取ViewModel实例
      this.viewModel = container.resolve('aiAssistantViewModel')

      // 订阅状态变化（优化：合并setData调用，减少渲染次数）
      let pendingUpdate = null
      this.viewModel.subscribe((newState, prevState) => {
        // 使用nextTick合并多次状态更新为一次setData
        if (pendingUpdate) {
          clearTimeout(pendingUpdate)
        }
        
        pendingUpdate = setTimeout(() => {
          this._onViewModelStateChange(newState, prevState)
          pendingUpdate = null
        }, 16) // 约60fps，16ms一帧
      })

      // 加载历史对话
      this.viewModel.loadConversationHistory()

      // 设置页面标题
      wx.setNavigationBarTitle({
        title: 'AI学习助手'
      })

      console.log('✅ [AI-Assistant] 新架构初始化完成')

    } catch (error) {
      console.error('❌ [AI-Assistant] 新架构初始化失败:', error)
      // 如果新架构初始化失败，抛出错误（不再回退到旧架构）
      throw error
    }
  },

  /**
   * ViewModel状态变化处理
   * @private
   * @param {Object} newState - 新状态
   * @param {Object} prevState - 旧状态
   */
  _onViewModelStateChange(newState, prevState) {
    // 更新页面数据（合并为一次setData调用）
    this.setData({
      activeTab: newState.activeTab,
      messages: newState.messages,
      inputText: newState.inputText,
      aiTyping: newState.aiTyping,
      scrollToView: newState.scrollToView,
      userAvatar: newState.userAvatar,
      aiAvatar: newState.aiAvatar,
      quickSuggestions: newState.quickSuggestions,
      quickActions: newState.quickActions,
      learningCourses: newState.learningCourses,
      loading: newState.loading,
      isLoading: newState.loading || false, // 添加isLoading字段用于骨架屏
      error: newState.error,
      themeClass: newState.themeClass
    })

    // 处理错误显示
    if (newState.error && (!prevState || newState.error !== prevState.error)) {
      wx.showToast({
        title: newState.error,
        icon: 'none',
        duration: 3000
      })
    }
  },

  /**
   * 发送消息
   */
  async onSendMessage() {
    const text = this.data.inputText.trim()
    if (!text) {
      wx.showToast({
        title: '请输入问题',
        icon: 'none'
      })
      return
    }

    try {
      await this.viewModel.sendMessage(text)
    } catch (error) {
      wx.showToast({
        title: error.message || '发送失败',
        icon: 'none'
      })
    }
  },

  /**
   * 使用快速建议
   */
  async onQuickSuggestionTap(e) {
    const suggestion = e.currentTarget.dataset.suggestion
    if (!suggestion) return

    try {
      await this.viewModel.useQuickSuggestion(suggestion)
    } catch (error) {
      wx.showToast({
        title: error.message || '发送失败',
        icon: 'none'
      })
    }
  },

  /**
   * 执行快捷功能
   */
  async onQuickActionTap(e) {
    const action = e.currentTarget.dataset.action
    if (!action) return

    try {
      await this.viewModel.executeQuickAction(action)
    } catch (error) {
      wx.showToast({
        title: error.message || '功能执行失败',
        icon: 'none'
      })
    }
  },

  /**
   * 开始学习课程
   */
  async onStartCourse(e) {
    const courseId = e.currentTarget.dataset.id
    if (!courseId) return

    try {
      await this.viewModel.startCourse(courseId)
    } catch (error) {
      wx.showToast({
        title: error.message || '开始课程失败',
        icon: 'none'
      })
    }
  },

  /**
   * 切换标签页
   */
  onTabChange(e) {
    const tab = e.currentTarget.dataset.tab || e.detail.key
    if (!tab) return

    try {
      this.viewModel.switchTab(tab)
    } catch (error) {
      wx.showToast({
        title: error.message || '切换失败',
        icon: 'none'
      })
    }
  },

  /**
   * 清空对话
   */
  onClearConversation() {
    wx.showModal({
      title: '确认清空',
      content: '确定要清空所有对话记录吗？',
      success: (res) => {
        if (res.confirm) {
          this.viewModel.clearConversation()
          wx.showToast({
            title: '对话已清空',
            icon: 'success'
          })
        }
      }
    })
  },

  /**
   * 输入框变化处理
   */
  onInputChange(e) {
    const value = e.detail.value
    this.viewModel._updateState({ inputText: value })
  },

  /**
   * 页面卸载时清理资源
   */
  onUnload() {
    if (this.viewModel) {
      // 保存对话历史
      this.viewModel.saveConversationHistory()
      // 销毁ViewModel
      this.viewModel.destroy()
    }
  }
})

