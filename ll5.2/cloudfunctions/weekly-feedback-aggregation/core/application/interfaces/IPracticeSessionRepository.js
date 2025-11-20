/**
 * PracticeSession仓储接口
 *
 * Phase 3.3: Domain层实体仓储接口
 *
 * 职责：
 * - 定义PracticeSession实体的持久化契约
 * - 提供会话的CRUD操作接口
 * - 确保接口隔离，不依赖具体实现
 */

class IPracticeSessionRepository {
  /**
   * 保存练习会话
   * @param {PracticeSession} session - 练习会话实体
   * @returns {Promise<boolean>} 保存是否成功
   */
  async save(session) {
    throw new Error('Must implement save()')
  }

  /**
   * 根据ID查找练习会话
   * @param {string} sessionId - 会话ID
   * @returns {Promise<PracticeSession|null>} 会话实体或null
   */
  async findById(sessionId) {
    throw new Error('Must implement findById()')
  }

  /**
   * 根据试卷ID查找进行中的会话
   * @param {string} paperId - 试卷ID
   * @returns {Promise<PracticeSession|null>} 进行中的会话或null
   */
  async findActiveByPaperId(paperId) {
    throw new Error('Must implement findActiveByPaperId()')
  }

  /**
   * 获取用户的所有会话
   * @param {string} userId - 用户ID
   * @param {Object} options - 查询选项
   * @param {number} options.limit - 限制数量
   * @param {number} options.offset - 偏移量
   * @param {string} options.status - 状态过滤
   * @returns {Promise<Array<PracticeSession>>} 会话列表
   */
  async findByUserId(userId, options = {}) {
    throw new Error('Must implement findByUserId()')
  }

  /**
   * 更新练习会话
   * @param {string} sessionId - 会话ID
   * @param {Object} updates - 更新数据
   * @returns {Promise<boolean>} 更新是否成功
   */
  async update(sessionId, updates) {
    throw new Error('Must implement update()')
  }

  /**
   * 删除练习会话
   * @param {string} sessionId - 会话ID
   * @returns {Promise<boolean>} 删除是否成功
   */
  async delete(sessionId) {
    throw new Error('Must implement delete()')
  }

  /**
   * 获取会话统计信息
   * @param {string} userId - 用户ID
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @returns {Promise<Object>} 统计数据
   */
  async getStatistics(userId, startDate, endDate) {
    throw new Error('Must implement getStatistics()')
  }
}

module.exports = IPracticeSessionRepository
