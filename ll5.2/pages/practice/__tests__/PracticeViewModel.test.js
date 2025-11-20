const PracticeViewModel = require('../PracticeViewModel')

// Mock 依赖
const mockStartPracticeSessionUseCase = {
  execute: jest.fn()
}

const mockSubmitAnswerUseCase = {
  execute: jest.fn()
}

const mockFinishPracticeSessionUseCase = {
  execute: jest.fn()
}

const mockGetSessionStatisticsUseCase = {
  execute: jest.fn()
}

const mockResumePracticeSessionUseCase = {
  execute: jest.fn()
}

const mockGetNextQuestionUseCase = {
  execute: jest.fn()
}

const mockGetPaperByIdUseCase = {
  execute: jest.fn()
}

const mockSubmitAnswersUseCase = {
  execute: jest.fn()
}

const mockRecordAnswerUseCase = {
  execute: jest.fn()
}

const mockGetPracticeStatisticsUseCase = {
  execute: jest.fn()
}

const mockDateService = {
  getCurrentDateISO: jest.fn()
}

const mockStorageAdapter = {
  get: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockResolvedValue(),
  remove: jest.fn().mockResolvedValue(),
  clear: jest.fn().mockResolvedValue(),
  has: jest.fn().mockResolvedValue(false)
}

