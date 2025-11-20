/**
 * NetworkAdapter - 微信小程序网络请求封装
 * 
 * 位置: Adapter层（唯一可以直接调用 wx.request 的层）
 * 职责: 封装 wx.request API，隔离平台依赖
 * 
 * Iron Laws:
 * - 这是唯一可以调用 wx.request 的地方
 * - upload() 失败时抛异常（与 StorageAdapter 不同！）
 * - checkNetwork() 不抛异常，返回安全默认值
 * 
 * WECHAT-LIMITS 约束:
 * - 并发请求限制: 最多10个
 * - 超时设置: 默认 10s（避免无限等待）
 * - 请求数据大小: 建议 < 1MB（batch size 控制）
 */

class NetworkAdapter {
  /**
   * 构造函数
   * 
   * @param {string} baseURL - API基础地址
   * @param {Object} options - 可选配置
   * @param {number} options.timeout - 超时时间（毫秒），默认 10000
   * @param {Object} options.headers - 请求头，默认 {}
   * 
   * @example
   * const uploader = new NetworkAdapter('https://api.example.com', {
   *   timeout: 10000,
   *   headers: { 'Content-Type': 'application/json' }
   * })
   */
  constructor(baseURL, options = {}) {
    this._baseURL = baseURL
    this._timeout = options.timeout || 10000  // 默认10s超时
    this._headers = options.headers || {}
    
    // 日志函数
    this._log = console.log.bind(console, '[NetworkAdapter]')
  }

  /**
   * 上传数据（POST请求）
   * 
   * @param {string} endpoint - 端点路径（如 'behavior_events'）
   * @param {any} data - 要上传的数据
   * @returns {Promise<{success: boolean, message?: string}>}
   * 
   * @throws {Error} 网络失败、超时、4xx/5xx 错误
   * 
   * @example
   * try {
   *   const result = await uploader.upload('behavior_events', batch)
   *   console.log('Upload success:', result)
   * } catch (err) {
   *   console.error('Upload failed:', err)
   *   // Fallback to offline storage
   * }
   */
  async upload(endpoint, data) {
    const url = `${this._baseURL}/${endpoint}`
    
    this._log(`Uploading to ${url}...`)
    
    return new Promise((resolve, reject) => {
      wx.request({
        url: url,
        method: 'POST',
        data: data,
        timeout: this._timeout,
        header: {
          'Content-Type': 'application/json',
          ...this._headers
        },
        success: (res) => {
          // 检查 HTTP 状态码
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // 2xx 成功
            this._log(`Upload success: ${res.statusCode}`)
            resolve({
              success: true,
              message: res.data?.message || 'Upload successful',
              statusCode: res.statusCode
            })
          } else if (res.statusCode >= 400 && res.statusCode < 500) {
            // 4xx 客户端错误
            this._log(`Upload failed: ${res.statusCode} (Client Error)`)
            reject(new Error(`Client error: ${res.statusCode} - ${res.data?.message || 'Bad request'}`))
          } else if (res.statusCode >= 500) {
            // 5xx 服务器错误
            this._log(`Upload failed: ${res.statusCode} (Server Error)`)
            reject(new Error(`Server error: ${res.statusCode} - ${res.data?.message || 'Internal server error'}`))
          } else {
            // 其他状态码
            this._log(`Upload failed: ${res.statusCode} (Unknown)`)
            reject(new Error(`Unexpected status code: ${res.statusCode}`))
          }
        },
        fail: (err) => {
          // 网络失败、超时等
          this._log(`Upload failed (network):`, err.errMsg)
          
          // 区分超时和其他网络错误
          if (err.errMsg && err.errMsg.includes('timeout')) {
            reject(new Error(`Upload timeout after ${this._timeout}ms`))
          } else if (err.errMsg && err.errMsg.includes('fail')) {
            reject(new Error(`Network error: ${err.errMsg}`))
          } else {
            reject(new Error(`Upload failed: ${err.errMsg || 'Unknown error'}`))
          }
        }
      })
    })
  }

  /**
   * 检查网络状态
   * 用于重试前判断是否有网络连接
   * 
   * @returns {Promise<{isConnected: boolean, networkType: string}>}
   * 
   * @example
   * const network = await uploader.checkNetwork()
   * if (!network.isConnected) {
   *   console.log('No network, skip retry')
   * }
   */
  async checkNetwork() {
    try {
      return await new Promise((resolve, reject) => {
        wx.getNetworkType({
          success: (res) => {
            // networkType: wifi, 2g, 3g, 4g, 5g, unknown, none
            const networkType = res.networkType
            const isConnected = networkType !== 'none' && networkType !== 'unknown'
            
            this._log(`Network status: ${networkType} (connected: ${isConnected})`)
            
            resolve({
              isConnected: isConnected,
              networkType: networkType
            })
          },
          fail: (err) => {
            // 失败时返回安全默认值，不抛异常
            this._log('checkNetwork failed:', err)
            resolve({
              isConnected: false,
              networkType: 'unknown'
            })
          }
        })
      })
    } catch (e) {
      // Silent fail - 返回安全默认值
      this._log('checkNetwork failed (sync):', e)
      return {
        isConnected: false,
        networkType: 'unknown'
      }
    }
  }

  /**
   * 获取当前配置（用于调试）
   * 
   * @returns {Object}
   */
  getConfig() {
    return {
      baseURL: this._baseURL,
      timeout: this._timeout,
      headers: this._headers
    }
  }
}

module.exports = NetworkAdapter
