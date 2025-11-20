// pages/home/home.js
const { getDateString } = require('../../utils/util.js')
const themeUtils = require('../../utils/theme.js')
const { smartModalManager } = require('../../utils/smart-modal-manager.js')
const { createThemeContainer } = require('../../core/infrastructure/di/themeContainer')

// 🏛️ 架构铁律合规: 使用DI容器获取服务
const themeContainer = createThemeContainer('wechat')
const markThemeSetupShownUseCase = themeContainer.resolve('markThemeSetupShownUseCase')

Page({
  __loadStartTime: Date.now(),
  data: {
    stats: {
      todayStudyTime: 0,
      weekAccuracy: 0,
      totalQuestions: 0
    },
    recentStats: [
      {
        label: '今日学习',
        value: '0分钟',
        icon: '/images/clock.png'
      },
      {
        label: '本周正确率',
        value: '0%',
        icon: '/images/target.png'
      },
      {
        label: '完成题目',
        value: '0道',
        icon: '/images/book-open.png'
      }
    ],
    isLoading: false,
    showThemeSetup: false,
    systemTheme: 'light',
    themeClass: ''  // Tokens v0.2: 暗色模式类名
  },

  onLoad() {
    // 立即显示默认数据
    this.setData({ isLoading: false })

    // 检查主题设置
    this.checkThemeSetup()

    // 异步尝试加载实时数据（可选）
    this.tryLoadRealStats()
  },

  onReady() {
    // 性能跟踪
    const app = getApp()
    if (app.globalData && app.globalData.perfTest) {
      const loadTime = Date.now() - this.__loadStartTime
      app.globalData.perfTest.recordPagePerformance('home', { loadTime })
    }
  },

  onShow() {
    // 页面显示时可选择刷新数据
    // this.tryLoadRealStats()
  },

  /**
   * 安全的数据加载 - 不会因为云数据库错误而崩溃
   */
  async tryLoadRealStats() {
    try {
      // 延迟初始化数据库连接
      const db = wx.cloud.database()
      const collection = db.collection('studyrecords')

      // 获取学习记录
      const studyRecords = await collection.orderBy('created_date', 'desc').limit(100).get()

      if (!studyRecords.data || studyRecords.data.length === 0) {
        return // 没有数据，保持默认值
      }

      const today = getDateString()
      const weekAgo = new Date()
      weekAgo.setDate(weekAgo.getDate() - 7)

      // 计算今日学习时长（分钟）
      const todayRecords = studyRecords.data.filter(record =>
        record.created_date && record.created_date.startsWith(today)
      )
      const todayStudyTime = Math.round(
        todayRecords.reduce((sum, record) => sum + (record.time_spent || 0), 0) / 60
      )

      // 计算本周正确率
      const weekRecords = studyRecords.data.filter(record =>
        new Date(record.created_date) >= weekAgo
      )
      const weekCorrect = weekRecords.filter(record => record.is_correct).length
      const weekAccuracy = weekRecords.length > 0
        ? ((weekCorrect / weekRecords.length) * 100).toFixed(1)
        : 0

      // 总完成题目数
      const totalQuestions = studyRecords.data.length

      const stats = {
        todayStudyTime,
        weekAccuracy,
        totalQuestions
      }

      const recentStats = [
        {
          label: '今日学习',
          value: `${stats.todayStudyTime}分钟`,
          icon: '/images/clock.png'
        },
        {
          label: '本周正确率',
          value: `${stats.weekAccuracy}%`,
          icon: '/images/target.png'
        },
        {
          label: '完成题目',
          value: `${stats.totalQuestions}道`,
          icon: '/images/book-open.png'
        }
      ]

      this.setData({
        stats,
        recentStats
      })
    } catch (error) {
      console.warn('加载实时数据失败，使用默认值:', error.message)
      // 失败时保持默认值，不显示错误
    }
  },

  goToStudy() {
    wx.navigateTo({
      url: '/pages/quiz-bank/quiz-bank'
    })
  },

  /**
   * 检查是否需要显示主题设置弹窗
   * 使用 SmartModalManager 智能管理弹窗时机
   */
  async checkThemeSetup() {
    try {
      // 获取系统主题
      const systemTheme = themeUtils.detectSystemDarkMode() ? 'dark' : 'light'

      // 延迟3秒后再考虑展示弹窗，确保用户已经看到首页内容
      setTimeout(() => {
        // 使用智能弹窗管理器
        smartModalManager.showModal({
          modalId: 'theme-setup',
          title: '主题设置',
          content: `检测到您的系统主题为${systemTheme === 'dark' ? '深色' : '浅色'}模式，是否跟随系统设置？`,
          confirmText: '跟随系统',
          cancelText: '手动设置',
          maxShowTimes: 1, // 只展示一次
          minInterval: 0, // 首次展示无间隔限制
          priority: 5, // 中等优先级
          onConfirm: () => {
            // 跟随系统主题
            themeUtils.setFollowSystem(true)
            this.setData({
              showThemeSetup: false
            })
            wx.showToast({
              title: '已设置跟随系统',
              icon: 'success'
            })
          },
          onCancel: () => {
            // 显示手动设置弹窗
            this.setData({
              showThemeSetup: true,
              systemTheme
            })
          }
        })
      }, 3000) // 延迟3秒，避免在用户刚进入时打断

    } catch (error) {
      console.error('检查主题设置失败:', error)
    }
  },

  /**
   * 主题设置确认
   */
  onThemeSetupConfirm(e) {
    const { theme, followSystem, selectedOption } = e.detail

    try {
      // 设置主题
      if (followSystem) {
        themeUtils.setFollowSystem(true)
      } else {
        themeUtils.setUserTheme(theme)
      }

      // 🏛️ 架构铁律合规: 通过Use Case标记主题设置状态 (A1超时保护)
      markThemeSetupShownUseCase.executeWithTimeout().catch(error => {
        console.error('[home] 标记主题设置失败:', error)
      })

      // 关闭弹窗
      this.setData({
        showThemeSetup: false
      })

      console.log('主题设置完成:', { theme, followSystem, selectedOption })

    } catch (error) {
      console.error('主题设置失败:', error)
    }
  },

  /**
   * 主题设置弹窗关闭
   */
  onThemeSetupClose() {
    this.setData({
      showThemeSetup: false
    })
  }
})
