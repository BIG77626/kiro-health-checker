/**
 * 用户仓储接口
 * 
 * Phase 1: 定义本地用户操作的抽象接口
 */
class IUserRepository {
  /**
   * 通过 email 查找用户
   */
  async findByEmail(_email) {
    throw new Error('Must implement findByEmail()')
  }

  /**
   * 通过 ID 查找用户
   */
  async findById(_userId) {
    throw new Error('Must implement findById()')
  }

  /**
   * 保存用户
   */
  async save(_user) {
    throw new Error('Must implement save()')
  }

  /**
   * 更新用户
   */
  async update(_user) {
    throw new Error('Must implement update()')
  }

  /**
   * 删除用户
   */
  async delete(_userId) {
    throw new Error('Must implement delete()')
  }

  /**
   * 获取学习统计数据
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 学习统计数据
   */
  async getStudyStatistics(userId) {
    throw new Error('Must implement getStudyStatistics()')
  }

  /**
   * 保存学习记录
   * @param {string} userId - 用户ID
   * @param {Object} record - 学习记录
   * @returns {Promise<boolean>} 保存是否成功
   */
  async saveStudyRecord(userId, record) {
    throw new Error('Must implement saveStudyRecord()')
  }

  /**
   * 同步用户数据到云端
   * @param {string} userId - 用户ID
   * @param {Array} localRecords - 本地学习记录
   * @returns {Promise<boolean>} 同步是否成功
   */
  async syncToCloud(userId, localRecords) {
    throw new Error('Must implement syncToCloud()')
  }

  /**
   * 从云端获取学习记录
   * @param {string} userId - 用户ID
   * @param {number} limit - 限制数量
   * @returns {Promise<Array>} 学习记录数组
   */
  async getStudyRecordsFromCloud(userId, limit = 1000) {
    throw new Error('Must implement getStudyRecordsFromCloud()')
  }
}

module.exports = IUserRepository
