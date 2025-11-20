/**
 * 定时器管理器
 * 架构铁律 v2.0 - M2 定时器生命周期管理
 */

/**
 * 定时器管理器类
 * 提供统一的定时器创建、跟踪和清理功能
 */
class TimerManager {
  constructor() {
    // 跟踪所有活跃的定时器
    this.timers = new Set()
    this.intervals = new Set()

    // 统计信息
    this.stats = {
      created: 0,
      cleared: 0,
      leaked: 0
    }

    // 自动清理已销毁的定时器引用
    this.cleanupInterval = setInterval(() => {
      this._cleanupInvalidTimers()
    }, 30000) // 30秒检查一次
  }

  /**
   * 创建延迟执行定时器
   * @param {Function} callback - 回调函数
   * @param {number} delay - 延迟时间(毫秒)
   * @param {string} label - 定时器标签，用于调试
   * @returns {number} 定时器ID
   */
  setTimeout(callback, delay, label = 'anonymous') {
    const timerId = setTimeout(() => {
      // 执行回调前先从跟踪列表中移除
      this.timers.delete(timerId)

      try {
        callback()
      } catch (error) {
        console.error(`[TimerManager] Error in timeout callback (${label}):`, error)
      }
    }, delay)

    // 添加到跟踪列表
    this.timers.add(timerId)
    this.stats.created++

    console.log(`[TimerManager] Created timeout: ${label} (${timerId})`)

    return timerId
  }

  /**
   * 创建重复执行定时器
   * @param {Function} callback - 回调函数
   * @param {number} interval - 执行间隔(毫秒)
   * @param {string} label - 定时器标签，用于调试
   * @returns {number} 定时器ID
   */
  setInterval(callback, interval, label = 'anonymous') {
    const timerId = setInterval(() => {
      try {
        callback()
      } catch (error) {
        console.error(`[TimerManager] Error in interval callback (${label}):`, error)
      }
    }, interval)

    // 添加到跟踪列表
    this.intervals.add(timerId)
    this.stats.created++

    console.log(`[TimerManager] Created interval: ${label} (${timerId})`)

    return timerId
  }

  /**
   * 清除延迟定时器
   * @param {number} timerId - 定时器ID
   * @returns {boolean} 是否成功清除
   */
  clearTimeout(timerId) {
    if (this.timers.has(timerId)) {
      clearTimeout(timerId)
      this.timers.delete(timerId)
      this.stats.cleared++
      console.log(`[TimerManager] Cleared timeout: ${timerId}`)
      return true
    }
    return false
  }

  /**
   * 清除重复定时器
   * @param {number} timerId - 定时器ID
   * @returns {boolean} 是否成功清除
   */
  clearInterval(timerId) {
    if (this.intervals.has(timerId)) {
      clearInterval(timerId)
      this.intervals.delete(timerId)
      this.stats.cleared++
      console.log(`[TimerManager] Cleared interval: ${timerId}`)
      return true
    }
    return false
  }

  /**
   * 清除所有定时器
   */
  clearAll() {
    // 清除所有延迟定时器
    this.timers.forEach(timerId => {
      clearTimeout(timerId)
    })
    const timeoutCount = this.timers.size
    this.timers.clear()

    // 清除所有重复定时器
    this.intervals.forEach(timerId => {
      clearInterval(timerId)
    })
    const intervalCount = this.intervals.size
    this.intervals.clear()

    this.stats.cleared += timeoutCount + intervalCount

    console.log(`[TimerManager] Cleared all timers: ${timeoutCount} timeouts, ${intervalCount} intervals`)
  }

  /**
   * 获取统计信息
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      active: {
        timeouts: this.timers.size,
        intervals: this.intervals.size,
        total: this.timers.size + this.intervals.size
      },
      history: {
        ...this.stats
      },
      leaked: this.stats.created - this.stats.cleared
    }
  }

  /**
   * 检查是否有内存泄漏的定时器
   * @returns {boolean} 是否有泄漏
   */
  hasLeaks() {
    return this.stats.created - this.stats.cleared > 0
  }

  /**
   * 清理无效的定时器引用
   * @private
   */
  _cleanupInvalidTimers() {
    // 这个方法主要用于清理已经自然结束但未正确清除的定时器引用
    // 在浏览器环境中，定时器ID在定时器执行后仍然有效，但我们可以通过其他方式检测

    let cleaned = 0
    // 这里可以添加更复杂的清理逻辑，比如检查定时器的执行状态

    if (cleaned > 0) {
      console.log(`[TimerManager] Cleaned up ${cleaned} invalid timer references`)
    }
  }

  /**
   * 销毁定时器管理器
   */
  destroy() {
    // 清除所有活跃定时器
    this.clearAll()

    // 清除清理间隔
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    console.log('[TimerManager] Timer manager destroyed')
  }
}

// 创建全局单例
const timerManager = new TimerManager()

module.exports = timerManager
