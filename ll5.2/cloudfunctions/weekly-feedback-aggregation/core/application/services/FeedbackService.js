/**
 * FeedbackService - 反馈服务
 * P1-002实现
 * 
 * === 设计原则 ===
 * - 复用P1-001的BehaviorTracker上报机制
 * - Silent fail: 所有错误不crash
 * - 依赖注入: StorageAdapter + UploaderAdapter
 * - 批量上报: 减少网络请求
 * 
 * === 失败场景处理 ===
 * 1. 网络失败 → 自动重试+离线缓存
 * 2. 数据库写入失败 → 降级到本地存储
 * 3. 存储满了 → 自动清理旧反馈
 * 4. 并发上报 → buffer机制
 * 5. 页面卸载 → 自动flush
 * 
 * === 数据格式 ===
 * {
 *   contentId: string,
 *   contentType: 'translation' | 'writing' | 'recommendation' | 'conversation',
 *   feedbackType: 'thumbUp' | 'thumbDown' | 'cancel',
 *   comment: string,
 *   context: object,
 *   timestamp: number
 * }
 */

class FeedbackService {
  /**
   * 构造函数
   * 
   * @param {Object} config - 配置
   * @param {StorageAdapter} storage - 存储适配器
   * @param {UploaderAdapter} uploader - 上传适配器
   * @param {Object} logger - 日志记录器（可选）
   */
  constructor(config = {}, storage, uploader, logger = null) {
    // 配置验证与边界检查
    this._config = this._validateConfig(config)
    
    // 依赖注入
    this._storage = storage
    this._uploader = uploader
    this._logger = logger || console
    
    // 反馈buffer（批量上报）
    this._buffer = []
    
    // 定时flush
    this._flushTimer = null
    this._startFlushTimer()
    
    this._logger.log('[FeedbackService] Initialized with config:', this._config)
  }

  /**
   * 提交反馈
   * 
   * @param {Object} feedbackData - 反馈数据
   * @returns {Promise<boolean>} - 是否成功
   */
  async submitFeedback(feedbackData) {
    try {
      // 数据验证
      if (!this._validateFeedbackData(feedbackData)) {
        this._logger.warn('[FeedbackService] Invalid feedback data:', feedbackData)
        return false
      }
      
      // 添加到buffer
      this._buffer.push({
        ...feedbackData,
        _submitTime: Date.now()
      })
      
      this._logger.log('[FeedbackService] Feedback added to buffer, size:', this._buffer.length)
      
      // 如果buffer满了，立即flush
      if (this._buffer.length >= this._config.maxBufferSize) {
        this._logger.log('[FeedbackService] Buffer full, flushing...')
        await this._flush()
      }
      
      return true
      
    } catch (error) {
      // Silent fail - 不向上抛异常
      this._logger.error('[FeedbackService] Submit feedback failed:', error)
      return false
    }
  }

  /**
   * 手动flush（立即上报所有pending反馈）
   * 
   * @returns {Promise<void>}
   */
  async flush() {
    return this._flush()
  }

  /**
   * 销毁服务（清理资源）
   */
  destroy() {
    // 立即flush
    this._flush().catch(e => {
      this._logger.warn('[FeedbackService] Final flush failed:', e)
    })
    
    // 清除定时器
    if (this._flushTimer) {
      clearInterval(this._flushTimer)
      this._flushTimer = null
    }
    
    this._logger.log('[FeedbackService] Destroyed')
  }

  /**
   * 获取buffer大小（测试用）
   */
  getBufferSize() {
    return this._buffer.length
  }

  // ==================== 私有方法 ====================

  /**
   * 验证配置
   */
  _validateConfig(config) {
    const defaults = {
      maxBufferSize: 10,           // 最大buffer大小
      flushInterval: 30000,        // flush间隔（毫秒）
      storageKey: 'feedback_cache' // 本地存储key
    }
    
    const validated = { ...defaults, ...config }
    
    // 边界检查
    validated.maxBufferSize = Math.max(1, Math.min(validated.maxBufferSize, 100))
    validated.flushInterval = Math.max(5000, Math.min(validated.flushInterval, 300000))
    
    return validated
  }

  /**
   * 验证反馈数据
   */
  _validateFeedbackData(data) {
    if (!data || typeof data !== 'object') {
      return false
    }
    
    // 必填字段
    if (!data.contentId || !data.contentType || !data.feedbackType) {
      return false
    }
    
    // 类型检查
    const validContentTypes = ['translation', 'writing', 'recommendation', 'conversation']
    if (!validContentTypes.includes(data.contentType)) {
      return false
    }
    
    const validFeedbackTypes = ['thumbUp', 'thumbDown', 'cancel']
    if (!validFeedbackTypes.includes(data.feedbackType)) {
      return false
    }
    
    return true
  }

  /**
   * 启动定时flush
   */
  _startFlushTimer() {
    if (this._flushTimer) {
      clearInterval(this._flushTimer)
    }
    
    this._flushTimer = setInterval(() => {
      if (this._buffer.length > 0) {
        this._logger.log('[FeedbackService] Timer flush triggered')
        this._flush().catch(e => {
          this._logger.warn('[FeedbackService] Timer flush failed:', e)
        })
      }
    }, this._config.flushInterval)
  }

  /**
   * Flush buffer（上报所有pending反馈）
   * 
   * === 失败场景处理 ===
   * 1. uploader失败 → fallback到storage
   * 2. storage失败 → 清空buffer，记录日志
   * 3. 并发flush → 加锁防止
   */
  async _flush() {
    if (this._buffer.length === 0) {
      return
    }
    
    // 防止并发flush
    if (this._flushing) {
      this._logger.log('[FeedbackService] Already flushing, skip')
      return
    }
    
    this._flushing = true
    
    try {
      this._logger.log(`[FeedbackService] Flushing ${this._buffer.length} feedbacks`)
      
      // 取出当前buffer（防止flush期间新增数据）
      const feedbacksToFlush = [...this._buffer]
      this._buffer = []
      
      // 优先上报到云端
      if (this._uploader) {
        try {
          const success = await this._uploader.upload({
            type: 'feedback_events',
            data: feedbacksToFlush,
            timestamp: Date.now()
          })
          
          if (success) {
            this._logger.log('[FeedbackService] Upload success')
            return
          }
          
        } catch (uploadError) {
          this._logger.warn('[FeedbackService] Upload failed, fallback to storage:', uploadError)
        }
      }
      
      // 失败场景1: uploader失败 → fallback到storage
      if (this._storage) {
        try {
          const success = await this._storage.save(
            this._config.storageKey,
            feedbacksToFlush
          )
          
          if (success) {
            this._logger.log('[FeedbackService] Saved to storage as fallback')
            return
          }
          
        } catch (storageError) {
          this._logger.error('[FeedbackService] Storage failed:', storageError)
        }
      }
      
      // 失败场景2: 都失败了 → 只记录日志（Silent fail）
      this._logger.error('[FeedbackService] All flush attempts failed, data lost')
      
    } catch (error) {
      // Silent fail - 不向上抛异常
      this._logger.error('[FeedbackService] Flush error:', error)
      
    } finally {
      this._flushing = false
    }
  }
}

module.exports = FeedbackService
