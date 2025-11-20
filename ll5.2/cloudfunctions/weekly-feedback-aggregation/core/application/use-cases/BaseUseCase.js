/**
 * Use Case基类
 *
 * 架构铁律合规性:
 * - ✅ A1 强制超时机制 - 所有Use Case执行都有超时保护
 * - ✅ E1 错误链 - 统一错误处理和链式传递
 * - ✅ 单一职责 - 提供基础的Use Case执行框架
 *
 * @class BaseUseCase
 */
const { withTimeout, TimeoutError } = require('../../infrastructure/utils/timeout-utils')

class BaseUseCase {
  /**
   * 构造函数
   * @param {Object} options - 配置选项
   * @param {number} options.timeout - 超时时间(毫秒)，默认30秒
   */
  constructor(options = {}) {
    this.timeout = options.timeout || 30000
    this.useCaseName = this.constructor.name
  }

  /**
   * 执行Use Case (子类必须实现)
   * @param {Object} params - 执行参数
   * @returns {Promise} - 执行结果
   */
  async execute(params = {}) {
    throw new Error(`${this.useCaseName}: execute method must be implemented by subclass`)
  }

  /**
   * 带超时保护的执行方法
   * @param {Object} params - 执行参数
   * @returns {Promise} - 执行结果
   */
  async executeWithTimeout(params = {}) {
    try {
      console.log(`[BaseUseCase] 开始执行: ${this.useCaseName}`)

      const result = await withTimeout(
        this.execute(params),
        this.timeout,
        this.useCaseName
      )

      console.log(`[BaseUseCase] 执行成功: ${this.useCaseName}`)
      return result

    } catch (error) {
      if (error instanceof TimeoutError) {
        console.error(`[BaseUseCase] 执行超时: ${this.useCaseName}, 超时时间: ${this.timeout}ms`)
        throw new Error(`${this.useCaseName} execution timeout`, { cause: error })
      }

      console.error(`[BaseUseCase] 执行失败: ${this.useCaseName}`, error)
      throw new Error(`${this.useCaseName} execution failed`, { cause: error })
    }
  }

  /**
   * 验证输入参数 (子类可重写)
   * @param {Object} params - 输入参数
   * @returns {boolean} - 验证结果
   */
  validateParams(params) {
    return true
  }

  /**
   * 创建成功响应
   * @param {Object} data - 响应数据
   * @param {Object} metadata - 元数据
   * @returns {Object} - 标准化响应
   */
  createSuccessResponse(data = null, metadata = {}) {
    return {
      success: true,
      data,
      metadata: {
        timestamp: new Date().toISOString(),
        useCase: this.useCaseName,
        ...metadata
      }
    }
  }

  /**
   * 创建错误响应
   * @param {string} message - 错误消息
   * @param {Error} cause - 原始错误
   * @param {Object} metadata - 元数据
   * @returns {Object} - 标准化错误响应
   */
  createErrorResponse(message, cause = null, metadata = {}) {
    return {
      success: false,
      error: {
        message,
        code: cause?.name || 'UNKNOWN_ERROR',
        details: cause?.message || message
      },
      metadata: {
        timestamp: new Date().toISOString(),
        useCase: this.useCaseName,
        ...metadata
      }
    }
  }
}

module.exports = BaseUseCase
