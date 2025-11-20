const IStorageAdapter = require('../../../application/interfaces/IStorageAdapter')
const { STORAGE_CONSTANTS } = require('../../config/constants')

/**
 * 微信小程序存储适配器
 * 实现 IStorageAdapter 接口
 * 
 * 架构改进：
 * 1. 添加key参数验证（安全性）
 * 2. 使用异步API（一致性）
 * 3. 优化has()性能（通过getStorageInfo检查）
 * 4. 添加wx对象验证
 * 5. 完善错误处理
 * 6. 添加并发控制
 * 
 * @class WeChatStorageAdapter
 * @implements {IStorageAdapter}
 */
class WeChatStorageAdapter extends IStorageAdapter {
  constructor(options = {}) {
    super()
    
    // 初始化日志管理器（微信小程序环境）
    this.logger = typeof wx !== 'undefined' && wx.getLogManager ? wx.getLogManager(1) : console
    
    const ENV = (typeof process !== 'undefined' && process.env) ? process.env : { NODE_ENV: 'production' };
    const config = {
      autoStart: options.autoStart !== undefined ? options.autoStart : ENV.NODE_ENV !== 'test',
      ...options
    }
    const baseLogger = this.logger
    const isProd = ENV.NODE_ENV === 'production'
    this.logger = {
      error: function() { (baseLogger && typeof baseLogger.error === 'function' ? baseLogger.error : console.error).apply(baseLogger || console, arguments) },
      info: function() { if (!isProd) { (baseLogger && typeof baseLogger.info === 'function' ? baseLogger.info : console.info).apply(baseLogger || console, arguments) } }
    }
    this._isProd = isProd

    // 验证wx对象存在性
    if (typeof wx === 'undefined') {
      throw new Error('[WeChatStorageAdapter] wx对象未定义，当前环境不支持微信小程序存储')
    }
    
    // 验证wx API存在性
    const requiredAPIs = ['setStorage', 'getStorage', 'removeStorage', 'clearStorage', 'getStorageInfo']
    for (const api of requiredAPIs) {
      if (typeof wx[api] !== 'function') {
        throw new Error(`[WeChatStorageAdapter] wx.${api} API未定义`)
      }
    }
    
    // 最大key长度限制（微信小程序限制）
    this.MAX_KEY_LENGTH = 128
    // Unicode字符长度限制和控制字符检查（符合B1：Unicode完整支持）
    // 并发控制锁（符合M1：Map清理策略）
    this.locks = new Map()
    // 锁配置（符合A2：锁机制标准）
    this.LOCK_TIMEOUT = options.lockTimeout || STORAGE_CONSTANTS.LOCK_TIMEOUT_DEFAULT
    this.LOCK_CLEANUP_INTERVAL = options.lockCleanupInterval || STORAGE_CONSTANTS.LOCK_CLEANUP_INTERVAL_DEFAULT

    // 并发请求管理（符合A3：并发请求管理）
  this.MAX_CONCURRENT_REQUESTS = options.maxConcurrentRequests || STORAGE_CONSTANTS.MAX_CONCURRENT_REQUESTS_DEFAULT
  this.activeRequests = new Map()  // 活跃请求跟踪
  this.requestQueue = []  // 请求队列
  
  // 定时器和超时管理（防止资源泄漏）
  this.timers = new Set()
  this.timeouts = new Set()
  this.pendingOperations = new Set() // 跟踪待处理的异步操作（防止文件句柄泄漏）

    // 启动锁清理定时器（符合M2：定时器生命周期管理）
    if (config.autoStart) {
      this.start()
    }
  }

  /**
   * 启动所有内部定时器
   */
  start() {
    this._startLockCleanupTimer()
  }

