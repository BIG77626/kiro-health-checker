/**
 * UserNotFoundError - 用户不存在错误
 * 
 * Phase 2: Application 层业务错误
 * 
 * 使用场景：
 * - 通过 ID 查找用户时，用户不存在
 * - StartLearningSessionUseCase 中验证用户存在性（可选）
 * 
 * 职责：
 * - 表示用户查找失败的业务错误
 * - 提供错误详情（包含 userId）
 * 
 * 注意：
 * - Phase 2 当前实现可能不需要此错误
 * - 保留此定义以备后续扩展使用
 */
class UserNotFoundError extends Error {
  /**
   * 创建用户不存在错误
   * 
   * @param {string} userId - 未找到的用户ID
   */
  constructor(userId) {
    super(`User not found: ${userId}`)
    this.name = 'UserNotFoundError'
    this.userId = userId
  }
}

module.exports = UserNotFoundError

