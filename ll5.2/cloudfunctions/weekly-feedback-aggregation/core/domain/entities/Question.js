/**
 * Question - 题目实体（题型基类）
 *
 * Phase 3.3: Domain 层实体
 *
 * 职责：
 * - 表示一道题目及其所有属性
 * - 提供题目验证和答案检查方法
 * - 支持多种题型（阅读、完形、翻译、写作）
 * - 不包含业务逻辑，只包含数据和约束
 */

class Question {
  /**
   * 构造函数
   * @param {Object} params - 题目参数
   * @param {string} params.id - 题目唯一标识
   * @param {string} params.type - 题型：'reading' | 'cloze' | 'translation' | 'writing'
   * @param {string} params.question - 题干文本
   * @param {Array} params.options - 选项数组（选择题）
   * @param {string} params.correctAnswer - 正确答案
   * @param {string} params.explanation - 解析说明
   * @param {Object} params.metadata - 元数据
   */
  constructor(params = {}) {
    // 基本信息
    this.id = params.id || this._generateId()
    this.type = params.type || 'reading'
    this.question = params.question || params.stem || ''
    this.passageId = params.passageId || null // 关联文章ID

    // 答案相关
    this.options = params.options || [] // 选择题选项
    this.correctAnswer = params.correctAnswer || params.correct_answer || ''
    this.explanation = params.explanation || ''

    // 证据信息（阅读理解特有）
    this.evidenceParagraphs = params.evidenceParagraphs || params.evidence_paragraphs || []
    this.evidenceSentences = params.evidenceSentences || params.evidence_sentences || []

    // 难度和提示
    this.difficultyTips = params.difficultyTips || params.difficulty_tips || []
    this.skill = params.skill || this._getDefaultSkill()

    // 元数据
    this.metadata = {
      createdAt: params.createdAt || Date.now(),
      updatedAt: params.updatedAt || Date.now(),
      difficulty: params.difficulty || 'medium',
      points: params.points || 1, // 分值
      timeLimit: params.timeLimit || null, // 时间限制（秒）
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
    return `question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取默认技能类型
   * @private
   * @returns {string} 技能标识
   */
  _getDefaultSkill() {
    const skillMap = {
      'reading': 'reading.detail',
      'cloze': 'cloze.logic',
      'translation': 'translation.syntax',
      'writing': 'writing.structure'
    }
    return skillMap[this.type] || 'reading.detail'
  }

  /**
   * 参数验证
   * @private
   */
  _validate() {
    if (!this.id) {
      throw new Error('Question: id is required')
    }

    if (!this.question) {
      throw new Error('Question: question text is required')
    }

    if (!['reading', 'cloze', 'translation', 'writing'].includes(this.type)) {
      throw new Error('Question: type must be one of reading, cloze, translation, writing')
    }

    // 选择题必须有选项
    if (['reading', 'cloze'].includes(this.type) && this.options.length === 0) {
      throw new Error('Question: options are required for choice questions')
    }

    // 选择题必须有正确答案
    if (['reading', 'cloze'].includes(this.type) && !this.correctAnswer) {
      throw new Error('Question: correctAnswer is required for choice questions')
    }

    // 验证选项格式
    if (this.options.length > 0) {
      this.options.forEach((option, index) => {
        if (!option || typeof option !== 'string') {
          throw new Error(`Question: option ${index} must be a non-empty string`)
        }
      })
    }
  }

  /**
   * 检查用户答案是否正确
   * @param {any} userAnswer - 用户答案
   * @returns {boolean} 是否正确
   */
  isAnswerCorrect(userAnswer) {
    if (!userAnswer) return false

    // 字符串比较（忽略大小写和空格）
    if (typeof userAnswer === 'string' && typeof this.correctAnswer === 'string') {
      return userAnswer.trim().toLowerCase() === this.correctAnswer.trim().toLowerCase()
    }

    // 其他类型直接比较
    return userAnswer === this.correctAnswer
  }

  /**
   * 获取答案选项的索引
   * @param {string} answer - 答案文本
   * @returns {number} 选项索引，-1表示未找到
   */
  getAnswerIndex(answer) {
    if (!answer || this.options.length === 0 || typeof answer !== 'string') return -1

    return this.options.findIndex(option =>
      option.charAt(0).toUpperCase() === answer.charAt(0).toUpperCase()
    )
  }

  /**
   * 获取格式化的答案文本
   * @param {string} answer - 原始答案
   * @returns {string} 格式化后的答案
   */
  getFormattedAnswer(answer) {
    const index = this.getAnswerIndex(answer)
    if (index >= 0) {
      return this.options[index]
    }
    return answer !== undefined && answer !== null ? answer : '未作答'
  }

  /**
   * 判断是否为选择题
   * @returns {boolean} 是否为选择题
   */
  isChoiceQuestion() {
    return ['reading', 'cloze'].includes(this.type)
  }

  /**
   * 判断是否为开放题
   * @returns {boolean} 是否为开放题
   */
  isOpenQuestion() {
    return ['translation', 'writing'].includes(this.type)
  }

  /**
   * 获取题目难度等级
   * @returns {string} 难度等级：'easy' | 'medium' | 'hard'
   */
  getDifficulty() {
    return this.metadata.difficulty || 'medium'
  }

  /**
   * 获取题目分值
   * @returns {number} 分值
   */
  getPoints() {
    return this.metadata.points || 1
  }

  /**
   * 获取时间限制
   * @returns {number|null} 时间限制（秒），null表示无限制
   */
  getTimeLimit() {
    return this.metadata.timeLimit || null
  }

  /**
   * 判断是否超时
   * @param {number} timeSpent - 已用时间（秒）
   * @returns {boolean} 是否超时
   */
  isTimeUp(timeSpent) {
    const limit = this.getTimeLimit()
    return limit !== null && timeSpent > limit
  }

  /**
   * 获取题目快照（用于序列化）
   * @returns {Object} 题目数据
   */
  getSnapshot() {
    return {
      id: this.id,
      type: this.type,
      question: this.question,
      passageId: this.passageId,
      options: [...this.options],
      correctAnswer: this.correctAnswer,
      explanation: this.explanation,
      evidenceParagraphs: [...this.evidenceParagraphs],
      evidenceSentences: [...this.evidenceSentences],
      difficultyTips: [...this.difficultyTips],
      skill: this.skill,
      metadata: { ...this.metadata }
    }
  }

  /**
   * 从快照恢复题目
   * @param {Object} snapshot - 题目快照
   * @returns {Question} 题目实例
   */
  static fromSnapshot(snapshot) {
    return new Question(snapshot)
  }

  /**
   * 创建阅读理解题目
   * @param {Object} params - 题目参数
   * @returns {Question} 阅读题目实例
   */
  static createReadingQuestion(params) {
    return new Question({
      ...params,
      type: 'reading'
    })
  }

  /**
   * 创建完形填空题目
   * @param {Object} params - 题目参数
   * @returns {Question} 完形题目实例
   */
  static createClozeQuestion(params) {
    return new Question({
      ...params,
      type: 'cloze'
    })
  }

  /**
   * 创建翻译题目
   * @param {Object} params - 题目参数
   * @returns {Question} 翻译题目实例
   */
  static createTranslationQuestion(params) {
    return new Question({
      ...params,
      type: 'translation'
    })
  }

  /**
   * 创建写作题目
   * @param {Object} params - 题目参数
   * @returns {Question} 写作题目实例
   */
  static createWritingQuestion(params) {
    return new Question({
      ...params,
      type: 'writing'
    })
  }
}

module.exports = Question
