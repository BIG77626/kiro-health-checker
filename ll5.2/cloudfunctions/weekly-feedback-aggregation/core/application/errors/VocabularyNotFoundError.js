/**
 * VocabularyNotFoundError - 词汇不存在错误
 * 
 * Phase 2: Application 层业务错误
 * 
 * 使用场景：
 * - 通过 ID 查找词汇时，词汇不存在
 * - RecordReviewResultUseCase 中验证词汇存在性
 * 
 * 职责：
 * - 表示词汇查找失败的业务错误
 * - 提供错误详情（包含 vocabularyId）
 */
class VocabularyNotFoundError extends Error {
  /**
   * 创建词汇不存在错误
   * 
   * @param {string} vocabularyId - 未找到的词汇ID
   */
  constructor(vocabularyId) {
    super(`Vocabulary not found: ${vocabularyId}`)
    this.name = 'VocabularyNotFoundError'
    this.vocabularyId = vocabularyId
  }
}

module.exports = VocabularyNotFoundError

