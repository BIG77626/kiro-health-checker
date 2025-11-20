const IPracticeSessionRepository = require('../../application/interfaces/IPracticeSessionRepository')
const PracticeSession = require('../../domain/entities/PracticeSession')

/**
 * 练习会话仓储实现
 *
 * Phase 3.3: Infrastructure层
 *
 * 职责:
 * - 实现 IPracticeSessionRepository 接口
 * - 负责 PracticeSession 实体的 CRUD 操作
 * - 适配云数据库和缓存
 * - 隐藏底层数据源的复杂性
 */
class PracticeSessionRepository extends IPracticeSessionRepository {
  /**
   * @param {Object} dependencies - 依赖注入
   * @param {ICloudAdapter} dependencies.cloudAdapter - 云数据库适配器
   * @param {ICacheAdapter} dependencies.cacheAdapter - 缓存适配器
   */
  constructor({ cloudAdapter, cacheAdapter }) {
    super()
    if (!cloudAdapter) {
      throw new Error('cloudAdapter is required')
    }
    if (!cacheAdapter) {
      throw new Error('cacheAdapter is required')
    }
    this.cloudAdapter = cloudAdapter
    this.cacheAdapter = cacheAdapter
    this.collection = 'practice_sessions'
  }

  /**
   * 将领域实体转换为持久化数据格式 (PO)
   * @param {PracticeSession} session - 会话实体
   * @returns {Object} 持久化对象
   */
  _toPO(session) {
    const po = session.getSnapshot()
    // 微信小程序云数据库要求 `_id` 字段
    po._id = po.id
    delete po.id
    return po
  }

  /**
   * 将持久化数据格式 (PO) 转换为领域实体
   * @param {Object} po - 持久化对象
   * @returns {PracticeSession} 会话实体
   */
  _toEntity(po) {
    if (!po) {
      return null
    }
    const params = { ...po, id: po._id }
    delete params._id
    return new PracticeSession(params)
  }

  /**
   * 保存会话
   * @param {PracticeSession} session - 会话实体
   * @returns {Promise<boolean>} 是否保存成功
   */
  async save(session) {
    try {
      const po = this._toPO(session)
      const result = await this.cloudAdapter.add(this.collection, po)
      if (result) {
        // 缓存新创建的会话
        await this.cacheAdapter.set(`session:${session.id}`, session, 3600 * 24) // 缓存24小时
      }
      return !!result
    } catch (error) {
      console.error('Error saving practice session:', error)
      throw new Error(`Failed to save practice session: ${error.message}`)
    }
  }

  /**
   * 根据ID查找会话
   * @param {string} sessionId - 会话ID
   * @returns {Promise<PracticeSession|null>} 会话实体
   */
  async findById(sessionId) {
    try {
      // 1. 尝试从缓存获取
      const cachedSession = await this.cacheAdapter.get(`session:${sessionId}`)
      if (cachedSession) {
        return cachedSession instanceof PracticeSession ? cachedSession : new PracticeSession(cachedSession)
      }

      // 2. 从数据库获取
      const po = await this.cloudAdapter.getById(this.collection, sessionId)
      if (!po) {
        return null
      }
      const session = this._toEntity(po)

      // 3. 存入缓存
      await this.cacheAdapter.set(`session:${sessionId}`, session, 3600 * 24)

      return session
    } catch (error) {
      console.error(`Error finding practice session by id ${sessionId}:`, error)
      throw new Error(`Failed to find practice session: ${error.message}`)
    }
  }

  /**
   * 根据试卷ID查找进行中的会话
   * @param {string} paperId - 试卷ID
   * @returns {Promise<PracticeSession|null>} 会话实体
   */
  async findActiveByPaperId(paperId) {
    try {
      const query = {
        paperId: paperId,
        status: { $in: ['answering', 'paused', 'idle'] }
      }
      const results = await this.cloudAdapter.query(this.collection, query)
      if (!results || results.length === 0) {
        return null
      }
      // 通常一个试卷只有一个进行中的会话
      return this._toEntity(results[0])
    } catch (error) {
      console.error(`Error finding active session by paperId ${paperId}:`, error)
      throw new Error(`Failed to find active session by paperId: ${error.message}`)
    }
  }

  /**
   * 根据用户ID查找会话
   * @param {string} userId - 用户ID
   * @param {Object} options - 查找选项
   * @param {Array<string>} options.status - 状态过滤
   * @param {number} options.limit - 数量限制
   * @param {string} options.sortBy - 排序字段
   * @param {string} options.sortOrder - 排序顺序 ('asc' | 'desc')
   * @returns {Promise<Array<PracticeSession>>} 会话实体列表
   */
  async findByUserId(userId, options = {}) {
    try {
      const query = {
        // PO中没有userId，需要在云函数中处理
        _openid: '{openid}' // 这是一个占位符，实际查询应在云函数中完成
      }
      if (options.status) {
        query.status = { $in: options.status }
      }

      const queryOptions = {
        limit: options.limit || 10,
        orderBy: options.sortBy ? { field: options.sortBy, direction: options.sortOrder || 'desc' } : undefined
      }

      const results = await this.cloudAdapter.query(this.collection, query, queryOptions)
      return results.map(po => this._toEntity(po))
    } catch (error) {
      console.error(`Error finding sessions by userId ${userId}:`, error)
      throw new Error(`Failed to find sessions by userId: ${error.message}`)
    }
  }

  /**
   * 更新会话
   * @param {string} sessionId - 会话ID
   * @param {Object} updates - 更新内容
   * @returns {Promise<boolean>} 是否更新成功
   */
  async update(sessionId, updates) {
    try {
      const result = await this.cloudAdapter.update(this.collection, sessionId, updates)
      if (result) {
        // 更新成功后，使缓存失效或更新缓存
        const session = await this.findById(sessionId) // 重新获取最新数据
        if (session) {
          // 更新缓存
          await this.cacheAdapter.set(`session:${sessionId}`, session, 3600 * 24)
        } else {
          // 如果数据不存在，则删除缓存
          await this.cacheAdapter.delete(`session:${sessionId}`)
        }
      }
      return !!result
    } catch (error) {
      console.error(`Error updating session ${sessionId}:`, error)
      throw new Error(`Failed to update session: ${error.message}`)
    }
  }

  /**
   * 删除会话
   * @param {string} sessionId - 会话ID
   * @returns {Promise<boolean>} 是否删除成功
   */
  async delete(sessionId) {
    try {
      const result = await this.cloudAdapter.delete(this.collection, sessionId)
      if (result) {
        // 删除缓存
        await this.cacheAdapter.delete(`session:${sessionId}`)
      }
      return !!result
    } catch (error) {
      console.error(`Error deleting session ${sessionId}:`, error)
      throw new Error(`Failed to delete session: ${error.message}`)
    }
  }

  /**
   * 获取用户统计数据
   * @param {string} userId - 用户ID
   * @param {Date} startDate - 开始日期
   * @param {Date} endDate - 结束日期
   * @returns {Promise<Object>} 统计数据
   */
  async getStatistics(userId, startDate, endDate) {
    // 复杂的统计通常由云函数完成
    try {
      const stats = await this.cloudAdapter.callFunction('getPracticeStatistics', {
        userId,
        startDate,
        endDate
      })
      return stats
    } catch (error) {
      console.error(`Error getting statistics for user ${userId}:`, error)
      throw new Error(`Failed to get statistics: ${error.message}`)
    }
  }
}

module.exports = PracticeSessionRepository
