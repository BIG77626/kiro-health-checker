/**
 * Map/Set清理工具函数
 * 架构铁律 v2.0 - M1 Map清理策略
 */

const { MAP_CLEANUP_CONSTANTS } = require('../config/constants')
const ENV = (typeof process !== 'undefined' && process.env) ? process.env : { NODE_ENV: 'production' }
const IS_PROD = ENV.NODE_ENV === 'production'

/**
 * 为Map添加LRU清理机制
 * @param {Map} map - 要添加清理机制的Map
 * @param {Object} options - 配置选项
 * @param {number} options.maxSize - 最大容量，默认1000
 * @param {number} options.ttl - TTL时间(毫秒)，默认24小时
 * @param {number} options.cleanupInterval - 清理间隔(毫秒)，默认5分钟
 * @returns {Object} 清理控制器
 */
function addLRUCleanup(map, options = {}) {
  const config = {
    maxSize: options.maxSize || MAP_CLEANUP_CONSTANTS.MAX_SIZE_DEFAULT,
    ttl: options.ttl || MAP_CLEANUP_CONSTANTS.TTL_DEFAULT,
    cleanupInterval: options.cleanupInterval || MAP_CLEANUP_CONSTANTS.CLEANUP_INTERVAL_DEFAULT,
    autoStart: options.autoStart !== undefined ? options.autoStart : ENV.NODE_ENV !== 'test',
    ...options
  }

  let cleanupTimer = null;

  // 为每个条目添加元数据
  const metadata = new Map()

  // 包装原始Map方法
  const originalSet = map.set.bind(map)
  const originalGet = map.get.bind(map)
  const originalDelete = map.delete.bind(map)
  const originalClear = map.clear.bind(map)

  // 重写set方法，添加元数据
  map.set = function(key, value) {
    const now = Date.now()

    // 添加或更新元数据
    metadata.set(key, {
      timestamp: now,
      ttl: config.ttl,
      lastAccess: now
    })

    // 检查容量限制
    if (map.size >= config.maxSize) {
      _performLRUCleanup()
    }

    return originalSet(key, value)
  }

  // 重写get方法，更新访问时间
  map.get = function(key) {
    const value = originalGet(key)
    if (value !== undefined && metadata.has(key)) {
      // 更新访问时间
      metadata.get(key).lastAccess = Date.now()
    }
    return value
  }

  // 重写delete方法，清理元数据
  map.delete = function(key) {
    metadata.delete(key)
    return originalDelete(key)
  }

  // 重写clear方法，清理所有元数据
  map.clear = function() {
    metadata.clear()
    return originalClear()
  }

  // LRU清理逻辑
  function _performLRUCleanup() {
    if (map.size < config.maxSize) return

    // 按最后访问时间排序，移除最少使用的
    const entries = Array.from(metadata.entries())
      .sort((a, b) => a[1].lastAccess - b[1].lastAccess)

    const toRemove = entries.slice(0, map.size - config.maxSize + 1)

    toRemove.forEach(([key]) => {
      map.delete(key)
    })

    if (!IS_PROD) console.debug(`[MapCleanup] LRU cleanup: removed ${toRemove.length} items, size: ${map.size}`)
  }

  // TTL清理逻辑
  function _performTTLCleanup() {
    const now = Date.now()
    let removed = 0

    for (const [key, meta] of metadata.entries()) {
      if (now - meta.timestamp > meta.ttl) {
        map.delete(key)
        removed++
      }
    }

    if (removed > 0) {
      if (!IS_PROD) console.debug(`[MapCleanup] TTL cleanup: removed ${removed} expired items, size: ${map.size}`)
    }
  }

  function start() {
    if (cleanupTimer) return;
    cleanupTimer = setInterval(() => {
      _performTTLCleanup();
      _performLRUCleanup();
    }, config.cleanupInterval);
  }

  if (config.autoStart) {
    start();
  }

  // 返回控制器，用于手动控制和清理
  return {
    config,
    getStats: () => ({
      size: map.size,
      maxSize: config.maxSize,
      metadataSize: metadata.size,
      utilization: `${(map.size / config.maxSize * 100).toFixed(1)}%`
    }),
    cleanup: () => {
      _performTTLCleanup()
      _performLRUCleanup()
    },
    start,
    destroy: () => {
      if (cleanupTimer) {
        clearInterval(cleanupTimer);
        cleanupTimer = null;
      }
      metadata.clear()
      if (!IS_PROD) console.debug('[MapCleanup] Cleanup controller destroyed')
    }
  }
}

/**
 * 为Set添加容量限制
 * @param {Set} set - 要添加容量限制的Set
 * @param {Object} options - 配置选项
 * @param {number} options.maxSize - 最大容量，默认1000
 * @returns {Object} 控制器
 */
function addSetCapacityLimit(set, options = {}) {
  const config = {
    maxSize: options.maxSize || 1000,
    ...options
  }

  // 包装原始Set方法
  const originalAdd = set.add.bind(set)

  // 重写add方法，检查容量
  set.add = function(value) {
    // 如果已存在，直接返回
    if (set.has(value)) {
      return set
    }

    // 如果超过容量，移除最旧的项（这里简化处理，实际可以记录添加时间）
    if (set.size >= config.maxSize) {
      const firstItem = set.values().next().value
      set.delete(firstItem)
      if (!IS_PROD) console.debug(`[SetCleanup] Capacity limit: removed oldest item, size: ${set.size}`)
    }

    return originalAdd(value)
  }

  return {
    config,
    getStats: () => ({
      size: set.size,
      maxSize: config.maxSize,
      utilization: `${(set.size / config.maxSize * 100).toFixed(1)}%`
    })
  }
}

/**
 * 增强Map的内存监控
 * @param {Map} map - 要监控的Map
 * @param {string} name - Map名称，用于日志
 * @returns {Object} 监控控制器
 */
function addMemoryMonitor(map, name = 'Map') {
  const stats = {
    peakSize: 0,
    totalOperations: 0,
    warnings: 0
  }

  // 包装方法以监控操作
  const originalSet = map.set.bind(map)
  const originalDelete = map.delete.bind(map)

  map.set = function(key, value) {
    stats.totalOperations++
    stats.peakSize = Math.max(stats.peakSize, map.size + 1)

    // 内存警告
    if (map.size > 5000 && stats.warnings < 3) {
      console.warn(`[MemoryMonitor] ${name} size is ${map.size}, consider cleanup`)
      stats.warnings++
    }

    return originalSet(key, value)
  }

  map.delete = function(key) {
    stats.totalOperations++
    return originalDelete(key)
  }

  return {
    getStats: () => ({
      currentSize: map.size,
      peakSize: stats.peakSize,
      totalOperations: stats.totalOperations,
      warnings: stats.warnings
    }),
    resetStats: () => {
      stats.peakSize = map.size
      stats.totalOperations = 0
      stats.warnings = 0
    }
  }
}

module.exports = {
  addLRUCleanup,
  addSetCapacityLimit,
  addMemoryMonitor
}
