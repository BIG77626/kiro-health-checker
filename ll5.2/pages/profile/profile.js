// pages/profile/profile.js
// ✅ 新架构已启用，不再使用CloudDatabase
// const { CloudDatabase } = require('../../utils/cloud.js')
const { showSuccess, showError } = require('../../utils/util.js')
const themeUtils = require('../../utils/theme.js')
const Logger = require('../../core/infrastructure/logging/Logger')

// 新架构相关导入（强制使用新架构，旧架构已完全移除）
// ProfileViewModel已集成到Container中，无需单独导入
const createProfileContainer = require('../../core/infrastructure/di/profileContainer')

console.log('✅ Profile页面：使用新架构 (Clean Architecture)')

Page({
  __loadStartTime: Date.now(),
  data: {
    userInfo: {},
    hasLogin: false,
    studyDays: 0,
    achievements: {
      totalStudyTime: 0,
      totalQuestions: 0,
      bestAccuracy: 0
    },
    showAboutModal: false,
    version: '1.0.0',
    showThemeSetup: false,
    systemTheme: 'light',
    // 新架构状态（强制使用新架构）
    isNewArchitecture: true,
    viewModelError: null
  },

  onLoad(options) {
    console.log('【个人中心】页面加载', options)

    // 新架构初始化（强制使用新架构）
    this._initNewArchitecture()
  },

  /**
   * 新架构初始化
   * @private
   */
  _initNewArchitecture() {
    try {
      console.log('🚀 Profile页面：初始化新架构...')

      // 创建DI容器
      this.container = createProfileContainer('wechat')

      // 创建ViewModel
      this.viewModel = this.container.resolve('profileViewModel')

      // 订阅状态变化
      this.unsubscribe = this.viewModel.subscribe((state) => {
        this.setData({
          userInfo: state.userInfo,
          hasLogin: state.hasLogin,
          studyDays: state.studyDays,
          achievements: state.achievements,
          viewModelError: state.error
        })
      })

      // 初始化数据加载
      this._loadNewArchitectureData()

    } catch (error) {
      Logger.error('Profile', 'InitArchitectureFailed', {
        errorType: error.name || 'InitError',
        errorMsg: error.message || 'Init architecture failed',
        errorCode: 'ERR_PROFILE_INIT_ARCH',
        fallback: 'show_error_state',
        impact: 'ui_blocked'
      })
      this.setData({
        viewModelError: error.message
      })
      // ✅ 不再回退到旧架构，记录错误供调试
    }
  },

  // ✅ _initLegacyArchitecture 已删除 - 旧架构已完全移除

  /**
   * 新架构数据加载
   * @private
   */
  async _loadNewArchitectureData() {
    try {
      // 检查登录状态
      await this.viewModel.checkLoginStatus()

      // 加载用户数据
      await this.viewModel.loadUserData()

    } catch (error) {
      Logger.error('Profile', 'LoadDataFailed', {
        errorType: error.name || 'LoadError',
        errorMsg: error.message || 'Load data failed',
        errorCode: 'ERR_PROFILE_LOAD_DATA',
        fallback: 'show_error_state',
        impact: 'feature_degradation'
      })
      this.setData({
        viewModelError: error.message
      })
    }
  },

  onReady() {
    // 性能跟踪
    const app = getApp()
    if (app.globalData && app.globalData.perfTest) {
      const loadTime = Date.now() - this.__loadStartTime
      app.globalData.perfTest.recordPagePerformance('profile', { loadTime })
    }

    // 页面渲染完成
    console.log('【个人中心】页面渲染完成')
  },

  onUnload() {
    // 清理新架构资源
    if (this.unsubscribe) {
      this.unsubscribe()
      this.unsubscribe = null
    }

    if (this.viewModel) {
      this.viewModel = null
    }

    if (this.container) {
      this.container = null
    }

    console.log('【个人中心】页面卸载，资源已清理')
  },

  onShow() {
    this.loadUserData()
    this.checkThemeSetup()
  },

  // ✅ checkLoginStatus 已删除 - 使用ViewModel.checkLoginStatus()替代

  async loadUserData() {
    // ✅ 新架构中，此方法由ViewModel.loadUserData()替代
    // 页面层只需触发ViewModel方法，数据通过subscribe自动更新到页面
    if (this.viewModel) {
      try {
        await this.viewModel.loadUserData()
      } catch (error) {
        console.error('Profile页面：加载用户数据失败', error)
        Logger.error('Profile', 'LoadUserDataFailed', {
          errorType: error.name || 'LoadError',
          errorMsg: error.message || 'Load user data failed',
          errorCode: 'ERR_PROFILE_LOAD_USER',
          fallback: 'silent_fail',
          impact: 'no_impact'
        })
        // 错误已记录到ViewModel的state.error，页面会通过subscribe自动更新
      }
    }
  },


  async handleLogin() {
    // ✅ 强制使用新架构登录
    if (this.viewModel) {
      return this._handleLoginNew()
    }
  },

  /**
   * 新架构登录处理
   * @private
   */
  async _handleLoginNew() {
    try {
      // 1. 获取用户授权
      const profileRes = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善用户资料和学习数据同步',
          success: resolve,
          fail: reject
        })
      })

      // 2. 通过ViewModel处理授权数据
      const authResult = await this.viewModel.processUserAuth(profileRes)
      if (!authResult.success) {
        throw new Error(authResult.error)
      }

      // 3. 获取微信登录凭证
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        })
      })

      if (!loginRes.code) {
        throw new Error('获取微信登录凭证失败')
      }

      // 4. 调用ViewModel登录
      const result = await this.viewModel.login(authResult.profile, loginRes.code)

      if (result.success) {
        showSuccess('登录成功')
        // 触发数据同步
        setTimeout(() => {
          this.handleSyncData()
        }, 100)
      } else {
        showError(result.error || '登录失败')
      }

    } catch (error) {
      Logger.error('Profile', 'LoginFailed', {
        errorType: error.name || 'LoginError',
        errorMsg: error.message || 'Login failed',
        errorCode: 'ERR_PROFILE_LOGIN',
        fallback: 'show_error_toast',
        impact: 'feature_degradation'
      })
      showError(error.message || '登录失败')
    }
  },

  // ✅ _handleLoginLegacy 已删除 - 旧架构已完全移除

  // 退出登录
  handleLogout() {
    // ✅ 强制使用新架构登出
    if (this.viewModel) {
      return this._handleLogoutNew()
    }
  },

  /**
   * 新架构登出处理
   * @private
   */
  _handleLogoutNew() {
    wx.showModal({
      title: '确认退出',
      content: '退出登录后，本地学习数据将被清除，确定要退出吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await this.viewModel.logout()

            if (result.success) {
              showSuccess('已退出登录')
            } else {
              showError(result.error || '登出失败')
            }
          } catch (error) {
            Logger.error('Profile', 'LogoutFailed', {
              errorType: error.name || 'LogoutError',
              errorMsg: error.message || 'Logout failed',
              errorCode: 'ERR_PROFILE_LOGOUT',
              fallback: 'show_error_toast',
              impact: 'no_impact'
            })
            showError(error.message || '登出失败')
          }
        }
      }
    })
  },

  // ✅ _handleLogoutLegacy 已删除 - 旧架构已完全移除


  // 编辑用户信息
  editUserInfo() {
    if (!this.data.hasLogin) {
      showError('请先登录')
      return
    }

    wx.showModal({
      title: '编辑资料',
      content: '功能开发中，敬请期待！',
      showCancel: false
    })
  },

  // 清除缓存
  clearCache() {
    // ✅ 强制使用新架构缓存清理
    if (this.viewModel) {
      return this._clearCacheNew()
    }
  },

  /**
   * 新架构缓存清理
   * @private
   */
  _clearCacheNew() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有本地缓存数据吗？这不会影响您的云端数据。',
      success: async (res) => {
        if (res.confirm) {
          try {
            const result = await this.viewModel.clearCache()

            if (result.success) {
              showSuccess('缓存已清除')
            } else {
              showError(result.error || '清除缓存失败')
            }
          } catch (error) {
            Logger.error('Profile', 'ClearCacheFailed', {
              errorType: error.name || 'CacheError',
              errorMsg: error.message || 'Clear cache failed',
              errorCode: 'ERR_PROFILE_CLEAR_CACHE',
              fallback: 'show_error_toast',
              impact: 'no_impact'
            })
            showError(error.message || '清除缓存失败')
          }
        }
      }
    })
  },

  // ✅ _clearCacheLegacy 已删除 - 旧架构已完全移除

  // 刷新用户信息
  async refreshUserInfo() {
    // ✅ 强制使用新架构刷新
    if (this.viewModel) {
      return this._refreshUserInfoNew()
    }
  },

  /**
   * 新架构刷新用户信息
   * @private
   */
  async _refreshUserInfoNew() {
    if (!this.data.hasLogin) {
      return
    }

    wx.showLoading({
      title: '刷新中...',
      mask: true
    })

    try {
      const result = await this.viewModel.refreshUserInfo()

      if (result.success) {
        showSuccess('已刷新')
      } else {
        showError(result.message || '刷新失败')
      }
    } catch (error) {
      Logger.error('Profile', 'RefreshUserInfoFailed', {
        errorType: error.name || 'RefreshError',
        errorMsg: error.message || 'Refresh user info failed',
        errorCode: 'ERR_PROFILE_REFRESH',
        fallback: 'show_error_toast',
        impact: 'no_impact'
      })
      showError(error.message || '刷新失败')
    } finally {
      wx.hideLoading()
    }
  },

  // ✅ _refreshUserInfoLegacy 已删除 - 旧架构已完全移除

  // 下拉刷新
  onPullDownRefresh() {
    console.log('【下拉刷新】开始')

    // ✅ 强制使用新架构下拉刷新
    if (this.viewModel) {
      this._pullDownRefreshNew()
    }
  },

  /**
   * 新架构下拉刷新
   * @private
   */
  async _pullDownRefreshNew() {
    try {
      // 重新加载所有数据
      await this._loadNewArchitectureData()

      // 延迟结束刷新动画
      setTimeout(() => {
        wx.stopPullDownRefresh()
        console.log('【下拉刷新】完成')
      }, 1000)
    } catch (error) {
      Logger.error('Profile', 'PullDownRefreshFailed', {
        errorType: error.name || 'RefreshError',
        errorMsg: error.message || 'Pull down refresh failed',
        errorCode: 'ERR_PROFILE_PULL_REFRESH',
        fallback: 'stop_refresh',
        impact: 'no_impact'
      })
      wx.stopPullDownRefresh()
    }
  },

  // ✅ _pullDownRefreshLegacy 已删除 - 旧架构已完全移除

  // 同步用户数据
  handleSyncData() {
    // ✅ 强制使用新架构数据同步
    if (this.viewModel) {
      return this._syncDataNew()
    }
  },

  /**
   * 新架构数据同步
   * @private
   */
  async _syncDataNew() {
    try {
      const result = await this.viewModel.syncUserData()

      if (result.success) {
        showSuccess(result.message || '数据同步成功')
      } else {
        showError(result.error || '数据同步失败')
      }
    } catch (error) {
      Logger.error('Profile', 'SyncDataFailed', {
        errorType: error.name || 'SyncError',
        errorMsg: error.message || 'Sync data failed',
        errorCode: 'ERR_PROFILE_SYNC_DATA',
        fallback: 'show_error_toast',
        impact: 'feature_degradation'
      })
      showError(error.message || '数据同步失败')
    }
  },

  // ✅ _syncDataLegacy 已删除 - 旧架构已完全移除


  goToStudySettings() {
    wx.showToast({
      title: '功能开发中...',
      icon: 'none'
    })
  },

  goToStudyHistory() {
    wx.showToast({
      title: '功能开发中...',
      icon: 'none'
    })
  },

  goToFeedback() {
    wx.showModal({
      title: '意见反馈',
      content: '请通过邮箱 feedback@example.com 联系我们，或在应用商店留下评价。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  showAbout() {
    this.setData({ showAboutModal: true })
  },

  hideAbout() {
    this.setData({ showAboutModal: false })
  },

  showAllAchievements() {
    wx.showToast({
      title: '功能开发中...',
      icon: 'none'
    })
  },

  // 检查主题设置
  async checkThemeSetup() {
    try {
      // 通过ViewModel检查主题设置状态
      const themeSetupStatus = await this.viewModel.checkThemeSetupStatus()

      if (!themeSetupStatus.hasSeen) {
        // 获取系统主题
        const systemTheme = themeUtils.getSystemTheme()

        // 延迟显示，让页面先加载完成
        setTimeout(() => {
          this.setData({
            showThemeSetup: true,
            systemTheme
          })
        }, 1000)
      }
    } catch (error) {
      Logger.warn('Profile', 'CheckThemeSetupFailed', {
        errorType: error.name || 'ThemeError',
        errorMsg: error.message || 'Check theme setup failed',
        errorCode: 'ERR_PROFILE_CHECK_THEME',
        fallback: 'assume_not_set',
        impact: 'no_impact'
      })
      // 降级处理：假设未设置
      const systemTheme = themeUtils.getSystemTheme()
      setTimeout(() => {
        this.setData({
          showThemeSetup: true,
          systemTheme
        })
      }, 1000)
    }
  },

  // 主题设置确认
  async onThemeSetupConfirm(e) {
    try {
      const { theme, followSystem } = e.detail

      // 通过ViewModel设置主题
      await this.viewModel.setThemePreference({ theme, followSystem })

      // 关闭弹窗
      this.setData({
        showThemeSetup: false
      })

      console.log('✅ 主题设置完成:', { theme, followSystem })
    } catch (error) {
      Logger.error('Profile', 'SetThemeFailed', {
        errorType: error.name || 'ThemeError',
        errorMsg: error.message || 'Set theme failed',
        errorCode: 'ERR_PROFILE_SET_THEME',
        fallback: 'show_error_toast',
        impact: 'no_impact'
      })
      wx.showToast({
        title: '主题设置失败，请重试',
        icon: 'none'
      })
    }
  },

  // 关闭主题设置
  async onThemeSetupClose() {
    try {
      // 通过ViewModel标记已查看
      await this.viewModel.markThemeSetupViewed()

      this.setData({
        showThemeSetup: false
      })
    } catch (error) {
      Logger.warn('Profile', 'CloseThemeSetupFailed', {
        errorType: error.name || 'ThemeError',
        errorMsg: error.message || 'Close theme setup failed',
        errorCode: 'ERR_PROFILE_CLOSE_THEME',
        fallback: 'close_anyway',
        impact: 'no_impact'
      })
      // 降级处理：直接关闭弹窗
      this.setData({
        showThemeSetup: false
      })
    }
  }
})
