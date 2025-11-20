const IQuestionRepository = require('../../application/interfaces/IQuestionRepository')
const Question = require('../../domain/entities/Question')

/**
 * Question仓储实现
 *
 * Phase 3.3: Infrastructure层
 *
 * 职责：
 * - 实现 IQuestionRepository 接口
 * - 提供题目的 CRUD 和查询能力
 * - 负责云数据库与领域实体之间的数据转换
 * - 引入缓存，降低重复查询的开销
 */
class QuestionRepository extends IQuestionRepository {
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
    this.collection = 'questions'
  }

  _getCacheKey(questionId) {
    return `question:${questionId}`
  }

  _ensureMetadata(metadata = {}) {
    return {
      questionIds: metadata.questionIds || undefined, // Question实体不会使用该字段
      createdAt: metadata.createdAt || Date.now(),
      updatedAt: metadata.updatedAt || Date.now(),
      difficulty: metadata.difficulty || 'medium',
      points: metadata.points || 1,
      timeLimit: metadata.timeLimit || null,
      ...metadata
    }
  }

  _toPO(question, extras = {}) {
    const snapshot = question.getSnapshot()
    return {
      _id: snapshot.id,
      type: snapshot.type,
      question: snapshot.question,
      passageId: snapshot.passageId || null,
      options: snapshot.options,
      correctAnswer: snapshot.correctAnswer,
      explanation: snapshot.explanation,
      evidenceParagraphs: snapshot.evidenceParagraphs,
      evidenceSentences: snapshot.evidenceSentences,
      difficultyTips: snapshot.difficultyTips,
      skill: snapshot.skill,
      metadata: this._ensureMetadata(snapshot.metadata),
      ...extras
    }
  }

  _toEntity(po) {
    if (!po) {
      return null
    }

    const snapshot = {
      id: po._id || po.id,
      type: po.type,
      question: po.question,
      passageId: po.passageId || po.passage_id || null,
      options: po.options || [],
      correctAnswer: po.correctAnswer || po.correct_answer || '',
      explanation: po.explanation || '',
      evidenceParagraphs: po.evidenceParagraphs || po.evidence_paragraphs || [],
      evidenceSentences: po.evidenceSentences || po.evidence_sentences || [],
      difficultyTips: po.difficultyTips || po.difficulty_tips || [],
      skill: po.skill,
      metadata: this._ensureMetadata(po.metadata)
    }

    return Question.fromSnapshot(snapshot)
  }

  async save(question, extras = {}) {
    try {
      const po = this._toPO(question, extras)
      const result = await this.cloudAdapter.add(this.collection, po)
      if (result) {
        await this.cacheAdapter.set(this._getCacheKey(question.id), question, 3600 * 24)
      }
      return !!result
    } catch (error) {
      console.error('Error saving question:', error)
      throw new Error(`Failed to save question: ${error.message}`)
    }
  }

  async saveBatch(questions, extras = {}) {
    if (!Array.isArray(questions) || questions.length === 0) {
      return true
    }
    try {
      if (typeof this.cloudAdapter.addMany === 'function') {
        const pos = questions.map(question => this._toPO(question, extras))
        await this.cloudAdapter.addMany(this.collection, pos)
      } else {
        await Promise.all(
          questions.map(question => this.cloudAdapter.add(this.collection, this._toPO(question, extras)))
        )
      }

      await Promise.all(
        questions.map(question => this.cacheAdapter.set(this._getCacheKey(question.id), question, 3600 * 24))
      )

      return true
    } catch (error) {
      console.error('Error saving questions batch:', error)
      throw new Error(`Failed to save questions batch: ${error.message}`)
    }
  }

  async findById(questionId) {
    try {
      const cacheKey = this._getCacheKey(questionId)
      const cached = await this.cacheAdapter.get(cacheKey)
      if (cached) {
        return cached instanceof Question ? cached : Question.fromSnapshot(cached)
      }

      const po = await this.cloudAdapter.getById(this.collection, questionId)
      if (!po) {
        return null
      }

      const question = this._toEntity(po)
      await this.cacheAdapter.set(cacheKey, question, 3600 * 6)
      return question
    } catch (error) {
      console.error(`Error finding question ${questionId}:`, error)
      throw new Error(`Failed to find question: ${error.message}`)
    }
  }

  async findByPaperId(paperId) {
    try {
      const query = { paperId }
      const results = await this.cloudAdapter.query(this.collection, query)
      return (results || []).map(po => this._toEntity(po))
    } catch (error) {
      console.error(`Error finding questions by paperId ${paperId}:`, error)
      throw new Error(`Failed to find questions by paperId: ${error.message}`)
    }
  }

  async findByPassageId(passageId) {
    try {
      const query = { passageId }
      const results = await this.cloudAdapter.query(this.collection, query)
      return (results || []).map(po => this._toEntity(po))
    } catch (error) {
      console.error(`Error finding questions by passageId ${passageId}:`, error)
      throw new Error(`Failed to find questions by passageId: ${error.message}`)
    }
  }

  async findByType(type, options = {}) {
    try {
      const query = {
        type,
        ...(options.difficulty ? { 'metadata.difficulty': options.difficulty } : {})
      }
      const queryOptions = {
        limit: options.limit || 20,
        orderBy: options.orderBy || { field: 'metadata.updatedAt', direction: 'desc' }
      }
      const results = await this.cloudAdapter.query(this.collection, query, queryOptions)
      return (results || []).map(po => this._toEntity(po))
    } catch (error) {
      console.error(`Error finding questions by type ${type}:`, error)
      throw new Error(`Failed to find questions by type: ${error.message}`)
    }
  }

  async search(keyword, filters = {}) {
    try {
      const response = await this.cloudAdapter.callFunction('searchQuestions', {
        keyword,
        filters
      })
      const results = response?.data?.questions || response?.questions || []
      return results.map(po => this._toEntity(po))
    } catch (error) {
      console.error(`Error searching questions with keyword ${keyword}:`, error)
      throw new Error(`Failed to search questions: ${error.message}`)
    }
  }

  async getRecommended(userId, preferences = {}, count = 10) {
    try {
      const response = await this.cloudAdapter.callFunction('getRecommendedQuestions', {
        userId,
        preferences,
        count
      })
      const results = response?.data?.questions || response?.questions || []
      return results.map(po => this._toEntity(po))
    } catch (error) {
      console.error(`Error getting recommended questions for user ${userId}:`, error)
      throw new Error(`Failed to get recommended questions: ${error.message}`)
    }
  }

  async update(questionId, updates) {
    try {
      const result = await this.cloudAdapter.update(this.collection, questionId, updates)
      if (result) {
        await this.cacheAdapter.delete(this._getCacheKey(questionId))
      }
      return !!result
    } catch (error) {
      console.error(`Error updating question ${questionId}:`, error)
      throw new Error(`Failed to update question: ${error.message}`)
    }
  }

  async delete(questionId) {
    try {
      const result = await this.cloudAdapter.delete(this.collection, questionId)
      if (result) {
        await this.cacheAdapter.delete(this._getCacheKey(questionId))
      }
      return !!result
    } catch (error) {
      console.error(`Error deleting question ${questionId}:`, error)
      throw new Error(`Failed to delete question: ${error.message}`)
    }
  }

  async getStatistics(filters = {}) {
    try {
      const response = await this.cloudAdapter.callFunction('getQuestionStatistics', filters)
      return response?.data || response || {}
    } catch (error) {
      console.error('Error getting question statistics:', error)
      throw new Error(`Failed to get question statistics: ${error.message}`)
    }
  }
}

module.exports = QuestionRepository
