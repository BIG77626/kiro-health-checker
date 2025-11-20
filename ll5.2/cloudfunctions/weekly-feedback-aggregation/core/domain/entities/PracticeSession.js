/**
 * PracticeSession - 练习会话实体
 *
 * Phase 3.3: Domain 层实体
 *
 * 职责：
 * - 表示一次完整的练习会话
 * - 管理会话状态和基本信息
 * - 不包含业务逻辑，只包含数据和约束
 *
 * 状态机：
 * IDLE → LOADING → ANSWERING → SUBMITTING → COMPLETED
 *   ↓       ↓         ↓         ↓           ↓
 * ERROR ← ERROR ← ERROR ← ERROR ← ERROR
 */

class PracticeSession {
  /**
   * 构造函数
   * @param {Object} params - 会话参数
   * @param {string} params.id - 会话唯一标识
   * @param {string} params.paperId - 试卷ID
   * @param {string} params.title - 会话标题
   * @param {string} params.mode - 模式：'practice' | 'exam'
   * @param {string} params.type - 题型：'reading' | 'cloze' | 'translation' | 'writing'
   * @param {number} params.startTime - 开始时间戳
   * @param {Object} params.paper - 试卷数据
   */
  constructor(params = {}) {
    // 基本信息
    this.id = params.id || this._generateId()
    this.paperId = params.paperId
    this.title = params.title || `练习会话-${this.id.slice(-6)}`
    this.mode = params.mode || 'practice' // practice | exam
    this.type = params.type || 'reading' // reading | cloze | translation | writing

    // 时间信息
    this.startTime = params.startTime || Date.now()
    this.endTime = null
    this.duration = 0 // 总时长（毫秒）

    // 状态信息
    this.status = params.status || 'idle' // idle | loading | answering | paused | cancelled | completed | error
    this.currentQuestionIndex = params.currentQuestionIndex || 0
    this.totalQuestions = params.totalQuestions || 0

    // 数据
    this.paper = params.paper || null
    this.questions = []
    this.userAnswers = {} // questionId -> answer
    this.correctAnswers = {} // questionId -> correctAnswer

    // 统计信息
    this.statistics = {
      total: 0,
      answered: 0,
      correct: 0,
      accuracy: 0,
      timeSpent: 0,
      attempts: 0
    }

    // 元数据
    this.metadata = {
      idleTime: params.idleTime || 0,
      hintsUsed: params.hintsUsed || 0,
      questionIds: params.questionIds || [],           // 题目ID列表（按需加载）
      resumeCount: params.resumeCount || 0,            // 恢复计数
      lastResumedAt: params.lastResumedAt || null,       // 最后恢复时间
      pausedAt: params.pausedAt || null,            // 暂停时间
      cancelReason: params.cancelReason || null,        // 取消原因
      cancelledAt: params.cancelledAt || null,         // 取消时间
      createdAt: params.createdAt || Date.now(),
      updatedAt: params.updatedAt || Date.now(),
      ...params.metadata
    }

    // 验证参数
    this._validate()
  }

