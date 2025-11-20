/**
 * StorageAdapter - 微信小程序存储API封装
 * 
 * 位置: Adapter层（唯一可以直接调用 wx.* 的层）
 * 职责: 封装 wx.storage.* API，隔离平台依赖
 * 
 * Iron Laws:
 * - 这是唯一可以调用 wx.storage.* 的地方
 * - 错误不向上抛出，返回 null/false 并记录日志
 * - 所有方法返回 Promise（保持接口一致性）
 * 
 * WECHAT-LIMITS 约束:
 * - Storage 总容量: 10MB（超出时 wx.setStorage 会报错）
 * - 不在 Adapter 层做容量检查（由业务层 BehaviorTracker 处理 LRU）
 * - 单个 key 存储大小: 理论无限制，但实际受 10MB 总容量限制
 */

class StorageAdapter {
  constructor() {
    // 日志函数（silent mode）
    this._log = console.log.bind(console, '[StorageAdapter]')
  }

  /**
   * 获取数据
   * 
   * @param {string} key - 存储键
   * @returns {Promise<any>} 返回数据，不存在返回 null
   * 
   * @example
   * const data = await storage.get('offline_events')
   * if (data) { ... }
   */
  async get(key) {
    try {
      // 使用 wx.getStorage（异步版本，性能更好）
      return await new Promise((resolve, reject) => {
        wx.getStorage({
          key: key,
          success: (res) => {
            resolve(res.data)
          },
          fail: (err) => {
            // 不存在时返回 null，不是错误
            if (err.errMsg.includes('data not found')) {
              resolve(null)
            } else {
              // 其他错误也返回 null，不要 reject
              this._log(`get('${key}') failed:`, err)
              resolve(null)
            }
          }
        })
      })
    } catch (e) {
      // Silent fail - 返回 null
      this._log(`get('${key}') failed (sync):`, e)
      return null
    }
  }

  /**
   * 设置数据（覆盖）
   * 
   * @param {string} key - 存储键
   * @param {any} value - 数据（会被 JSON 序列化）
   * @returns {Promise<boolean>} 成功返回 true，失败返回 false
   * 
   * @example
   * const success = await storage.set('offline_events', events)
   * if (!success) {
   *   console.warn('Storage full or write failed')
   * }
   */
  async set(key, value) {
    try {
      return await new Promise((resolve, reject) => {
        wx.setStorage({
          key: key,
          data: value,
          success: () => {
            resolve(true)
          },
          fail: (err) => {
            // 在 Promise 内部处理错误，不要 reject
            this._log(`set('${key}') failed:`, err)
            
            // 检查是否因为超出 10MB 限制
            if (err.errMsg && err.errMsg.includes('exceed max size')) {
              this._log('WARNING: Storage exceeded 10MB limit')
            }
            
            resolve(false)  // 返回 false，不是 reject
          }
        })
      })
    } catch (e) {
      // 外层 try/catch 捕获同步异常
      this._log(`set('${key}') failed (sync):`, e)
      return false
    }
  }

  /**
   * 追加数据到数组
   * 封装"读-改-写"逻辑，避免调用方直接操作
   * 
   * @param {string} key - 存储键
   * @param {Array} items - 要追加的元素
   * @returns {Promise<boolean>} 成功返回 true，失败返回 false
   * 
   * @example
   * // 追加 10 个事件到离线缓存
   * await storage.append('offline_events', batch)
   */
  async append(key, items) {
    try {
      // [1] 读取现有数据
      const existing = await this.get(key)
      const array = Array.isArray(existing) ? existing : []
      
      // [2] 追加新数据
      array.push(...items)
      
      // [3] 写回（可能失败）
      const success = await this.set(key, array)
      
      if (!success) {
        this._log(`append('${key}') failed: set returned false`)
      }
      
      return success
    } catch (e) {
      // Silent fail
      this._log(`append('${key}') failed:`, e)
      return false
    }
  }

  /**
   * 删除数据
   * 
   * @param {string} key - 存储键
   * @returns {Promise<boolean>} 成功返回 true，失败返回 false
   * 
   * @example
   * await storage.remove('offline_events')
   */
  async remove(key) {
    try {
      return await new Promise((resolve, reject) => {
        wx.removeStorage({
          key: key,
          success: () => {
            resolve(true)
          },
          fail: (err) => {
            // Key 不存在时也算成功（幂等性）
            if (err.errMsg.includes('data not found')) {
              resolve(true)
            } else {
              // 其他错误也返回 false，不要 reject
              this._log(`remove('${key}') failed:`, err)
              resolve(false)
            }
          }
        })
      })
    } catch (e) {
      // Silent fail
      this._log(`remove('${key}') failed (sync):`, e)
      return false
    }
  }

  /**
   * 获取存储信息（用于监控）
   * 
   * @returns {Promise<{currentSize: number, limitSize: number, keys: string[]}>}
   * 返回值：
   * - currentSize: 当前占用空间（KB）
   * - limitSize: 总容量限制（KB，通常是 10240）
   * - keys: 所有存储的 key 列表
   * 
   * @example
   * const info = await storage.getStorageInfo()
   * if (info.currentSize > info.limitSize * 0.8) {
   *   console.warn('Storage usage > 80%')
   * }
   */
  async getStorageInfo() {
    try {
      return await new Promise((resolve, reject) => {
        wx.getStorageInfo({
          success: (res) => {
            resolve({
              currentSize: res.currentSize, // KB
              limitSize: res.limitSize,     // KB (usually 10240)
              keys: res.keys || []
            })
          },
          fail: (err) => {
            // 失败时返回安全默认值，不要 reject
            this._log('getStorageInfo() failed:', err)
            resolve({
              currentSize: 0,
              limitSize: 10240,
              keys: []
            })
          }
        })
      })
    } catch (e) {
      // Silent fail - 返回安全默认值
      this._log('getStorageInfo() failed (sync):', e)
      return {
        currentSize: 0,
        limitSize: 10240,
        keys: []
      }
    }
  }

  /**
   * 清空所有存储（仅用于测试/调试）
   * 生产环境不应调用！
   * 
   * @returns {Promise<boolean>}
   */
  async clearAll() {
    try {
      return await new Promise((resolve, reject) => {
        wx.clearStorage({
          success: () => {
            this._log('WARNING: All storage cleared')
            resolve(true)
          },
          fail: (err) => {
            // 失败时返回 false，不要 reject
            this._log('clearAll() failed:', err)
            resolve(false)
          }
        })
      })
    } catch (e) {
      this._log('clearAll() failed (sync):', e)
      return false
    }
  }
}

module.exports = StorageAdapter
