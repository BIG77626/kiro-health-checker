/**
 * Answer仓储接口
 *
 * Phase 3.3: Domain层实体仓储接口
 *
 * 职责：
 * - 定义Answer实体的持久化契约
 * - 提供答案记录的CRUD操作接口
 * - 支持答案分析和统计查询
 */

class IAnswerRepository {
  /**
   * 保存答案记录
   * @param {Answer} answer - 答案实体
   * @returns {Promise<boolean>} 保存是否成功
   */
  async save(answer) {
    throw new Error('Must implement save()')
  }

  /**
   * 批量保存答案记录
   * @param {Array<Answer>} answers - 答案实体数组
   * @returns {Promise<boolean>} 保存是否成功
   */
  async saveBatch(answers) {
    throw new Error('Must implement saveBatch()')
  }

  /**
   * 根据题目ID查找答案
   * @param {string} questionId - 题目ID
   * @returns {Promise<Array<Answer>>} 答案记录列表
   */
  async findByQuestionId(questionId) {
    throw new Error('Must implement findByQuestionId()')
  }

  /**
   * 根据会话ID查找答案
   * @param {string} sessionId - 会话ID
   * @returns {Promise<Array<Answer>>} 答案记录列表
   */
  async findBySessionId(sessionId) {
    throw new Error('Must implement findBySessionId()')
  }

  /**
   * 根据用户ID查找答案记录
   * @param {string} userId - 用户ID
   * @param {Object} options - 查询选项
   * @param {number} options.limit - 限制数量
   * @param {number} options.offset - 偏移量
   * @param {Date} options.startDate - 开始日期
   * @param {Date} options.endDate - 结束日期
   * @returns {Promise<Array<Answer>>} 答案记录列表
   */
  async findByUserId(userId, options = {}) {
    throw new Error('Must implement findByUserId()')
  }

  /**
   * 根据题目ID和用户ID查找答案
   * @param {string} questionId - 题目ID
   * @param {string} userId - 用户ID
   * @returns {Promise<Answer|null>} 最新答案记录或null
   */
  async findByQuestionAndUser(questionId, userId) {
    throw new Error('Must implement findByQuestionAndUser()')
  }

  /**
   * 根据题目ID和会话ID查找答案
   * @param {string} questionId - 题目ID
   * @param {string} sessionId - 会话ID
   * @returns {Promise<Answer|null>} 最新答案记录或null
   */
  async findByQuestionAndSession(questionId, sessionId) {
    throw new Error('Must implement findByQuestionAndSession()')
  }

  /**
   * 获取用户对特定试卷的答案
   * @param {string} userId - 用户ID
   * @param {string} paperId - 试卷ID
   * @returns {Promise<Array<Answer>>} 答案记录列表
   */
  async findByUserAndPaper(userId, paperId) {
    throw new Error('Must implement findByUserAndPaper()')
  }

  /**
   * 更新答案记录
   * @param {string} answerId - 答案ID（通常是questionId + sessionId的组合）
   * @param {Object} updates - 更新数据
   * @returns {Promise<boolean>} 更新是否成功
   */
  async update(answerId, updates) {
    throw new Error('Must implement update()')
  }

  /**
   * 删除答案记录
   * @param {string} answerId - 答案ID
   * @returns {Promise<boolean>} 删除是否成功
   */
  async delete(answerId) {
    throw new Error('Must implement delete()')
  }

  /**
   * 删除会话的所有答案
   * @param {string} sessionId - 会话ID
   * @returns {Promise<boolean>} 删除是否成功
   */
  async deleteBySessionId(sessionId) {
    throw new Error('Must implement deleteBySessionId()')
  }

  /**
   * 获取答案统计信息
   * @param {string} userId - 用户ID
   * @param {Object} filters - 过滤条件
   * @param {Date} filters.startDate - 开始日期
   * @param {Date} filters.endDate - 结束日期
   * @param {string} filters.questionType - 题型过滤
   * @param {boolean} filters.onlyCorrect - 仅正确答案
   * @returns {Promise<Object>} 统计数据
   */
  async getStatistics(userId, filters = {}) {
    throw new Error('Must implement getStatistics()')
  }

  /**
   * 获取用户答题历史分析
   * @param {string} userId - 用户ID
   * @param {Object} options - 分析选项
   * @param {string} options.groupBy - 分组方式：'day' | 'week' | 'month' | 'questionType'
   * @param {Date} options.startDate - 开始日期
   * @param {Date} options.endDate - 结束日期
   * @returns {Promise<Array>} 分析数据数组
   */
  async getAnalysis(userId, options = {}) {
    throw new Error('Must implement getAnalysis()')
  }

  /**
   * 获取错题本
   * @param {string} userId - 用户ID
   * @param {Object} options - 查询选项
   * @param {number} options.limit - 限制数量
   * @param {string} options.questionType - 题型过滤
   * @returns {Promise<Array<Object>>} 错题列表（包含题目和答案信息）
   */
  async getIncorrectAnswers(userId, options = {}) {
    throw new Error('Must implement getIncorrectAnswers()')
  }

  /**
   * 获取高频错题
   * @param {string} userId - 用户ID
   * @param {number} limit - 返回数量
   * @returns {Promise<Array<Object>>} 高频错题列表
   */
  async getFrequentMistakes(userId, limit = 10) {
    throw new Error('Must implement getFrequentMistakes()')
  }
}

module.exports = IAnswerRepository
