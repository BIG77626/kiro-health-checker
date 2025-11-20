/**
 * 微信云适配器 (强化版)
 * 实现微信小程序云开发相关的功能
 *
 * 架构铁律 v2.0 合规：
 * - A1: 强制超时机制
 * - E1: 完整错误链
 * - B1: Unicode边界处理
 * - R1: 网络超时控制
 * - S1: 输入验证
 * - M1: Map清理策略
 */
const { addLRUCleanup } = require('../../utils/map-cleanup-utils')

class WeChatCloudAdapter {
  constructor(config = {}) {
    // 超时配置 (符合A1: 强制超时机制)
    this.DEFAULT_TIMEOUT = config.timeout || 30000  // 30秒默认超时
    this.UPLOAD_TIMEOUT = config.uploadTimeout || 120000  // 2分钟上传超时
    this.DOWNLOAD_TIMEOUT = config.downloadTimeout || 60000  // 1分钟下载超时

    // 资源管理 (符合R1: 网络超时控制和M1: Map清理策略)
    this.activeRequests = new Map()  // 跟踪活跃请求
    this.activeRequestsController = addLRUCleanup(this.activeRequests, {
      maxSize: 100,        // 最大跟踪100个活跃请求
      ttl: 5 * 60 * 1000,  // 5分钟TTL
      cleanupInterval: 60000  // 1分钟清理一次
    })

    // 边界验证配置 (符合B1: Unicode边界处理)
    this.MAX_FILE_NAME_LENGTH = 255
    this.MAX_FILE_SIZE = 10 * 1024 * 1024  // 10MB

    // 安全配置 (符合S1: 输入验证)
    this.allowedFileTypes = config.allowedFileTypes || ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
  }

  /**
   * 输入验证 (符合B1-B2: Unicode边界处理和空值显式处理)
   * @param {string} name - 云函数名称
   * @param {Object} data - 数据参数
   * @private
   */
  _validateFunctionCall(name, data) {
    const errors = []

    // 函数名验证
    if (!name || typeof name !== 'string') {
      errors.push('Function name must be a non-empty string')
    } else {
      // Unicode长度检查
      const unicodeLength = [...name].length
      if (unicodeLength > 64) {
        errors.push(`Function name too long: ${unicodeLength} > 64 characters`)
      }

      // 控制字符检查
      const controlChars = /[\x00-\x1F\x7F-\x9F]/g
      if (controlChars.test(name)) {
        errors.push('Function name contains control characters')
      }

      // 零宽字符检查
      const zeroWidthChars = /[\u200B-\u200D\uFEFF]/g
      if (zeroWidthChars.test(name)) {
        errors.push('Function name contains zero-width Unicode characters')
      }
    }

    // 数据验证
    if (data !== undefined && data !== null && typeof data !== 'object') {
      errors.push('Data must be an object, null, or undefined')
    }

    if (errors.length > 0) {
      const error = new Error(`[WeChatCloudAdapter] Validation failed: ${errors.join(', ')}`)
      error.code = 'VALIDATION_ERROR'
      error.details = errors
      throw error
    }
  }

  /**
   * 文件上传验证 (符合B1-B2和S1: 边界处理和安全验证)
   * @param {string} filePath - 文件路径
   * @param {string} cloudPath - 云端路径
   * @private
   */
  _validateFileUpload(filePath, cloudPath) {
    const errors = []

    // 文件路径验证
    if (!filePath || typeof filePath !== 'string') {
      errors.push('File path must be a non-empty string')
    }

    // 云端路径验证
    if (cloudPath && typeof cloudPath !== 'string') {
      errors.push('Cloud path must be a string if provided')
    }

    if (cloudPath) {
      // Unicode长度检查
      const unicodeLength = [...cloudPath].length
      if (unicodeLength > this.MAX_FILE_NAME_LENGTH) {
        errors.push(`Cloud path too long: ${unicodeLength} > ${this.MAX_FILE_NAME_LENGTH} characters`)
      }

      // 路径安全检查
      if (cloudPath.includes('..') || cloudPath.includes('\\')) {
        errors.push('Cloud path contains invalid characters (.. or \\)')
      }
    }

    if (errors.length > 0) {
      const error = new Error(`[WeChatCloudAdapter] File validation failed: ${errors.join(', ')}`)
      error.code = 'FILE_VALIDATION_ERROR'
      error.details = errors
      throw error
    }
  }

