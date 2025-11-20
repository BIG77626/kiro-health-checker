/**
 * 练习数据仓储接口
 * 定义练习相关数据的访问契约
 *
 * Phase 3: 为练习页面提供数据访问抽象
 */
class IPracticeRepository {
  /**
   * 根据ID获取试卷
   * @param {string} paperId - 试卷ID
   * @returns {Promise<Object|null>} 试卷数据或null
   */
  async getPaperById(paperId) {
    throw new Error('Must implement getPaperById()')
  }

  /**
   * 获取推荐试卷
   * @returns {Promise<Object|null>} 推荐试卷数据
   */
  async getRecommendedPaper() {
    throw new Error('Must implement getRecommendedPaper()')
  }

  /**
   * 保存练习记录
   * @param {string} userId - 用户ID
   * @param {Object} record - 练习记录
   * @returns {Promise<boolean>} 保存是否成功
   */
  async savePracticeRecord(userId, record) {
    throw new Error('Must implement savePracticeRecord()')
  }

  /**
   * 获取练习历史记录
   * @param {string} userId - 用户ID
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>} 练习记录数组
   */
  async getPracticeHistory(userId, limit = 100) {
    throw new Error('Must implement getPracticeHistory()')
  }

  /**
   * 获取练习统计数据
   * @param {string} userId - 用户ID
   * @param {string} paperId - 试卷ID（可选）
   * @returns {Promise<Object>} 统计数据
   */
  async getPracticeStatistics(userId, paperId = null) {
    throw new Error('Must implement getPracticeStatistics()')
  }

  /**
   * 更新练习进度
   * @param {string} userId - 用户ID
   * @param {string} paperId - 试卷ID
   * @param {Object} progress - 进度数据
   * @returns {Promise<boolean>} 更新是否成功
   */
  async updatePracticeProgress(userId, paperId, progress) {
    throw new Error('Must implement updatePracticeProgress()')
  }

  /**
   * 获取练习进度
   * @param {string} userId - 用户ID
   * @param {string} paperId - 试卷ID
   * @returns {Promise<Object|null>} 进度数据或null
   */
  async getPracticeProgress(userId, paperId) {
    throw new Error('Must implement getPracticeProgress()')
  }

  /**
   * 清除练习进度
   * @param {string} userId - 用户ID
   * @param {string} paperId - 试卷ID（可选，为null时清除所有进度）
   * @returns {Promise<boolean>} 清除是否成功
   */
  async clearPracticeProgress(userId, paperId = null) {
    throw new Error('Must implement clearPracticeProgress()')
  }
}

module.exports = IPracticeRepository
