// pages/profile/profile.js - Clean Architecture 版本
const { container } = require('../../core/infrastructure/di/container')
const { createThemeContainer } = require('../../core/infrastructure/di/themeContainer')

// 🏛️ 架构铁律合规: 使用DI容器获取服务
const themeContainer = createThemeContainer('wechat')
const checkThemeSetupStatusUseCase = themeContainer.resolve('checkThemeSetupStatusUseCase')
const markThemeSetupShownUseCase = themeContainer.resolve('markThemeSetupShownUseCase')
const themeService = themeContainer.resolve('IThemeService')

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
    isLoading: false
  },

  async onLoad(options) {
    console.log('【个人中心】页面加载 (Clean Architecture)', options)

    // 检查登录状态
    await this.checkLoginStatus()

    // 加载用户数据
    await this.loadUserData()
  },

  onReady() {
    // 性能跟踪
    const app = getApp()
    if (app.globalData && app.globalData.perfTest) {
      const loadTime = Date.now() - this.__loadStartTime
      app.globalData.perfTest.recordPagePerformance('profile', { loadTime })
    }

    console.log('【个人中心】页面渲染完成 (Clean Architecture)')
  },

  async onShow() {
    await this.loadUserData()
    this.checkThemeSetup()
  },

  /**
   * 检查登录状态
   */
  async checkLoginStatus() {
    try {
      // 通过存储适配器检查用户信息
      const storageAdapter = container.resolve('storageAdapter')
      const userInfo = await storageAdapter.get('userInfo')

      console.log('【检查登录状态】用户信息:', userInfo)

      if (userInfo) {
        this.setData({
          userInfo,
          hasLogin: true
        })
      } else {
        console.log('【未登录状态】未找到用户信息')
        this.setData({
          hasLogin: false
        })
      }
    } catch (error) {
      console.error('【检查登录状态失败】:', error)
      this.setData({
        hasLogin: false
      })
    }
  },

  /**
   * 加载用户数据
   */
  async loadUserData() {
    if (!this.data.hasLogin) {
      console.log('【跳过加载用户数据】用户未登录')
      return
    }

    try {
      this.setData({ isLoading: true })

      // 使用 Clean Architecture 用例获取用户资料
      const getUserProfileUseCase = container.resolve('getUserProfileUseCase')
      const profileData = await getUserProfileUseCase.execute(this.data.userInfo.openid)

      this.setData({
        studyDays: profileData.studyStatistics.studyDays,
        achievements: {
          totalStudyTime: profileData.studyStatistics.totalStudyTime,
          totalQuestions: profileData.studyStatistics.totalQuestions,
          bestAccuracy: profileData.studyStatistics.bestAccuracy
        },
        isLoading: false
      })

      console.log('【用户数据加载完成】', profileData)

    } catch (error) {
      console.error('【加载用户数据失败】:', error)
      this.setData({
        studyDays: 0,
        achievements: {
          totalStudyTime: 0,
          totalQuestions: 0,
          bestAccuracy: 0
        },
        isLoading: false
      })
    }
  },

  /**
   * 处理登录
   */
  async handleLogin() {
    try {
      // 检查是否已经登录
      if (this.data.hasLogin) {
        wx.showToast({
          title: '您已登录',
          icon: 'none'
        })
        return
      }

      // 1. 获取用户授权
      const profileRes = await new Promise((resolve, reject) => {
        wx.getUserProfile({
          desc: '用于完善用户资料和学习数据同步',
          success: resolve,
          fail: reject
        })
      })

      // 2. 获取微信登录凭证
      const loginRes = await new Promise((resolve, reject) => {
        wx.login({
          success: resolve,
          fail: reject
        })
      })

      if (!loginRes.code) {
        throw new Error('获取微信登录凭证失败')
      }

      // 3. 使用 Clean Architecture 用例进行登录
      const weChatLoginUseCase = container.resolve('weChatLoginUseCase')
      const loginResult = await weChatLoginUseCase.execute({
        userProfile: profileRes,
        loginCode: loginRes.code
      })

      // 4. 保存用户信息到本地存储
      const storageAdapter = container.resolve('storageAdapter')
      await storageAdapter.set('userInfo', loginResult.userInfo)
      await storageAdapter.set('openid', loginResult.openid)

      // 5. 更新页面状态
      this.setData({
        userInfo: loginResult.userInfo,
        hasLogin: true
      })

      wx.showToast({
        title: '登录成功',
        icon: 'success'
      })

      // 6. 同步学习数据
      await this.syncUserData()

      // 7. 重新加载用户数据
      await this.loadUserData()

    } catch (error) {
      console.error('【登录失败】:', error)
      wx.showToast({
        title: error.message || '登录失败，请重试',
        icon: 'none'
      })
    }
  },

  /**
   * 退出登录
   */
  async handleLogout() {
    wx.showModal({
      title: '确认退出',
      content: '退出登录后，本地学习数据将被清除，确定要退出吗？',
      success: async (res) => {
        if (res.confirm) {
          try {
            // 使用 Clean Architecture 用例退出登录
            const logoutUseCase = container.resolve('logoutUserUseCase')
            await logoutUseCase.execute(this.data.userInfo.openid)

            // 重置页面数据
            this.setData({
              userInfo: {},
              hasLogin: false,
              studyDays: 0,
              achievements: {
                totalStudyTime: 0,
                totalQuestions: 0,
                bestAccuracy: 0
              }
            })

            wx.showToast({
              title: '已退出登录',
              icon: 'success'
            })
          } catch (error) {
            console.error('【退出登录失败】:', error)
            wx.showToast({
              title: '退出登录失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  /**
   * 同步用户数据
   */
  async syncUserData() {
    if (!this.data.hasLogin) {
      return
    }

    try {
      wx.showLoading({
        title: '同步中...',
        mask: true
      })

      const syncUseCase = container.resolve('syncUserDataUseCase')
      const result = await syncUseCase.execute(this.data.userInfo.openid)

      wx.hideLoading()

      if (result.syncedCount > 0) {
        wx.showToast({
          title: result.message,
          icon: 'success',
          duration: 2000
        })
      }

      // 重新加载用户数据
      await this.loadUserData()

    } catch (error) {
      wx.hideLoading()
      console.error('【数据同步失败】:', error)
      wx.showToast({
        title: '数据同步失败',
        icon: 'none'
      })
    }
  },

  /**
   * 清除缓存
   */
  async clearCache() {
    wx.showModal({
      title: '清除缓存',
      content: '确定要清除所有本地缓存数据吗？这不会影响您的云端数据。',
      success: async (res) => {
        if (res.confirm) {
          try {
            wx.showLoading({
              title: '清理中...',
              mask: true
            })

            const clearCacheUseCase = container.resolve('clearCacheUseCase')
            const result = await clearCacheUseCase.execute({
              keepUserData: true,  // 保留用户登录数据
              keepSettings: true   // 保留设置数据
            })

            wx.hideLoading()

            // 重新检查登录状态和加载数据
            await this.checkLoginStatus()
            await this.loadUserData()

            wx.showToast({
              title: result.message,
              icon: 'success',
              duration: 2000
            })

          } catch (error) {
            wx.hideLoading()
            console.error('【清除缓存失败】:', error)
            wx.showToast({
              title: '清除缓存失败',
              icon: 'none'
            })
          }
        }
      }
    })
  },

  /**
   * 刷新用户信息
   */
  async refreshUserInfo() {
    if (!this.data.hasLogin) {
      return
    }

    wx.showLoading({
      title: '刷新中...',
      mask: true
    })

    try {
      // 重新检查登录状态
      await this.checkLoginStatus()

      // 重新加载学习数据
      await this.loadUserData()

      setTimeout(() => {
        wx.hideLoading()
        wx.showToast({
          title: '已刷新',
          icon: 'success'
        })
      }, 1000)
    } catch (error) {
      wx.hideLoading()
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      })
    }
  },

  /**
   * 下拉刷新
   */
  async onPullDownRefresh() {
    console.log('【下拉刷新】开始')

    try {
      // 重新加载所有数据
      await this.checkLoginStatus()
      await this.loadUserData()

      // 延迟结束刷新动画
      setTimeout(() => {
        wx.stopPullDownRefresh()
        console.log('【下拉刷新】完成')
      }, 1500)
    } catch (error) {
      wx.stopPullDownRefresh()
      console.error('【下拉刷新失败】:', error)
    }
  },

  // 编辑用户信息（占位符）
  editUserInfo() {
    if (!this.data.hasLogin) {
      wx.showToast({
        title: '请先登录',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '编辑资料',
      content: '功能开发中，敬请期待！',
      showCancel: false
    })
  },

  // 其他功能保持不变（因为不涉及业务逻辑）
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

  // 主题设置相关
  async checkThemeSetup() {
    try {
      // 🏛️ 架构铁律合规: 通过Use Case检查主题设置状态 (A1超时保护)
      const result = await checkThemeSetupStatusUseCase.executeWithTimeout()
      const hasSeenThemeSetup = result.data.hasShown

      if (!hasSeenThemeSetup) {
        // 获取系统主题（UI相关，可以直接调用wx API）
        const systemTheme = wx.getSystemInfoSync().theme || 'light'

        // 延迟显示，让页面先加载完成
        setTimeout(() => {
          this.setData({
            showThemeSetup: true,
            systemTheme
          })
        }, 1000)
      }
    } catch (error) {
      console.error('[profile-clean] 检查主题设置状态失败:', error)
    }
  },

  async onThemeSetupConfirm(e) {
    const { theme, followSystem } = e.detail

    try {
      // 🏛️ 架构铁律合规: 通过服务设置主题
      if (followSystem) {
        await themeService.setFollowSystem(true)
      } else {
        await themeService.setFollowSystem(false)
        await themeService.setTheme(theme)
      }

      // 标记首次设置已完成 (A1超时保护)
      await markThemeSetupShownUseCase.executeWithTimeout()

      // 关闭弹窗
      this.setData({
        showThemeSetup: false
      })

      console.log('✅ 主题设置完成:', { theme, followSystem })
    } catch (error) {
      console.error('[profile-clean] 主题设置失败:', error)
    }
  },

  onThemeSetupClose() {
    // 🏛️ 架构铁律合规: 通过Use Case标记已查看 (A1超时保护)
    markThemeSetupShownUseCase.executeWithTimeout().catch(error => {
      console.error('[profile-clean] 标记主题设置失败:', error)
    })

    this.setData({
      showThemeSetup: false
    })
  }
})
