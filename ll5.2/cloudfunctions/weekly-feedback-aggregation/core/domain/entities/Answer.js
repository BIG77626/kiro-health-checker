/**
 * Answer - 答案实体
 *
 * Phase 3.3: Domain 层实体
 *
 * 职责：
 * - 表示用户对一道题目的答案记录
 * - 包含答案内容、时间戳、尝试次数等信息
 * - 提供答案验证和格式化方法
 * - 不包含业务逻辑，只包含数据和约束
 */

class Answer {
  /**
   * 构造函数
   * @param {Object} params - 答案参数
   * @param {string} params.questionId - 题目ID
   * @param {any} params.answer - 用户答案
   * @param {any} params.correctAnswer - 正确答案（用于验证）
   * @param {number} params.timestamp - 答题时间戳
   * @param {number} params.attempts - 尝试次数
   * @param {number} params.timeSpent - 答题用时（秒）
   */
  constructor(params = {}) {
    // 关联信息
    this.questionId = params.questionId
    this.sessionId = params.sessionId || null

    // 答案内容
    this.answer = params.answer
    this.correctAnswer = params.correctAnswer || null

    // 时间信息
    this.timestamp = params.timestamp || Date.now()
    this.timeSpent = params.timeSpent || 0 // 答题用时（秒）

    // 答题统计
    this.attempts = params.attempts !== undefined ? params.attempts : 1
    this.isCorrect = params.isCorrect !== undefined ? params.isCorrect : this._calculateCorrectness()

    // 元数据
    this.metadata = {
      device: params.device || null,
      network: params.network || null,
      idleTime: params.idleTime || 0, // 空闲时间
      hintsUsed: params.hintsUsed || 0, // 使用提示次数
      ...params.metadata
    }

    // 验证参数
    this._validate()
  }

  /**
   * 参数验证
   * @private
   */
  _validate() {
    if (!this.questionId) {
      throw new Error('Answer: questionId is required')
    }

    if (this.timestamp && (this.timestamp < 0 || this.timestamp > Date.now() + 86400000)) {
      throw new Error('Answer: timestamp is invalid')
    }

    if (this.timeSpent < 0) {
      throw new Error('Answer: timeSpent cannot be negative')
    }

    if (this.attempts < 1) {
      throw new Error('Answer: attempts must be at least 1')
    }
  }

  /**
   * 计算答案正确性
   * @private
   * @returns {boolean} 是否正确
   */
  _calculateCorrectness() {
    if (this.correctAnswer === null || this.correctAnswer === undefined) {
      return false // 无法判断
    }

    if (!this.answer) {
      return false // 未作答
    }

    // 字符串比较（忽略大小写和空格）
    if (typeof this.answer === 'string' && typeof this.correctAnswer === 'string') {
      return this.answer.trim().toLowerCase() === this.correctAnswer.trim().toLowerCase()
    }

    // 数组比较（深度比较）
    if (Array.isArray(this.answer) && Array.isArray(this.correctAnswer)) {
      if (this.answer.length !== this.correctAnswer.length) return false
      return this.answer.every((val, index) => val === this.correctAnswer[index])
    }

    // 对象比较（使用JSON序列化）
    if (typeof this.answer === 'object' && typeof this.correctAnswer === 'object') {
      return JSON.stringify(this.answer) === JSON.stringify(this.correctAnswer)
    }

    // 其他类型直接比较
    return this.answer === this.correctAnswer
  }

  /**
   * 更新答案（用于多次尝试）
   * @param {any} newAnswer - 新答案
   * @param {number} additionalTime - 额外用时（秒）
   */
  updateAnswer(newAnswer, additionalTime = 0) {
    this.answer = newAnswer
    this.timestamp = Date.now()
    this.timeSpent += additionalTime
    this.attempts += 1
    this.isCorrect = this._calculateCorrectness()

    this.metadata.updatedAt = Date.now()
  }

  /**
   * 获取答案状态
   * @returns {string} 状态：'unanswered' | 'correct' | 'incorrect'
   */
  getStatus() {
    if (!this.answer) {
      return 'unanswered'
    }
    return this.isCorrect ? 'correct' : 'incorrect'
  }

  /**
   * 判断是否为首次正确答案
   * @returns {boolean} 是否首次正确
   */
  isFirstTimeCorrect() {
    return this.isCorrect && this.attempts === 1
  }

  /**
   * 获取答题效率（每秒得分）
   * @returns {number} 效率值
   */
  getEfficiency() {
    if (this.timeSpent <= 0) return 0

    const points = this.isCorrect ? 1 : 0
    return points / this.timeSpent
  }

  /**
   * 获取格式化的答案文本
   * @param {Array} options - 选项数组（用于选择题）
   * @returns {string} 格式化答案
   */
  getFormattedAnswer(options = []) {
    if (this.answer === null || this.answer === undefined) {
      return '未作答'
    }

    // 如果是选择题，尝试格式化
    if (options.length > 0 && typeof this.answer === 'string') {
      // 优先尝试字母索引匹配（如 'A' -> 0, 'B' -> 1）
      if (this.answer.length === 1) {
        const index = this.answer.toUpperCase().charCodeAt(0) - 'A'.charCodeAt(0)
        if (index >= 0 && index < options.length) {
          return options[index]
        }
      }
    }

    return String(this.answer)
  }

  /**
   * 获取答题分析数据
   * @returns {Object} 分析数据
   */
  getAnalysis() {
    return {
      questionId: this.questionId,
      isCorrect: this.isCorrect,
      attempts: this.attempts,
      timeSpent: this.timeSpent,
      efficiency: this.getEfficiency(),
      status: this.getStatus(),
      firstTimeCorrect: this.isFirstTimeCorrect(),
      timestamp: this.timestamp,
      metadata: { ...this.metadata }
    }
  }

  /**
   * 获取答案快照（用于序列化）
   * @returns {Object} 答案数据
   */
  getSnapshot() {
    return {
      questionId: this.questionId,
      sessionId: this.sessionId,
      answer: this.answer,
      correctAnswer: this.correctAnswer,
      timestamp: this.timestamp,
      timeSpent: this.timeSpent,
      attempts: this.attempts,
      isCorrect: this.isCorrect,
      metadata: { ...this.metadata }
    }
  }

  /**
   * 从快照恢复答案
   * @param {Object} snapshot - 答案快照
   * @returns {Answer} 答案实例
   */
  static fromSnapshot(snapshot) {
    return new Answer(snapshot)
  }

  /**
   * 创建未答答案
   * @param {string} questionId - 题目ID
   * @returns {Answer} 未答答案实例
   */
  static createUnanswered(questionId) {
    const answer = new Answer({
      questionId,
      answer: null,
      timeSpent: 0
    })
    answer.attempts = 0 // 直接设置attempts，绕过验证
    return answer
  }

  /**
   * 创建正确答案
   * @param {Object} params - 参数
   * @returns {Answer} 正确答案实例
   */
  static createCorrectAnswer(params) {
    return new Answer({
      ...params,
      isCorrect: true
    })
  }

  /**
   * 创建错误答案
   * @param {Object} params - 参数
   * @returns {Answer} 错误答案实例
   */
  static createIncorrectAnswer(params) {
    return new Answer({
      ...params,
      isCorrect: false
    })
  }

  /**
   * 批量创建答案
   * @param {Array} answerData - 答案数据数组
   * @returns {Array<Answer>} 答案实例数组
   */
  static createBatch(answerData) {
    return answerData.map(data => new Answer(data))
  }
}

module.exports = Answer
