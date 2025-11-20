/**
 * 平台适配层
 * 解决不同运行环境（微信小程序/Node.js/浏览器）的API差异
 * 
 * 问题背景：
 * - 微信小程序不支持 fetch 和 process.env
 * - 需要使用 wx.request 替代 fetch
 * - 需要使用配置服务替代 process.env
 * 
 * @class PlatformAdapter
 */
class PlatformAdapter {
  /**
   * 检测运行环境
   * @returns {Object} 环境信息
   */
  static detectEnvironment() {
    const env = {
      isWeChatMiniProgram: false,
      isNodeJS: false,
      isBrowser: false,
      platform: 'unknown'
    }

    // 检测微信小程序环境
    if (typeof wx !== 'undefined' && wx.request) {
      env.isWeChatMiniProgram = true
      env.platform = 'wechat'
    }
    // 检测Node.js环境
    else if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      env.isNodeJS = true
      env.platform = 'nodejs'
    }
    // 检测浏览器环境
    else if (typeof window !== 'undefined') {
      env.isBrowser = true
      env.platform = 'browser'
    }

    return env
  }

  /**
   * 判断是否为微信小程序环境
   * @returns {boolean}
   */
  static isWeChatMiniProgram() {
    return this.detectEnvironment().isWeChatMiniProgram
  }

  /**
   * 判断是否为Node.js环境
   * @returns {boolean}
   */
  static isNodeJS() {
    return this.detectEnvironment().isNodeJS
  }

  /**
   * 判断是否为浏览器环境
   * @returns {boolean}
   */
  static isBrowser() {
    return this.detectEnvironment().isBrowser
  }

  /**
   * 统一的HTTP请求方法
   * 根据运行环境自动选择对应的实现
   * 
   * @param {string} url - 请求URL
   * @param {Object} options - 请求选项
   * @param {string} options.method - HTTP方法（GET/POST等）
   * @param {Object} options.headers - 请求头
   * @param {Object|string} options.body - 请求体
   * @returns {Promise<Object>} 响应对象
   */
  static async request(url, options = {}) {
    const env = this.detectEnvironment()

    if (env.isWeChatMiniProgram) {
      return this._wxRequest(url, options)
    } else if (env.isNodeJS) {
      return this._nodeFetch(url, options)
    } else if (env.isBrowser) {
      return this._browserFetch(url, options)
    } else {
      throw new Error('Unsupported platform environment')
    }
  }

  /**
   * 微信小程序环境下的请求实现
   * @private
   */
  static _wxRequest(url, options) {
    return new Promise((resolve, reject) => {
      wx.request({
        url: url,
        method: options.method || 'GET',
        header: options.headers || {},
        data: typeof options.body === 'string' 
          ? JSON.parse(options.body) 
          : options.body,
        success: (res) => {
          // 将微信小程序的响应格式转换为标准格式
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusCode === 200 ? 'OK' : 'Error',
            json: async () => res.data,
            text: async () => JSON.stringify(res.data)
          })
        },
        fail: (err) => {
          reject(new Error(`Request failed: ${err.errMsg || JSON.stringify(err)}`))
        }
      })
    })
  }

  /**
   * Node.js环境下的请求实现
   * @private
   */
  static async _nodeFetch(url, options) {
    // 动态导入node-fetch（仅在Node.js环境）
    const fetch = require('node-fetch')
    return fetch(url, options)
  }

  /**
   * 浏览器环境下的请求实现
   * @private
   */
  static async _browserFetch(url, options) {
    // 使用浏览器原生fetch
    return fetch(url, options)
  }

  /**
   * 获取环境变量或配置值
   * 根据运行环境自动选择对应的配置源
   * 
   * @param {string} key - 配置键名
   * @param {string} defaultValue - 默认值
   * @returns {string} 配置值
   */
  static getConfig(key, defaultValue = '') {
    const env = this.detectEnvironment()

    if (env.isWeChatMiniProgram) {
      // 微信小程序环境：从全局配置或云函数环境变量获取
      // 注意：密钥不应存储在客户端，应通过云函数获取
      const app = getApp()
      if (app && app.globalData && app.globalData.config) {
        return app.globalData.config[key] || defaultValue
      }
      // 如果全局配置不存在，返回默认值（密钥应通过云函数获取）
      console.warn(`[PlatformAdapter] 配置 ${key} 未找到，使用默认值。密钥应通过云函数获取。`)
      return defaultValue
    } else if (env.isNodeJS) {
      // Node.js环境：从process.env获取
      return process.env[key] || defaultValue
    } else if (env.isBrowser) {
      // 浏览器环境：从window.env或全局配置获取
      if (typeof window !== 'undefined' && window.env) {
        return window.env[key] || defaultValue
      }
      return defaultValue
    }

    return defaultValue
  }

  /**
   * 警告：不应在客户端使用此方法获取敏感配置（如API密钥）
   * 敏感配置应通过服务端/云函数获取
   * 
   * @param {string} key - 配置键名
   * @returns {string} 配置值
   * @deprecated 敏感配置应通过服务端获取
   */
  static getSecureConfig(key) {
    console.warn(`[PlatformAdapter] getSecureConfig已废弃。敏感配置（如${key}）应通过服务端/云函数获取。`)
    return this.getConfig(key, '')
  }
}

module.exports = PlatformAdapter

