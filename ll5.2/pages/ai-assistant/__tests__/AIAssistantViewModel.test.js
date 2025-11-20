/**
 * === 测试编写检查清单 ===
 * 
 * [✅] Happy path测试
 * [✅] Boundary conditions测试
 * [✅] Dependency failure测试
 * [✅] Silent fail verification测试
 * [✅] State consistency测试
 */

const AIAssistantViewModel = require('../AIAssistantViewModel')

// Mock 依赖
const mockSendAIMessageUseCase = {
  execute: jest.fn()
}

const mockStorageAdapter = {
  get: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockResolvedValue(),
  remove: jest.fn().mockResolvedValue(),
  clear: jest.fn().mockResolvedValue(),
  has: jest.fn().mockResolvedValue(false)
}

const mockDateService = {
  getCurrentDateISO: jest.fn().mockReturnValue('2025-11-17T22:00:00.000Z')
}

describe('AIAssistantViewModel', () => {
  let viewModel
  let mockListener

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks()
    mockStorageAdapter.get.mockResolvedValue(null)
    mockStorageAdapter.has.mockResolvedValue(false)
    mockDateService.getCurrentDateISO.mockReturnValue('2025-11-17T22:00:00.000Z')

    // 创建ViewModel实例
    viewModel = new AIAssistantViewModel({
      sendAIMessageUseCase: mockSendAIMessageUseCase,
      storageAdapter: mockStorageAdapter,
      dateService: mockDateService
    })

    // Mock 状态监听器
    mockListener = jest.fn()
  })

  afterEach(() => {
    // 清理ViewModel
    if (viewModel && viewModel.destroy) {
      viewModel.destroy()
    }
  })

  // ==================== 1. Happy Path 测试 ====================
  
  describe('constructor - Happy Path', () => {
    test('应该正确创建ViewModel实例', () => {
      expect(viewModel).toBeDefined()
      expect(viewModel.sendAIMessageUseCase).toBe(mockSendAIMessageUseCase)
      expect(viewModel.storageAdapter).toBe(mockStorageAdapter)
      expect(viewModel.dateService).toBe(mockDateService)
    })

    test('应该初始化正确的默认状态', () => {
      const state = viewModel.getState()

      // 验证基本状态
      expect(state.activeTab).toBe('chat')
      expect(state.messages).toEqual([])
      expect(state.inputText).toBe('')
      expect(state.aiTyping).toBe(false)
      expect(state.scrollToView).toBe('')
      expect(state.loading).toBe(false)
      expect(state.error).toBe(null)
      expect(state.version).toBe(0)

      // 验证快速建议存在
      expect(Array.isArray(state.quickSuggestions)).toBe(true)
      expect(state.quickSuggestions.length).toBeGreaterThan(0)

      // 验证快捷功能存在
      expect(Array.isArray(state.quickActions)).toBe(true)
      expect(state.quickActions.length).toBeGreaterThan(0)

      // 验证学习课程存在
      expect(Array.isArray(state.learningCourses)).toBe(true)
      expect(state.learningCourses.length).toBeGreaterThan(0)
    })
  })

  describe('状态管理 - Happy Path', () => {
    test('getState应该返回状态的副本', () => {
      const state1 = viewModel.getState()
      const state2 = viewModel.getState()

      expect(state1).toEqual(state2)
      expect(state1).not.toBe(state2) // 不是同一个引用
    })

    test('subscribe应该正确添加监听器', () => {
      viewModel.subscribe(mockListener)
      
      // 触发状态更新
      viewModel.switchTab('courses')
      
      expect(mockListener).toHaveBeenCalled()
      expect(mockListener).toHaveBeenCalledWith(
        expect.objectContaining({ activeTab: 'courses' }),
        expect.objectContaining({ activeTab: 'chat' })
      )
    })

    test('unsubscribe应该正确移除监听器', () => {
      viewModel.subscribe(mockListener)
      viewModel.unsubscribe(mockListener)
      
      // 触发状态更新
      viewModel.switchTab('courses')
      
      expect(mockListener).not.toHaveBeenCalled()
    })
  })

  describe('switchTab - Happy Path', () => {
    test('应该正确切换到chat标签页', () => {
      viewModel.subscribe(mockListener)
      
      viewModel.switchTab('chat')
      
      const state = viewModel.getState()
      expect(state.activeTab).toBe('chat')
      expect(mockListener).toHaveBeenCalled()
    })

    test('应该正确切换到courses标签页', () => {
      viewModel.subscribe(mockListener)
      
      viewModel.switchTab('courses')
      
      const state = viewModel.getState()
      expect(state.activeTab).toBe('courses')
      expect(mockListener).toHaveBeenCalled()
    })
  })

  describe('clearConversation - Happy Path', () => {
    test('应该正确清空对话记录', () => {
      // 先添加一些消息（通过直接修改state模拟）
      viewModel._updateState({
        messages: [
          { id: 1, content: 'test message 1' },
          { id: 2, content: 'test message 2' }
        ]
      })
      
      // 清空对话
      viewModel.clearConversation()
      
      const state = viewModel.getState()
      expect(state.messages).toEqual([])
      expect(state.scrollToView).toBe('')
    })
  })

  describe('setTheme - Happy Path', () => {
    test('应该正确设置主题', () => {
      viewModel.setTheme('dark')
      
      const state = viewModel.getState()
      expect(state.themeClass).toBe('dark')
    })
  })

  // ==================== 2. Boundary Conditions 测试 ====================

  describe('constructor - Boundary Conditions', () => {
    test('缺少sendAIMessageUseCase时应该抛出错误', () => {
      expect(() => new AIAssistantViewModel({
        storageAdapter: mockStorageAdapter,
        dateService: mockDateService
      })).toThrow('sendAIMessageUseCase is required')
    })

    test('缺少storageAdapter时应该抛出错误', () => {
      expect(() => new AIAssistantViewModel({
        sendAIMessageUseCase: mockSendAIMessageUseCase,
        dateService: mockDateService
      })).toThrow('storageAdapter is required')
    })

    test('缺少dateService时应该抛出错误', () => {
      expect(() => new AIAssistantViewModel({
        sendAIMessageUseCase: mockSendAIMessageUseCase,
        storageAdapter: mockStorageAdapter
      })).toThrow('dateService is required')
    })

    test('传入空对象时应该抛出错误', () => {
      expect(() => new AIAssistantViewModel({})).toThrow()
    })

    test('传入null时应该抛出错误', () => {
      expect(() => new AIAssistantViewModel(null)).toThrow()
    })
  })

  describe('switchTab - Boundary Conditions', () => {
    test('传入无效标签页时应该抛出错误', () => {
      expect(() => viewModel.switchTab('invalid')).toThrow('无效的标签页标识')
    })

    test('传入空字符串时应该抛出错误', () => {
      expect(() => viewModel.switchTab('')).toThrow('无效的标签页标识')
    })

    test('传入null时应该抛出错误', () => {
      expect(() => viewModel.switchTab(null)).toThrow('无效的标签页标识')
    })

    test('传入undefined时应该抛出错误', () => {
      expect(() => viewModel.switchTab(undefined)).toThrow('无效的标签页标识')
    })
  })

  describe('subscribe - Boundary Conditions', () => {
    test('传入非函数类型应该被忽略', () => {
      viewModel.subscribe(null)
      viewModel.subscribe(undefined)
      viewModel.subscribe('string')
      viewModel.subscribe(123)
      viewModel.subscribe({})
      
      // 不应该抛出错误，且监听器数量为0
      expect(viewModel.listeners.length).toBe(0)
    })
  })

  describe('状态更新 - Boundary Conditions', () => {
    test('messages数组长度不应该减少时有警告', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      // 先添加消息
      viewModel._updateState({ messages: [{ id: 1 }, { id: 2 }] })
      
      // 减少消息数量
      viewModel._updateState({ messages: [{ id: 1 }] })
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('消息数量减少')
      )
      
      consoleSpy.mockRestore()
    })

    test('重复设置aiTyping时有警告', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation()
      
      viewModel._updateState({ aiTyping: true })
      viewModel._updateState({ aiTyping: true })
      
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('AI已经在回复中')
      )
      
      consoleSpy.mockRestore()
    })
  })

  // ==================== 3. Dependency Failure 测试 ====================

  describe('依赖失败处理', () => {
    test('storageAdapter.save失败时不应该抛出异常', async () => {
      mockStorageAdapter.save.mockRejectedValue(new Error('Storage failed'))
      
      // 这个操作内部可能调用storage，但不应该抛出异常
      await expect(async () => {
        viewModel.switchTab('courses')
      }).not.toThrow()
    })

    test('dateService返回无效值时应该处理', () => {
      mockDateService.getCurrentDateISO.mockReturnValue(null)
      
      expect(() => {
        viewModel.switchTab('courses')
      }).not.toThrow()
      
      const state = viewModel.getState()
      expect(state.lastUpdated).toBe(null)
    })

    test('监听器抛出异常时不应该影响状态更新', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error')
      })
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      
      viewModel.subscribe(errorListener)
      viewModel.subscribe(mockListener)
      
      expect(() => {
        viewModel.switchTab('courses')
      }).not.toThrow()
      
      // 正常监听器应该仍然被调用
      expect(mockListener).toHaveBeenCalled()
      
      // 错误应该被记录
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('状态监听器执行失败'),
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()
    })
  })

  // ==================== 4. Silent Fail Verification 测试 ====================

  describe('Silent Fail验证', () => {
    test('所有公开方法在异常情况下不应该crash', () => {
      // 测试destroy
      expect(() => viewModel.destroy()).not.toThrow()
      expect(() => viewModel.destroy()).not.toThrow() // 再次调用
      
      // 重新创建viewModel
      viewModel = new AIAssistantViewModel({
        sendAIMessageUseCase: mockSendAIMessageUseCase,
        storageAdapter: mockStorageAdapter,
        dateService: mockDateService
      })
      
      // 测试getState
      expect(() => viewModel.getState()).not.toThrow()
      
      // 测试clearConversation
      expect(() => viewModel.clearConversation()).not.toThrow()
      
      // 测试setTheme（各种值）
      expect(() => viewModel.setTheme('light')).not.toThrow()
      expect(() => viewModel.setTheme('dark')).not.toThrow()
      expect(() => viewModel.setTheme('')).not.toThrow()
      
      // 测试subscribe/unsubscribe
      expect(() => viewModel.subscribe(() => {})).not.toThrow()
      expect(() => viewModel.unsubscribe(() => {})).not.toThrow()
    })

    test('状态验证失败时应该抛出错误（不是silent fail）', () => {
      // messages必须是数组
      expect(() => {
        viewModel._updateState({ messages: 'not an array' })
      }).toThrow('messages必须是数组')
      
      // activeTab必须是字符串
      expect(() => {
        viewModel._updateState({ activeTab: 123 })
      }).toThrow('activeTab必须是字符串')
    })
  })

  // ==================== 5. State Consistency 测试 ====================

  describe('State Consistency', () => {
    test('状态更新后version应该递增', () => {
      const initialState = viewModel.getState()
      expect(initialState.version).toBe(0)
      
      viewModel.switchTab('courses')
      const state1 = viewModel.getState()
      expect(state1.version).toBe(1)
      
      viewModel.switchTab('chat')
      const state2 = viewModel.getState()
      expect(state2.version).toBe(2)
      
      viewModel.clearConversation()
      const state3 = viewModel.getState()
      expect(state3.version).toBe(3)
    })

    test('状态更新后lastUpdated应该更新', () => {
      const time1 = '2025-11-17T22:00:00.000Z'
      const time2 = '2025-11-17T22:01:00.000Z'
      
      mockDateService.getCurrentDateISO.mockReturnValue(time1)
      viewModel.switchTab('courses')
      expect(viewModel.getState().lastUpdated).toBe(time1)
      
      mockDateService.getCurrentDateISO.mockReturnValue(time2)
      viewModel.switchTab('chat')
      expect(viewModel.getState().lastUpdated).toBe(time2)
    })

    test('多次状态更新应该保持一致性', () => {
      viewModel.switchTab('courses')
      const state1 = viewModel.getState()
      
      viewModel.setTheme('dark')
      const state2 = viewModel.getState()
      
      // 之前的状态应该保持
      expect(state2.activeTab).toBe(state1.activeTab)
      expect(state2.version).toBe(state1.version + 1)
    })

    test('destroy后状态应该被清空', () => {
      viewModel.switchTab('courses')
      viewModel.destroy()
      
      expect(viewModel.listeners).toEqual([])
      expect(viewModel.state).toBe(null)
    })

    test('状态变更日志应该正确记录', () => {
      viewModel.switchTab('courses')
      viewModel.setTheme('dark')
      viewModel.clearConversation()
      
      expect(viewModel.stateChangeLog.length).toBe(3)
      expect(viewModel.stateChangeLog[0].action).toBe('switchTab')
      expect(viewModel.stateChangeLog[1].action).toBe('setTheme')
      
      // 验证日志包含变更信息
      expect(viewModel.stateChangeLog[0].changes).toHaveProperty('activeTab')
    })

    test('状态日志应该限制在100条以内', () => {
      // 模拟大量状态更新
      for (let i = 0; i < 150; i++) {
        viewModel.switchTab(i % 2 === 0 ? 'chat' : 'courses')
      }
      
      expect(viewModel.stateChangeLog.length).toBeLessThanOrEqual(100)
    })
  })

  // ==================== 集成测试 ====================

  describe('集成场景测试', () => {
    test('完整的用户交互流程', () => {
      const listener = jest.fn()
      viewModel.subscribe(listener)
      
      // 1. 切换到chat标签页
      viewModel.switchTab('chat')
      expect(viewModel.getState().activeTab).toBe('chat')
      
      // 2. 设置主题
      viewModel.setTheme('dark')
      expect(viewModel.getState().themeClass).toBe('dark')
      
      // 3. 添加消息并清空
      viewModel._updateState({
        messages: [{ id: 1, content: 'test' }]
      })
      viewModel.clearConversation()
      expect(viewModel.getState().messages).toEqual([])
      
      // 4. 切换到courses标签页
      viewModel.switchTab('courses')
      expect(viewModel.getState().activeTab).toBe('courses')
      
      // 验证监听器被调用次数
      expect(listener.mock.calls.length).toBeGreaterThan(0)
    })
  })

  // ==================== P0核心方法测试 ====================

  describe('sendMessage - Happy Path', () => {
    beforeEach(() => {
      // Mock dateService返回固定时间戳
      mockDateService.getCurrentTimestamp = jest.fn()
        .mockReturnValueOnce(1700000000)  // 用户消息
        .mockReturnValueOnce(1700000001)  // AI消息
    })

    test('应该成功发送消息并接收AI回复', async () => {
      mockSendAIMessageUseCase.execute.mockResolvedValue({
        success: true,
        response: {
          hint: 'AI的回复内容',
          suggestions: ['建议1', '建议2']
        }
      })

      const result = await viewModel.sendMessage('你好AI')

      expect(result).toBe(true)
      const state = viewModel.getState()
      expect(state.messages.length).toBe(2)
      expect(state.messages[0].content).toBe('你好AI')
      expect(state.messages[0].type).toBe('user')
      expect(state.messages[1].content).toBe('AI的回复内容')
      expect(state.messages[1].type).toBe('ai')
      expect(state.messages[1].suggestions).toEqual(['建议1', '建议2'])
      expect(state.aiTyping).toBe(false)
      expect(state.inputText).toBe('')
    })

    test('应该正确传递conversationHistory上下文', async () => {
      mockSendAIMessageUseCase.execute.mockResolvedValue({
        success: true,
        response: { hint: '回复' }
      })

      // 先添加一些历史消息
      viewModel._updateState({
        messages: Array(15).fill(null).map((_, i) => ({
          id: i,
          content: `message ${i}`,
          type: 'user'
        }))
      })

      await viewModel.sendMessage('新消息')

      expect(mockSendAIMessageUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          context: expect.objectContaining({
            conversationHistory: expect.arrayContaining([
              expect.objectContaining({ content: expect.stringContaining('message') })
            ])
          })
        })
      )

      // 验证只传递最近10条
      const call = mockSendAIMessageUseCase.execute.mock.calls[0][0]
      expect(call.context.conversationHistory.length).toBeLessThanOrEqual(10)
    })
  })

  describe('sendMessage - 输入验证失败', () => {
    test('空字符串应该返回false并显示错误', async () => {
      const result = await viewModel.sendMessage('')

      expect(result).toBe(false)
      expect(viewModel.getState().error).toBeTruthy()
      expect(viewModel.getState().messages.length).toBe(0)
    })

    test('只包含空格的字符串应该返回false', async () => {
      const result = await viewModel.sendMessage('   ')

      expect(result).toBe(false)
      expect(viewModel.getState().error).toBeTruthy()
    })

    test('null应该返回false', async () => {
      const result = await viewModel.sendMessage(null)

      expect(result).toBe(false)
      expect(viewModel.getState().error).toBeTruthy()
    })

    test('AI忙碌时应该返回false', async () => {
      viewModel._updateState({ aiTyping: true })

      const result = await viewModel.sendMessage('测试消息')

      expect(result).toBe(false)
      expect(viewModel.getState().error).toBeTruthy()
      // AI仍然保持忙碌状态
      expect(viewModel.getState().aiTyping).toBe(true)
    })
  })

  describe('sendMessage - UseCase失败处理', () => {
    test('AI对话失败应该返回false并显示友好错误', async () => {
      mockSendAIMessageUseCase.execute.mockRejectedValue(
        new Error('AI对话失败')
      )

      const result = await viewModel.sendMessage('测试消息')

      expect(result).toBe(false)
      expect(viewModel.getState().aiTyping).toBe(false)
      expect(viewModel.getState().error).toContain('AI服务暂时不可用')
    })

    test('网络错误应该返回false并显示网络提示', async () => {
      mockSendAIMessageUseCase.execute.mockRejectedValue(
        new Error('网络连接失败')
      )

      const result = await viewModel.sendMessage('测试消息')

      expect(result).toBe(false)
      expect(viewModel.getState().error).toContain('网络连接失败')
    })

    test('未知错误应该返回false并显示通用提示', async () => {
      mockSendAIMessageUseCase.execute.mockRejectedValue(
        new Error('Unknown error')
      )

      const result = await viewModel.sendMessage('测试消息')

      expect(result).toBe(false)
      expect(viewModel.getState().error).toBeTruthy()
      expect(viewModel.getState().aiTyping).toBe(false)
    })

    test('AI返回空响应应该使用默认消息', async () => {
      mockDateService.getCurrentTimestamp = jest.fn()
        .mockReturnValueOnce(1700000000)
        .mockReturnValueOnce(1700000001)

      mockSendAIMessageUseCase.execute.mockResolvedValue({
        success: true,
        response: {} // 空响应
      })

      const result = await viewModel.sendMessage('测试消息')

      expect(result).toBe(true)
      const state = viewModel.getState()
      expect(state.messages[1].content).toBe('抱歉，我没有理解您的问题，请重新表述。')
    })
  })

  describe('sendMessage - 状态一致性', () => {
    test('发送过程中aiTyping应该正确切换', async () => {
      mockDateService.getCurrentTimestamp = jest.fn()
        .mockReturnValue(1700000000)

      let typingDuringSend = false
      mockSendAIMessageUseCase.execute.mockImplementation(async () => {
        typingDuringSend = viewModel.getState().aiTyping
        return {
          success: true,
          response: { hint: '回复' }
        }
      })

      await viewModel.sendMessage('测试')

      expect(typingDuringSend).toBe(true) // 发送中是true
      expect(viewModel.getState().aiTyping).toBe(false) // 完成后是false
    })

    test('失败后aiTyping应该重置为false', async () => {
      mockSendAIMessageUseCase.execute.mockRejectedValue(
        new Error('失败')
      )

      await viewModel.sendMessage('测试')

      expect(viewModel.getState().aiTyping).toBe(false)
    })
  })

  describe('executeQuickAction - Happy Path', () => {
    beforeEach(() => {
      mockDateService.getCurrentTimestamp = jest.fn()
        .mockReturnValue(1700000000)
      mockSendAIMessageUseCase.execute.mockResolvedValue({
        success: true,
        response: { hint: 'AI回复' }
      })
    })

    test('应该正确执行diagnose诊断功能', async () => {
      await viewModel.executeQuickAction('diagnose')

      expect(mockSendAIMessageUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('学习诊断')
        })
      )
    })

    test('应该正确执行question_help答疑功能', async () => {
      await viewModel.executeQuickAction('question_help')

      expect(mockSendAIMessageUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('困难问题')
        })
      )
    })

    test('应该正确执行vocabulary_help词汇解析功能', async () => {
      await viewModel.executeQuickAction('vocabulary_help')

      expect(mockSendAIMessageUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('词汇')
        })
      )
    })

    test('应该正确执行practice_plan练习计划功能', async () => {
      await viewModel.executeQuickAction('practice_plan')

      expect(mockSendAIMessageUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('练习计划')
        })
      )
    })
  })

  describe('executeQuickAction - Boundary & Failure', () => {
    test('无效action应该抛出错误', async () => {
      await expect(
        viewModel.executeQuickAction('invalid_action')
      ).rejects.toThrow('未知的快捷功能')
    })

    test('sendMessage失败应该设置error状态', async () => {
      mockDateService.getCurrentTimestamp = jest.fn()
        .mockReturnValue(1700000000)
      mockSendAIMessageUseCase.execute.mockRejectedValue(
        new Error('发送失败')
      )

      // executeQuickAction内部调用sendMessage，sendMessage失败不抛异常
      await viewModel.executeQuickAction('diagnose')

      // sendMessage失败后aiTyping应该是false，error应该有值
      expect(viewModel.getState().aiTyping).toBe(false)
      expect(viewModel.getState().error).toBeTruthy()
    })

    test('loading状态应该正确管理', async () => {
      mockDateService.getCurrentTimestamp = jest.fn()
        .mockReturnValue(1700000000)
      
      let loadingDuringExecution = false
      mockSendAIMessageUseCase.execute.mockImplementation(async () => {
        loadingDuringExecution = viewModel.getState().loading
        return {
          success: true,
          response: { hint: '回复' }
        }
      })

      await viewModel.executeQuickAction('diagnose')

      expect(loadingDuringExecution).toBe(true)
      // 注意：loading由sendMessage管理，executeQuickAction只设置初始状态
    })
  })

  describe('startCourse - Happy Path', () => {
    test('应该成功启动课程并更新进度', async () => {
      mockDateService.getCurrentTimestamp = jest.fn()
        .mockReturnValue(1700000000)
      mockSendAIMessageUseCase.execute.mockResolvedValue({
        success: true,
        response: { hint: '欢迎' }
      })

      const initialState = viewModel.getState()
      const courseId = initialState.learningCourses[0].id
      const courseTitle = initialState.learningCourses[0].title

      await viewModel.startCourse(courseId)

      const state = viewModel.getState()
      const updatedCourse = state.learningCourses.find(c => c.id === courseId)
      
      expect(updatedCourse.completedLessons).toBeGreaterThanOrEqual(1)
      expect(state.activeTab).toBe('chat')
      // inputText在sendMessage成功后会被清空，所以应该是空字符串
      expect(state.inputText).toBe('')
      // 验证sendMessage被调用时带有欢迎消息
      expect(mockSendAIMessageUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining(courseTitle)
        })
      )
    })

    test('应该发送欢迎消息', async () => {
      mockDateService.getCurrentTimestamp = jest.fn()
        .mockReturnValue(1700000000)
      mockSendAIMessageUseCase.execute.mockResolvedValue({
        success: true,
        response: { hint: '欢迎' }
      })

      const courseId = viewModel.getState().learningCourses[0].id
      const courseTitle = viewModel.getState().learningCourses[0].title

      await viewModel.startCourse(courseId)

      expect(mockSendAIMessageUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('欢迎')
        })
      )
    })
  })

  describe('startCourse - Boundary & Failure', () => {
    test('课程不存在应该抛出错误', async () => {
      await expect(
        viewModel.startCourse('non-existent-course')
      ).rejects.toThrow('课程不存在')
    })

    test('sendMessage失败应该设置error状态', async () => {
      mockDateService.getCurrentTimestamp = jest.fn()
        .mockReturnValue(1700000000)
      mockSendAIMessageUseCase.execute.mockRejectedValue(
        new Error('发送失败')
      )

      const courseId = viewModel.getState().learningCourses[0].id

      // startCourse内部调用sendMessage，sendMessage失败不抛异常
      await viewModel.startCourse(courseId)

      // sendMessage失败后状态应该正确
      expect(viewModel.getState().aiTyping).toBe(false)
      expect(viewModel.getState().error).toBeTruthy()
    })

    test('loading状态应该正确管理', async () => {
      mockDateService.getCurrentTimestamp = jest.fn()
        .mockReturnValue(1700000000)
      
      let loadingDuringExecution = false
      mockSendAIMessageUseCase.execute.mockImplementation(async () => {
        loadingDuringExecution = viewModel.getState().loading
        return {
          success: true,
          response: { hint: '欢迎' }
        }
      })

      const courseId = viewModel.getState().learningCourses[0].id
      await viewModel.startCourse(courseId)

      expect(loadingDuringExecution).toBe(true)
    })
  })

  // ==================== P1辅助方法测试 ====================

  describe('loadConversationHistory - Happy Path & Failure', () => {
    test('应该成功加载历史消息', async () => {
      const mockHistory = [
        { id: 1, content: '消息1', type: 'user' },
        { id: 2, content: '消息2', type: 'ai' }
      ]
      mockStorageAdapter.get.mockResolvedValue(mockHistory)

      await viewModel.loadConversationHistory()

      const state = viewModel.getState()
      expect(state.messages).toEqual(mockHistory)
      expect(state.loading).toBe(false)
      expect(state.error).toBe(null)
    })

    test('无历史消息时应该返回空数组', async () => {
      mockStorageAdapter.get.mockResolvedValue(null)

      await viewModel.loadConversationHistory()

      const state = viewModel.getState()
      expect(state.messages).toEqual([])
    })

    test('加载失败不应该显示错误（Silent Fail）', async () => {
      mockStorageAdapter.get.mockRejectedValue(new Error('Storage failed'))
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await viewModel.loadConversationHistory()

      const state = viewModel.getState()
      expect(state.loading).toBe(false)
      expect(state.error).toBe(null) // Silent Fail
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })

  describe('saveConversationHistory - Silent Fail', () => {
    test('应该成功保存历史消息', async () => {
      viewModel._updateState({
        messages: [{ id: 1, content: '测试' }]
      })

      await viewModel.saveConversationHistory()

      expect(mockStorageAdapter.save).toHaveBeenCalledWith(
        expect.any(String),
        [{ id: 1, content: '测试' }]
      )
    })

    test('保存失败不应该抛出异常（Silent Fail）', async () => {
      mockStorageAdapter.save.mockRejectedValue(new Error('Save failed'))
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()

      await expect(
        viewModel.saveConversationHistory()
      ).resolves.not.toThrow()

      expect(consoleSpy).toHaveBeenCalled()
      consoleSpy.mockRestore()
    })
  })

  describe('useQuickSuggestion', () => {
    test('应该设置inputText并调用sendMessage', async () => {
      mockDateService.getCurrentTimestamp = jest.fn()
        .mockReturnValue(1700000000)
      mockSendAIMessageUseCase.execute.mockResolvedValue({
        success: true,
        response: { hint: '回复' }
      })

      await viewModel.useQuickSuggestion('快速建议文本')

      expect(viewModel.getState().inputText).toBe('')  // sendMessage后清空
      expect(mockSendAIMessageUseCase.execute).toHaveBeenCalled()
    })
  })

  describe('_diffStates - 私有方法', () => {
    test('应该正确识别状态差异', () => {
      const prev = { a: 1, b: 2, c: 3 }
      const next = { a: 1, b: 3, d: 4 }

      const diff = viewModel._diffStates(prev, next)

      expect(diff).toHaveProperty('b')
      expect(diff).toHaveProperty('c')
      expect(diff).toHaveProperty('d')
      expect(diff).not.toHaveProperty('a')  // 未改变
    })

    test('相同状态应该返回空对象', () => {
      const state = { a: 1, b: 2 }

      const diff = viewModel._diffStates(state, state)

      expect(Object.keys(diff).length).toBe(0)
    })
  })

  // ==================== ErrorHandler测试 ====================

  describe('AIAssistantErrorHandler', () => {
    let errorHandler

    beforeEach(() => {
      errorHandler = viewModel.errorHandler
    })

    test('handleBusinessError - AI对话失败', () => {
      const error = new Error('AI对话失败:服务不可用')

      const result = errorHandler.handleBusinessError(error)

      expect(result.type).toBe('business')
      expect(result.message).toContain('AI服务暂时不可用')
      expect(result.canRetry).toBe(true)
    })

    test('handleBusinessError - 网络错误', () => {
      const error = new Error('网络连接超时')

      const result = errorHandler.handleBusinessError(error)

      expect(result.type).toBe('network')
      expect(result.message).toContain('网络连接失败')
      expect(result.canRetry).toBe(true)
    })

    test('handleBusinessError - 通用业务错误', () => {
      const error = new Error('数据格式错误')

      const result = errorHandler.handleBusinessError(error)

      expect(result.type).toBe('business')
      expect(result.message).toBe('数据格式错误')
      expect(result.canRetry).toBe(true)
    })

    test('handleUIError应该返回UI错误信息', () => {
      const error = new Error('UI错误')

      const result = errorHandler.handleUIError(error)

      expect(result.type).toBe('ui')
      expect(result.message).toContain('界面操作失败')
      expect(result.canRetry).toBe(false)
    })

    test('handleUnknownError应该返回未知错误信息', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation()
      const error = new Error('未知错误')

      const result = errorHandler.handleUnknownError(error)

      expect(result.type).toBe('unknown')
      expect(result.message).toContain('未知错误')
      expect(result.canRetry).toBe(false)
      expect(consoleSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
    })
  })
})
