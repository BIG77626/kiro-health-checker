/**
 * IVocabularyRepository - 词汇仓储接口
 * 
 * Phase 2: Application 层接口定义
 * 
 * 职责：
 * - 定义词汇数据访问的抽象接口
 * - 由 Infrastructure 层实现具体的持久化逻辑
 * - 不包含业务逻辑（如判断是否到期、SM-2 计算等）
 * 
 * 设计原则：
 * - 只负责 CRUD 操作
 * - 返回 Domain 实体（Vocabulary）
 * - 不依赖具体存储实现
 */
class IVocabularyRepository {
  /**
   * 获取用户所有词汇
   * 
   * @param {string} _userId - 用户ID
   * @returns {Promise<Vocabulary[]>} 用户的所有词汇列表
   */
  async findByUserId(_userId) {
    throw new Error('Must implement findByUserId()')
  }

  /**
   * 通过ID查找词汇
   * 
   * @param {string} _vocabularyId - 词汇ID
   * @returns {Promise<Vocabulary|null>} 找到的词汇实体，不存在时返回 null
   */
  async findById(_vocabularyId) {
    throw new Error('Must implement findById()')
  }

  /**
   * 保存词汇（新增或更新）
   * 
   * @param {Vocabulary} _vocabulary - 词汇实体
   * @returns {Promise<void>}
   */
  async save(_vocabulary) {
    throw new Error('Must implement save()')
  }

  /**
   * 删除词汇
   * 
   * @param {string} _vocabularyId - 词汇ID
   * @returns {Promise<void>}
   */
  async delete(_vocabularyId) {
    throw new Error('Must implement delete()')
  }

  // 注意：暂不实现 saveAll() 批量保存方法
  // 当前场景通过循环调用 save() 即可满足需求
  // 若后续需要批量操作优化（如事务支持），可添加此方法
}

module.exports = IVocabularyRepository