  /**
   * 执行带超时的异步操作 (符合A1: 强制超时机制)
   * @param {Function} operation - 要执行的操作
   * @param {number} timeout - 超时时间
   * @param {string} operationId - 操作ID
   * @returns {Promise} 操作结果
   * @private
   */
  async _executeWithTimeout(operation, timeout, operationId) {
    return new Promise((resolve, reject) => {
      const requestId = crypto.randomUUID()
      const startTime = Date.now()

      // 记录活跃请求 (符合R1: 网络超时控制)
      this.activeRequests.set(requestId, {
        operationId,
        startTime,
        timeout
      })

      // 设置超时
      const timeoutId = setTimeout(() => {
        this.activeRequests.delete(requestId)
        const error = new Error(`[WeChatCloudAdapter] Operation timeout: ${operationId} (${timeout}ms)`)
        error.code = 'TIMEOUT_ERROR'
        error.operationId = operationId
        error.elapsed = Date.now() - startTime
        reject(error)
      }, timeout)

      // 执行操作
      operation()
        .then(result => {
          clearTimeout(timeoutId)
          this.activeRequests.delete(requestId)
          resolve(result)
        })
        .catch(error => {
          clearTimeout(timeoutId)
          this.activeRequests.delete(requestId)

          // 增强错误信息 (符合E1: 完整错误链)
          const enhancedError = new Error(`[WeChatCloudAdapter] ${operationId} failed: ${error.message}`)
          enhancedError.code = error.code || 'OPERATION_ERROR'
          enhancedError.operationId = operationId
          enhancedError.originalError = error
          enhancedError.elapsed = Date.now() - startTime
          reject(enhancedError)
        })
    })
  }

  /**
   * 销毁适配器，清理资源 (符合M2: 定时器生命周期管理)
   */
  destroy() {
    // 清理活跃请求 (符合M1: Map清理策略)
    this.activeRequests.clear()

    // 清理LRU控制器 (符合M2: 定时器生命周期管理)
    if (this.activeRequestsController) {
      this.activeRequestsController.destroy()
    }
  }
  /**
   * 调用云函数 (强化版 - 符合A1/E1/B1/S1)
   * @param {string} name - 云函数名称
   * @param {Object} data - 传递给云函数的数据
   * @returns {Promise<Object>} 云函数返回结果
   */
  async callFunction(name, data = {}) {
    // 输入验证 (符合B1-B2: Unicode边界处理和空值显式处理)
    this._validateFunctionCall(name, data)

    // 带超时执行 (符合A1: 强制超时机制)
    return this._executeWithTimeout(async () => {
      const result = await wx.cloud.callFunction({
        name,
        data
      });

      // 业务逻辑错误处理 (符合E1: 完整错误链)
      if (result.result && result.result.success === false) {
        const businessError = new Error(result.result.message || '云函数业务逻辑失败')
        businessError.code = 'BUSINESS_ERROR'
        businessError.functionName = name
        businessError.result = result.result
        throw businessError
      }

      // 成功返回
      return result.result || {}
    }, this.DEFAULT_TIMEOUT, `callFunction:${name}`)
  }

  /**
   * 上传文件到云存储 (强化版 - 符合A1/E1/B1/S1)
   * @param {string} filePath - 本地文件路径
   * @param {string} cloudPath - 云端路径
   * @returns {Promise<Object>} 上传结果
   */
  async uploadFile(filePath, cloudPath = null) {
    // 文件验证 (符合B1-B2和S1: 边界处理和安全验证)
    this._validateFileUpload(filePath, cloudPath)

    // 生成安全的云端路径
    const uploadPath = cloudPath || this._generateSafeCloudPath('png')

    // 带超时执行 (符合A1: 强制超时机制)
    return this._executeWithTimeout(async () => {
      const result = await wx.cloud.uploadFile({
        cloudPath: uploadPath,
        filePath: filePath
      });

      // 验证上传结果 (符合E1: 完整错误链)
      if (!result.fileID) {
        const uploadError = new Error('文件上传失败：未获得有效的fileID')
        uploadError.code = 'UPLOAD_ERROR'
        uploadError.filePath = filePath
        uploadError.cloudPath = uploadPath
        throw uploadError
      }

      return {
        fileID: result.fileID,
        cloudPath: uploadPath,
        statusCode: result.statusCode
      };
    }, this.UPLOAD_TIMEOUT, `uploadFile:${filePath}`)
  }

