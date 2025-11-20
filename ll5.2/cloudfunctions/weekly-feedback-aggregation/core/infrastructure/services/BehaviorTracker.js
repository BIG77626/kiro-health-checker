/**
 * BehaviorTracker - 用户行为追踪器
 * 
 * 基于 P1-001 Skill 实现
 * 
 * Iron Laws (来自 P1-001):
 * - NO PLATFORM API (wx.*) IN BEHAVIORTRACKER
 * - NO THROWING EXCEPTIONS TO CALLER
 * - NO SYNCHRONOUS BLOCKING > 5ms
 * 
 * @see .claude/skills/quick-refs/P1-001-BEHAVIOR-TRACKER.md
 */

class BehaviorTracker {
  /**
   * @param {Object} config - 配置
   * @param {Object} storage - 存储适配器（依赖注入）
   * @param {Object} uploader - 上报适配器（依赖注入）
   * @param {Object} logger - 日志适配器（依赖注入，可选）
   */
  constructor(config, storage, uploader, logger) {
    this._buffer = [];
    this._config = this._validateConfig(config);
    this._storage = storage;
    this._uploader = uploader;
    this._logger = logger; // 可注入的日志器
    this._flushTimer = null;
  }
  
  /**
   * 验证和规范化配置
   * @private
   */
  _validateConfig(config) {
    const defaults = {
      maxBufferSize: 10,
      flushInterval: 30000
    };
    
    if (!config) return defaults;
    
    // 防御性边界检查 (development-discipline)
    return {
      maxBufferSize: Math.max(1, Math.min(config.maxBufferSize || defaults.maxBufferSize, 1000)),
      flushInterval: Math.max(1000, Math.min(config.flushInterval || defaults.flushInterval, 300000))
    };
  }
  
  /**
   * 追踪犹豫行为
   * 
   * 触发条件：用户在选项上停留 > 3秒
   * 
   * @param {string} questionId - 题目ID
   * @param {number} duration - 犹豫时长(ms)
   */
  trackHesitation(questionId, duration) {
    try {
      // 小于3秒不算犹豫
      if (duration < 3000) return;
      
      this._enqueue({
        eventType: 'hesitation',
        questionId,
        duration,
        timestamp: Date.now()
      });
    } catch (e) {
      // Silent fail - P1-001 Iron Law #2
      this._log('error', 'Track hesitation failed', e);
    }
  }
  
  /**
   * 追踪答题行为
   * 
   * @param {string} questionId - 题目ID
   * @param {string} selectedOption - 选中的选项 (A/B/C/D)
   * @param {boolean} isCorrect - 是否正确
   * @param {number} timeSpent - 答题耗时(ms)
   */
  trackAnswer(questionId, selectedOption, isCorrect, timeSpent) {
    try {
      this._enqueue({
        eventType: 'answer',
        questionId,
        selectedOption,
        isCorrect,
        timeSpent,
        timestamp: Date.now()
      });
    } catch (e) {
      this._log('error', 'Track answer failed', e);
    }
  }
  
  /**
   * 追踪单词查询
   * 
   * 触发条件：用户点击单词查看释义
   * 
   * @param {string} word - 查询的单词
   * @param {string} context - 单词所在的句子上下文
   */
  trackWordLookup(word, context) {
    try {
      this._enqueue({
        eventType: 'word_lookup',
        word,
        context,
        timestamp: Date.now()
      });
    } catch (e) {
      this._log('error', 'Track word lookup failed', e);
    }
  }
  
  /**
   * 追踪跳题行为
   * 
   * @param {string} questionId - 题目ID
   * @param {string} reason - 跳题原因 (too_hard/no_time/etc)
   */
  trackSkip(questionId, reason) {
    try {
      this._enqueue({
        eventType: 'skip',
        questionId,
        reason,
        timestamp: Date.now()
      });
    } catch (e) {
      this._log('error', 'Track skip failed', e);
    }
  }
  
