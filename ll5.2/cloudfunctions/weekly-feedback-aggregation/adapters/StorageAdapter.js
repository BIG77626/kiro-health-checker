/**
 * === 开发前检查清单 ===
 * 
 * [ ] development-discipline: 失败场景列表已完成
 * [ ] development-discipline: 5类测试已设计
 * [ ] development-discipline: Skills三问法已回答
 * [ ] clean-architecture: wx.* 仅在Adapter中
 * [ ] P1-001: Silent fail机制
 * [ ] 生产环境5问已思考
 */

/**
 * StorageAdapter - 微信小程序存储适配器
 * 
 * 职责：
 * - 封装 wx.setStorageSync / wx.getStorageSync
 * - 隔离平台API，提供统一接口
 * - Silent fail，永不向上抛异常
 * 
 * Iron Laws (P1-001 + clean-architecture):
 * - ONLY THIS FILE CAN USE wx.* FOR STORAGE
 * - NO THROWING EXCEPTIONS TO CALLER
 * - PROVIDE FALLBACK FOR ALL FAILURES
 * 
 * 失败场景清单:
 * - [ ] wx.setStorageSync quota exceeded → 清理旧数据，重试一次
 * - [ ] wx.setStorageSync 其他异常 → 记录日志，返回false
 * - [ ] wx.getStorageSync 不存在 → 返回null
 * - [ ] wx.getStorageSync 数据损坏 → 返回null，清空该key
 * - [ ] key为null/undefined → 返回false/null
 * - [ ] value太大(>10MB) → 拒绝存储，返回false
 * - [ ] wx未定义(非小程序环境) → 使用localStorage fallback
 * 
 * 期望行为：所有失败都silent fail，不crash，有日志
 * 
 * @see .claude/skills/quick-refs/P1-001-BEHAVIOR-TRACKER.md
 * @see .claude/skills/quick-refs/CLEAN-ARCHITECTURE-CHECKLIST.md
 */

class StorageAdapter {
  constructor(logger) {
    this._logger = logger; // 可选的日志器
    this._platform = this._detectPlatform();
  }
  
