const SpacedRepetitionEngine = require('../../../domain/services/SpacedRepetitionEngine')
const VocabularyNotFoundError = require('../../errors/VocabularyNotFoundError')
const InvalidPerformanceRatingError = require('../../errors/InvalidPerformanceRatingError')

/**
 * RecordReviewResultUseCase - 记录复习结果并更新学习进度
 * 
 * Phase 2: Application 层用例
 * 
 * 职责：
 * - 验证输入参数有效性（评分范围）
 * - 查找目标词汇（不存在时抛出业务错误）
 * - 调用 SpacedRepetitionEngine 计算新状态
 * - 持久化更新后的词汇
 * 
 * 注意：
 * - 只负责协调，不包含业务逻辑
 * - 业务逻辑由 SpacedRepetitionEngine 处理
 * - 日期统一通过 DateService 获取
 * - 使用自定义错误类型表达业务异常
 */
class RecordReviewResultUseCase {
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
   * 执行记录复习结果
   * 
   * @param {Object} params - 参数
   * @param {string} params.vocabularyId - 词汇ID
   * @param {number} params.performanceRating - 复习评分（0-5）
   * @returns {Promise<Object>} 更新结果
   * 
   * @throws {VocabularyNotFoundError} 词汇不存在
   * @throws {InvalidPerformanceRatingError} 评分无效
   * 
   * @example
   * const result = await useCase.execute({
   *   vocabularyId: 'vocab_123',
   *   performanceRating: 4
   * })
   * // {
   * //   success: true,
   * //   vocabulary: { ... 更新后的词汇 ... }
   * // }
   */
  async execute({ vocabularyId, performanceRating }) {
    try {
      // 1. 验证评分有效性（0-5 范围）
      if (typeof performanceRating !== 'number' || performanceRating < 0 || performanceRating > 5) {
        throw new InvalidPerformanceRatingError(performanceRating)
      }

      // 2. 查找目标词汇
      const vocabulary = await this.vocabularyRepository.findById(vocabularyId)
      if (!vocabulary) {
        throw new VocabularyNotFoundError(vocabularyId)
      }

      // 3. 通过 DateService 获取当前日期
      const currentDateISO = this.dateService.getCurrentDateISO()

      // 4. 调用 Domain 服务计算新状态（返回新实例，不修改原对象）
      const updatedVocabulary = this.spacedRepetitionEngine.updateCard(
        vocabulary,
        performanceRating,
        currentDateISO
      )

      // 5. 持久化更新后的词汇
      await this.vocabularyRepository.save(updatedVocabulary)

      // 6. 返回更新结果
      return {
        success: true,
        vocabulary: updatedVocabulary
      }
    } catch (error) {
      // VocabularyNotFoundError 和 InvalidPerformanceRatingError 是业务错误，直接抛出
      if (error instanceof VocabularyNotFoundError || error instanceof InvalidPerformanceRatingError) {
        throw error
      }

      // 其他错误包装后抛出
      console.error('[RecordReviewResultUseCase] Unexpected error:', error)
      throw new Error(`Failed to record review result: ${error.message}`)
    }
  }
}

module.exports = RecordReviewResultUseCase

