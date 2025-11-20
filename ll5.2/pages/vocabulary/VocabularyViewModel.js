/**
 * VocabularyViewModel - 词汇学习页面视图模型
 *
 * Phase 3.1: UI层与Application层桥接
 *
 * 职责：
 * - 作为页面与Use Cases之间的桥梁
 * - 转换UseCase返回数据为页面所需格式
 * - 处理错误并转换为用户友好消息
 * - 管理页面状态转换逻辑
 */

const VocabularyNotFoundError = require('../../core/application/errors/VocabularyNotFoundError')
const InvalidPerformanceRatingError = require('../../core/application/errors/InvalidPerformanceRatingError')

class VocabularyViewModel {
  /**
   * 创建ViewModel实例
   *
   * @param {Object} dependencies - 依赖注入
   * @param {StartLearningSessionUseCase} dependencies.startLearningSessionUseCase
   * @param {RecordReviewResultUseCase} dependencies.recordReviewResultUseCase
   */
  constructor(dependencies) {
    if (!dependencies) {
      throw new Error('dependencies is required')
    }
    if (!dependencies.startLearningSessionUseCase) {
      throw new Error('startLearningSessionUseCase is required')
    }
    if (!dependencies.recordReviewResultUseCase) {
      throw new Error('recordReviewResultUseCase is required')
    }

    this.startLearningSessionUseCase = dependencies.startLearningSessionUseCase
    this.recordReviewResultUseCase = dependencies.recordReviewResultUseCase

    console.log('[VocabularyViewModel] 初始化完成')
  }

  /**
   * 开始学习会话
   *
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 页面所需的学习数据
   */
  async startSession(userId) {
    try {
      console.log('[VocabularyViewModel] 开始学习会话:', userId)

      const result = await this.startLearningSessionUseCase.execute({ userId })

      if (!result.success) {
        console.error('[VocabularyViewModel] 开始会话失败:', result.error)
        return {
          success: false,
          error: this._convertErrorToUserMessage(result.error)
        }
      }

      // 转换数据为页面期望的格式
      const sessionData = this._convertSessionToPageData(result.session)

      console.log('[VocabularyViewModel] 会话开始成功:', {
        totalCount: sessionData.totalCount,
        reviewCount: sessionData.reviewCount
      })

      return {
        success: true,
        session: sessionData
      }

    } catch (error) {
      console.error('[VocabularyViewModel] 开始会话异常:', error)
      return {
        success: false,
        error: this._convertErrorToUserMessage(error.message)
      }
    }
  }

  /**
   * 记录复习结果
   *
   * @param {string} vocabularyId - 词汇ID
   * @param {number} performanceRating - 评分 (0-5，对应页面中的mastery)
   * @returns {Promise<Object>} 更新结果
   */
  async recordAnswer(vocabularyId, performanceRating) {
    try {
      console.log('[VocabularyViewModel] 记录答案:', { vocabularyId, performanceRating })

      // 将页面的mastery转换为UseCase的评分
      const rating = this._convertMasteryToRating(performanceRating)

      const result = await this.recordReviewResultUseCase.execute({
        vocabularyId,
        performanceRating: rating
      })

      if (!result.success) {
        console.error('[VocabularyViewModel] 记录答案失败:', result.error)
        return {
          success: false,
          error: this._convertErrorToUserMessage(result.error)
        }
      }

      console.log('[VocabularyViewModel] 答案记录成功:', {
        vocabularyId,
        newInterval: result.vocabulary.interval,
        nextReviewDate: result.vocabulary.nextReviewDate
      })

      return {
        success: true,
        vocabulary: result.vocabulary
      }

    } catch (error) {
      console.error('[VocabularyViewModel] 记录答案异常:', error)

      // 处理业务错误
      if (error instanceof VocabularyNotFoundError) {
        return {
          success: false,
          error: '词汇不存在，可能已被删除'
        }
      }

      if (error instanceof InvalidPerformanceRatingError) {
        return {
          success: false,
          error: '评分无效，请重新选择'
        }
      }

      return {
        success: false,
        error: this._convertErrorToUserMessage(error.message)
      }
    }
  }

  /**
   * 刷新学习会话
   * 用于重新获取复习计划（比如用户手动刷新）
   *
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 刷新后的学习数据
   */
  async refreshSession(userId) {
    try {
      console.log('[VocabularyViewModel] 刷新会话:', userId)

      // 刷新本质上是重新开始会话
      return await this.startSession(userId)

    } catch (error) {
      console.error('[VocabularyViewModel] 刷新会话异常:', error)
      return {
        success: false,
        error: this._convertErrorToUserMessage(error.message)
      }
    }
  }

  /**
   * 将UseCase返回的session数据转换为页面期望的格式
   *
   * @private
   * @param {Object} session - UseCase返回的session对象
   * @returns {Object} 页面格式的session数据
   */
  _convertSessionToPageData(session) {
    return {
      // 基础信息
      userId: session.userId,
      startTime: session.startTime,

      // 词汇列表 - 转换为页面期望的单词格式
      wordsToLearn: session.vocabularies.map(vocab => ({
        id: vocab.id,
        word: vocab.word,
        translation: vocab.translation,
        // 保留SM-2状态供调试（生产环境可移除）
        interval: vocab.interval,
        repetition: vocab.repetition,
        easeFactor: vocab.easeFactor,
        nextReviewDate: vocab.nextReviewDate
      })),

      // 统计信息
      totalCount: session.totalCount,
      reviewCount: session.reviewCount,

      // 页面状态
      currentIndex: 0,
      currentWord: session.vocabularies.length > 0 ? {
        id: session.vocabularies[0].id,
        word: session.vocabularies[0].word,
        translation: session.vocabularies[0].translation,
        interval: session.vocabularies[0].interval,
        repetition: session.vocabularies[0].repetition,
        easeFactor: session.vocabularies[0].easeFactor,
        nextReviewDate: session.vocabularies[0].nextReviewDate
      } : null
    }
  }

  /**
   * 将页面的mastery转换为UseCase的评分
   *
   * @private
   * @param {string|number} mastery - 页面中的掌握度 ('easy', 'good', 'hard', 'again' 或数字)
   * @returns {number} SM-2评分 (0-5)
   */
  _convertMasteryToRating(mastery) {
    // 如果已经是数字，直接返回
    if (typeof mastery === 'number') {
      return Math.max(0, Math.min(5, mastery))
    }

    // 转换字符串为评分
    const ratingMap = {
      'again': 0,    // 完全忘记
      'hard': 2,     // 困难
      'good': 3,     // 一般
      'easy': 4      // 简单
    }

    return ratingMap[mastery] !== undefined ? ratingMap[mastery] : 3 // 默认一般
  }

  /**
   * 将技术错误转换为用户友好的消息
   *
   * @private
   * @param {string} errorMessage - 原始错误消息
   * @returns {string} 用户友好的错误消息
   */
  _convertErrorToUserMessage(errorMessage) {
    // 可以根据不同错误类型返回不同的用户消息
    if (errorMessage.includes('network') || errorMessage.includes('timeout')) {
      return '网络连接失败，请检查网络后重试'
    }

    if (errorMessage.includes('database') || errorMessage.includes('storage')) {
      return '数据存储异常，请稍后重试'
    }

    // 默认错误消息
    return '操作失败，请稍后重试'
  }
}

module.exports = VocabularyViewModel