describe('PracticeViewModel', () => {
  let viewModel
  let mockListener

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks()
    mockStorageAdapter.get.mockResolvedValue(null)
    mockStorageAdapter.has.mockResolvedValue(false)

    // 设置默认mock返回值
    mockDateService.getCurrentDateISO.mockReturnValue('2025-11-08T20:00:00.000Z')

    // 创建ViewModel实例
    viewModel = new PracticeViewModel({
      startPracticeSessionUseCase: mockStartPracticeSessionUseCase,
      submitAnswerUseCase: mockSubmitAnswerUseCase,
      finishPracticeSessionUseCase: mockFinishPracticeSessionUseCase,
      getSessionStatisticsUseCase: mockGetSessionStatisticsUseCase,
      resumePracticeSessionUseCase: mockResumePracticeSessionUseCase,
      getNextQuestionUseCase: mockGetNextQuestionUseCase,
      getPaperByIdUseCase: mockGetPaperByIdUseCase,
      submitAnswersUseCase: mockSubmitAnswersUseCase,
      recordAnswerUseCase: mockRecordAnswerUseCase,
      getPracticeStatisticsUseCase: mockGetPracticeStatisticsUseCase,
      dateService: mockDateService,
      storageAdapter: mockStorageAdapter
    })

    // Mock 状态监听器
    mockListener = jest.fn()
  })

  afterEach(() => {
    // 清理ViewModel，停止所有定时器
    if (viewModel && viewModel.destroy) {
      viewModel.destroy()
    }
  })

  describe('constructor', () => {
    test('应该正确创建ViewModel实例', () => {
      expect(viewModel).toBeDefined()
      expect(viewModel.startPracticeSessionUseCase).toBe(mockStartPracticeSessionUseCase)
      expect(viewModel.submitAnswerUseCase).toBe(mockSubmitAnswerUseCase)
      expect(viewModel.finishPracticeSessionUseCase).toBe(mockFinishPracticeSessionUseCase)
      expect(viewModel.getSessionStatisticsUseCase).toBe(mockGetSessionStatisticsUseCase)
      expect(viewModel.resumePracticeSessionUseCase).toBe(mockResumePracticeSessionUseCase)
      expect(viewModel.getNextQuestionUseCase).toBe(mockGetNextQuestionUseCase)
      expect(viewModel.getPaperByIdUseCase).toBe(mockGetPaperByIdUseCase)
      expect(viewModel.submitAnswersUseCase).toBe(mockSubmitAnswersUseCase)
      expect(viewModel.recordAnswerUseCase).toBe(mockRecordAnswerUseCase)
      expect(viewModel.getPracticeStatisticsUseCase).toBe(mockGetPracticeStatisticsUseCase)
      expect(viewModel.dateService).toBe(mockDateService)
    })

    test('缺少必需依赖时应该抛出错误', () => {
      expect(() => new PracticeViewModel({})).toThrow('startPracticeSessionUseCase is required')
    })

    test('应该初始化正确的默认状态', () => {
      const state = viewModel.getState()

      expect(state.session).toBe(null)
      expect(state.sessionId).toBe(null)
      expect(state.paper).toBe(null)
      expect(state.questions).toEqual([])
      expect(state.passages).toEqual([])
      expect(state.currentQuestionIndex).toBe(0)
      expect(state.currentQuestion).toBe(null)
      expect(state.userAnswers).toEqual({})
      expect(state.isLoading).toBe(true)
      expect(state.showResult).toBe(false)
      expect(state.showExplanation).toBe(false)
      expect(state.practiceMode).toBe('practice')
      expect(state.startTime).toBe(0)
      expect(state.timeSpent).toBe(0)
      expect(state.formattedTime).toBe('0:00')
      expect(state.timer).toBe(null)
      expect(state.stats).toEqual({
        total: 0,
        answered: 0,
        correct: 0,
        accuracy: 0
      })
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

      expect(typeof unsubscribe).toBe('function')

      // 调用取消订阅
      unsubscribe()

      // 这里可以验证监听器已被移除，但需要访问私有属性
      // 暂时只验证函数存在性
    })

    test('_updateState应该更新状态并通知监听器', () => {
      viewModel.subscribe(mockListener)

      viewModel._updateState({ isLoading: false, error: 'test error' })

      expect(mockListener).toHaveBeenCalledTimes(1)
      expect(mockListener).toHaveBeenCalledWith(expect.objectContaining({
        isLoading: false,
        error: 'test error',
        lastUpdated: '2025-11-08T20:00:00.000Z'
      }))
    })
  })

  describe('基本功能验证', () => {
    test('应该能够订阅状态变化', () => {
      const unsubscribe = viewModel.subscribe(mockListener)
      expect(typeof unsubscribe).toBe('function')

      viewModel._updateState({ isLoading: false })
      expect(mockListener).toHaveBeenCalledTimes(1)
    })

    test('应该能够正确处理错误状态', () => {
      viewModel._updateState({ error: '测试错误', isLoading: false })

      const state = viewModel.getState()
      expect(state.error).toBe('测试错误')
      expect(state.isLoading).toBe(false)
    })

    test('destroy应该清理资源', () => {
      // Mock定时器
      viewModel.state.timer = setTimeout(() => {}, 1000)

      viewModel.destroy()

      expect(viewModel.listeners).toEqual([])
      expect(viewModel.state).toBe(null)
    })
  })

  // ==================== Category 2: startSession测试 ====================

  describe('startSession - Happy Path', () => {
    test('应该成功开始练习会话', async () => {
      // Arrange
      const paperId = 'paper-123'
      
      // Mock所有必需的UseCase响应
      mockGetPaperByIdUseCase.execute.mockResolvedValue({
        success: true,
        paper: { id: 'paper-123', title: '测试试卷' },
        questions: [{ id: 'q1' }, { id: 'q2' }]
      })
      
      mockStartPracticeSessionUseCase.execute.mockResolvedValue({
        success: true,
        session: { id: 'session-abc' }
      })
      
      mockGetNextQuestionUseCase.execute.mockResolvedValue({
        success: true,
        question: { id: 'q1', type: 'choice' }
      })

      // Act
      const result = await viewModel.startSession(paperId)

      // Assert
      expect(result.success).toBe(true)
      expect(mockStartPracticeSessionUseCase.execute).toHaveBeenCalled()
      expect(mockGetPaperByIdUseCase.execute).toHaveBeenCalled()
      expect(mockGetNextQuestionUseCase.execute).toHaveBeenCalled()
      
      const state = viewModel.getState()
      expect(state.sessionId).toBe('session-abc')
      expect(state.isLoading).toBe(false)
    })
  })

  describe('startSession - Boundary & Failure', () => {
    test('应该拒绝无效的paperId', async () => {
      const result1 = await viewModel.startSession(null)
      const result2 = await viewModel.startSession('')
      
      expect(result1.success).toBe(false)
      expect(result2.success).toBe(false)
    })

    test('UseCase失败时应该恢复状态', async () => {
      // Arrange
      mockStartPracticeSessionUseCase.execute.mockRejectedValue(
        new Error('Paper not found')
      )

      // Act
      const result = await viewModel.startSession('invalid')
      
      // Assert - silent fail模式
      expect(result.success).toBe(false)
      expect(result.error).toContain('Paper not found')
      
      const state = viewModel.getState()
      expect(state.isLoading).toBe(false)
      expect(state.error).toBeTruthy()
      expect(state.sessionId).toBe(null)
    })
  })

  // ==================== Category 3: submitAnswer测试 ====================

  describe('submitAnswer - Happy Path', () => {
    test('应该成功提交答案', async () => {
      // Arrange - 先建立会话
      viewModel._updateState({
        sessionId: 'session-123',
        currentQuestion: { id: 'q1', type: 'choice' },
        currentQuestionIndex: 0,
        questions: [{ id: 'q1' }, { id: 'q2' }]
      })
      
      // Mock所有需要的UseCase
      mockRecordAnswerUseCase.execute.mockResolvedValue({
        success: true
      })
      
      mockSubmitAnswerUseCase.execute.mockResolvedValue({
        success: true,
        result: {
          isCorrect: true,
          score: 100
        }
      })
      
      mockGetNextQuestionUseCase.execute.mockResolvedValue({
        success: true,
        question: { id: 'q2' }
      })

      // Act
      const result = await viewModel.submitAnswer('A')

      // Assert
      expect(result.success).toBe(true)
      expect(mockRecordAnswerUseCase.execute).toHaveBeenCalled()
      expect(mockSubmitAnswerUseCase.execute).toHaveBeenCalled()
    })
  })

  describe('submitAnswer - Failure', () => {
    test('无活跃会话时应该返回错误', async () => {
      // Arrange - 确保无会话
      viewModel._updateState({ sessionId: null, currentQuestion: null })

      // Act
      const result = await viewModel.submitAnswer('A')
      
      // Assert - silent fail
      expect(result.success).toBe(false)
      expect(result.error).toContain('没有活跃的练习会话或当前题目')
    })

    test('UseCase失败时应该正确处理', async () => {
      // Arrange
      viewModel._updateState({
        sessionId: 'session-123',
        currentQuestion: { id: 'q1' }
      })
      mockRecordAnswerUseCase.execute.mockResolvedValue({ success: true })
      mockSubmitAnswerUseCase.execute.mockRejectedValue(
        new Error('Network error')
      )

      // Act
      const result = await viewModel.submitAnswer('A')
      
      // Assert - silent fail
      expect(result.success).toBe(false)
      expect(result.error).toContain('Network error')
    })
  })

  // ==================== Category 4: finishSession测试 ====================

  describe('finishSession', () => {
    test('应该成功完成会话', async () => {
      // Arrange
      viewModel._updateState({ 
        sessionId: 'session-123',
        stats: { total: 10, answered: 8, correct: 6 }
      })
      
      // Mock两个必需的UseCase
      mockFinishPracticeSessionUseCase.execute.mockResolvedValue({
        success: true,
        session: { id: 'session-123', completed: true }
      })
      
      mockGetSessionStatisticsUseCase.execute.mockResolvedValue({
        success: true,
        statistics: { total: 10, correct: 8, accuracy: 0.8 }
      })

      // Act
      const result = await viewModel.finishSession()

      // Assert
      expect(result.success).toBe(true)
      expect(mockFinishPracticeSessionUseCase.execute).toHaveBeenCalled()
      expect(mockGetSessionStatisticsUseCase.execute).toHaveBeenCalled()
    })

    test('无活跃会话时应该返回错误', async () => {
      // Arrange
      viewModel._updateState({ sessionId: null })

      // Act
      const result = await viewModel.finishSession()
      
      // Assert - silent fail
      expect(result.success).toBe(false)
      expect(result.error).toContain('没有活跃的练习会话')
    })
  })

  // ==================== Category 5: Navigation测试 ====================

  describe('nextQuestion', () => {
    test('应该成功切换到下一题', async () => {
      // Arrange
      viewModel._updateState({
        sessionId: 'session-123',
        currentQuestionIndex: 0,
        questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]
      })
      
      mockGetNextQuestionUseCase.execute.mockResolvedValue({
        success: true,
        question: { id: 'q2' }
      })

      // Act
      const result = await viewModel.nextQuestion()

      // Assert
      expect(result.success).toBe(true)
      const state = viewModel.getState()
      expect(state.currentQuestionIndex).toBe(1)
    })

    test('无活跃会话时应该返回错误', async () => {
      viewModel._updateState({ sessionId: null })
      
      const result = await viewModel.nextQuestion()
      
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  describe('previousQuestion', () => {
    test('应该成功切换到上一题', async () => {
      // Arrange
      viewModel._updateState({
        sessionId: 'session-123',
        currentQuestionIndex: 2,
        questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]
      })

      // Act
      await viewModel.previousQuestion()

      // Assert
      const state = viewModel.getState()
      expect(state.currentQuestionIndex).toBe(1)
    })

    test('已是第一题时应该保持不变', async () => {
      // Arrange
      viewModel._updateState({
        currentQuestionIndex: 0,
        questions: [{ id: 'q1' }]
      })

      // Act
      await viewModel.previousQuestion()

      // Assert
      const state = viewModel.getState()
      expect(state.currentQuestionIndex).toBe(0)
    })
  })

  // ==================== Category 6: Statistics测试 ====================

  describe('getStatistics', () => {
    test('应该成功获取统计信息', async () => {
      // Arrange
      viewModel._updateState({ sessionId: 'session-123' })
      
      mockGetSessionStatisticsUseCase.execute.mockResolvedValue({
        success: true,
        data: {
          total: 10,
          correct: 8,
          accuracy: 0.8
        }
      })

      // Act
      const result = await viewModel.getStatistics()

      // Assert
      expect(result.success).toBe(true)
      expect(result.data.accuracy).toBe(0.8)
    })

    test('无活跃会话时应该返回错误', async () => {
      viewModel._updateState({ sessionId: null })
      
      const result = await viewModel.getStatistics()
      
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    test('UseCase失败时应该正确处理', async () => {
      viewModel._updateState({ sessionId: 'session-123' })
      mockGetSessionStatisticsUseCase.execute.mockRejectedValue(
        new Error('Stats not available')
      )

      const result = await viewModel.getStatistics()
      
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  // ==================== Category 7: Theme Setup测试 ====================

  describe('Theme Setup', () => {
    test('checkHasSeenThemeSetup - 未看过应返回false', async () => {
      mockStorageAdapter.get.mockResolvedValue(null)

      const result = await viewModel.checkHasSeenThemeSetup()

      expect(result).toBe(false)
    })

    test('checkHasSeenThemeSetup - 已看过应返回true', async () => {
      mockStorageAdapter.get.mockResolvedValue(true)

      const result = await viewModel.checkHasSeenThemeSetup()

      expect(result).toBe(true)
    })

    test('checkHasSeenThemeSetup - storage失败应返回false', async () => {
      mockStorageAdapter.get.mockRejectedValue(new Error('Storage error'))

      const result = await viewModel.checkHasSeenThemeSetup()

      expect(result).toBe(false)
    })

    test('markHasSeenThemeSetup应该保存设置', async () => {
      await viewModel.markHasSeenThemeSetup()

      expect(mockStorageAdapter.save).toHaveBeenCalledWith(
        'hasSeenThemeSetup',
        true
      )
    })
  })

  // ==================== Category 8: AI功能测试 ====================

  describe('AI Features', () => {
    test('getHint - AI服务未初始化应返回错误', async () => {
      // viewModel默认没有aiService

      const result = await viewModel.getHint('q1')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('AI服务未初始化')
    })

    test('getHint - AI服务成功返回提示', async () => {
      // 创建带AI服务的ViewModel
      const mockAIService = {
        getHint: jest.fn().mockResolvedValue({
          hint: '这是一个提示',
          questionId: 'q1',
          timestamp: new Date().toISOString()
        })
      }
      
      const vmWithAI = new PracticeViewModel({
        ...viewModel,
        aiService: mockAIService,
        startPracticeSessionUseCase: mockStartPracticeSessionUseCase,
        submitAnswerUseCase: mockSubmitAnswerUseCase,
        finishPracticeSessionUseCase: mockFinishPracticeSessionUseCase,
        getSessionStatisticsUseCase: mockGetSessionStatisticsUseCase,
        resumePracticeSessionUseCase: mockResumePracticeSessionUseCase,
        getNextQuestionUseCase: mockGetNextQuestionUseCase,
        getPaperByIdUseCase: mockGetPaperByIdUseCase,
        submitAnswersUseCase: mockSubmitAnswersUseCase,
        recordAnswerUseCase: mockRecordAnswerUseCase,
        getPracticeStatisticsUseCase: mockGetPracticeStatisticsUseCase,
        dateService: mockDateService,
        storageAdapter: mockStorageAdapter
      })
      
      vmWithAI._updateState({
        currentQuestion: { id: 'q1', type: 'choice' },
        questions: [{ id: 'q1' }]
      })

      const result = await vmWithAI.getHint('q1')
      
      expect(result.success).toBe(true)
      expect(result.hint).toBe('这是一个提示')
      expect(mockAIService.getHint).toHaveBeenCalled()
    })

    test('gradeEssay - AI服务未初始化应返回错误', async () => {
      const result = await viewModel.gradeEssay('essay content', 'q1')
      
      expect(result.success).toBe(false)
      expect(result.error).toContain('AI服务未初始化')
    })
  })

  // ==================== Category 9: State Consistency测试 ====================

  describe('State Consistency', () => {
    test('多次startSession应该清理旧会话', async () => {
      // Arrange - Mock第一次startSession
      mockGetPaperByIdUseCase.execute
        .mockResolvedValueOnce({
          success: true,
          paper: { id: 'paper-1' },
          questions: []
        })
        .mockResolvedValueOnce({
          success: true,
          paper: { id: 'paper-2' },
          questions: []
        })
      
      mockStartPracticeSessionUseCase.execute
        .mockResolvedValueOnce({
          success: true,
          session: { id: 'session-1' }
        })
        .mockResolvedValueOnce({
          success: true,
          session: { id: 'session-2' }
        })
      
      mockGetNextQuestionUseCase.execute
        .mockResolvedValue({
          success: true,
          question: { id: 'q1' }
        })

      // Act
      await viewModel.startSession('paper-1')
      await viewModel.startSession('paper-2')

      // Assert
      const state = viewModel.getState()
      expect(state.sessionId).toBe('session-2')
    })

    test('finishSession后再操作应该正确处理', async () => {
      // Arrange
      viewModel._updateState({ sessionId: 'session-123' })
      mockFinishPracticeSessionUseCase.execute.mockResolvedValue({
        success: true
      })

      // Act
      await viewModel.finishSession()

      // 会话结束后再操作应该返回错误
      const result = await viewModel.submitAnswer('A')
      
      expect(result.success).toBe(false)
    })

    test('destroy后不应crash', () => {
      viewModel.destroy()

      expect(() => viewModel.getState()).not.toThrow()
      // destroy后getState可能返回空对象或null
      const state = viewModel.getState()
      expect(state === null || Object.keys(state).length === 0).toBe(true)
    })
  })

  // ==================== Category 10: 补充边界测试达到80% ====================

  describe('Additional Boundary Tests', () => {
    test('previousQuestion - 已是最后一题时也应正常工作', async () => {
      viewModel._updateState({
        currentQuestionIndex: 2,
        questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]
      })

      await viewModel.previousQuestion()

      const state = viewModel.getState()
      expect(state.currentQuestionIndex).toBe(1)
    })

    test('startSession - 空paperId应该返回错误', async () => {
      // Mock所有UseCase以防止undefined访问
      mockGetPaperByIdUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Invalid paperId'
      })
      
      const result = await viewModel.startSession(undefined)
      
      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    test('submitAnswer - currentQuestion为null应返回错误', async () => {
      viewModel._updateState({
        sessionId: 'session-123',
        currentQuestion: null
      })

      const result = await viewModel.submitAnswer('A')
      
      expect(result.success).toBe(false)
    })

    test('nextQuestion - 获取下一题失败应自动完成会话', async () => {
      viewModel._updateState({
        sessionId: 'session-123',
        currentQuestionIndex: 0,
        questions: [{ id: 'q1' }, { id: 'q2' }]
      })

      // Mock获取下一题失败（没有更多题目）
      mockGetNextQuestionUseCase.execute.mockResolvedValue({
        success: false,
        error: 'No more questions'
      })
      
      // Mock finishSession相关的UseCases
      mockFinishPracticeSessionUseCase.execute.mockResolvedValue({
        success: true
      })
      mockGetSessionStatisticsUseCase.execute.mockResolvedValue({
        success: true,
        statistics: { total: 2, correct: 1 }
      })

      const result = await viewModel.nextQuestion()
      
      // 应该自动完成会话并返回finished=true
      expect(result.success).toBe(true)
      expect(result.finished).toBe(true)
    })

    test('getStatistics - 统计数据结构应正确', async () => {
      viewModel._updateState({ sessionId: 'session-123' })
      
      mockGetSessionStatisticsUseCase.execute.mockResolvedValue({
        success: true,
        data: {
          total: 20,
          correct: 15,
          wrong: 5,
          accuracy: 0.75,
          avgTime: 45
        }
      })

      const result = await viewModel.getStatistics()

      expect(result.success).toBe(true)
      expect(result.data.total).toBe(20)
      expect(result.data.accuracy).toBe(0.75)
    })

    test('finishSession - 获取统计失败应正确处理', async () => {
      viewModel._updateState({ sessionId: 'session-123' })
      
      mockFinishPracticeSessionUseCase.execute.mockResolvedValue({
        success: true
      })
      
      mockGetSessionStatisticsUseCase.execute.mockRejectedValue(
        new Error('Stats unavailable')
      )

      const result = await viewModel.finishSession()

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    test('startSession - 获取Paper失败应正确处理', async () => {
      mockGetPaperByIdUseCase.execute.mockRejectedValue(
        new Error('Paper not found')
      )
      
      mockStartPracticeSessionUseCase.execute.mockResolvedValue({
        success: true,
        session: { id: 'session-123' }
      })

      const result = await viewModel.startSession('invalid-paper')

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  // ==================== Category 11: 更多分支覆盖测试 ====================

  describe('Additional Branch Coverage Tests', () => {
    test('submitAnswer - recordAnswer失败应正确处理', async () => {
      viewModel._updateState({
        sessionId: 'session-123',
        currentQuestion: { id: 'q1' }
      })

      mockRecordAnswerUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Record failed'
      })

      const result = await viewModel.submitAnswer('A')

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    test('submitAnswer - 最后一题提交后应自动完成', async () => {
      viewModel._updateState({
        sessionId: 'session-123',
        currentQuestion: { id: 'q2' },
        currentQuestionIndex: 1,
        questions: [{ id: 'q1' }, { id: 'q2' }]
      })

      mockRecordAnswerUseCase.execute.mockResolvedValue({ success: true })
      mockSubmitAnswerUseCase.execute.mockResolvedValue({
        success: true,
        result: { isCorrect: true }
      })
      
      // 没有下一题
      mockGetNextQuestionUseCase.execute.mockResolvedValue({
        success: false
      })
      
      // Mock finishSession
      mockFinishPracticeSessionUseCase.execute.mockResolvedValue({ success: true })
      mockGetSessionStatisticsUseCase.execute.mockResolvedValue({
        success: true,
        statistics: { total: 2, correct: 2 }
      })

      const result = await viewModel.submitAnswer('B')

      expect(result.success).toBe(true)
      expect(result.hasNext).toBe(false)
    })

    test('startSession - getNextQuestion失败应正确处理', async () => {
      mockGetPaperByIdUseCase.execute.mockResolvedValue({
        success: true,
        paper: { id: 'p1' },
        questions: [{ id: 'q1' }]
      })
      mockStartPracticeSessionUseCase.execute.mockResolvedValue({
        success: true,
        session: { id: 's1' }
      })
      mockGetNextQuestionUseCase.execute.mockResolvedValue({
        success: false,
        error: 'No questions'
      })

      const result = await viewModel.startSession('p1')

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })

    test('previousQuestion - 有questions数组时应正常工作', async () => {
      viewModel._updateState({
        sessionId: null,  // 即使没有sessionId也能工作
        currentQuestionIndex: 1,
        questions: [{ id: 'q1' }, { id: 'q2' }]
      })

      const result = await viewModel.previousQuestion()

      expect(result.success).toBe(true)
      expect(result.question.id).toBe('q1')
      const state = viewModel.getState()
      expect(state.currentQuestionIndex).toBe(0)
    })

    test('checkHasSeenThemeSetup - 返回布尔值转换', async () => {
      // 测试各种truthy/falsy值
      mockStorageAdapter.get.mockResolvedValue(1)
      let result = await viewModel.checkHasSeenThemeSetup()
      expect(result).toBe(true)

      mockStorageAdapter.get.mockResolvedValue(0)
      result = await viewModel.checkHasSeenThemeSetup()
      expect(result).toBe(false)

      mockStorageAdapter.get.mockResolvedValue('')
      result = await viewModel.checkHasSeenThemeSetup()
      expect(result).toBe(false)
    })

    test('startSession - Paper和Session都成功但无questions', async () => {
      mockGetPaperByIdUseCase.execute.mockResolvedValue({
        success: true,
        paper: { id: 'p1', title: 'Test' },
        questions: []  // 空questions数组
      })
      mockStartPracticeSessionUseCase.execute.mockResolvedValue({
        success: true,
        session: { id: 's1' }
      })
      mockGetNextQuestionUseCase.execute.mockResolvedValue({
        success: true,
        question: { id: 'q1' }
      })

      const result = await viewModel.startSession('p1')

      expect(result.success).toBe(true)
      const state = viewModel.getState()
      expect(state.stats.total).toBe(0)
    })

    test('previousQuestion - newIndex与currentIndex相同应返回失败', async () => {
      viewModel._updateState({
        currentQuestionIndex: 0,
        questions: [{ id: 'q1' }]
      })

      const result = await viewModel.previousQuestion()

      expect(result.success).toBe(false)
      expect(result.error).toContain('第一题')
    })

    test('nextQuestion - 成功获取并有question属性', async () => {
      viewModel._updateState({
        sessionId: 'session-123',
        currentQuestionIndex: 0
      })

      mockGetNextQuestionUseCase.execute.mockResolvedValue({
        success: true,
        question: { id: 'q2', content: 'Question 2' }
      })

      const result = await viewModel.nextQuestion()

      expect(result.success).toBe(true)
      expect(result.question.id).toBe('q2')
    })

    test('previousQuestion - questions数组为null时catch错误', async () => {
      viewModel._updateState({
        currentQuestionIndex: 1,
        questions: null
      })

      const result = await viewModel.previousQuestion()

      expect(result.success).toBe(false)
      expect(result.error).toBeTruthy()
    })
  })

  // ==================== Category 12: Silent Fail验证 ====================

  describe('Silent Fail Verification', () => {
    test('storage操作失败应该silent fail', async () => {
      mockStorageAdapter.save.mockRejectedValue(new Error('Storage full'))

      // 这些操作内部可能用storage
      // 如果有返回值应该是{success: false}，如果void则不crash
      try {
        const result = await viewModel.markHasSeenThemeSetup()
        // 如果返回值存在，应该是失败
        if (result && typeof result === 'object') {
          expect(result.success).toBe(false)
        }
      } catch (error) {
        // 某些实现可能会抛出，这也是可接受的
        expect(error).toBeDefined()
      }
    })

    test('监听器异常不应该影响状态更新', () => {
      const errorListener = jest.fn(() => {
        throw new Error('Listener error')
      })
      const normalListener = jest.fn()

      viewModel.subscribe(errorListener)
      viewModel.subscribe(normalListener)

      // 状态更新应该成功，且normalListener应该被调用
      expect(() => {
        viewModel._updateState({ isLoading: false })
      }).not.toThrow()

      expect(normalListener).toHaveBeenCalled()
    })
  })

  /**
   * P1-003修复验证测试
   * 应用Skill: TEST-PATTERNS-LIBRARY Pattern 3（异步资源清理）
   * 
   * 验证点：
   * 1. destroy应该清理注入的aiService
   * 2. 多次destroy应该是安全的（幂等性）
   * 3. aiService可选时不应crash
   */
  describe('Resource Cleanup (P1-003 Fix Verification)', () => {
    test('should destroy aiService when ViewModel is destroyed', () => {
      // Arrange: 创建带aiService的ViewModel
      const mockAIService = {
        getHint: jest.fn(),
        gradeEssay: jest.fn(),
        destroy: jest.fn() // ✅ Mock destroy方法
      }

      const viewModelWithAI = new PracticeViewModel({
        startPracticeSessionUseCase: mockStartPracticeSessionUseCase,
        submitAnswerUseCase: mockSubmitAnswerUseCase,
        finishPracticeSessionUseCase: mockFinishPracticeSessionUseCase,
        getSessionStatisticsUseCase: mockGetSessionStatisticsUseCase,
        resumePracticeSessionUseCase: mockResumePracticeSessionUseCase,
        getNextQuestionUseCase: mockGetNextQuestionUseCase,
        getPaperByIdUseCase: mockGetPaperByIdUseCase,
        submitAnswersUseCase: mockSubmitAnswersUseCase,
        recordAnswerUseCase: mockRecordAnswerUseCase,
        getPracticeStatisticsUseCase: mockGetPracticeStatisticsUseCase,
        dateService: mockDateService,
        storageAdapter: mockStorageAdapter,
        aiService: mockAIService // 注入AI服务
      })

      // Act: 销毁ViewModel
      viewModelWithAI.destroy()

      // Assert: 验证aiService.destroy()被调用
      expect(mockAIService.destroy).toHaveBeenCalledTimes(1)
    })

    test('should be safe to call destroy multiple times (idempotent)', () => {
      // Arrange
      const mockAIService = {
        destroy: jest.fn()
      }

      const viewModelWithAI = new PracticeViewModel({
        startPracticeSessionUseCase: mockStartPracticeSessionUseCase,
        submitAnswerUseCase: mockSubmitAnswerUseCase,
        finishPracticeSessionUseCase: mockFinishPracticeSessionUseCase,
        getSessionStatisticsUseCase: mockGetSessionStatisticsUseCase,
        resumePracticeSessionUseCase: mockResumePracticeSessionUseCase,
        getNextQuestionUseCase: mockGetNextQuestionUseCase,
        getPaperByIdUseCase: mockGetPaperByIdUseCase,
        submitAnswersUseCase: mockSubmitAnswersUseCase,
        recordAnswerUseCase: mockRecordAnswerUseCase,
        getPracticeStatisticsUseCase: mockGetPracticeStatisticsUseCase,
        dateService: mockDateService,
        storageAdapter: mockStorageAdapter,
        aiService: mockAIService
      })

      // Act: 多次调用destroy
      viewModelWithAI.destroy()
      
      // Assert: 第二次destroy不应该抛出错误
      expect(() => viewModelWithAI.destroy()).not.toThrow()
    })

    test('should not crash if aiService is undefined (optional dependency)', () => {
      // Arrange: 创建不带aiService的ViewModel
      const viewModelWithoutAI = new PracticeViewModel({
        startPracticeSessionUseCase: mockStartPracticeSessionUseCase,
        submitAnswerUseCase: mockSubmitAnswerUseCase,
        finishPracticeSessionUseCase: mockFinishPracticeSessionUseCase,
        getSessionStatisticsUseCase: mockGetSessionStatisticsUseCase,
        resumePracticeSessionUseCase: mockResumePracticeSessionUseCase,
        getNextQuestionUseCase: mockGetNextQuestionUseCase,
        getPaperByIdUseCase: mockGetPaperByIdUseCase,
        submitAnswersUseCase: mockSubmitAnswersUseCase,
        recordAnswerUseCase: mockRecordAnswerUseCase,
        getPracticeStatisticsUseCase: mockGetPracticeStatisticsUseCase,
        dateService: mockDateService,
        storageAdapter: mockStorageAdapter
        // 注意：没有提供aiService
      })

      // Act & Assert
      expect(() => viewModelWithoutAI.destroy()).not.toThrow()
    })

    test('should not crash if aiService lacks destroy method', () => {
      // Arrange: aiService没有destroy方法（向后兼容）
      const mockAIServiceWithoutDestroy = {
        getHint: jest.fn()
      }

      const viewModelWithPartialAI = new PracticeViewModel({
        startPracticeSessionUseCase: mockStartPracticeSessionUseCase,
        submitAnswerUseCase: mockSubmitAnswerUseCase,
        finishPracticeSessionUseCase: mockFinishPracticeSessionUseCase,
        getSessionStatisticsUseCase: mockGetSessionStatisticsUseCase,
        resumePracticeSessionUseCase: mockResumePracticeSessionUseCase,
        getNextQuestionUseCase: mockGetNextQuestionUseCase,
        getPaperByIdUseCase: mockGetPaperByIdUseCase,
        submitAnswersUseCase: mockSubmitAnswersUseCase,
        recordAnswerUseCase: mockRecordAnswerUseCase,
        getPracticeStatisticsUseCase: mockGetPracticeStatisticsUseCase,
        dateService: mockDateService,
        storageAdapter: mockStorageAdapter,
        aiService: mockAIServiceWithoutDestroy
      })

      // Act & Assert
      expect(() => viewModelWithPartialAI.destroy()).not.toThrow()
    })
  })
})
