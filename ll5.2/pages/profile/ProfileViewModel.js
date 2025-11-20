/**
 * Profile页面视图模型
 *
 * 负责管理个人中心页面的状态和业务逻辑
 * 遵循Clean Architecture的ViewModel模式
 */

// ✅ 修复：将timeout-utils引用移到文件顶部（修正路径）
const { withTimeout } = require('../../core/infrastructure/utils/timeout-utils')

class ProfileViewModel {
  constructor({
    getUserProfileUseCase,
    getStudyStatisticsUseCase,
    weChatLoginUseCase,
    logoutUserUseCase,
    syncUserDataUseCase,
    clearCacheUseCase,
    storageAdapter,
    dateService
  }) {
    // 依赖注入验证
    if (!getUserProfileUseCase) {
      throw new Error('getUserProfileUseCase is required')
    }
    if (!getStudyStatisticsUseCase) {
      throw new Error('getStudyStatisticsUseCase is required')
    }
    if (!weChatLoginUseCase) {
      throw new Error('weChatLoginUseCase is required')
    }
    if (!logoutUserUseCase) {
      throw new Error('logoutUserUseCase is required')
    }
    if (!syncUserDataUseCase) {
      throw new Error('syncUserDataUseCase is required')
    }
    if (!clearCacheUseCase) {
      throw new Error('clearCacheUseCase is required')
    }
    if (!storageAdapter) {
      throw new Error('storageAdapter is required')
    }
    if (!dateService) {
      throw new Error('dateService is required')
    }

    // 注入依赖
    this.getUserProfileUseCase = getUserProfileUseCase
    this.getStudyStatisticsUseCase = getStudyStatisticsUseCase
    this.weChatLoginUseCase = weChatLoginUseCase
    this.logoutUserUseCase = logoutUserUseCase
    this.syncUserDataUseCase = syncUserDataUseCase
    this.clearCacheUseCase = clearCacheUseCase
    this.storageAdapter = storageAdapter
    this.dateService = dateService

    // 状态管理
    this.state = {
      userInfo: {},
      hasLogin: false,
      studyDays: 0,
      achievements: {
        totalStudyTime: 0,
        totalQuestions: 0,
        bestAccuracy: 0
      },
      isLoading: false,
      error: null,
      lastUpdated: null
    }

    // 状态变更监听器
    this.listeners = []
  }

  /**
   * 获取当前状态
   * @returns {Object} 视图状态
   */
  getState() {
    return { ...this.state }
  }

