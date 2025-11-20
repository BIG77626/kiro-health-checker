const IDateService = require('../../application/interfaces/IDateService')

/**
 * DateServiceImpl - 日期服务实现
 * 
 * Phase 2: Infrastructure 层实现
 * 
 * 职责：
 * - 实现 IDateService 接口
 * - 提供真实的日期获取能力
 * 
 * 注意：
 * - Infrastructure 层可以使用平台 API（如 new Date()）
 * - 这是唯一允许调用 new Date() 获取当前时间的地方
 * - 测试时可以通过 Mock 替换为固定日期
 */
class DateServiceImpl extends IDateService {
  /**
   * 获取当前日期（ISO 8601 格式）
   *
   * @returns {string} 当前日期的 ISO 8601 字符串
   * @example
   * const service = new DateServiceImpl()
   * const now = service.getCurrentDateISO()
   * // => '2025-01-06T12:30:45.123Z'
   */
  getCurrentDateISO() {
    return new Date().toISOString()
  }

  /**
   * 获取当前时间戳（毫秒）
   *
   * @returns {number} 当前时间戳
   * @example
   * const service = new DateServiceImpl()
   * const timestamp = service.getCurrentTimestamp()
   * // => 1736163045123
   */
  getCurrentTimestamp() {
    return Date.now()
  }
}

module.exports = DateServiceImpl

