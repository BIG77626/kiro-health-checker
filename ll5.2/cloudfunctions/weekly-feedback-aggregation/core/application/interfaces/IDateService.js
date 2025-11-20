/**
 * IDateService - 日期服务接口
 * 
 * Phase 2: Infrastructure 层抽象
 * 
 * 职责：
 * - 提供日期服务抽象，由 Infrastructure 层实现
 * - 避免 Use Case 直接使用平台 API
 * - 便于测试时 Mock 固定日期
 * 
 * 优势：
 * - Use Case 无需手动传入日期，简化调用
 * - Domain 层仍通过参数接收日期，保持纯净
 * - 测试时可轻松 Mock，支持时间旅行测试
 */
class IDateService {
  /**
   * 获取当前日期（ISO 8601 格式）
   *
   * @returns {string} 当前日期，格式：'2025-01-06T00:00:00.000Z'
   * @example
   * const currentDate = dateService.getCurrentDateISO()
   * // => '2025-01-06T12:30:45.123Z'
   */
  getCurrentDateISO() {
    throw new Error('Must implement getCurrentDateISO()')
  }

  /**
   * 获取当前时间戳（毫秒）
   *
   * @returns {number} 当前时间戳
   * @example
   * const timestamp = dateService.getCurrentTimestamp()
   * // => 1736163045123
   */
  getCurrentTimestamp() {
    throw new Error('Must implement getCurrentTimestamp()')
  }
}

module.exports = IDateService