  /**
   * 订阅状态变更
   * @param {Function} listener - 状态变更回调
   * @returns {Function} 取消订阅函数
   */
  subscribe(listener) {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  /**
   * 更新状态并通知监听器
   * @private
   * @param {Object} updates - 状态更新
   */
  _updateState(updates) {
    this.state = {
      ...this.state,
      ...updates,
      lastUpdated: this.dateService.getCurrentDateISO()
    }

    // 通知所有监听器
    this.listeners.forEach(listener => {
      try {
        listener(this.getState())
      } catch (error) {
        console.error('ProfileViewModel: 状态监听器执行失败:', error)
      }
    })
  }

  /**
   * 检查登录状态
   * @returns {Promise<boolean>} 是否已登录
   */
  async checkLoginStatus() {
    try {
      this._updateState({ isLoading: true, error: null })

      // 从本地存储检查用户信息
      const userInfo = await this.storageAdapter.get('userInfo')

      if (userInfo && userInfo.openid) {
        this._updateState({
          userInfo,
          hasLogin: true,
          isLoading: false
        })
        return true
      } else {
        this._updateState({
          userInfo: {},
          hasLogin: false,
          isLoading: false
        })
        return false
      }
    } catch (error) {
      console.error('ProfileViewModel: 检查登录状态失败:', error)
      this._updateState({
        error: error.message,
        isLoading: false
      })
      return false
    }
  }

  /**
   * 加载用户数据
   * @param {string} userId - 用户ID（可选，默认使用当前登录用户）
   * @returns {Promise<Object>} 加载结果
   */
  async loadUserData(userId = null) {
    try {
      this._updateState({ isLoading: true, error: null })

      // 如果没有指定userId，使用当前登录用户的ID
      if (!userId) {
        if (!this.state.hasLogin || !this.state.userInfo.openid) {
          throw new Error('用户未登录')
        }
        userId = this.state.userInfo.openid
      }

      // 获取用户资料
      const profileData = await this.getUserProfileUseCase.execute(userId)

      // 更新状态
      this._updateState({
        userInfo: {
          ...this.state.userInfo,
          ...profileData.userInfo
        },
        studyDays: profileData.studyStatistics.studyDays,
        achievements: {
          totalStudyTime: profileData.studyStatistics.totalStudyTime,
          totalQuestions: profileData.studyStatistics.totalQuestions,
          bestAccuracy: profileData.studyStatistics.bestAccuracy
        },
        isLoading: false
      })

      return {
        success: true,
        data: profileData
      }

    } catch (error) {
      console.error('ProfileViewModel: 加载用户数据失败:', error)

      // 设置默认数据
      this._updateState({
        studyDays: 1,
        achievements: {
          totalStudyTime: 0,
          totalQuestions: 0,
          bestAccuracy: 0
        },
        error: error.message,
        isLoading: false
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 用户登录
   * @param {Object} userProfile - 用户授权信息
   * @param {string} loginCode - 微信登录凭证
   * @returns {Promise<Object>} 登录结果
   */
  async login(userProfile, loginCode) {
    try {
      this._updateState({ isLoading: true, error: null })

      // 检查是否已经登录
      if (this.state.hasLogin) {
        this._updateState({ isLoading: false })
        return {
          success: false,
          message: '您已登录'
        }
      }

      // 执行登录
      const loginResult = await this.weChatLoginUseCase.execute({
        userProfile,
        loginCode
      })

      if (loginResult.success) {
        // 保存到本地存储
        await this.storageAdapter.save('userInfo', loginResult.userInfo)
        await this.storageAdapter.save('openid', loginResult.openid)

        // 更新状态
        this._updateState({
          userInfo: loginResult.userInfo,
          hasLogin: true,
          isLoading: false
        })

        // 触发数据同步
        setTimeout(() => {
          this.syncUserData()
        }, 100)

        return {
          success: true,
          message: '登录成功',
          data: loginResult
        }
      } else {
        throw new Error(loginResult.message || '登录失败')
      }

    } catch (error) {
      console.error('ProfileViewModel: 登录失败:', error)
      this._updateState({
        error: error.message,
        isLoading: false
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 用户登出
   * @returns {Promise<Object>} 登出结果
   */
  async logout() {
    try {
      this._updateState({ isLoading: true, error: null })

      // 执行登出逻辑 (A1超时保护)
      await this._executeUseCaseWithTimeout(this.logoutUserUseCase, 'LogoutUserUseCase')

      // 清除本地存储
      await this.storageAdapter.remove('userInfo')
      await this.storageAdapter.remove('openid')

      // 重置状态
      this._updateState({
        userInfo: {},
        hasLogin: false,
        studyDays: 0,
        achievements: {
          totalStudyTime: 0,
          totalQuestions: 0,
          bestAccuracy: 0
        },
        isLoading: false
      })

      return {
        success: true,
        message: '已退出登录'
      }

    } catch (error) {
      console.error('ProfileViewModel: 登出失败:', error)
      this._updateState({
        error: error.message,
        isLoading: false
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 同步用户数据
   * @returns {Promise<Object>} 同步结果
   */
  async syncUserData() {
    try {
      this._updateState({ isLoading: true, error: null })

      // 执行数据同步 (A1超时保护)
      const syncResult = await this._executeUseCaseWithTimeout(this.syncUserDataUseCase, 'SyncUserDataUseCase')

      this._updateState({ isLoading: false })

      // 重新加载用户数据
      await this.loadUserData()

      return {
        success: true,
        message: syncResult.message,
        data: syncResult
      }

    } catch (error) {
      console.error('ProfileViewModel: 数据同步失败:', error)
      this._updateState({
        error: error.message,
        isLoading: false
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 清除缓存
   * @returns {Promise<Object>} 清除结果
   */
  async clearCache() {
    try {
      this._updateState({ isLoading: true, error: null })

      // 执行缓存清理 (A1超时保护)
      await this._executeUseCaseWithTimeout(this.clearCacheUseCase, 'ClearCacheUseCase')

      this._updateState({ isLoading: false })

      // 重新检查登录状态
      await this.checkLoginStatus()

      // 重新加载数据
      await this.loadUserData()

      return {
        success: true,
        message: '缓存已清除'
      }

    } catch (error) {
      console.error('ProfileViewModel: 清除缓存失败:', error)
      this._updateState({
        error: error.message,
        isLoading: false
      })

      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 处理用户授权数据（从页面层接收wx API结果）
   * @param {Object} profileRes wx.getUserProfile的结果
   * @returns {Promise<Object>} 处理结果
   */
  async processUserAuth(profileRes) {
    try {
      // 验证授权数据
      if (!profileRes || !profileRes.userInfo) {
        throw new Error('无效的用户授权数据')
      }

      // 这里可以添加额外的验证或处理逻辑
      return {
        profile: profileRes,
        success: true,
        processed: true
      }
    } catch (error) {
      console.error('处理用户授权失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 检查主题设置状态（替换页面层的wx.getStorageSync）
   * @returns {Promise<Object>} 主题设置状态
   */
  async checkThemeSetupStatus() {
    try {
      const hasSeen = await this.storageAdapter.get('hasSeenThemeSetup')
      return {
        hasSeen: Boolean(hasSeen),
        success: true
      }
    } catch (error) {
      console.error('检查主题设置状态失败:', error)
      return {
        hasSeen: false,
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 设置主题偏好（替换页面层的主题设置逻辑）
   * @param {Object} themePreference 主题偏好
   * @returns {Promise<Object>} 设置结果
   */
  async setThemePreference(themePreference) {
    try {
      const { theme, followSystem } = themePreference

      // 根据用户选择设置主题
      if (followSystem) {
        // 这里应该调用主题工具，但为了架构纯净，我们只处理存储
        await this.storageAdapter.save('theme_follow_system', true)
      } else {
        await this.storageAdapter.save('user_theme', theme)
      }

      // 标记首次设置已完成
      await this.storageAdapter.save('hasSeenThemeSetup', true)

      return {
        success: true,
        message: '主题设置成功'
      }
    } catch (error) {
      console.error('设置主题偏好失败:', error)
      throw new Error('主题设置失败')
    }
  }

  /**
   * 标记主题设置已查看（替换页面层的wx.setStorageSync）
   * @returns {Promise<Object>} 标记结果
   */
  async markThemeSetupViewed() {
    try {
      await this.storageAdapter.save('hasSeenThemeSetup', true)
      return {
        success: true,
        message: '已标记主题设置已查看'
      }
    } catch (error) {
      console.error('标记主题设置已查看失败:', error)
      // 降级处理：不抛出错误，只记录日志
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 刷新用户信息
   * @returns {Promise<Object>} 刷新结果
   */
  async refreshUserInfo() {
    try {
      if (!this.state.hasLogin) {
        return {
          success: false,
          message: '用户未登录'
        }
      }

      // 重新检查登录状态
      await this.checkLoginStatus()

      // 重新加载用户数据
      const result = await this.loadUserData()

      return result

    } catch (error) {
      console.error('ProfileViewModel: 刷新用户信息失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * 执行Use Case并添加超时保护 (A1铁律)
   * @param {Object} useCase - Use Case实例
   * @param {string} useCaseName - Use Case名称
   * @param {Object} params - 执行参数
   * @returns {Promise} - 执行结果
   */
  async _executeUseCaseWithTimeout(useCase, useCaseName, params = {}) {
    // withTimeout已在文件顶部引入 
    try {
      console.log(`[ProfileViewModel] 执行Use Case: ${useCaseName} (超时保护)`)
      return await withTimeout(
        useCase.execute(params),
        30000, // 30秒超时
        useCaseName
      )
    } catch (error) {
      console.error(`[ProfileViewModel] Use Case执行失败: ${useCaseName}`, error)
      throw error
    }
  }
}

module.exports = ProfileViewModel