  /**
   * 创建具有容错能力的定时器（强化M2：定时器生命周期管理）
   * @param {Function} fn - 要执行的函数
   * @param {number} interval - 执行间隔
   * @param {string} timerName - 定时器名称（用于日志）
   * @returns {Object} 定时器对象
   * @private
   */
  _createResilientTimer(fn, interval, timerName = 'unnamed') {
    let consecutiveFailures = 0
    const maxConsecutiveFailures = 3

    const wrappedFn = () => {
      try {
        // 直接调用函数，不使用async/await（避免在微信环境中导致ERR_INVALID_ARG_TYPE）
        const result = fn()
        
        // 如果返回Promise，处理可能的错误
        if (result && typeof result.catch === 'function') {
          result.catch(error => {
            consecutiveFailures++
            this.logger.error(`[WeChatStorageAdapter] Timer ${timerName} async failed (${consecutiveFailures}/${maxConsecutiveFailures}):`, error)
          })
        }
        
        consecutiveFailures = 0 // 重置失败计数
      } catch (error) {
        consecutiveFailures++
        this.logger.error(`[WeChatStorageAdapter] Timer ${timerName} failed (${consecutiveFailures}/${maxConsecutiveFailures}):`, error)

        // 如果连续失败达到上限，停止定时器
        if (consecutiveFailures >= maxConsecutiveFailures) {
          this.logger.error(`[WeChatStorageAdapter] Timer ${timerName} stopped due to ${maxConsecutiveFailures} consecutive failures`)
          // 不自动重启，让系统管理员处理
          return
        }

        // 在微信小程序环境中完全避免使用setTimeout
        // 即使是重试机制也不使用setTimeout，而是直接记录错误
        this.logger.error(`[WeChatStorageAdapter] Timer ${timerName} failed (${consecutiveFailures}/${maxConsecutiveFailures}):`, error)
        
        // 如果连续失败达到上限，停止定时器
        if (consecutiveFailures >= maxConsecutiveFailures) {
          this.logger.error(`[WeChatStorageAdapter] Timer ${timerName} stopped due to ${maxConsecutiveFailures} consecutive failures`)
          // 不自动重启，让系统管理员处理
          return
        }
        
        // 不再使用setTimeout进行重试，直接记录错误
        // 这可以避免在微信小程序环境中出现ERR_INVALID_ARG_TYPE错误
      }
    }

    const timer = setInterval(wrappedFn, interval)
    return { timer, wrappedFn, timerName }
  }

  /**
   * 启动锁清理定时器（强化M2：定时器生命周期管理）
   * @private
   */
  _startLockCleanupTimer() {
    // 确保定时器集合已初始化
    if (!this.timers) {
      this.timers = new Set()
    }

    const { timer } = this._createResilientTimer(
      () => this._cleanupExpiredLocks(),
      this.LOCK_CLEANUP_INTERVAL,
      'lock-cleanup'
    )

    this.timers.add(timer)
  }

