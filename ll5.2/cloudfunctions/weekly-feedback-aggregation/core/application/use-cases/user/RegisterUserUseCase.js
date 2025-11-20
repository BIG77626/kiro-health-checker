/**
 * 用户注册用例 - 本地版本
 * 
 * Phase 1: 使用 email/password 注册，完全本地
 * 
 * 职责：
 * 1. 接收 email/password/nickname
 * 2. 检查邮箱是否已存在
 * 3. 创建新用户并保存
 */
class RegisterUserUseCase {
  /**
   * @param {IUserRepository} userRepository - 用户仓储
   */
  constructor(userRepository) {
    this.userRepository = userRepository
  }

  /**
   * 执行注册
   * @param {Object} params
   * @param {string} params.email - 邮箱
   * @param {string} params.password - 密码
   * @param {string} params.nickname - 昵称
   * @returns {Promise<Object>}
   */
  async execute({ email, password, nickname }) {
    try {
      // 1. 验证输入
      if (!email || !email.includes('@')) {
        return { success: false, error: '请输入有效的邮箱地址' }
      }

      if (!password || password.length < 6) {
        return { success: false, error: '密码至少6个字符' }
      }

      if (!nickname || nickname.trim() === '') {
        return { success: false, error: '请输入昵称' }
      }

      // 2. 检查邮箱是否已存在
      const existingUser = await this.userRepository.findByEmail(email)
      if (existingUser) {
        return { success: false, error: '该邮箱已注册' }
      }

      // 3. 创建用户实体
      const User = require('../../../domain/entities/User')
      const user = new User({
        email,
        nickname: nickname.trim()
      })

      // 4. 设置密码（会自动哈希）
      user.setPassword(password)

      // 5. 保存到仓储
      await this.userRepository.save(user)

      // 6. 返回成功（不返回密码）
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname
        },
        message: '注册成功'
      }
    } catch (error) {
      console.error('[RegisterUserUseCase] Error:', error)
      return {
        success: false,
        error: error.message || '注册失败'
      }
    }
  }
}

module.exports = RegisterUserUseCase

