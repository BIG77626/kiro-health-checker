/**
 * Question仓储接口
 *
 * Phase 3.3: Domain层实体仓储接口
 *
 * 职责：
 * - 定义Question实体的持久化契约
 * - 提供题目的CRUD操作接口
 * - 支持多种题型的数据访问
 */

class IQuestionRepository {
  /**
   * 保存题目
   * @param {Question} question - 题目实体
   * @returns {Promise<boolean>} 保存是否成功
   */
  async save(question) {
    throw new Error('Must implement save()')
  }

  /**
   * 批量保存题目
   * @param {Array<Question>} questions - 题目实体数组
   * @returns {Promise<boolean>} 保存是否成功
   */
  async saveBatch(questions) {
    throw new Error('Must implement saveBatch()')
  }

  /**
   * 根据ID查找题目
   * @param {string} questionId - 题目ID
   * @returns {Promise<Question|null>} 题目实体或null
   */
  async findById(questionId) {
    throw new Error('Must implement findById()')
  }

  /**
   * 根据试卷ID查找题目列表
   * @param {string} paperId - 试卷ID
   * @returns {Promise<Array<Question>>} 题目列表
   */
  async findByPaperId(paperId) {
    throw new Error('Must implement findByPaperId()')
  }

  /**
   * 根据文章ID查找题目
   * @param {string} passageId - 文章ID
   * @returns {Promise<Array<Question>>} 题目列表
   */
  async findByPassageId(passageId) {
    throw new Error('Must implement findByPassageId()')
  }

  /**
   * 根据题型查找题目
   * @param {string} type - 题型：'reading' | 'cloze' | 'translation' | 'writing'
   * @param {Object} options - 查询选项
   * @param {number} options.limit - 限制数量
   * @param {string} options.difficulty - 难度过滤
   * @returns {Promise<Array<Question>>} 题目列表
   */
  async findByType(type, options = {}) {
    throw new Error('Must implement findByType()')
  }

  /**
   * 搜索题目
   * @param {string} keyword - 搜索关键词
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Array<Question>>} 搜索结果
   */
  async search(keyword, filters = {}) {
    throw new Error('Must implement search()')
  }

  /**
   * 获取推荐题目
   * @param {string} userId - 用户ID
   * @param {Object} preferences - 用户偏好
   * @param {number} count - 推荐数量
   * @returns {Promise<Array<Question>>} 推荐题目列表
   */
  async getRecommended(userId, preferences = {}, count = 10) {
    throw new Error('Must implement getRecommended()')
  }

  /**
   * 更新题目
   * @param {string} questionId - 题目ID
   * @param {Object} updates - 更新数据
   * @returns {Promise<boolean>} 更新是否成功
   */
  async update(questionId, updates) {
    throw new Error('Must implement update()')
  }

  /**
   * 删除题目
   * @param {string} questionId - 题目ID
   * @returns {Promise<boolean>} 删除是否成功
   */
  async delete(questionId) {
    throw new Error('Must implement delete()')
  }

  /**
   * 获取题目统计信息
   * @param {Object} filters - 过滤条件
   * @returns {Promise<Object>} 统计数据
   */
  async getStatistics(filters = {}) {
    throw new Error('Must implement getStatistics()')
  }
}

module.exports = IQuestionRepository
