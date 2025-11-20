/**
 * 用户登录用例 - 本地版本
 * 
 * Phase 1: 使用 email/password 登录，完全本地，无云端依赖
 * 
 * 职责：
 * 1. 接收 email/password
 * 2. 调用 IUserRepository.findByEmail()
 * 3. 验证密码
 * 4. 返回 user 或 error
 */
class LoginUserUseCase {
  /**
   * @param {IUserRepository} userRepository - 用户仓储（由DI容器注入）
   */
  constructor(userRepository) {
    this.userRepository = userRepository
  }

  /**
   * 执行登录
   * @param {Object} params - 登录参数
   * @param {string} params.email - 邮箱
   * @param {string} params.password - 密码
   * @returns {Promise<Object>} { success: boolean, user?: Object, error?: string }
   * 
   * @example
   * const result = await loginUserUseCase.execute({
   *   email: 'test@example.com',
   *   password: '123456'
   * })
   * 
   * if (result.success) {
   *   console.log('登录成功:', result.user.id)
   * } else {
   *   console.error('登录失败:', result.error)
   * }
   */
  async execute({ email, password }) {
    try {
      // 1. 验证输入
      if (!email || !email.includes('@')) {
        return {
          success: false,
          error: '请输入有效的邮箱地址'
        }
      }

      if (!password || password.length < 6) {
        return {
          success: false,
          error: '密码至少6个字符'
        }
      }

      // 2. 调用 Repository 查找用户
      const user = await this.userRepository.findByEmail(email)

      if (!user) {
        return {
          success: false,
          error: '用户不存在，请先注册'
        }
      }

      // 3. 验证密码
      const isPasswordValid = user.verifyPassword(password)

      if (!isPasswordValid) {
        return {
          success: false,
          error: '密码错误'
        }
      }

      // 4. 登录成功，返回用户信息（不返回密码）
      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          nickname: user.nickname,
          avatar: user.avatar
        },
        message: '登录成功'
      }
    } catch (error) {
      console.error('[LoginUserUseCase] Error:', error)
      return {
        success: false,
        error: '登录失败，请重试'
      }
    }
  }
}

module.exports = LoginUserUseCase
