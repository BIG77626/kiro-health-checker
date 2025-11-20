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
 * UploaderAdapter - 微信小程序网络上传适配器
 * 
 * 职责：
 * - 封装 wx.request
 * - 隔离平台API，提供统一接口
 * - Silent fail，永不向上抛异常
 * - 处理网络超时、重试
 * 
 * Iron Laws (P1-001 + clean-architecture):
 * - ONLY THIS FILE CAN USE wx.request
 * - NO THROWING EXCEPTIONS TO CALLER
 * - PROVIDE FALLBACK FOR ALL FAILURES
 * 
 * 失败场景清单:
 * - [ ] wx.request 超时(>30s) → 重试3次，间隔2s
 * - [ ] wx.request 5xx错误 → 记录日志，返回false
 * - [ ] wx.request 4xx错误 → 不重试，返回false
 * - [ ] wx.request 网络断开 → 返回false，记录日志
 * - [ ] wx.request DNS解析失败 → 返回false
 * - [ ] url为null/undefined → 返回false
 * - [ ] data为null → 使用空数组
 * - [ ] wx未定义(非小程序环境) → 使用fetch fallback
 * 
 * 期望行为：所有失败都silent fail，不crash，有日志
 * 
 * @see .claude/skills/quick-refs/P1-001-BEHAVIOR-TRACKER.md
 * @see .claude/skills/quick-refs/CLEAN-ARCHITECTURE-CHECKLIST.md
 */

class UploaderAdapter {
  constructor(config, logger) {
    this._config = this._validateConfig(config);
    this._logger = logger; // 可选的日志器
    this._platform = this._detectPlatform();
  }
  
  /**
   * 验证和规范化配置
   * @private
   */
  _validateConfig(config) {
    const defaults = {
      baseUrl: '',
      timeout: 30000,
      maxRetries: 3,
      retryDelay: 2000
    };
    
    if (!config) return defaults;
    
    // 防御性边界检查
    return {
      baseUrl: config.baseUrl || defaults.baseUrl,
      timeout: Math.max(5000, Math.min(config.timeout || defaults.timeout, 60000)),
      maxRetries: Math.max(0, Math.min(config.maxRetries || defaults.maxRetries, 5)),
      retryDelay: Math.max(1000, Math.min(config.retryDelay || defaults.retryDelay, 10000))
    };
  }
  
  /**
   * 检测运行平台
   * @private
   */
  _detectPlatform() {
    if (typeof wx !== 'undefined' && wx.request) {
      return 'wechat';
    }
    if (typeof fetch !== 'undefined') {
      return 'web';
    }
    return 'none';
  }
  
  /**
   * 上传事件数据
   * 
   * @param {Array} events - 事件数组
   * @returns {Promise<boolean>} - 成功true，失败false
   */
  async upload(events) {
    try {
      // 边界检查：events
      if (!events || !Array.isArray(events)) {
        this._log('error', 'Invalid events', { events });
        return false;
      }
      
      if (events.length === 0) {
        this._log('info', 'No events to upload');
        return true; // 空数组视为成功
      }
      
      // 边界检查：配置
      if (!this._config.baseUrl) {
        this._log('error', 'No baseUrl configured');
        return false;
      }
      
      // 构建请求
      const url = `${this._config.baseUrl}/api/behavior/upload`;
      const data = {
        events,
        timestamp: Date.now(),
        clientId: this._getClientId()
      };
      
      // 带重试的上传
      const result = await this._uploadWithRetry(url, data, this._config.maxRetries);
      
      return result;
    } catch (e) {
      // 外层兜底 - Silent fail
      this._log('error', 'UploaderAdapter.upload failed unexpectedly', e);
      return false;
    }
  }
  
