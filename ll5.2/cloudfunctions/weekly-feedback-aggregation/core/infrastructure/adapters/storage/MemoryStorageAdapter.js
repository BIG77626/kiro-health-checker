const IStorageAdapter = require('../../../application/interfaces/IStorageAdapter')

/**
 * 内存存储适配器 (强化版)
 * 实现 IStorageAdapter 接口
 *
 * 架构铁律 v2.0 合规：
 * - M1: Map清理策略（TTL清理）
 * - B1: Unicode边界处理
 * - E1: 完整错误链
 * - S1: 输入验证
 *
 * 用途：
 * - 集成测试（不依赖真实存储）
 * - 单元测试（可控的测试环境）
 * - 开发调试（快速迭代，无需清理真实数据）
 *
 * 特性：
 * - 所有数据存储在内存中（Map 对象）
 * - 完全实现 IStorageAdapter 接口
 * - 支持序列化/反序列化（深拷贝，避免引用问题）
 * - 测试隔离（每个实例独立存储空间）
 * - 内存清理策略（TTL + 容量限制）
 *
 * @class MemoryStorageAdapter
 * @implements {IStorageAdapter}
 */
class MemoryStorageAdapter extends IStorageAdapter {
  constructor(config = {}) {
    super()

    // Map清理策略配置 (符合M1)
    this.maxSize = config.maxSize || 1000  // 最大存储条目数
    this.defaultTTL = config.defaultTTL || 24 * 60 * 60 * 1000  // 24小时TTL

    // 使用 Map 作为内存存储，包含元数据
    this.storage = new Map()  // key -> { value: serialized, timestamp: number, ttl: number }

    // 边界处理配置 (符合B1)
    this.MAX_KEY_LENGTH = 128

    // 定期清理配置
    this.cleanupInterval = config.cleanupInterval || 5 * 60 * 1000  // 5分钟清理一次
    this.lastCleanup = Date.now()

    // 统计信息 (用于监控)
    this.stats = {
      totalSets: 0,
      totalGets: 0,
      totalDeletes: 0,
      cacheHits: 0,
      cacheMisses: 0,
      expiredItems: 0
    }
  }

  /**
   * 执行定期清理 (符合M1: Map清理策略)
   * @private
   */
  _performCleanup() {
    const now = Date.now()
    let cleaned = 0

    // TTL清理
    for (const [key, metadata] of this.storage.entries()) {
      if (now - metadata.timestamp > metadata.ttl) {
        this.storage.delete(key)
        this.stats.expiredItems++
        cleaned++
      }
    }

    // 容量清理 (LRU策略)
    if (this.storage.size > this.maxSize) {
      const entries = Array.from(this.storage.entries())
      // 按访问时间排序 (最少使用的在前)
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp)

      const toRemove = entries.slice(0, this.storage.size - this.maxSize)
      toRemove.forEach(([key]) => {
        this.storage.delete(key)
        cleaned++
      })
    }

    this.lastCleanup = now

