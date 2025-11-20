const IAnswerRepository = require('../../application/interfaces/IAnswerRepository')
const Answer = require('../../domain/entities/Answer')

/**
 * Answer仓储实现
 *
 * Phase 3.3: Infrastructure层
 *
 * 职责：
 * - 实现 IAnswerRepository 接口
 * - 提供答案记录的 CRUD、查询和统计能力
 * - 负责云数据库与领域实体之间的数据转换
 * - 使用缓存减少热点查询
 */
class AnswerRepository extends IAnswerRepository {
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
    this.collection = 'answers'
  }

  _buildAnswerId(questionId, sessionId) {
    return `${questionId}#${sessionId || 'global'}`
  }

  _getCacheKey(questionId, sessionId) {
    return `answer:${this._buildAnswerId(questionId, sessionId)}`
  }

  _toPO(answer, extras = {}) {
    const snapshot = answer.getSnapshot()
    const userId = extras.userId || snapshot.metadata?.userId || null
    const paperId = extras.paperId || snapshot.metadata?.paperId || null

    return {
      _id: this._buildAnswerId(snapshot.questionId, snapshot.sessionId),
      questionId: snapshot.questionId,
      sessionId: snapshot.sessionId,
      userId,
      paperId,
      answer: snapshot.answer,
      correctAnswer: snapshot.correctAnswer,
      timestamp: snapshot.timestamp,
      timeSpent: snapshot.timeSpent,
      attempts: snapshot.attempts,
      isCorrect: snapshot.isCorrect,
      metadata: {
        ...snapshot.metadata,
        userId,
        paperId
      }
    }
  }

  _toEntity(po) {
    if (!po) {
      return null
    }

    const snapshot = {
      questionId: po.questionId,
      sessionId: po.sessionId === 'global' ? null : po.sessionId,
      answer: po.answer,
      correctAnswer: po.correctAnswer,
      timestamp: po.timestamp,
      timeSpent: po.timeSpent,
      attempts: po.attempts,
      isCorrect: po.isCorrect,
      metadata: {
        ...(po.metadata || {}),
        userId: po.userId || po.metadata?.userId || null,
        paperId: po.paperId || po.metadata?.paperId || null
      }
    }

    return Answer.fromSnapshot(snapshot)
  }

  async save(answer, extras = {}) {
    const po = this._toPO(answer, extras)
    try {
      let saved = false

      if (typeof this.cloudAdapter.update === 'function') {
        try {
          const updateResult = await this.cloudAdapter.update(this.collection, po._id, po)
          saved = !!updateResult
        } catch (updateError) {
          if (typeof this.cloudAdapter.add === 'function') {
            const addResult = await this.cloudAdapter.add(this.collection, po)
            saved = !!addResult
          } else {
            throw updateError
          }
        }
      } else if (typeof this.cloudAdapter.add === 'function') {
        const addResult = await this.cloudAdapter.add(this.collection, po)
        saved = !!addResult
      } else {
        throw new Error('Cloud adapter does not support save operations')
      }

      if (saved) {
        await this.cacheAdapter.set(this._getCacheKey(po.questionId, po.sessionId), answer, 3600 * 24)
      }

      return saved
    } catch (error) {
      console.error('Error saving answer:', error)
      throw new Error(`Failed to save answer: ${error.message}`)
    }
  }

  async saveBatch(answers, extras = {}) {
    if (!Array.isArray(answers) || answers.length === 0) {
      return true
    }

    try {
      const pos = answers.map(answer => this._toPO(answer, extras))

      if (typeof this.cloudAdapter.addMany === 'function') {
        await this.cloudAdapter.addMany(this.collection, pos)
      } else {
        await Promise.all(
          pos.map(po => this.cloudAdapter.add(this.collection, po))
        )
      }

      await Promise.all(
        pos.map(po => this.cacheAdapter.set(this._getCacheKey(po.questionId, po.sessionId), Answer.fromSnapshot({
          questionId: po.questionId,
          sessionId: po.sessionId === 'global' ? null : po.sessionId,
          answer: po.answer,
          correctAnswer: po.correctAnswer,
          timestamp: po.timestamp,
          timeSpent: po.timeSpent,
          attempts: po.attempts,
          isCorrect: po.isCorrect,
          metadata: po.metadata
        }), 3600 * 24))
      )

      return true
    } catch (error) {
      console.error('Error saving answers batch:', error)
      throw new Error(`Failed to save answers batch: ${error.message}`)
    }
  }

  async findByQuestionId(questionId) {
    try {
      const results = await this.cloudAdapter.query(this.collection, { questionId })
      return (results || []).map(po => this._toEntity(po))
    } catch (error) {
      console.error(`Error finding answers by questionId ${questionId}:`, error)
      throw new Error(`Failed to find answers by questionId: ${error.message}`)
    }
  }

  async findBySessionId(sessionId) {
    try {
      const results = await this.cloudAdapter.query(this.collection, { sessionId })
      return (results || []).map(po => this._toEntity(po))
    } catch (error) {
      console.error(`Error finding answers by sessionId ${sessionId}:`, error)
      throw new Error(`Failed to find answers by sessionId: ${error.message}`)
    }
  }

  async findByUserId(userId, options = {}) {
    try {
      const query = { userId }
      const queryOptions = {
        limit: options.limit || 20,
        offset: options.offset || 0,
        orderBy: options.orderBy || { field: 'timestamp', direction: 'desc' }
      }
      const results = await this.cloudAdapter.query(this.collection, query, queryOptions)
      return (results || []).map(po => this._toEntity(po))
    } catch (error) {
      console.error(`Error finding answers by userId ${userId}:`, error)
      throw new Error(`Failed to find answers by userId: ${error.message}`)
    }
  }

  async findByQuestionAndUser(questionId, userId) {
    try {
      const results = await this.cloudAdapter.query(this.collection, { questionId, userId })
      if (!results || results.length === 0) {
        return null
      }
      return this._toEntity(results[0])
    } catch (error) {
      console.error(`Error finding answer by question ${questionId} and user ${userId}:`, error)
      throw new Error(`Failed to find answer by question and user: ${error.message}`)
    }
  }

  async findByQuestionAndSession(questionId, sessionId) {
    try {
      const cacheKey = this._getCacheKey(questionId, sessionId)
      const cached = await this.cacheAdapter.get(cacheKey)
      if (cached) {
        return cached instanceof Answer ? cached : Answer.fromSnapshot(cached)
      }

      const results = await this.cloudAdapter.query(this.collection, { questionId, sessionId })
      if (!results || results.length === 0) {
        return null
      }
      const entity = this._toEntity(results[0])
      await this.cacheAdapter.set(cacheKey, entity, 3600 * 12)
      return entity
    } catch (error) {
      console.error(`Error finding answer by question ${questionId} and session ${sessionId}:`, error)
      throw new Error(`Failed to find answer by question and session: ${error.message}`)
    }
  }

  async findByUserAndPaper(userId, paperId) {
    try {
      const results = await this.cloudAdapter.query(this.collection, { userId, paperId })
      return (results || []).map(po => this._toEntity(po))
    } catch (error) {
      console.error(`Error finding answers by user ${userId} and paper ${paperId}:`, error)
      throw new Error(`Failed to find answers by user and paper: ${error.message}`)
    }
  }

  async update(answerId, updates) {
    try {
      const result = await this.cloudAdapter.update(this.collection, answerId, updates)
      if (result) {
        const [questionId, sessionToken] = answerId.split('#')
        const sessionId = sessionToken === 'global' ? null : sessionToken
        await this.cacheAdapter.delete(this._getCacheKey(questionId, sessionId))
      }
      return !!result
    } catch (error) {
      console.error(`Error updating answer ${answerId}:`, error)
      throw new Error(`Failed to update answer: ${error.message}`)
    }
  }

  async delete(answerId) {
    try {
      const result = await this.cloudAdapter.delete(this.collection, answerId)
      if (result) {
        const [questionId, sessionToken] = answerId.split('#')
        const sessionId = sessionToken === 'global' ? null : sessionToken
        await this.cacheAdapter.delete(this._getCacheKey(questionId, sessionId))
      }
      return !!result
    } catch (error) {
      console.error(`Error deleting answer ${answerId}:`, error)
      throw new Error(`Failed to delete answer: ${error.message}`)
    }
  }

  async deleteBySessionId(sessionId) {
    try {
      if (typeof this.cloudAdapter.deleteMany === 'function') {
        await this.cloudAdapter.deleteMany(this.collection, { sessionId })
      } else {
        await this.cloudAdapter.callFunction('deleteAnswersBySession', { sessionId })
      }
      // 清理缓存前缀匹配（缓存在Session级别不易遍历，这里直接忽略）
      return true
    } catch (error) {
      console.error(`Error deleting answers by sessionId ${sessionId}:`, error)
      throw new Error(`Failed to delete answers by sessionId: ${error.message}`)
    }
  }

  async getStatistics(userId, filters = {}) {
    try {
      const response = await this.cloudAdapter.callFunction('getAnswerStatistics', {
        userId,
        filters
      })
      return response?.data || response || {}
    } catch (error) {
      console.error(`Error getting answer statistics for user ${userId}:`, error)
      throw new Error(`Failed to get answer statistics: ${error.message}`)
    }
  }

  async getAnalysis(userId, options = {}) {
    try {
      const response = await this.cloudAdapter.callFunction('getAnswerAnalysis', {
        userId,
        options
      })
      return response?.data || response?.analysis || []
    } catch (error) {
      console.error(`Error getting answer analysis for user ${userId}:`, error)
      throw new Error(`Failed to get answer analysis: ${error.message}`)
    }
  }

  async getIncorrectAnswers(userId, options = {}) {
    try {
      const response = await this.cloudAdapter.callFunction('getIncorrectAnswers', {
        userId,
        options
      })
      return response?.data || response?.answers || []
    } catch (error) {
      console.error(`Error getting incorrect answers for user ${userId}:`, error)
      throw new Error(`Failed to get incorrect answers: ${error.message}`)
    }
  }

  async getFrequentMistakes(userId, limit = 10) {
    try {
      const response = await this.cloudAdapter.callFunction('getFrequentMistakes', {
        userId,
        limit
      })
      return response?.data || response?.mistakes || []
    } catch (error) {
      console.error(`Error getting frequent mistakes for user ${userId}:`, error)
      throw new Error(`Failed to get frequent mistakes: ${error.message}`)
    }
  }
}

module.exports = AnswerRepository
