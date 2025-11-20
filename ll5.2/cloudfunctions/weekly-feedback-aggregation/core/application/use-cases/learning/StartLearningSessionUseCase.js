const SpacedRepetitionEngine = require('../../../domain/services/SpacedRepetitionEngine')

/**
 * StartLearningSessionUseCase - 开始间隔重复学习会话
 * 
 * Phase 2: Application 层用例
 * 
 * 职责：
 * - 启动学习会话，生成今日复习计划
 * - 协调 Repository、DateService 和 SpacedRepetitionEngine
 * - 返回今日需要复习的词汇列表
 * 
 * 注意：
 * - 只负责协调，不包含业务逻辑
 * - 业务逻辑由 SpacedRepetitionEngine 处理
 * - 日期统一通过 DateService 获取
 */
class StartLearningSessionUseCase {
  /**
   * 创建用例实例
   * 
   * @param {Object} dependencies - 依赖项（使用对象解构避免顺序问题）
   * @param {IVocabularyRepository} dependencies.vocabularyRepository - 词汇仓储
   * @param {IDateService} dependencies.dateService - 日期服务
   * @param {SpacedRepetitionEngine} [dependencies.spacedRepetitionEngine] - 间隔重复引擎（可选，默认创建新实例）
   */
  constructor({ vocabularyRepository, dateService, spacedRepetitionEngine }) {
    // 依赖验证
    if (!vocabularyRepository) {
      throw new Error('vocabularyRepository is required')
    }
    if (!dateService) {
      throw new Error('dateService is required')
    }

    this.vocabularyRepository = vocabularyRepository
    this.dateService = dateService
    // SpacedRepetitionEngine 是无状态的，可以默认创建
    this.spacedRepetitionEngine = spacedRepetitionEngine || new SpacedRepetitionEngine()
  }

  /**
   * 执行开始学习会话
   * 
   * @param {Object} params - 参数
   * @param {string} params.userId - 用户ID
   * @returns {Promise<Object>} 学习会话信息
   * 
   * @example
   * const result = await useCase.execute({ userId: 'user_123' })
   * // {
   * //   success: true,
   * //   session: {
   * //     userId: 'user_123',
   * //     startTime: '2025-01-06T12:00:00.000Z',
   * //     vocabularies: [...],
   * //     totalCount: 100,
   * //     reviewCount: 15
   * //   }
   * // }
   */
  async execute({ userId }) {
    try {
      // 1. 通过 DateService 获取当前日期（唯一获取日期的方式）
      const currentDateISO = this.dateService.getCurrentDateISO()

      // 2. 获取用户所有词汇
      const vocabularies = await this.vocabularyRepository.findByUserId(userId)

      // 3. 调用 Domain 服务生成今日复习计划
      const reviewPlan = this.spacedRepetitionEngine.generatePlan(
        vocabularies,
        currentDateISO
      )

      // 4. 构建并返回学习会话
      const session = {
        userId,
        startTime: currentDateISO,
        vocabularies: reviewPlan,
        totalCount: vocabularies.length,
        reviewCount: reviewPlan.length
      }

      return {
        success: true,
        session
      }
    } catch (error) {
      // 捕获并包装错误
      console.error('[StartLearningSessionUseCase] Error:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }
}

module.exports = StartLearningSessionUseCase

