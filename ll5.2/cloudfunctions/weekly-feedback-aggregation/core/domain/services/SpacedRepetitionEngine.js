const Vocabulary = require('../entities/Vocabulary')

/**
 * SpacedRepetitionEngine - 间隔重复算法引擎
 *
 * Phase 2: SM-2 算法实现
 *
 * 职责：
 * - 实现 SM-2 间隔重复算法的纯计算逻辑
 * - 生成复习计划
 * - 更新词汇卡片状态
 *
 * 约束：
 * - ✅ 纯函数，无副作用
 * - ✅ 所有日期计算基于传入的 currentDateISO 参数
 * - ❌ 禁止使用 Date.now()、new Date()（日期通过参数传入）
 * - ❌ 禁止任何外部依赖（包括 wx、console）
 * - ✅ 可被 Jest 直接测试，无需 Mock
 */
class SpacedRepetitionEngine {
  /**
   * 生成复习计划
   * 筛选出今日需要复习的词汇列表
   *
   * @param {Vocabulary[]} vocabularies - 用户所有词汇列表
   * @param {string} currentDateISO - 当前日期（ISO 8601 格式）
   * @returns {Vocabulary[]} 今日需要复习的词汇列表
   */
  generatePlan(vocabularies, currentDateISO) {
    if (!vocabularies || vocabularies.length === 0) {
      return []
    }

    const currentDate = this._parseDate(currentDateISO)

    return vocabularies.filter(vocab => {
      if (!vocab.nextReviewDate) {
        return true // 没有设置复习日期的词汇也算作需要复习
      }

      const reviewDate = this._parseDate(vocab.nextReviewDate)
      return reviewDate <= currentDate
    })
  }

  /**
   * 更新词汇卡片（SM-2 算法核心）
   *
   * @param {Vocabulary} card - 当前词汇卡片
   * @param {number} performanceRating - 用户表现评分（0-5）
   *   0: 完全忘记
   *   1: 困难
   *   2: 困难但能回忆
   *   3: 正常
   *   4: 简单
   *   5: 非常简单
   * @param {string} currentDateISO - 当前日期（ISO 8601 格式）
   * @returns {Vocabulary} 更新后的词汇卡片（新实例）
   */
  updateCard(card, performanceRating, currentDateISO) {
    // 计算新的 Ease Factor
    const newEaseFactor = this._calculateEaseFactor(card.easeFactor, performanceRating)

    // 计算新的间隔和重复次数
    let newInterval
    let newRepetition

    if (performanceRating < 3) {
      // 回答错误，重置状态
      newInterval = 0
      newRepetition = 0
    } else {
      // 回答正确
      if (card.repetition === 0) {
        // 首次复习正确
        newInterval = 1
        newRepetition = 1
      } else {
        // 后续复习正确
        newInterval = Math.ceil(card.interval * newEaseFactor)
        newRepetition = card.repetition + 1
      }
    }

    // 计算下次复习日期
    const nextReviewDate = this._addDays(currentDateISO, newInterval)

    // 返回新的 Vocabulary 实例（不修改原对象）
    return new Vocabulary({
      ...card.toJSON(),
      interval: newInterval,
      repetition: newRepetition,
      easeFactor: newEaseFactor,
      nextReviewDate: nextReviewDate,
      updatedAt: currentDateISO
    })
  }

  /**
   * 计算新的 Ease Factor
   * SM-2 公式: EF' = EF + (0.1 - (5-q) * (0.08 + (5-q) * 0.02))
   *
   * @private
   * @param {number} currentEaseFactor - 当前简易度因子
   * @param {number} performanceRating - 表现评分（0-5）
   * @returns {number} 新的简易度因子（最小值 1.3）
   */
  _calculateEaseFactor(currentEaseFactor, performanceRating) {
    const q = performanceRating
    let newEaseFactor = currentEaseFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))

    // Ease Factor 最小值限制为 1.3
    if (newEaseFactor < 1.3) {
      newEaseFactor = 1.3
    }

    return newEaseFactor
  }

  /**
   * 在指定日期基础上增加天数
   *
   * @private
   * @param {string} dateISO - ISO 8601 格式日期
   * @param {number} days - 要增加的天数
   * @returns {string} 新日期（ISO 8601 格式）
   */
  _addDays(dateISO, days) {
    const date = this._parseDate(dateISO)
    date.setDate(date.getDate() + days)
    return date.toISOString()
  }

  /**
   * 解析 ISO 8601 日期字符串为 Date 对象
   * 注意：这里使用 Date 对象是为了日期计算，但不使用 Date.now() 或 new Date() 获取当前时间
   *
   * @private
   * @param {string} dateISO - ISO 8601 格式日期
   * @returns {Date} Date 对象
   */
  _parseDate(dateISO) {
    return new Date(dateISO)
  }
}

module.exports = SpacedRepetitionEngine

