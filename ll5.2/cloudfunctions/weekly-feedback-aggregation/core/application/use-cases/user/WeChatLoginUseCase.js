/**
 * 微信登录用例
 *
 * 处理微信小程序的用户登录流程
 */
class WeChatLoginUseCase {
  constructor(userRepository, cloudAdapter) {
    if (!userRepository) {
      throw new Error('userRepository is required');
    }
    if (!cloudAdapter) {
      throw new Error('cloudAdapter is required');
    }

    this.userRepository = userRepository;
    this.cloudAdapter = cloudAdapter;
  }

  /**
   * 执行微信登录
   * @param {Object} params - 登录参数
   * @param {Object} params.userProfile - 用户授权信息
   * @param {string} params.loginCode - 微信登录凭证
   * @returns {Promise<Object>} 登录结果
   */
  async execute({ userProfile, loginCode }) {
    if (!userProfile || !loginCode) {
      throw new Error('用户授权信息和登录凭证都是必需的');
    }

    try {
      // 1. 调用云函数进行登录
      const loginResult = await this.cloudAdapter.callFunction('login', {
        code: loginCode,
        userInfo: userProfile.userInfo
      });

      if (!loginResult.success) {
        throw new Error(loginResult.message || '云函数调用失败');
      }

      const { userInfo, openid, sessionKey } = loginResult.data;

      // 2. 构建完整的用户信息
      const fullUserInfo = {
        ...userInfo,
        openid,
        sessionKey,
        loginTime: new Date().toISOString()
      };

      // 3. 保存到仓储（如果需要本地缓存）
      // 注意：这里可能不需要立即保存到仓储，取决于业务需求

      return {
        success: true,
        userInfo: fullUserInfo,
        openid,
        message: '登录成功'
      };

    } catch (error) {
      console.error('WeChatLoginUseCase execute error:', error);
      throw new Error(`微信登录失败: ${error.message}`);
    }
  }
}

module.exports = WeChatLoginUseCase;