  /**
   * 生成安全的云端路径 (符合S1: 输入验证)
   * @param {string} extension - 文件扩展名
   * @returns {string} 安全的云端路径
   * @private
   */
  _generateSafeCloudPath(extension = 'png') {
    const timestamp = Date.now()
    const randomId = crypto.randomUUID().substring(0, 8)
    return `uploads/${timestamp}-${randomId}.${extension}`
  }

  /**
   * 从云存储下载文件 (强化版 - 符合A1/E1/B1/S1)
   * @param {string} fileID - 云文件ID
   * @returns {Promise<Object>} 下载结果
   */
  async downloadFile(fileID) {
    // 文件ID验证 (符合B1-B2: Unicode边界处理)
    if (!fileID || typeof fileID !== 'string') {
      const error = new Error('[WeChatCloudAdapter] FileID must be a non-empty string')
      error.code = 'VALIDATION_ERROR'
      throw error
    }

    // Unicode长度检查
    const unicodeLength = [...fileID].length
    if (unicodeLength > 512) {
      const error = new Error(`[WeChatCloudAdapter] FileID too long: ${unicodeLength} > 512 characters`)
      error.code = 'VALIDATION_ERROR'
      throw error
    }

    // 带超时执行 (符合A1: 强制超时机制)
    return this._executeWithTimeout(async () => {
      const result = await wx.cloud.downloadFile({
        fileID
      });

      // 验证下载结果 (符合E1: 完整错误链)
      if (!result.tempFilePath) {
        const downloadError = new Error('文件下载失败：未获得有效的临时文件路径')
        downloadError.code = 'DOWNLOAD_ERROR'
        downloadError.fileID = fileID
        downloadError.statusCode = result.statusCode
        throw downloadError
      }

      return {
        tempFilePath: result.tempFilePath,
        statusCode: result.statusCode,
        fileID: fileID
      };
    }, this.DOWNLOAD_TIMEOUT, `downloadFile:${fileID}`)
  }

  /**
   * 删除云存储文件 (强化版 - 符合A1/E1/B1/S1)
   * @param {string[]} fileList - 要删除的文件ID列表
   * @returns {Promise<Object>} 删除结果
   */
  async deleteFile(fileList) {
    // 文件列表验证 (符合B1-B2: Unicode边界处理)
    if (!Array.isArray(fileList) || fileList.length === 0) {
      const error = new Error('[WeChatCloudAdapter] FileList must be a non-empty array')
      error.code = 'VALIDATION_ERROR'
      throw error
    }

    // 验证每个文件ID
    const errors = []
    for (let i = 0; i < fileList.length; i++) {
      const fileID = fileList[i]
      if (!fileID || typeof fileID !== 'string') {
        errors.push(`FileID at index ${i} must be a non-empty string`)
      } else {
        // Unicode长度检查
        const unicodeLength = [...fileID].length
        if (unicodeLength > 512) {
          errors.push(`FileID at index ${i} too long: ${unicodeLength} > 512 characters`)
        }
      }
    }

    if (errors.length > 0) {
      const error = new Error(`[WeChatCloudAdapter] FileList validation failed: ${errors.join(', ')}`)
      error.code = 'VALIDATION_ERROR'
      error.details = errors
      throw error
    }

    // 带超时执行 (符合A1: 强制超时机制)
    return this._executeWithTimeout(async () => {
      const result = await wx.cloud.deleteFile({
        fileList
      });

      // 分析删除结果 (符合E1: 完整错误链)
      const deletedCount = result.fileList.filter(item => item.status === 0).length
      const failedItems = result.fileList.filter(item => item.status !== 0)

      // 如果有删除失败的项目，记录但不抛出错误 (符合E2: 优雅降级)
      if (failedItems.length > 0) {
        console.warn(`[WeChatCloudAdapter] Some files failed to delete:`, failedItems)
      }

      return {
        fileList: result.fileList,
        deletedCount: deletedCount,
        failedCount: failedItems.length,
        totalCount: fileList.length
      };
    }, this.DEFAULT_TIMEOUT, `deleteFile:${fileList.length}files`)
  }
}

module.exports = WeChatCloudAdapter;
