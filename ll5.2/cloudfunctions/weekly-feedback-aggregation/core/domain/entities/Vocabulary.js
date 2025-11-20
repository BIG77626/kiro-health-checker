/**
 * Vocabulary 实体 - 领域层
 *
 * Phase 2: 间隔重复学习词汇实体
 *
 * 职责：
 * - 表示一个学习词汇及其 SM-2 算法所需的所有状态信息
 * - 完全独立于框架（无 wx、无 Date.now、无外部API）
 * - 只包含数据和基本序列化方法，业务逻辑由 Domain Service 处理
 */
class Vocabulary {
  /**
   * 创建词汇实体
   * @param {Object} data - 初始化数据
   * @param {string} data.id - 词汇唯一标识
   * @param {string} data.word - 单词文本
   * @param {string} data.translation - 翻译
   * @param {string} data.userId - 所属用户ID
   * @param {number} [data.interval=0] - 复习间隔（天数）
   * @param {number} [data.repetition=0] - 已复习次数
   * @param {number} [data.easeFactor=2.5] - 简易度因子
   * @param {string} data.nextReviewDate - 下次复习日期（ISO 8601格式）
   * @param {string} data.createdAt - 创建时间（ISO 8601格式）
   * @param {string} data.updatedAt - 更新时间（ISO 8601格式）
   */
  constructor(data = {}) {
    this.id = data.id || this._generateId()
    this.word = data.word || ''
    this.translation = data.translation || ''
    this.userId = data.userId || ''

    // SM-2 算法状态字段
    this.interval = data.interval !== undefined ? data.interval : 0
    this.repetition = data.repetition !== undefined ? data.repetition : 0
    this.easeFactor = data.easeFactor !== undefined ? data.easeFactor : 2.5
    this.nextReviewDate = data.nextReviewDate || ''

    // 元数据
    this.createdAt = data.createdAt || ''
    this.updatedAt = data.updatedAt || ''
  }

  /**
   * 生成唯一ID
   * @private
   * @returns {string}
   */
  _generateId() {
    // 注意：这里不使用 Date.now()，而是通过参数传入时间
    // 实际创建时应由外部传入当前时间
    const timestamp = Math.floor(Math.random() * 1000000000) // 临时随机数，仅用于测试
    const random = Math.random().toString(36).substr(2, 9)
    return `vocab_${timestamp}_${random}`
  }

  /**
   * 序列化为可存储格式
   * @returns {Object}
   */
  toJSON() {
    return {
      id: this.id,
      word: this.word,
      translation: this.translation,
      userId: this.userId,
      interval: this.interval,
      repetition: this.repetition,
      easeFactor: this.easeFactor,
      nextReviewDate: this.nextReviewDate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  /**
   * 从存储数据反序列化
   * @param {Object} data - 存储的数据
   * @returns {Vocabulary}
   */
  static fromJSON(data) {
    return new Vocabulary(data)
  }
}

module.exports = Vocabulary