  /**
   * 带重试的上传
   * 
   * @private
   * @param {string} url - 请求URL
   * @param {Object} data - 请求数据
   * @param {number} retriesLeft - 剩余重试次数
   * @returns {Promise<boolean>}
   */
  async _uploadWithRetry(url, data, retriesLeft) {
    try {
      if (this._platform === 'wechat') {
        return await this._uploadWechat(url, data);
      } else if (this._platform === 'web') {
        return await this._uploadWeb(url, data);
      } else {
        this._log('error', 'No upload platform available');
        return false;
      }
    } catch (e) {
      // 判断是否需要重试
      const shouldRetry = this._shouldRetry(e, retriesLeft);
      
      if (shouldRetry) {
        this._log('warn', `Upload failed, retrying (${retriesLeft} left)`, e);
        
        // 等待后重试
        await this._sleep(this._config.retryDelay);
        return await this._uploadWithRetry(url, data, retriesLeft - 1);
      } else {
        this._log('error', 'Upload failed, no retries left', e);
        return false;
      }
    }
  }
  
  /**
   * 微信小程序上传
   * 
   * @private
   * @param {string} url - 请求URL
   * @param {Object} data - 请求数据
   * @returns {Promise<boolean>}
   */
  _uploadWechat(url, data) {
    return new Promise((resolve) => {
      try {
        wx.request({
          url,
          method: 'POST',
          data,
          timeout: this._config.timeout,
          header: {
            'Content-Type': 'application/json'
          },
          success: (res) => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              this._log('info', 'Upload success', { statusCode: res.statusCode });
              resolve(true);
            } else if (res.statusCode >= 500) {
              // 5xx错误，可重试
              this._log('error', '5xx server error', { statusCode: res.statusCode });
              const error = new Error(`Server error: ${res.statusCode}`);
              error.statusCode = res.statusCode;
              error.retryable = true;
              throw error;
            } else {
              // 4xx错误，不重试
              this._log('error', '4xx client error', { statusCode: res.statusCode });
              resolve(false);
            }
          },
          fail: (err) => {
            this._log('error', 'wx.request failed', err);
            
            // 判断错误类型
            const error = new Error(err.errMsg || 'Network error');
            
            // 超时、网络断开等可重试
            if (err.errMsg && (
              err.errMsg.includes('timeout') ||
              err.errMsg.includes('fail') ||
              err.errMsg.includes('network')
            )) {
              error.retryable = true;
            } else {
              error.retryable = false;
            }
            
            throw error;
          }
        });
      } catch (e) {
        this._log('error', 'wx.request exception', e);
        resolve(false);
      }
    });
  }
  
  /**
   * Web环境上传 (fallback)
   * 
   * @private
   * @param {string} url - 请求URL
   * @param {Object} data - 请求数据
   * @returns {Promise<boolean>}
   */
  async _uploadWeb(url, data) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this._config.timeout);
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        this._log('info', 'Upload success (web)', { status: response.status });
        return true;
      } else if (response.status >= 500) {
        // 5xx可重试
        const error = new Error(`Server error: ${response.status}`);
        error.statusCode = response.status;
        error.retryable = true;
        throw error;
      } else {
        // 4xx不重试
        this._log('error', '4xx error (web)', { status: response.status });
        return false;
      }
    } catch (e) {
      if (e.name === 'AbortError') {
        // 超时，可重试
        const error = new Error('Request timeout');
        error.retryable = true;
        throw error;
      }
      
      // 其他网络错误，可重试
      e.retryable = true;
      throw e;
    }
  }
  
  /**
   * 判断是否应该重试
   * 
   * @private
   * @param {Error} error - 错误对象
   * @param {number} retriesLeft - 剩余重试次数
   * @returns {boolean}
   */
  _shouldRetry(error, retriesLeft) {
    if (retriesLeft <= 0) {
      return false;
    }
    
    // 只有标记为retryable的错误才重试
    return error.retryable === true;
  }
  
  /**
   * 获取客户端ID（用于标识设备）
   * 
   * @private
   * @returns {string}
   */
  _getClientId() {
    try {
      if (this._platform === 'wechat') {
        // 使用微信的唯一标识
        // 实际项目中应该从登录信息获取
        return 'wechat_client_' + Date.now();
      } else {
        return 'web_client_' + Date.now();
      }
    } catch (e) {
      return 'unknown_client';
    }
  }
  
  /**
   * 睡眠工具函数
   * 
   * @private
   * @param {number} ms - 睡眠毫秒数
   * @returns {Promise<void>}
   */
  _sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
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
    const logMessage = `[UploaderAdapter] ${message}`;
    
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

module.exports = UploaderAdapter;