  /**
   * 检测运行平台
   * @private
   */
  _detectPlatform() {
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      return 'wechat';
    }
    if (typeof localStorage !== 'undefined') {
      return 'web';
    }
    return 'none';
  }
  
  /**
   * 保存数据到存储
   * 
   * @param {string} key - 存储键
   * @param {any} value - 存储值
   * @returns {boolean} - 成功true，失败false
   */
  save(key, value) {
    try {
      // 边界检查：key
      if (!key || typeof key !== 'string') {
        this._log('error', 'Invalid key', { key });
        return false;
      }
      
      // 边界检查：value size (防止超限)
      const valueStr = JSON.stringify(value);
      const sizeBytes = new Blob([valueStr]).size;
      const sizeMB = sizeBytes / (1024 * 1024);
      
      if (sizeMB > 10) {
        this._log('error', 'Value too large', { sizeMB });
        return false;
      }
      
      // 保存逻辑
      if (this._platform === 'wechat') {
        try {
          wx.setStorageSync(key, value);
          this._log('info', 'Storage save success', { key });
          return true;
        } catch (e) {
          // 特殊处理：quota exceeded
          if (e.message && e.message.includes('quota')) {
            this._log('warn', 'Storage quota exceeded, clearing old data');
            this._clearOldData();
            
            // 重试一次
            try {
              wx.setStorageSync(key, value);
              this._log('info', 'Storage save success after cleanup', { key });
              return true;
            } catch (retryError) {
              this._log('error', 'Storage save failed after retry', retryError);
              return false;
            }
          }
          
          // 其他异常
          this._log('error', 'wx.setStorageSync failed', e);
          return false;
        }
      } else if (this._platform === 'web') {
        // Web fallback
        localStorage.setItem(key, valueStr);
        return true;
      } else {
        // 无存储能力
        this._log('error', 'No storage platform available');
        return false;
      }
    } catch (e) {
      // 外层兜底 - Silent fail
      this._log('error', 'StorageAdapter.save failed unexpectedly', e);
      return false;
    }
  }
  
  /**
   * 从存储读取数据
   * 
   * @param {string} key - 存储键
   * @returns {any|null} - 读取的值，失败返回null
   */
  load(key) {
    try {
      // 边界检查
      if (!key || typeof key !== 'string') {
        this._log('error', 'Invalid key', { key });
        return null;
      }
      
      if (this._platform === 'wechat') {
        try {
          const value = wx.getStorageSync(key);
          if (value === '' || value === undefined) {
            // 不存在或为空
            return null;
          }
          return value;
        } catch (e) {
          this._log('error', 'wx.getStorageSync failed', e);
          
          // 如果是数据损坏，清空该key
          if (e.message && e.message.includes('parse')) {
            this._log('warn', 'Data corrupted, removing key', { key });
            this.remove(key);
          }
          
          return null;
        }
      } else if (this._platform === 'web') {
        const valueStr = localStorage.getItem(key);
        if (!valueStr) return null;
        
        try {
          return JSON.parse(valueStr);
        } catch (e) {
          this._log('error', 'JSON parse failed', e);
          return null;
        }
      } else {
        return null;
      }
    } catch (e) {
      // 外层兜底
      this._log('error', 'StorageAdapter.load failed unexpectedly', e);
      return null;
    }
  }
  
  /**
   * 删除存储的数据
   * 
   * @param {string} key - 存储键
   * @returns {boolean} - 成功true，失败false
   */
  remove(key) {
    try {
      if (!key || typeof key !== 'string') {
        return false;
      }
      
      if (this._platform === 'wechat') {
        try {
          wx.removeStorageSync(key);
          return true;
        } catch (e) {
          this._log('error', 'wx.removeStorageSync failed', e);
          return false;
        }
      } else if (this._platform === 'web') {
        localStorage.removeItem(key);
        return true;
      } else {
        return false;
      }
    } catch (e) {
      this._log('error', 'StorageAdapter.remove failed unexpectedly', e);
      return false;
    }
  }
  
  /**
   * 统计存储中数组的元素数量（P1-004需求）
   * 
   * @param {string} key - 存储键
   * @returns {number} - 元素数量，失败返回0
   */
  count(key) {
    try {
      const data = this.load(key);
      
      if (!data) {
        return 0;
      }
      
      if (!Array.isArray(data)) {
        this._log('warn', 'count() called on non-array data', { key });
        return 0;
      }
      
      return data.length;
    } catch (e) {
      this._log('error', 'StorageAdapter.count failed unexpectedly', e);
      return 0;
    }
  }
  
  /**
   * 查询存储中的数据（P1-004需求）
   * 
   * @param {string} key - 存储键
   * @param {Object} filter - 过滤条件，支持值匹配和函数过滤
   * @returns {Array} - 查询结果数组，失败返回空数组
   * 
   * @example
   * // 值匹配
   * query('feedback_events', { rating: 'dislike' })
   * 
   * // 函数过滤
   * query('feedback_events', { timestamp: (val) => val >= 1000 })
   * 
   * // 多条件
   * query('feedback_events', { rating: 'dislike', category: 'A' })
   */
  query(key, filter = {}) {
    try {
      const data = this.load(key);
      
      if (!data) {
        return [];
      }
      
      if (!Array.isArray(data)) {
        this._log('warn', 'query() called on non-array data', { key });
        return [];
      }
      
      // 无过滤条件，返回全部
      if (!filter || Object.keys(filter).length === 0) {
        return data;
      }
      
      // 应用过滤条件
      return data.filter(item => {
        // 检查所有过滤条件
        for (const [filterKey, filterValue] of Object.entries(filter)) {
          const itemValue = item[filterKey];
          
          // 函数过滤器
          if (typeof filterValue === 'function') {
            if (!filterValue(itemValue)) {
              return false;
            }
          }
          // 值匹配
          else if (itemValue !== filterValue) {
            return false;
          }
        }
        
        return true;
      });
    } catch (e) {
      this._log('error', 'StorageAdapter.query failed unexpectedly', e);
      return [];
    }
  }
  
  /**
   * 清理旧数据（当quota exceeded时）
   * 策略：删除behavior_cache（最不重要的数据）
   * 
   * @private
   */
  _clearOldData() {
    try {
      // 简单策略：删除行为缓存
      this.remove('behavior_cache');
      this._log('info', 'Old data cleared: behavior_cache');
    } catch (e) {
      this._log('error', 'Clear old data failed', e);
    }
  }
  
  /**
   * 统一日志方法
   * 
   * @private
   * @param {string} level - 日志级别 (info/warn/error)
   * @param {string} message - 日志消息
   * @param {any} data - 附加数据
   */
  _log(level, message, data) {
    const logMessage = `[StorageAdapter] ${message}`;
    
    if (this._logger) {
      this._logger.log(level, logMessage, data);
    } else {
      // Fallback到console
      if (level === 'error') {
        console.error(logMessage, data);
      } else if (level === 'warn') {
        console.warn(logMessage, data);
      } else {
        console.log(logMessage, data);
      }
    }
  }
}

module.exports = StorageAdapter;