    if (cleaned > 0) {
      console.log(`[MemoryStorageAdapter] Cleaned up ${cleaned} items. Current size: ${this.storage.size}`)
    }
  }

  /**
   * 检查是否需要清理
   * @returns {boolean}
   * @private
   */
  _shouldCleanup() {
    const now = Date.now()
    return (now - this.lastCleanup > this.cleanupInterval) ||
           (this.storage.size > this.maxSize * 0.9)
  }

  /**
   * 获取存储项的元数据
   * @param {string} key
   * @returns {Object|null}
   * @private
   */
  _getMetadata(key) {
    const metadata = this.storage.get(key)
    if (!metadata) return null

    // 检查是否过期
    const now = Date.now()
    if (now - metadata.timestamp > metadata.ttl) {
      this.storage.delete(key)
      this.stats.expiredItems++
      return null
    }

    return metadata
  }

  /**
   * 保存数据 (强化版 - 符合M1: Map清理策略和E1: 完整错误链)
   * @param {string} key - 存储键
   * @param {any} value - 要存储的值
   * @param {number} ttl - 可选的TTL（毫秒）
   * @returns {Promise<void>}
   */
  async save(key, value, ttl = null) {
    this._validateKey(key)

    // 检查是否需要清理 (符合M1)
    if (this._shouldCleanup()) {
      this._performCleanup()
    }

    try {
      // 深拷贝，避免外部修改影响存储的数据
      const serialized = JSON.stringify(value)
      const now = Date.now()

      // 存储元数据 (符合M1)
      this.storage.set(key, {
        value: serialized,
        timestamp: now,
        ttl: ttl || this.defaultTTL
      })

      this.stats.totalSets++

      // 如果超出容量，立即清理 (符合M1)
      if (this.storage.size > this.maxSize) {
        this._performCleanup()
      }
    } catch (error) {
      const enhancedError = new Error(`[MemoryStorageAdapter] Failed to save data: ${error.message}`)
      enhancedError.code = 'SAVE_ERROR'
      enhancedError.key = key
      enhancedError.originalError = error
      throw enhancedError
    }
  }

  /**
   * 读取数据 (强化版 - 符合M1: Map清理策略和E1: 完整错误链)
   * @param {string} key - 存储键
   * @returns {Promise<any>} 存储的值，如果不存在返回 null
   */
  async get(key) {
    this._validateKey(key)

    this.stats.totalGets++

    try {
      const metadata = this._getMetadata(key)
      if (!metadata) {
        this.stats.cacheMisses++
        return null
      }

      // 更新访问时间 (LRU策略)
      metadata.timestamp = Date.now()

      this.stats.cacheHits++

      // 反序列化，返回新对象（避免外部修改影响存储）
      return JSON.parse(metadata.value)
    } catch (error) {
      console.error('[MemoryStorageAdapter] Get error:', error)
      const enhancedError = new Error(`[MemoryStorageAdapter] Failed to get data: ${error.message}`)
      enhancedError.code = 'GET_ERROR'
      enhancedError.key = key
      enhancedError.originalError = error
      throw enhancedError
    }
  }

  /**
   * 删除数据 (强化版 - 符合E1: 完整错误链)
   * @param {string} key - 存储键
   * @returns {Promise<boolean>} 删除是否成功
   */
  async remove(key) {
    this._validateKey(key)

    this.stats.totalDeletes++

    try {
      const existed = this.storage.has(key)
      const deleted = this.storage.delete(key)

      if (deleted) {
        // 检查是否需要清理 (容量减少后可能不再需要清理)
        if (this._shouldCleanup()) {
          this._performCleanup()
        }
      }

      return deleted
    } catch (error) {
      const enhancedError = new Error(`[MemoryStorageAdapter] Failed to remove data: ${error.message}`)
      enhancedError.code = 'REMOVE_ERROR'
      enhancedError.key = key
      enhancedError.originalError = error
      throw enhancedError
    }
  }

  /**
   * 清空所有数据 (强化版 - 符合E1: 完整错误链)
   * @returns {Promise<Object>} 清理结果
   */
  async clear() {
    try {
      const clearedCount = this.storage.size
      this.storage.clear()

      // 重置统计
      Object.keys(this.stats).forEach(key => {
        if (key !== 'expiredItems') { // 保留过期统计用于分析
          this.stats[key] = 0
        }
      })

      return {
        cleared: clearedCount,
        remaining: 0,
        utilization: '0.0%'
      }
    } catch (error) {
      const enhancedError = new Error(`[MemoryStorageAdapter] Failed to clear storage: ${error.message}`)
      enhancedError.code = 'CLEAR_ERROR'
      enhancedError.originalError = error
      throw enhancedError
    }
  }

  /**
   * 检查键是否存在 (强化版 - 符合M1: Map清理策略)
   * @param {string} key - 存储键
   * @returns {Promise<boolean>}
   */
  async has(key) {
    try {
      this._validateKey(key)

      // 获取元数据时会自动检查过期 (符合M1)
      const metadata = this._getMetadata(key)
      return metadata !== null
    } catch (error) {
      // 对于无效键，返回 false 而不是抛出错误 (符合B2: 空值显式处理)
      return false
    }
  }

  /**
   * 获取所有键（调试用）
   * @returns {Promise<string[]>}
   */
  async keys() {
    return Array.from(this.storage.keys())
  }

  /**
   * 获取存储的条目数（调试用）
   * @returns {Promise<number>}
   */
  async size() {
    return this.storage.size
  }

  /**
   * 获取统计信息（监控用）
   * @returns {Promise<Object>} 统计信息
   */
  async getStats() {
    const hitRate = this.stats.totalGets > 0 ?
      (this.stats.cacheHits / this.stats.totalGets * 100).toFixed(2) : 0

    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      currentSize: this.storage.size,
      maxSize: this.maxSize,
      utilization: `${(this.storage.size / this.maxSize * 100).toFixed(1)}%`,
      lastCleanup: new Date(this.lastCleanup).toISOString()
    }
  }

  /**
   * 手动触发清理（运维用）
   * @returns {Promise<Object>} 清理结果
   */
  async cleanup() {
    const beforeSize = this.storage.size
    this._performCleanup()
    const afterSize = this.storage.size

    return {
      cleaned: beforeSize - afterSize,
      remaining: afterSize,
      utilization: `${(afterSize / this.maxSize * 100).toFixed(1)}%`
    }
  }

  /**
   * 销毁适配器，清理所有资源 (符合M2: 定时器生命周期管理)
   */
  destroy() {
    // 清理存储
    this.storage.clear()

    // 重置统计
    Object.keys(this.stats).forEach(key => {
      this.stats[key] = 0
    })

    console.log('[MemoryStorageAdapter] Destroyed and cleaned up all resources')
  }

  /**
   * 重置存储（测试用）
   * @returns {Promise<void>}
   */
  async reset() {
    try {
      this.storage.clear()
    } catch (error) {
      throw new Error(`Failed to reset storage: ${error.message}`)
    }
  }

  /**
   * 验证键参数 (强化版 - 符合B1: Unicode边界处理和S1: 输入验证)
   * @private
   * @param {any} key - 要验证的键
   * @throws {Error} 如果键无效
   */
  _validateKey(key) {
    const errors = []

    // 基本类型检查
    if (!key || typeof key !== 'string') {
      errors.push('Key must be a non-empty string')
    }

    if (key) {
      // Unicode长度检查 (符合B1)
      const unicodeLength = [...key].length
      if (unicodeLength > this.MAX_KEY_LENGTH) {
        errors.push(`Key too long: ${unicodeLength} > ${this.MAX_KEY_LENGTH} characters`)
      }

      // 控制字符检查 (符合B1)
      const controlChars = /[\x00-\x1F\x7F-\x9F]/g
      if (controlChars.test(key)) {
        errors.push('Key contains control characters')
      }

      // 零宽字符检查 (强化B1)
      const zeroWidthChars = /[\u200B-\u200D\uFEFF]/g
      if (zeroWidthChars.test(key)) {
        errors.push('Key contains zero-width Unicode characters')
      }
    }

    if (errors.length > 0) {
      const error = new Error(`[MemoryStorageAdapter] Validation failed: ${errors.join(', ')}`)
      error.code = 'VALIDATION_ERROR'
      error.details = errors
      throw error
    }
  }
}

module.exports = MemoryStorageAdapter
