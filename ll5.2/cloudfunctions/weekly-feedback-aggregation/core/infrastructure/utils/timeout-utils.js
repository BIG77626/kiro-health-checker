/**
 * 超时工具函数
 * 架构铁律 v2.0 - A1 强制超时机制
 */

class TimeoutError extends Error {
  constructor(message = 'Operation timeout', timeout = 30000) {
    super(message)
    this.name = 'TimeoutError'
    this.timeout = timeout
    this.retryable = true
    this.timestamp = Date.now()
  }
}

class LockTimeoutError extends Error {
  constructor(message = 'Lock timeout', timeout = 5000) {
    super(message)
    this.name = 'LockTimeoutError'
    this.timeout = timeout
    this.retryable = false
    this.timestamp = Date.now()
  }
}

/**
 * 为异步操作添加超时保护
 * @param {Promise} operation - 异步操作
 * @param {number} timeout - 超时时间(毫秒)，默认30秒
 * @param {string} operationName - 操作名称，用于错误信息
 * @returns {Promise} - 带超时的异步操作
 */
async function withTimeout(operation, timeout = 30000, operationName = 'operation') {
  console.log(`[TimeoutUtils] 开始执行操作: ${operationName}, 超时时间: ${timeout}ms`)

  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => {
      console.error(`[TimeoutUtils] 操作超时: ${operationName}`)
      reject(new TimeoutError(`${operationName} timeout after ${timeout}ms`, timeout))
    }, timeout)
  })

  try {
    const startTime = Date.now()
    const result = await Promise.race([operation, timeoutPromise])
    const duration = Date.now() - startTime
    console.log(`[TimeoutUtils] 操作完成: ${operationName}, 耗时: ${duration}ms`)
    return result
  } catch (error) {
    if (error instanceof TimeoutError) {
      throw error
    }
    console.error(`[TimeoutUtils] 操作失败: ${operationName}`, error)
    throw error
  }
}

/**
 * 为Use Case调用添加超时保护
 * @param {Object} useCase - Use Case实例
 * @param {Object} params - Use Case参数
 * @param {number} timeout - 超时时间(毫秒)
 * @param {string} useCaseName - Use Case名称
 * @returns {Promise} - 执行结果
 */
async function executeUseCaseWithTimeout(useCase, params = {}, timeout = 30000, useCaseName = 'UseCase') {
  if (!useCase || typeof useCase.execute !== 'function') {
    throw new Error(`Invalid useCase: ${useCaseName}`)
  }

  console.log(`[TimeoutUtils] 执行Use Case: ${useCaseName}`)

  return withTimeout(
    useCase.execute(params),
    timeout,
    useCaseName
  )
}

/**
 * 为服务调用添加超时保护
 * @param {Object} service - 服务实例
 * @param {string} methodName - 方法名
 * @param {Array} args - 方法参数
 * @param {number} timeout - 超时时间(毫秒)
 * @returns {Promise} - 执行结果
 */
async function executeServiceWithTimeout(service, methodName, args = [], timeout = 30000) {
  if (!service || typeof service[methodName] !== 'function') {
    throw new Error(`Invalid service method: ${methodName}`)
  }

  console.log(`[TimeoutUtils] 执行服务方法: ${service.constructor.name}.${methodName}`)

  return withTimeout(
    service[methodName](...args),
    timeout,
    `${service.constructor.name}.${methodName}`
  )
}

/**
 * 创建锁机制（A2铁律）
 */
class AsyncLock {
  constructor(timeout = 5000) {
    this.locks = new Map()
    this.defaultTimeout = timeout
    this.cleanupInterval = setInterval(() => this._cleanupExpiredLocks(), 30000)
  }

  /**
   * 获取锁
   * @param {string} key - 锁的唯一标识
   * @param {number} timeout - 超时时间
   * @returns {Promise<string>} - 锁ID
   */
  async acquire(key, timeout = this.defaultTimeout) {
    const lockId = crypto.randomUUID()
    const startTime = Date.now()

    console.log(`[AsyncLock] 尝试获取锁: ${key}`)

    while (this.locks.has(key)) {
      if (Date.now() - startTime > timeout) {
        console.error(`[AsyncLock] 获取锁超时: ${key}`)
        throw new LockTimeoutError(`Lock acquisition timeout for key: ${key}`)
      }
      await new Promise(resolve => setTimeout(resolve, 10))
    }

    // 记录锁信息
    this.locks.set(key, {
      lockId,
      timestamp: Date.now(),
      stack: new Error().stack
    })

    console.log(`[AsyncLock] 成功获取锁: ${key}, 锁ID: ${lockId}`)
    return lockId
  }

  /**
   * 释放锁
   * @param {string} key - 锁的唯一标识
   * @param {string} lockId - 锁ID
   * @returns {boolean} - 是否成功释放
   */
  release(key, lockId) {
    const lock = this.locks.get(key)

    if (!lock) {
      console.warn(`[AsyncLock] 锁不存在: ${key}`)
      return false
    }

    if (lock.lockId !== lockId) {
      console.error(`[AsyncLock] 锁ID不匹配: ${key}, 期望: ${lockId}, 实际: ${lock.lockId}`)
      return false
    }

    this.locks.delete(key)
    console.log(`[AsyncLock] 成功释放锁: ${key}`)
    return true
  }

  /**
   * 清理过期的锁
   */
  _cleanupExpiredLocks() {
    const now = Date.now()
    let cleanedCount = 0

    for (const [key, lock] of this.locks.entries()) {
      if (now - lock.timestamp > this.defaultTimeout * 2) {
        console.warn(`[AsyncLock] 清理过期锁: ${key}`)
        this.locks.delete(key)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      console.log(`[AsyncLock] 清理了 ${cleanedCount} 个过期锁`)
    }
  }

  /**
   * 销毁锁管理器
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.locks.clear()
    console.log('[AsyncLock] 锁管理器已销毁')
  }
}

module.exports = {
  TimeoutError,
  LockTimeoutError,
  withTimeout,
  executeUseCaseWithTimeout,
  executeServiceWithTimeout,
  AsyncLock
}
