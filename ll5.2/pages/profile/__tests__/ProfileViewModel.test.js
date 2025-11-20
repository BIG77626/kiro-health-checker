/**
 * ProfileViewModel 测试
 * 验证个人中心页面的视图模型功能
 */
const ProfileViewModel = require('../ProfileViewModel')

// Mock dependencies
const mockGetUserProfileUseCase = {
  execute: jest.fn()
}

const mockGetStudyStatisticsUseCase = {
  execute: jest.fn()
}

const mockWeChatLoginUseCase = {
  execute: jest.fn()
}

const mockLogoutUserUseCase = {
  execute: jest.fn()
}

const mockSyncUserDataUseCase = {
  execute: jest.fn()
}

const mockClearCacheUseCase = {
  execute: jest.fn()
}

const mockStorageAdapter = {
  get: jest.fn(),
  save: jest.fn(),
  remove: jest.fn()
}

const mockDateService = {
  now: jest.fn(),
  daysDiff: jest.fn(),
  getCurrentDateISO: jest.fn()
}

describe('ProfileViewModel', () => {
  let viewModel
  let mockListener

  beforeEach(() => {
    // 使用legacy fake timers避免异步泄漏
    jest.useFakeTimers('legacy')
    
    // 重置所有mock（只清除调用记录，保留mock定义）
    jest.clearAllMocks()
    
    // 修复：重置Mock实现到默认值
    mockDateService.now.mockReturnValue(new Date('2025-01-07T10:00:00.000Z'))
    mockDateService.getCurrentDateISO.mockReturnValue('2025-11-08T19:00:00.000Z')
    mockDateService.daysDiff.mockReturnValue(1)
    
    // 修复：确保storageAdapter有默认实现
    mockStorageAdapter.get.mockResolvedValue(null)
    mockStorageAdapter.save.mockResolvedValue(true)
    mockStorageAdapter.remove.mockResolvedValue(true)
    
    // 修复：确保UseCases有默认实现
    mockGetUserProfileUseCase.execute.mockResolvedValue({
      userInfo: {},
      studyStatistics: {
        studyDays: 1,
        totalStudyTime: 0,
        totalQuestions: 0,
        bestAccuracy: 0
      }
    })
    mockGetStudyStatisticsUseCase.execute.mockResolvedValue({})
    mockWeChatLoginUseCase.execute.mockResolvedValue({ success: true })
    mockLogoutUserUseCase.execute.mockResolvedValue({ success: true })
    mockSyncUserDataUseCase.execute.mockResolvedValue({ success: true })
    mockClearCacheUseCase.execute.mockResolvedValue({ success: true })

    // 创建ViewModel实例
    viewModel = new ProfileViewModel({
      getUserProfileUseCase: mockGetUserProfileUseCase,
      getStudyStatisticsUseCase: mockGetStudyStatisticsUseCase,
      weChatLoginUseCase: mockWeChatLoginUseCase,
      logoutUserUseCase: mockLogoutUserUseCase,
      syncUserDataUseCase: mockSyncUserDataUseCase,
      clearCacheUseCase: mockClearCacheUseCase,
      storageAdapter: mockStorageAdapter,
      dateService: mockDateService
    })

    // Mock 状态监听器
    mockListener = jest.fn()
  })

  afterEach(() => {
    // 清理所有定时器，避免Jest无法退出
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  describe('constructor', () => {
    test('应该正确创建ViewModel实例', () => {
      expect(viewModel).toBeDefined()
      expect(viewModel.getUserProfileUseCase).toBe(mockGetUserProfileUseCase)
      expect(viewModel.getStudyStatisticsUseCase).toBe(mockGetStudyStatisticsUseCase)
      expect(viewModel.weChatLoginUseCase).toBe(mockWeChatLoginUseCase)
      expect(viewModel.logoutUserUseCase).toBe(mockLogoutUserUseCase)
      expect(viewModel.syncUserDataUseCase).toBe(mockSyncUserDataUseCase)
      expect(viewModel.clearCacheUseCase).toBe(mockClearCacheUseCase)
      expect(viewModel.storageAdapter).toBe(mockStorageAdapter)
      expect(viewModel.dateService).toBe(mockDateService)
    })

    test('缺少必需依赖时应该抛出错误', () => {
      expect(() => new ProfileViewModel({})).toThrow('getUserProfileUseCase is required')
      expect(() => new ProfileViewModel({
        getUserProfileUseCase: mockGetUserProfileUseCase
      })).toThrow('getStudyStatisticsUseCase is required')
      expect(() => new ProfileViewModel({
        getUserProfileUseCase: mockGetUserProfileUseCase,
        getStudyStatisticsUseCase: mockGetStudyStatisticsUseCase
      })).toThrow('weChatLoginUseCase is required')
      expect(() => new ProfileViewModel({
        getUserProfileUseCase: mockGetUserProfileUseCase,
        getStudyStatisticsUseCase: mockGetStudyStatisticsUseCase,
        weChatLoginUseCase: mockWeChatLoginUseCase
      })).toThrow('logoutUserUseCase is required')
      expect(() => new ProfileViewModel({
        getUserProfileUseCase: mockGetUserProfileUseCase,
        getStudyStatisticsUseCase: mockGetStudyStatisticsUseCase,
        weChatLoginUseCase: mockWeChatLoginUseCase,
        logoutUserUseCase: mockLogoutUserUseCase
      })).toThrow('syncUserDataUseCase is required')
      expect(() => new ProfileViewModel({
        getUserProfileUseCase: mockGetUserProfileUseCase,
        getStudyStatisticsUseCase: mockGetStudyStatisticsUseCase,
        weChatLoginUseCase: mockWeChatLoginUseCase,
        logoutUserUseCase: mockLogoutUserUseCase,
        syncUserDataUseCase: mockSyncUserDataUseCase
      })).toThrow('clearCacheUseCase is required')
      expect(() => new ProfileViewModel({
        getUserProfileUseCase: mockGetUserProfileUseCase,
        getStudyStatisticsUseCase: mockGetStudyStatisticsUseCase,
        weChatLoginUseCase: mockWeChatLoginUseCase,
        logoutUserUseCase: mockLogoutUserUseCase,
        syncUserDataUseCase: mockSyncUserDataUseCase,
        clearCacheUseCase: mockClearCacheUseCase
      })).toThrow('storageAdapter is required')
      expect(() => new ProfileViewModel({
        getUserProfileUseCase: mockGetUserProfileUseCase,
        getStudyStatisticsUseCase: mockGetStudyStatisticsUseCase,
        weChatLoginUseCase: mockWeChatLoginUseCase,
        logoutUserUseCase: mockLogoutUserUseCase,
        syncUserDataUseCase: mockSyncUserDataUseCase,
        clearCacheUseCase: mockClearCacheUseCase,
        storageAdapter: mockStorageAdapter
      })).toThrow('dateService is required')
    })

    test('应该初始化正确的默认状态', () => {
      const state = viewModel.getState()

      expect(state.userInfo).toEqual({})
      expect(state.hasLogin).toBe(false)
      expect(state.studyDays).toBe(0)
      expect(state.achievements).toEqual({
        totalStudyTime: 0,
        totalQuestions: 0,
        bestAccuracy: 0
      })
      expect(state.isLoading).toBe(false)
      expect(state.error).toBe(null)
      expect(state.lastUpdated).toBe(null)
    })
  })

  describe('状态管理', () => {
    test('getState应该返回状态的副本', () => {
      const state1 = viewModel.getState()
      const state2 = viewModel.getState()

      expect(state1).not.toBe(state2) // 应该是不同的对象
      expect(state1).toEqual(state2) // 但内容应该相同
    })

    test('subscribe应该添加监听器并返回取消订阅函数', () => {
      const unsubscribe = viewModel.subscribe(mockListener)

      expect(viewModel.listeners).toContain(mockListener)

      unsubscribe()
      expect(viewModel.listeners).not.toContain(mockListener)
    })

    test('_updateState应该更新状态并通知监听器', () => {
      viewModel.subscribe(mockListener)

      viewModel._updateState({ isLoading: true, error: 'test error' })

      expect(mockListener).toHaveBeenCalledTimes(1)
      expect(mockListener).toHaveBeenCalledWith(expect.objectContaining({
        isLoading: true,
        error: 'test error',
        lastUpdated: '2025-11-08T19:00:00.000Z'
      }))
    })

    test('状态变更监听器执行失败时应该继续执行其他监听器', () => {
      const mockListener2 = jest.fn()
      const failingListener = jest.fn().mockImplementation(() => {
        throw new Error('Listener failed')
      })

      viewModel.subscribe(failingListener)
      viewModel.subscribe(mockListener2)

      // 模拟控制台错误
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

      viewModel._updateState({ isLoading: true })

      expect(failingListener).toHaveBeenCalledTimes(1)
      expect(mockListener2).toHaveBeenCalledTimes(1)
      expect(consoleSpy).toHaveBeenCalledWith(
        'ProfileViewModel: 状态监听器执行失败:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })
  })

  describe('checkLoginStatus', () => {
    test('应该正确检查已登录状态', async () => {
      const mockUserInfo = {
        openid: 'test_openid',
        nickName: 'Test User'
      }

      mockStorageAdapter.get.mockResolvedValue(mockUserInfo)

      const result = await viewModel.checkLoginStatus()

      expect(result).toBe(true)
      expect(mockStorageAdapter.get).toHaveBeenCalledWith('userInfo')
      expect(viewModel.getState()).toEqual(expect.objectContaining({
        userInfo: mockUserInfo,
        hasLogin: true,
        isLoading: false,
        error: null
      }))
    })

    test('应该正确处理未登录状态', async () => {
      mockStorageAdapter.get.mockResolvedValue(null)

      const result = await viewModel.checkLoginStatus()

      expect(result).toBe(false)
      expect(viewModel.getState()).toEqual(expect.objectContaining({
        userInfo: {},
        hasLogin: false,
        isLoading: false,
        error: null
      }))
    })

    test('应该处理存储读取错误', async () => {
      mockStorageAdapter.get.mockRejectedValue(new Error('Storage error'))

      const result = await viewModel.checkLoginStatus()

      expect(result).toBe(false)
      expect(viewModel.getState()).toEqual(expect.objectContaining({
        error: 'Storage error',
        isLoading: false
      }))
    })
  })

  describe('loadUserData', () => {
    const mockProfileData = {
      userId: 'user_123',
      userInfo: {
        nickName: 'Test User',
        avatarUrl: 'http://example.com/avatar.jpg'
      },
      studyStatistics: {
        studyDays: 30,
        totalStudyTime: 120,
        totalQuestions: 500,
        bestAccuracy: 85
      }
    }

    test('应该成功加载用户数据', async () => {
      // 先设置登录状态
      viewModel._updateState({
        hasLogin: true,
        userInfo: { openid: 'user_123' }
      })

      mockGetUserProfileUseCase.execute.mockResolvedValue(mockProfileData)

      const result = await viewModel.loadUserData()

      expect(result.success).toBe(true)
      expect(mockGetUserProfileUseCase.execute).toHaveBeenCalledWith('user_123')
      expect(viewModel.getState()).toEqual(expect.objectContaining({
        studyDays: 30,
        achievements: {
          totalStudyTime: 120,
          totalQuestions: 500,
          bestAccuracy: 85
        },
        isLoading: false
      }))
    })

    test('应该使用指定的userId', async () => {
      mockGetUserProfileUseCase.execute.mockResolvedValue(mockProfileData)

      await viewModel.loadUserData('custom_user_id')

      expect(mockGetUserProfileUseCase.execute).toHaveBeenCalledWith('custom_user_id')
    })

    test('未登录时应该抛出错误', async () => {
      viewModel._updateState({ hasLogin: false })

      const result = await viewModel.loadUserData()

      expect(result.success).toBe(false)
      expect(result.error).toBe('用户未登录')
    })

    test('应该处理UseCase执行错误并设置默认数据', async () => {
      viewModel._updateState({
        hasLogin: true,
        userInfo: { openid: 'user_123' }
      })

      mockGetUserProfileUseCase.execute.mockRejectedValue(new Error('Database error'))

      const result = await viewModel.loadUserData()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database error')
      expect(viewModel.getState()).toEqual(expect.objectContaining({
        studyDays: 1,
        achievements: {
          totalStudyTime: 0,
          totalQuestions: 0,
          bestAccuracy: 0
        },
        isLoading: false
      }))
    })
  })

  describe('login', () => {
    const mockUserProfile = {
      userInfo: {
        nickName: 'Test User',
        avatarUrl: 'http://example.com/avatar.jpg'
      }
    }
    const mockLoginCode = 'test_login_code'

    const mockLoginResult = {
      success: true,
      userInfo: {
        ...mockUserProfile.userInfo,
        openid: 'test_openid',
        sessionKey: 'test_session_key',
        loginTime: '2025-01-07T10:00:00.000Z'
      },
      openid: 'test_openid',
      message: '登录成功'
    }

    test('应该成功执行登录', async () => {
      mockWeChatLoginUseCase.execute.mockResolvedValue(mockLoginResult)

      const result = await viewModel.login(mockUserProfile, mockLoginCode)

      expect(result.success).toBe(true)
      expect(result.message).toBe('登录成功')
      expect(mockWeChatLoginUseCase.execute).toHaveBeenCalledWith({
        userProfile: mockUserProfile,
        loginCode: mockLoginCode
      })
      expect(mockStorageAdapter.save).toHaveBeenCalledWith('userInfo', mockLoginResult.userInfo)
      expect(mockStorageAdapter.save).toHaveBeenCalledWith('openid', 'test_openid')
      expect(viewModel.getState()).toEqual(expect.objectContaining({
        userInfo: mockLoginResult.userInfo,
        hasLogin: true,
        isLoading: false
      }))
    })

    test('已经登录时应该返回失败', async () => {
      viewModel._updateState({ hasLogin: true })

      const result = await viewModel.login(mockUserProfile, mockLoginCode)

      expect(result.success).toBe(false)
      expect(result.message).toBe('您已登录')
      expect(mockWeChatLoginUseCase.execute).not.toHaveBeenCalled()
    })

    test('应该处理登录失败', async () => {
      mockWeChatLoginUseCase.execute.mockRejectedValue(new Error('登录失败'))

      const result = await viewModel.login(mockUserProfile, mockLoginCode)

      expect(result.success).toBe(false)
      expect(result.error).toBe('登录失败')
      expect(viewModel.getState()).toEqual(expect.objectContaining({
        error: '登录失败',
        isLoading: false
      }))
    })
  })

  describe('logout', () => {
    test('应该成功执行登出', async () => {
      const result = await viewModel.logout()

      expect(result.success).toBe(true)
      expect(result.message).toBe('已退出登录')
      expect(mockLogoutUserUseCase.execute).toHaveBeenCalled()
      expect(mockStorageAdapter.remove).toHaveBeenCalledWith('userInfo')
      expect(mockStorageAdapter.remove).toHaveBeenCalledWith('openid')
      expect(viewModel.getState()).toEqual(expect.objectContaining({
        userInfo: {},
        hasLogin: false,
        studyDays: 0,
        achievements: {
          totalStudyTime: 0,
          totalQuestions: 0,
          bestAccuracy: 0
        },
        isLoading: false
      }))
    })

    test('应该处理登出失败', async () => {
      mockLogoutUserUseCase.execute.mockRejectedValue(new Error('登出失败'))

      const result = await viewModel.logout()

      expect(result.success).toBe(false)
      expect(result.error).toBe('登出失败')
      expect(viewModel.getState()).toEqual(expect.objectContaining({
        error: '登出失败',
        isLoading: false
      }))
    })
  })

  describe('syncUserData', () => {
    test('应该成功同步用户数据', async () => {
      const mockSyncResult = {
        message: '成功同步 2 条学习记录到云端'
      }

      mockSyncUserDataUseCase.execute.mockResolvedValue(mockSyncResult)
      mockGetUserProfileUseCase.execute.mockResolvedValue({
        userId: 'user_123',
        userInfo: {},
        studyStatistics: {
          studyDays: 30,
          totalStudyTime: 120,
          totalQuestions: 500,
          bestAccuracy: 85
        }
      })

      // 设置登录状态
      viewModel._updateState({
        hasLogin: true,
        userInfo: { openid: 'user_123' }
      })

      const result = await viewModel.syncUserData()

      expect(result.success).toBe(true)
      expect(result.message).toBe('成功同步 2 条学习记录到云端')
      expect(mockSyncUserDataUseCase.execute).toHaveBeenCalled()
      expect(mockGetUserProfileUseCase.execute).toHaveBeenCalledWith('user_123')
    })

    test('应该处理同步失败', async () => {
      mockSyncUserDataUseCase.execute.mockRejectedValue(new Error('同步失败'))

      const result = await viewModel.syncUserData()

      expect(result.success).toBe(false)
      expect(result.error).toBe('同步失败')
      expect(viewModel.getState()).toEqual(expect.objectContaining({
        error: '同步失败',
        isLoading: false
      }))
    })
  })

  describe('clearCache', () => {
    test('应该成功清除缓存', async () => {
      mockClearCacheUseCase.execute.mockResolvedValue()
      mockStorageAdapter.get.mockResolvedValue({ openid: 'user_123' })
      mockGetUserProfileUseCase.execute.mockResolvedValue({
        userId: 'user_123',
        userInfo: {},
        studyStatistics: {
          studyDays: 30,
          totalStudyTime: 120,
          totalQuestions: 500,
          bestAccuracy: 85
        }
      })

      const result = await viewModel.clearCache()

      expect(result.success).toBe(true)
      expect(result.message).toBe('缓存已清除')
      expect(mockClearCacheUseCase.execute).toHaveBeenCalled()
      expect(mockStorageAdapter.get).toHaveBeenCalledWith('userInfo')
    })

    test('应该处理清除缓存失败', async () => {
      mockClearCacheUseCase.execute.mockRejectedValue(new Error('清除失败'))

      const result = await viewModel.clearCache()

      expect(result.success).toBe(false)
      expect(result.error).toBe('清除失败')
      expect(viewModel.getState()).toEqual(expect.objectContaining({
        error: '清除失败',
        isLoading: false
      }))
    })
  })

  describe('refreshUserInfo', () => {
    test('应该成功刷新用户信息', async () => {
      viewModel._updateState({
        hasLogin: true,
        userInfo: { openid: 'user_123' }
      })

      mockStorageAdapter.get.mockResolvedValue({ openid: 'user_123' })
      mockGetUserProfileUseCase.execute.mockResolvedValue({
        userId: 'user_123',
        userInfo: { nickName: 'Updated User' },
        studyStatistics: {
          studyDays: 31,
          totalStudyTime: 130,
          totalQuestions: 550,
          bestAccuracy: 88
        }
      })

      const result = await viewModel.refreshUserInfo()

      expect(result.success).toBe(true)
      expect(mockStorageAdapter.get).toHaveBeenCalledWith('userInfo')
      expect(mockGetUserProfileUseCase.execute).toHaveBeenCalledWith('user_123')
    })

    test('未登录时应该返回失败', async () => {
      viewModel._updateState({ hasLogin: false })

      const result = await viewModel.refreshUserInfo()

      expect(result.success).toBe(false)
      expect(result.message).toBe('用户未登录')
    })

    test('应该处理刷新失败', async () => {
      // 先设置登录状态
      viewModel._updateState({
        hasLogin: true,
        userInfo: { openid: 'user_123' }
      })

      // mock checkLoginStatus 方法，让它不调用 storageAdapter
      const originalCheckLogin = viewModel.checkLoginStatus
      viewModel.checkLoginStatus = jest.fn().mockResolvedValue(true)

      // mock loadUserData 抛出错误
      const originalLoadUserData = viewModel.loadUserData
      viewModel.loadUserData = jest.fn().mockRejectedValue(new Error('存储错误'))

      const result = await viewModel.refreshUserInfo()

      expect(result.success).toBe(false)
      expect(result.error).toBe('存储错误')

      // 恢复原始方法
      viewModel.checkLoginStatus = originalCheckLogin
      viewModel.loadUserData = originalLoadUserData
    })
  })

  // ==================== Day 2新增测试：未覆盖方法 ====================

  describe('processUserAuth - 处理用户授权数据', () => {
    test('应该成功处理有效的授权数据', async () => {
      const profileRes = {
        userInfo: {
          nickName: '测试用户',
          avatarUrl: 'https://example.com/avatar.png',
          gender: 1,
          country: '中国',
          province: '广东',
          city: '深圳'
        },
        rawData: '{"nickName":"测试用户"}',
        signature: 'test-signature'
      }

      const result = await viewModel.processUserAuth(profileRes)

      expect(result.success).toBe(true)
      expect(result.processed).toBe(true)
      expect(result.profile).toBe(profileRes)
      expect(result.profile.userInfo.nickName).toBe('测试用户')
    })

    test('授权数据为null时应该返回错误', async () => {
      const result = await viewModel.processUserAuth(null)

      expect(result.success).toBe(false)
      expect(result.error).toBe('无效的用户授权数据')
    })

    test('授权数据缺少userInfo时应该返回错误', async () => {
      const result = await viewModel.processUserAuth({})

      expect(result.success).toBe(false)
      expect(result.error).toBe('无效的用户授权数据')
    })
  })

  describe('checkThemeSetupStatus - 检查主题设置状态', () => {
    test('已经查看过时应该返回hasSeen=true', async () => {
      mockStorageAdapter.get.mockResolvedValue(true)

      const result = await viewModel.checkThemeSetupStatus()

      expect(result.hasSeen).toBe(true)
      expect(result.success).toBe(true)
      expect(mockStorageAdapter.get).toHaveBeenCalledWith('hasSeenThemeSetup')
    })

    test('从未查看过时应该返回hasSeen=false', async () => {
      mockStorageAdapter.get.mockResolvedValue(null)

      const result = await viewModel.checkThemeSetupStatus()

      expect(result.hasSeen).toBe(false)
      expect(result.success).toBe(true)
    })

    test('存储读取失败时应该Silent Fail', async () => {
      mockStorageAdapter.get.mockRejectedValue(new Error('Storage error'))

      const result = await viewModel.checkThemeSetupStatus()

      expect(result.hasSeen).toBe(false)
      expect(result.success).toBe(false)
      expect(result.error).toBe('Storage error')
    })
  })

  describe('setThemePreference - 设置主题偏好', () => {
    test('应该正确设置跟随系统主题', async () => {
      mockStorageAdapter.save.mockResolvedValue(true)

      const result = await viewModel.setThemePreference({
        followSystem: true
      })

      expect(result.success).toBe(true)
      expect(result.message).toBe('主题设置成功')
      expect(mockStorageAdapter.save).toHaveBeenCalledWith('theme_follow_system', true)
      expect(mockStorageAdapter.save).toHaveBeenCalledWith('hasSeenThemeSetup', true)
    })

    test('应该正确设置自定义主题', async () => {
      mockStorageAdapter.save.mockResolvedValue(true)

      const result = await viewModel.setThemePreference({
        theme: 'dark',
        followSystem: false
      })

      expect(result.success).toBe(true)
      expect(mockStorageAdapter.save).toHaveBeenCalledWith('user_theme', 'dark')
      expect(mockStorageAdapter.save).toHaveBeenCalledWith('hasSeenThemeSetup', true)
    })

    test('存储失败时应该抛出错误', async () => {
      mockStorageAdapter.save.mockRejectedValue(new Error('Save failed'))

      await expect(
        viewModel.setThemePreference({ theme: 'dark' })
      ).rejects.toThrow('主题设置失败')
    })
  })

  describe('markThemeSetupViewed - 标记主题设置已查看', () => {
    test('应该成功标记已查看', async () => {
      mockStorageAdapter.save.mockResolvedValue(true)

      const result = await viewModel.markThemeSetupViewed()

      expect(result.success).toBe(true)
      expect(result.message).toBe('已标记主题设置已查看')
      expect(mockStorageAdapter.save).toHaveBeenCalledWith('hasSeenThemeSetup', true)
    })

    test('标记失败时应该Silent Fail（不抛异常）', async () => {
      mockStorageAdapter.save.mockRejectedValue(new Error('Save failed'))

      const result = await viewModel.markThemeSetupViewed()

      expect(result.success).toBe(false)
      expect(result.error).toBe('Save failed')
    })
  })
})