  /**
   * 生成唯一ID
   * @private
   * @returns {string} 唯一标识符
   */
  _generateId() {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 参数验证
   * @private
   */
  _validate() {
    if (!this.paperId) {
      throw new Error('PracticeSession: paperId is required')
    }

    if (!['practice', 'exam'].includes(this.mode)) {
      throw new Error('PracticeSession: mode must be "practice" or "exam"')
    }

    if (!['reading', 'cloze', 'translation', 'writing'].includes(this.type)) {
      throw new Error('PracticeSession: type must be one of reading, cloze, translation, writing')
    }

    const validStatuses = ['idle', 'loading', 'answering', 'paused', 'cancelled', 'completed', 'error']
    if (!validStatuses.includes(this.status)) {
      throw new Error(`PracticeSession: status must be one of ${validStatuses.join(', ')}, got: ${this.status}`)
    }

    // 验证元数据字段
    if (!Array.isArray(this.metadata.questionIds)) {
      throw new Error('PracticeSession: metadata.questionIds must be an array')
    }

    if (typeof this.metadata.resumeCount !== 'number' || this.metadata.resumeCount < 0) {
      throw new Error('PracticeSession: metadata.resumeCount must be a non-negative number')
    }
  }

  /**
   * 开始会话
   */
  start() {
    if (this.status !== 'idle') {
      throw new Error(`Cannot start session in status: ${this.status}`)
    }

    this.status = 'loading'
    this.metadata.updatedAt = Date.now()
  }

  /**
   * 加载完成，开始答题
   * @param {Array} questions - 题目列表
   */
  startAnswering(questions) {
    if (this.status !== 'loading') {
      throw new Error(`Cannot start answering in status: ${this.status}`)
    }

    this.questions = questions || []
    this.totalQuestions = this.questions.length
    this.status = 'answering'
    this.metadata.updatedAt = Date.now()
  }

  /**
   * 提交答案
   * @param {string} questionId - 题目ID
   * @param {any} answer - 用户答案
   */
  submitAnswer(questionId, answer) {
    if (this.status !== 'answering') {
      throw new Error(`Cannot submit answer in status: ${this.status}`)
    }

    // 记录答案
    this.userAnswers[questionId] = {
      answer: answer,
      timestamp: Date.now(),
      attempts: (this.userAnswers[questionId]?.attempts || 0) + 1
    }

    // 更新统计
    this._updateStatistics()

    this.metadata.updatedAt = Date.now()
  }

  /**
   * 完成会话
   */
  complete() {
    if (!['answering', 'submitting'].includes(this.status)) {
      throw new Error(`Cannot complete session in status: ${this.status}`)
    }

    this.status = 'completed'
    this.endTime = Date.now()
    this.duration = this.endTime - this.startTime
    this.metadata.updatedAt = Date.now()
  }

  /**
   * 暂停会话
   * @param {string} reason - 暂停原因（可选）
   */
  pause(reason = 'user_paused') {
    if (this.status !== 'answering') {
      throw new Error(`Cannot pause session in status: ${this.status}`)
    }

    this.status = 'paused'
    this.metadata.pausedAt = Date.now()
    this.metadata.updatedAt = Date.now()
  }

  /**
   * 恢复会话
   */
  resume() {
    if (this.status !== 'paused') {
      throw new Error(`Cannot resume session in status: ${this.status}`)
    }

    this.status = 'answering'
    this.metadata.resumeCount++
    this.metadata.lastResumedAt = Date.now()
    this.metadata.updatedAt = Date.now()
  }

  /**
   * 取消会话
   * @param {string} reason - 取消原因
   */
  cancel(reason = 'user_cancelled') {
    if (this.status === 'completed') {
      throw new Error('Cannot cancel completed session')
    }

    if (this.status === 'cancelled') {
      throw new Error('Session is already cancelled')
    }

    this.status = 'cancelled'
    this.metadata.cancelReason = reason
    this.metadata.cancelledAt = Date.now()
    this.metadata.updatedAt = Date.now()
  }

  /**
   * 检查会话是否已过期
   * @param {number} timeoutMs - 超时时间（毫秒），默认24小时
   * @returns {boolean} 是否已过期
   */
  isExpired(timeoutMs = 24 * 60 * 60 * 1000) {
    const now = Date.now()
    return (now - this.startTime) > timeoutMs
  }

  /**
   * 获取会话状态描述
   * @returns {string} 状态描述
   */
  getStatusDescription() {
    const descriptions = {
      'idle': '未开始',
      'loading': '加载中',
      'answering': '答题中',
      'paused': '已暂停',
      'cancelled': '已取消',
      'completed': '已完成',
      'error': '出错'
    }
    return descriptions[this.status] || '未知状态'
  }

  /**
   * 标记错误状态
   * @param {string} error - 错误信息
   */
  error(error) {
    this.status = 'error'
    this.metadata.error = error
    this.metadata.updatedAt = Date.now()
  }

  /**
   * 更新统计信息
   * @private
   */
  _updateStatistics() {
    const answeredCount = Object.keys(this.userAnswers).length
    let correctCount = 0

    // 计算正确数
    Object.entries(this.userAnswers).forEach(([questionId, userAnswer]) => {
      const correctAnswer = this.correctAnswers[questionId]
      if (this._isAnswerCorrect(userAnswer.answer, correctAnswer)) {
        correctCount++
      }
    })

    // 更新统计
    this.statistics.answered = answeredCount
    this.statistics.correct = correctCount
    this.statistics.accuracy = answeredCount > 0 ? (correctCount / answeredCount) * 100 : 0
    this.statistics.attempts = Object.values(this.userAnswers).reduce(
      (sum, answer) => sum + answer.attempts, 0
    )
  }

  /**
   * 检查答案是否正确
   * @private
   * @param {any} userAnswer - 用户答案
   * @param {any} correctAnswer - 正确答案
   * @returns {boolean} 是否正确
   */
  _isAnswerCorrect(userAnswer, correctAnswer) {
    if (!correctAnswer) return false

    // 字符串比较（忽略大小写和空格）
    if (typeof userAnswer === 'string' && typeof correctAnswer === 'string') {
      return userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
    }

    // 其他类型直接比较
    return userAnswer === correctAnswer
  }

  /**
   * 获取会话状态快照
   * @returns {Object} 状态数据
   */
  getSnapshot() {
    return {
      id: this.id,
      paperId: this.paperId,
      title: this.title,
      mode: this.mode,
      type: this.type,
      status: this.status,
      currentQuestionIndex: this.currentQuestionIndex,
      totalQuestions: this.totalQuestions,
      startTime: this.startTime,
      endTime: this.endTime,
      duration: this.duration,
      userAnswers: this.userAnswers,
      statistics: { ...this.statistics },
      metadata: { ...this.metadata }
    }
  }

  /**
   * 从快照恢复会话
   * @param {Object} snapshot - 状态快照
   */
  static fromSnapshot(snapshot) {
    const session = new PracticeSession({
      id: snapshot.id,
      paperId: snapshot.paperId,
      title: snapshot.title,
      mode: snapshot.mode,
      type: snapshot.type,
      startTime: snapshot.startTime
    })

    // 恢复状态
    session.status = snapshot.status
    session.currentQuestionIndex = snapshot.currentQuestionIndex
    session.totalQuestions = snapshot.totalQuestions
    session.endTime = snapshot.endTime
    session.duration = snapshot.duration
    session.userAnswers = snapshot.userAnswers || {}
    session.statistics = snapshot.statistics || session.statistics
    session.metadata = { ...session.metadata, ...snapshot.metadata }

    return session
  }
}

module.exports = PracticeSession