  /**
   * 追踪复习行为
   * 
   * 触发条件：用户返回查看已答过的题目
   * 
   * @param {string} questionId - 题目ID
   * @param {number} reviewCount - 第几次复习
   */
  trackReview(questionId, reviewCount) {
    try {
      this._enqueue({
        eventType: 'review',
        questionId,
        reviewCount,
        timestamp: Date.now()
      });
    } catch (e) {
      this._log('error', 'Track review failed', e);
    }
  }
  
  /**
   * 入队事件
   * 
   * @private
   * @param {Object} event - 事件对象
   */
  _enqueue(event) {
    this._buffer.push(event);
    
    // 达到批量大小，立即flush
    if (this._buffer.length >= this._config.maxBufferSize) {
      this._flush();
    }
    
    // 设置定时flush
    if (!this._flushTimer) {
      this._flushTimer = setTimeout(() => {
        this._flush();
      }, this._config.flushInterval);
    }
  }
  
  /**
   * 刷新缓冲区 - 上报或存储事件
   * 
   * 离线缓存策略 (修复后):
   * 1. 优先上报 (uploader存在时)
   * 2. 上报失败 → fallback到storage (如果有storage)
   * 3. 无uploader → 直接存储到storage
   * 4. 都没有 → silent fail，事件丢失但不crash
   * 
   * @private
   */
  _flush() {
    if (this._buffer.length === 0) return;
    
    const eventsToFlush = [...this._buffer]; // 复制一份，避免清空后丢失引用
    let uploadSuccess = false;
    
    try {
      this._log('info', `Flushing ${eventsToFlush.length} events`);
      
      // 策略1: 尝试上报
      if (this._uploader) {
        try {
          this._uploader.upload(eventsToFlush);
          uploadSuccess = true;
          this._log('info', 'Upload success');
        } catch (uploadError) {
          // 上报失败，记录错误
          this._log('error', 'Upload failed', uploadError);
          uploadSuccess = false;
        }
      }
      
      // 策略2: 上报失败或无uploader时，使用storage
      if (!uploadSuccess && this._storage) {
        try {
          this._storage.save('behavior_cache', eventsToFlush);
          this._log('info', 'Saved to offline cache');
        } catch (storageError) {
          // 存储也失败，记录但不抛出
          this._log('error', 'Storage save failed', storageError);
        }
      }
      
      // 清空缓冲区（无论成功失败，避免无限积累）
      this._buffer = [];
      
      // 清除定时器
      if (this._flushTimer) {
        clearTimeout(this._flushTimer);
        this._flushTimer = null;
      }
    } catch (e) {
      // 外层兜底 - Silent fail (P1-001 Iron Law)
      this._log('error', 'Flush failed unexpectedly', e);
      // 即使出错也清空buffer，避免死循环
      this._buffer = [];
    }
  }
  
  /**
   * 统一日志方法
   * 
   * @private
   * @param {string} level - 日志级别 (info/error/warn)
   * @param {string} message - 日志消息
   * @param {Error} error - 错误对象（可选）
   */
  _log(level, message, error) {
    const logMessage = `[BehaviorTracker] ${message}`;
    
    if (this._logger) {
      // 使用注入的logger
      this._logger.log(level, logMessage, error);
    } else {
      // Fallback到console (保持向后兼容)
      if (level === 'error' && error) {
        console.log(logMessage, error);
      } else {
        console.log(logMessage);
      }
    }
  }
  
  /**
   * 手动触发flush
   * 
   * 使用场景：
   * - 页面onUnload时
   * - 小程序onHide时
   * - 用户退出登录时
   */
  flush() {
    this._flush();
  }
  
  /**
   * 获取当前缓冲区大小
   * 
   * @returns {number} 缓冲区中的事件数量
   * 
   * 用途：测试和调试
   */
  getBufferSize() {
    return this._buffer.length;
  }
  
  /**
   * 清空缓冲区（不上报）
   * 
   * 用途：测试cleanup
   */
  clear() {
    this._buffer = [];
    if (this._flushTimer) {
      clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
  }
}

module.exports = BehaviorTracker;
