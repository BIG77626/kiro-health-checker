const IVocabularyRepository = require('../../application/interfaces/IVocabularyRepository')
const Vocabulary = require('../../domain/entities/Vocabulary')

/**
 * VocabularyRepositoryImpl - 词汇仓储实现
 * 
 * Phase 2: Infrastructure 层实现
 * 
 * 职责：
 * - 使用 IStorageAdapter 实现词汇的本地持久化
 * - 管理词汇数据和用户索引
 * - 序列化/反序列化 Vocabulary 实体
 * 
 * 存储策略：
 * - 单个词汇: vocabulary_${vocabularyId} -> Vocabulary JSON
 * - 用户词汇索引: user_vocabularies_${userId} -> string[] (词汇ID列表)
 * 
 * 约束：
 * - 必须使用 IStorageAdapter 接口，不直接使用 wx.setStorageSync 等
 * - 错误处理要完善，避免数据不一致
 * - ✅ 允许使用 console 进行调试和错误日志
 */
class VocabularyRepositoryImpl extends IVocabularyRepository {
  /**
   * 创建词汇仓储实例
   * 
   * @param {IStorageAdapter} storageAdapter - 存储适配器（Phase 1 实现）
   */
  constructor(storageAdapter) {
    super()
    this.storageAdapter = storageAdapter
  }

  /**
   * 获取用户所有词汇
   * 
   * @param {string} userId - 用户ID
   * @returns {Promise<Vocabulary[]>} 用户的所有词汇列表
   */
  async findByUserId(userId) {
    try {
      // 1. 读取用户词汇索引
      const indexKey = this._getUserIndexKey(userId)
      const vocabularyIds = await this.storageAdapter.get(indexKey)

      if (!vocabularyIds || vocabularyIds.length === 0) {
        return []
      }

      // 2. 批量读取词汇数据
      const vocabularies = []
      for (const vocabId of vocabularyIds) {
        const vocab = await this.findById(vocabId)
        if (vocab) {
          vocabularies.push(vocab)
        }
      }

      return vocabularies
    } catch (error) {
      console.error(`Failed to find vocabularies for user ${userId}:`, error)
      throw new Error(`Storage error: ${error.message}`)
    }
  }

  /**
   * 通过ID查找词汇
   * 
   * @param {string} vocabularyId - 词汇ID
   * @returns {Promise<Vocabulary|null>} 找到的词汇实体，不存在时返回 null
   */
  async findById(vocabularyId) {
    try {
      const key = this._getVocabularyKey(vocabularyId)
      const data = await this.storageAdapter.get(key)

      if (!data) {
        return null
      }

      // 反序列化为 Vocabulary 实体
      return Vocabulary.fromJSON(data)
    } catch (error) {
      console.error(`Failed to find vocabulary ${vocabularyId}:`, error)
      throw new Error(`Storage error: ${error.message}`)
    }
  }

  /**
   * 保存词汇（新增或更新）
   * 
   * @param {Vocabulary} vocabulary - 词汇实体
   * @returns {Promise<void>}
   */
  async save(vocabulary) {
    try {
      // 1. 序列化并保存词汇数据
      const key = this._getVocabularyKey(vocabulary.id)
      await this.storageAdapter.save(key, vocabulary.toJSON())

      // 2. 更新用户词汇索引（如果词汇不在索引中则添加）
      await this._addToUserIndex(vocabulary.userId, vocabulary.id)
    } catch (error) {
      console.error(`Failed to save vocabulary ${vocabulary.id}:`, error)
      throw new Error(`Storage error: ${error.message}`)
    }
  }

  /**
   * 删除词汇
   * 
   * @param {string} vocabularyId - 词汇ID
   * @returns {Promise<void>}
   */
  async delete(vocabularyId) {
    try {
      // 1. 读取词汇以获取 userId
      const vocabulary = await this.findById(vocabularyId)
      if (!vocabulary) {
        return // 词汇不存在，无需删除
      }

      // 2. 删除词汇数据
      const key = this._getVocabularyKey(vocabularyId)
      await this.storageAdapter.remove(key)

      // 3. 从用户索引中移除
      await this._removeFromUserIndex(vocabulary.userId, vocabularyId)
    } catch (error) {
      console.error(`Failed to delete vocabulary ${vocabularyId}:`, error)
      throw new Error(`Storage error: ${error.message}`)
    }
  }

  /**
   * 将词汇ID添加到用户索引
   * 
   * @private
   * @param {string} userId - 用户ID
   * @param {string} vocabularyId - 词汇ID
   * @returns {Promise<void>}
   */
  async _addToUserIndex(userId, vocabularyId) {
    const indexKey = this._getUserIndexKey(userId)
    const vocabularyIds = await this.storageAdapter.get(indexKey) || []

    // 如果词汇ID不在索引中，则添加
    if (!vocabularyIds.includes(vocabularyId)) {
      vocabularyIds.push(vocabularyId)
      await this.storageAdapter.save(indexKey, vocabularyIds)
    }
  }

  /**
   * 从用户索引中移除词汇ID
   * 
   * @private
   * @param {string} userId - 用户ID
   * @param {string} vocabularyId - 词汇ID
   * @returns {Promise<void>}
   */
  async _removeFromUserIndex(userId, vocabularyId) {
    const indexKey = this._getUserIndexKey(userId)
    let vocabularyIds = await this.storageAdapter.get(indexKey) || []

    // 过滤掉要删除的词汇ID
    vocabularyIds = vocabularyIds.filter(id => id !== vocabularyId)
    await this.storageAdapter.save(indexKey, vocabularyIds)
  }

  /**
   * 获取词汇存储键
   * 
   * @private
   * @param {string} vocabularyId - 词汇ID
   * @returns {string} 存储键
   */
  _getVocabularyKey(vocabularyId) {
    return `vocabulary_${vocabularyId}`
  }

  /**
   * 获取用户词汇索引键
   * 
   * @private
   * @param {string} userId - 用户ID
   * @returns {string} 索引键
   */
  _getUserIndexKey(userId) {
    return `user_vocabularies_${userId}`
  }
}

module.exports = VocabularyRepositoryImpl

