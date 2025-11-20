/**
 * VocabularyViewModel 测试
 * 验证视图模型的数据转换和错误处理逻辑
 */
const VocabularyViewModel = require('../VocabularyViewModel')

// Mock Use Cases
const mockStartLearningSessionUseCase = {
  execute: jest.fn()
}

const mockRecordReviewResultUseCase = {
  execute: jest.fn()
}

describe('VocabularyViewModel', () => {
  let viewModel

  beforeEach(() => {
    // 重置所有mock
    jest.clearAllMocks()

    // 创建ViewModel实例
    viewModel = new VocabularyViewModel({
      startLearningSessionUseCase: mockStartLearningSessionUseCase,
      recordReviewResultUseCase: mockRecordReviewResultUseCase
    })
  })

  describe('constructor', () => {
    test('应该正确创建ViewModel实例', () => {
      expect(viewModel).toBeDefined()
      expect(viewModel.startLearningSessionUseCase).toBe(mockStartLearningSessionUseCase)
      expect(viewModel.recordReviewResultUseCase).toBe(mockRecordReviewResultUseCase)
    })

    test('缺少依赖时应该抛出错误', () => {
      expect(() => new VocabularyViewModel()).toThrow('dependencies is required')
      expect(() => new VocabularyViewModel({})).toThrow('startLearningSessionUseCase is required')
    })
  })

  describe('startSession', () => {
    const mockSession = {
      userId: 'user_123',
      startTime: '2025-01-06T12:00:00.000Z',
      vocabularies: [
        {
          id: 'vocab_1',
          word: 'hello',
          translation: '你好',
          interval: 1,
          repetition: 1,
          easeFactor: 2.5,
          nextReviewDate: '2025-01-07T12:00:00.000Z'
        },
        {
          id: 'vocab_2',
          word: 'world',
          translation: '世界',
          interval: 2,
          repetition: 2,
          easeFactor: 2.6,
          nextReviewDate: '2025-01-08T12:00:00.000Z'
        }
      ],
      totalCount: 10,
      reviewCount: 2
    }

    test('应该成功开始学习会话并转换数据格式', async () => {
      mockStartLearningSessionUseCase.execute.mockResolvedValue({
        success: true,
        session: mockSession
      })

      const result = await viewModel.startSession('user_123')

      expect(result.success).toBe(true)
      expect(result.session.userId).toBe('user_123')
      expect(result.session.totalCount).toBe(10)
      expect(result.session.reviewCount).toBe(2)
      expect(result.session.wordsToLearn).toHaveLength(2)
      expect(result.session.currentWord.word).toBe('hello')
      expect(result.session.currentIndex).toBe(0)
    })

    test('UseCase执行失败时应该返回错误', async () => {
      mockStartLearningSessionUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Database connection failed'
      })

      const result = await viewModel.startSession('user_123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('操作失败')
    })

    test('UseCase抛出异常时应该处理错误', async () => {
      mockStartLearningSessionUseCase.execute.mockRejectedValue(new Error('Network timeout'))

      const result = await viewModel.startSession('user_123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('网络连接失败')
    })
  })

  describe('recordAnswer', () => {
    const mockUpdatedVocabulary = {
      id: 'vocab_1',
      word: 'hello',
      translation: '你好',
      interval: 3,
      repetition: 2,
      easeFactor: 2.5,
      nextReviewDate: '2025-01-09T12:00:00.000Z'
    }

    test('应该成功记录答案并返回更新后的词汇', async () => {
      mockRecordReviewResultUseCase.execute.mockResolvedValue({
        success: true,
        vocabulary: mockUpdatedVocabulary
      })

      const result = await viewModel.recordAnswer('vocab_1', 'good')

      expect(result.success).toBe(true)
      expect(result.vocabulary.interval).toBe(3)
      expect(result.vocabulary.repetition).toBe(2)
    })

    test('应该正确转换mastery为评分', async () => {
      mockRecordReviewResultUseCase.execute.mockResolvedValue({
        success: true,
        vocabulary: mockUpdatedVocabulary
      })

      // 测试不同mastery值的转换
      await viewModel.recordAnswer('vocab_1', 'easy')
      expect(mockRecordReviewResultUseCase.execute).toHaveBeenCalledWith({
        vocabularyId: 'vocab_1',
        performanceRating: 4
      })

      await viewModel.recordAnswer('vocab_1', 'hard')
      expect(mockRecordReviewResultUseCase.execute).toHaveBeenCalledWith({
        vocabularyId: 'vocab_1',
        performanceRating: 2
      })
    })

    test('直接传入数字评分时应该使用原值', async () => {
      mockRecordReviewResultUseCase.execute.mockResolvedValue({
        success: true,
        vocabulary: mockUpdatedVocabulary
      })

      await viewModel.recordAnswer('vocab_1', 5)

      expect(mockRecordReviewResultUseCase.execute).toHaveBeenCalledWith({
        vocabularyId: 'vocab_1',
        performanceRating: 5
      })
    })

    test('词汇不存在时应该返回友好错误消息', async () => {
      const VocabularyNotFoundError = require('../../../core/application/errors/VocabularyNotFoundError')
      mockRecordReviewResultUseCase.execute.mockRejectedValue(
        new VocabularyNotFoundError('vocab_1')
      )

      const result = await viewModel.recordAnswer('vocab_1', 'good')

      expect(result.success).toBe(false)
      expect(result.error).toBe('词汇不存在，可能已被删除')
    })

    test('评分无效时应该返回友好错误消息', async () => {
      const InvalidPerformanceRatingError = require('../../../core/application/errors/InvalidPerformanceRatingError')
      mockRecordReviewResultUseCase.execute.mockRejectedValue(
        new InvalidPerformanceRatingError(10)
      )

      const result = await viewModel.recordAnswer('vocab_1', 'good')

      expect(result.success).toBe(false)
      expect(result.error).toBe('评分无效，请重新选择')
    })
  })

  describe('refreshSession', () => {
    test('应该调用startSession重新开始会话', async () => {
      const mockResult = { success: true, session: {} }
      const startSessionSpy = jest.spyOn(viewModel, 'startSession').mockResolvedValue(mockResult)

      const result = await viewModel.refreshSession('user_123')

      expect(startSessionSpy).toHaveBeenCalledWith('user_123')
      expect(result).toBe(mockResult)
    })
  })

  describe('私有方法', () => {
    describe('_convertSessionToPageData', () => {
      test('应该正确转换session数据为页面格式', () => {
        const session = {
          userId: 'user_123',
          startTime: '2025-01-06T12:00:00.000Z',
          vocabularies: [
            {
              id: 'vocab_1',
              word: 'hello',
              translation: '你好',
              interval: 1,
              repetition: 1,
              easeFactor: 2.5,
              nextReviewDate: '2025-01-07T12:00:00.000Z'
            }
          ],
          totalCount: 5,
          reviewCount: 1
        }

        const result = viewModel._convertSessionToPageData(session)

        expect(result.userId).toBe('user_123')
        expect(result.wordsToLearn).toHaveLength(1)
        expect(result.wordsToLearn[0].word).toBe('hello')
        expect(result.currentWord.word).toBe('hello')
        expect(result.currentIndex).toBe(0)
      })
    })

    describe('_convertMasteryToRating', () => {
      test('应该正确转换mastery字符串为评分数字', () => {
        expect(viewModel._convertMasteryToRating('again')).toBe(0)
        expect(viewModel._convertMasteryToRating('hard')).toBe(2)
        expect(viewModel._convertMasteryToRating('good')).toBe(3)
        expect(viewModel._convertMasteryToRating('easy')).toBe(4)
        expect(viewModel._convertMasteryToRating('unknown')).toBe(3) // 默认值
      })

      test('传入数字时应该返回原值并限制范围', () => {
        expect(viewModel._convertMasteryToRating(5)).toBe(5)
        expect(viewModel._convertMasteryToRating(0)).toBe(0)
        expect(viewModel._convertMasteryToRating(10)).toBe(5) // 限制最大值
        expect(viewModel._convertMasteryToRating(-1)).toBe(0) // 限制最小值
      })
    })

    describe('_convertErrorToUserMessage', () => {
      test('应该将技术错误转换为用户友好消息', () => {
        expect(viewModel._convertErrorToUserMessage('network timeout')).toContain('网络连接失败')
        expect(viewModel._convertErrorToUserMessage('database error')).toContain('数据存储异常')
        expect(viewModel._convertErrorToUserMessage('unknown error')).toContain('操作失败')
      })
    })
  })

  // ==================== Day 3新增测试：覆盖剩余6行代码 ====================

  describe('constructor - 边界条件补充', () => {
    test('缺少recordReviewResultUseCase时应该抛出错误', () => {
      expect(() => new VocabularyViewModel({
        startLearningSessionUseCase: mockStartLearningSessionUseCase
      })).toThrow('recordReviewResultUseCase is required')
    })
  })

  describe('recordAnswer - UseCase失败场景', () => {
    test('UseCase返回success=false时应该返回友好错误', async () => {
      mockRecordReviewResultUseCase.execute.mockResolvedValue({
        success: false,
        error: 'Database connection failed'
      })

      const result = await viewModel.recordAnswer('vocab1', 3)

      expect(result.success).toBe(false)
      expect(result.error).toContain('操作失败')
    })

    test('通用异常时应该返回友好错误', async () => {
      // 模拟一个既不是VocabularyNotFoundError也不是InvalidRatingError的异常
      mockRecordReviewResultUseCase.execute.mockRejectedValue(
        new Error('Something went wrong')
      )

      const result = await viewModel.recordAnswer('vocab1', 3)

      expect(result.success).toBe(false)
      expect(result.error).toContain('操作失败')
    })
  })

  describe('refreshSession - 异常处理', () => {
    test('刷新会话异常时应该返回友好错误', async () => {
      mockStartLearningSessionUseCase.execute.mockRejectedValue(
        new Error('Session refresh failed')
      )

      const result = await viewModel.refreshSession('user_123')

      expect(result.success).toBe(false)
      expect(result.error).toContain('操作失败')
    })
  })
})
