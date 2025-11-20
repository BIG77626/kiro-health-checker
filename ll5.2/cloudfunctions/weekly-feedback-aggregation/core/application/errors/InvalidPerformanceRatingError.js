/**
 * InvalidPerformanceRatingError - 无效的复习评分错误
 * 
 * Phase 2: Application 层业务错误
 * 
 * 使用场景：
 * - performanceRating 不在 0-5 范围内
 * - RecordReviewResultUseCase 中验证评分有效性
 * 
 * 职责：
 * - 表示评分参数验证失败的业务错误
 * - 提供错误详情（包含实际评分值和有效范围）
 */
class InvalidPerformanceRatingError extends Error {
  /**
   * 创建无效评分错误
   * 
   * @param {number} rating - 无效的评分值
   */
  constructor(rating) {
    super(`Invalid performance rating: ${rating}, must be between 0-5`)
    this.name = 'InvalidPerformanceRatingError'
    this.rating = rating
    this.validRange = { min: 0, max: 5 }
  }
}

module.exports = InvalidPerformanceRatingError