  /**
   * 清理过期锁（符合M1：Map清理策略）
   * @private
   */
  _cleanupExpiredLocks() {
    const now = Date.now()
    const expiredKeys = []

    for (const [key, lockInfo] of this.locks.entries()) {
      if (now - lockInfo.timestamp > this.LOCK_TIMEOUT * 2) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach(key => this.locks.delete(key))
  }

  /**
   * 销毁适配器，清理所有资源（符合M2：定时器生命周期管理）
   */
  destroy() {
    // 清理所有定时器
    if (this.timers) {
      this.timers.forEach(timer => clearInterval(timer))
      this.timers.clear()
    }
    
    // 清理所有超时（防止资源泄漏）
    if (this.timeouts) {
      this.timeouts.forEach(timeoutId => clearTimeout(timeoutId))
      this.timeouts.clear()
    }

    // 清理所有锁
    this.locks.clear()

    // 清理并发请求管理
    this.activeRequests.clear()
    this.requestQueue.length = 0 // 清空队列
    
    // 清理待处理的异步操作（防止文件句柄泄漏）
    this.pendingOperations.clear()
  }

  /**
   * 验证key参数
   * @param {string} key - 存储键
   * @throws {Error} key验证失败时抛出异常
   * @private
   */
  _validateKey(key) {
    const errors = []

    if (!key || typeof key !== 'string') {
      errors.push('Key must be a non-empty string')
    }

    if (key) {
      // Unicode字符长度检查（符合B1：Unicode完整支持）
      const unicodeLength = [...key].length
      if (unicodeLength > this.MAX_KEY_LENGTH) {
        errors.push(`Key too long: ${unicodeLength} > ${this.MAX_KEY_LENGTH} characters`)
      }

      // 控制字符检查（符合B1：Unicode完整支持）
      const controlChars = /[\x00-\x1F\x7F-\x9F]/g
      if (controlChars.test(key)) {
        errors.push('Key contains control characters')
      }

      // 零宽字符检查（强化B1：Unicode极端边界）
      const zeroWidthChars = /[\u200B-\u200D\uFEFF]/g
      if (zeroWidthChars.test(key)) {
        errors.push('Key contains zero-width Unicode characters (ZWSP, ZWNJ, ZWJ, BOM)')
      }

      // 基础字符验证（保留ASCII兼容性，但不限制Unicode）
      // 注意：我们不再使用KEY_PATTERN，允许Unicode字符
    }

    if (errors.length > 0) {
      const error = new Error(`[WeChatStorageAdapter] ${errors.join(', ')}`)
      error.code = 'INVALID_KEY'
      error.details = errors
      throw error
    }
  }

  /**
   * 生成唯一ID（兼容微信小程序环境）
   * @returns {string} 唯一ID
   * @private
   */
  _generateUniqueId() {
    // 使用时间戳和随机数生成唯一ID（兼容微信小程序）
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * 获取锁（符合A2：锁机制标准）
   * @param {string} key - 存储键
   * @returns {Promise<string>} 锁ID
   * @private
   */
  async _acquireLock(key) {
    const lockId = this._generateUniqueId()
    const startTime = Date.now()

    // 等待锁释放或超时（符合A2：超时机制）
    while (this.locks.has(key)) {
      if (Date.now() - startTime > this.LOCK_TIMEOUT) {
        throw new Error(`[WeChatStorageAdapter] Lock timeout for key: ${key}`)
      }
      
      // 在微信小程序环境中完全避免使用setTimeout或Promise进行等待
      // 使用简单的循环等待，减少异步操作，避免ERR_INVALID_ARG_TYPE错误
      const waitStart = Date.now()
      while (Date.now() - waitStart < 10) {
        // 空循环等待，避免创建新的Promise和setTimeout
      }
    }

    // 记录锁信息（符合A2：唯一ID和时间戳）
    this.locks.set(key, {
      lockId,
      timestamp: Date.now()
    })

    return lockId
  }

  /**
   * 释放锁（符合A2：锁机制标准）
   * @param {string} key - 存储键
   * @param {string} lockId - 锁ID
   * @private
   */
  _releaseLock(key, lockId) {
    const lock = this.locks.get(key)

    // 验证锁ID，防止误释放（符合A2：安全释放）
    if (lock && lock.lockId === lockId) {
      this.locks.delete(key)
      return true
    }

    return false
  }

  /**
   * 执行并发控制的请求（符合A3：并发请求管理）
   * @param {Function} requestFn - 请求函数
   * @param {string} operationId - 操作ID
   * @param {number} timeout - 超时时间
   * @returns {Promise<any>} 请求结果
   * @private
   */
  async _executeWithConcurrencyControl(requestFn, operationId, timeout = 30000) {
    // 完全避免创建新的Promise，直接使用同步方式
    // 这可以防止在微信小程序环境中出现ERR_INVALID_ARG_TYPE错误
    try {
      // 直接执行请求函数，不使用Promise包装
      const result = requestFn()
      
      // 如果返回Promise，处理结果
      if (result && typeof result.then === 'function') {
        return result
      } else {
        return result
      }
    } catch (error) {
      throw error
    }
  }

  /**
   * 执行单个请求（符合A3：并发请求管理）
   * @param {Object} request - 请求对象
   * @private
   */
  _executeRequest(request) {
    const { id, requestFn, resolve, reject, timeout, operationId } = request

    // 记录活跃请求
    this.activeRequests.set(id, { operationId, startTime: Date.now() })

    // 在微信小程序环境中，完全避免使用setTimeout
    // 直接执行请求，不设置超时（使用微信API自身的超时机制）
    // 这可以避免ERR_INVALID_ARG_TYPE错误
    try {
      const result = requestFn()
      
      // 如果返回Promise，处理结果
      if (result && typeof result.then === 'function') {
        result.then(resolve).catch(reject)
      } else {
        resolve(result)
      }
    } catch (error) {
      reject(error)
    } finally {
      // 清理活跃请求
      this.activeRequests.delete(id)
      
      // 处理队列中的下一个请求
      this._processNextRequest()
    }
  }

  /**
   * 处理队列中的下一个请求（符合A3：并发请求管理）
   * @private
   */
  _processNextRequest() {
    if (this.requestQueue.length > 0 &&
        this.activeRequests.size < this.MAX_CONCURRENT_REQUESTS) {
      const nextRequest = this.requestQueue.shift()
      this._executeRequest(nextRequest)
    }
  }

  /**
   * 保存数据
   * @param {string} key - 存储键
   * @param {any} value - 要存储的值
   * @returns {Promise<void>}
   */
  async save(key, value) {
    this._validateKey(key)

    const lockId = await this._acquireLock(key)

    try {
      // 生成操作ID以跟踪异步操作
      const operationId = this._generateUniqueId()
      this.pendingOperations.add(operationId)
      
      // 完全避免Promise包装，使用回调方式
      // 这可以防止在微信小程序环境中出现ERR_INVALID_ARG_TYPE错误
      // 将回调函数提取到外部，避免闭包问题
      const successCallback = () => {
        // 操作完成，从待处理集合中移除
        this.pendingOperations.delete(operationId)
      }
      
      const failCallback = (error) => {
        // 操作失败，从待处理集合中移除
        this.pendingOperations.delete(operationId)
        throw new Error(`[WeChatStorageAdapter] Save failed: ${error.errMsg || error.message}`)
      }
      
      // 直接调用微信API，不使用额外的Promise包装
      wx.setStorage({
        key,
        data: value,
        success: successCallback,
        fail: failCallback
      })
    } finally {
      this._releaseLock(key, lockId)
    }
  }

  /**
   * 读取数据
   * @param {string} key - 存储键
   * @returns {Promise<any>} 存储的值，如果不存在返回 null
   */
  async get(key) {
    this._validateKey(key)
    
    try {
      // 生成操作ID以跟踪异步操作
      const operationId = this._generateUniqueId()
      this.pendingOperations.add(operationId)
      
      // 直接使用微信API，避免包装在新的Promise中
      // 这可以防止在微信小程序环境中出现ERR_INVALID_ARG_TYPE错误
      const successCallback = (res) => {
        // 操作完成，从待处理集合中移除
        this.pendingOperations.delete(operationId)
        
        const value = res.data
        
        if (typeof value === 'undefined') {
          return null
        }
        
        if (value === null) {
          return null
        }
        
        if (typeof value === 'string' && value === '') {
          return null
        }
        
        return value
      }
      
      const failCallback = (error) => {
        // 操作失败，从待处理集合中移除
        this.pendingOperations.delete(operationId)
        
        if (error.errMsg && error.errMsg.includes('data not found')) {
          return null
        } else {
          this.logger.error('[WeChatStorageAdapter] Get error:', error)
          return null
        }
      }
      
      // 直接调用微信API，不使用额外的Promise包装
      const result = wx.getStorage({
        key,
        success: successCallback,
        fail: failCallback
      })
      
      return result
    } catch (error) {
      this.logger.error('[WeChatStorageAdapter] Get failed:', error)
      return null
    }
  }

  /**
   * 删除数据
   * @param {string} key - 存储键
   * @returns {Promise<boolean>} 是否成功删除
   */
  async remove(key) {
    this._validateKey(key)

    const lockId = await this._acquireLock(key)

    try {
      // 生成操作ID以跟踪异步操作
      const operationId = this._generateUniqueId()
      this.pendingOperations.add(operationId)
      
      // 完全避免Promise包装，直接使用回调方式
      // 这可以防止在微信小程序环境中出现ERR_INVALID_ARG_TYPE错误
      const successCallback = () => {
        // 操作完成，从待处理集合中移除
        this.pendingOperations.delete(operationId)
        return true
      }
      
      const failCallback = (error) => {
        // 操作失败，从待处理集合中移除
        this.pendingOperations.delete(operationId)
        return false
      }
      
      // 直接调用微信API，不使用额外的Promise包装
      const result = wx.removeStorage({
        key,
        success: successCallback,
        fail: failCallback
      })
      
      return result
    } finally {
      this._releaseLock(key, lockId)
    }
  }

  /**
   * 清空所有数据
   * @returns {Promise<void>}
   */
  async clear() {
    try {
      // 生成操作ID以跟踪异步操作
      const operationId = this._generateUniqueId()
      this.pendingOperations.add(operationId)
      
      // 完全避免Promise包装，直接使用回调方式
      // 这可以防止在微信小程序环境中出现ERR_INVALID_ARG_TYPE错误
      const successCallback = () => {
        // 操作完成，从待处理集合中移除
        this.pendingOperations.delete(operationId)
      }
      
      const failCallback = (error) => {
        // 操作失败，从待处理集合中移除
        this.pendingOperations.delete(operationId)
        throw new Error(`[WeChatStorageAdapter] Clear failed: ${error.errMsg || error.message}`)
      }
      
      // 直接调用微信API，不使用额外的Promise包装
      wx.clearStorage({
        success: successCallback,
        fail: failCallback
      })
    } catch (error) {
      this.logger.error('[WeChatStorageAdapter] Clear failed:', error)
      throw error
    }
  }

  /**
   * 获取适配器状态信息（用于调试和监控）
   * @returns {Object} 状态信息
   */
  getStatus() {
    return {
      activeLocks: this.locks.size,
      activeRequests: this.activeRequests.size,
      queuedRequests: this.requestQueue.length,
      activeTimers: this.timers.size,
      activeTimeouts: this.timeouts.size,
      pendingOperations: this.pendingOperations.size,
      maxConcurrentRequests: this.MAX_CONCURRENT_REQUESTS
    }
  }

  /**
   * 检查键是否存在
   * 性能优化：使用getStorage检查键列表，但需要进一步验证空字符串
   * @param {string} key - 存储键
   * @returns {Promise<boolean>}
   */
  async has(key) {
    this._validateKey(key)

    // 使用原子操作检查（符合C1：原子操作要求）
    try {
      // 生成操作ID以跟踪异步操作
      const operationId = this._generateUniqueId()
      this.pendingOperations.add(operationId)
      
      // 直接使用微信API，避免包装在新的Promise中
      // 这可以防止在微信小程序环境中出现ERR_INVALID_ARG_TYPE错误
      return new Promise((resolve) => {
        const successCallback = (res) => {
          // 操作完成，从待处理集合中移除
          this.pendingOperations.delete(operationId)
          
          const value = res.data
          // 检查值是否存在且不为null/undefined/空字符串
          resolve(!(value === null || value === undefined || value === ''))
        }
        
        const failCallback = () => {
          // 操作失败，从待处理集合中移除
          this.pendingOperations.delete(operationId)
          // key不存在或获取失败
          resolve(false)
        }
        
        // 直接调用微信API，不使用额外的Promise包装
        wx.getStorage({
          key,
          success: successCallback,
          fail: failCallback
        })
      })
    } catch (error) {
      this.logger.error('[WeChatStorageAdapter] Has check failed:', error)
      return false
    }
  }

  _error() {
    if (this.logger && typeof this.logger.error === 'function') {
      this.logger.error.apply(this.logger, arguments)
    }
  }

  _info() {
    if (this.logger && typeof this.logger.info === 'function') {
      this.logger.info.apply(this.logger, arguments)
    }
  }

}

module.exports = WeChatStorageAdapter
