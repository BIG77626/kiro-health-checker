/**
 * 用户登出用例
 *
 * 处理用户登出逻辑，包括清理本地数据
 */
class LogoutUserUseCase {
  constructor(userRepository, storageAdapter) {
    if (!userRepository) {
      throw new Error('userRepository is required');
    }
    if (!storageAdapter) {
      throw new Error('storageAdapter is required');
    }

    this.userRepository = userRepository;
    this.storageAdapter = storageAdapter;
  }

  /**
   * 执行用户登出
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 登出结果
   */
  async execute(userId) {
    if (!userId) {
      throw new Error('UserId is required');
    }

    try {
      // 清理本地用户数据
      await this.storageAdapter.remove('userInfo');
      await this.storageAdapter.remove('openid');
      await this.storageAdapter.remove('localStudyRecords');

      // 可以在这里添加其他清理逻辑，比如撤销用户相关的缓存

      return {
        success: true,
        message: '用户已成功登出'
      };
    } catch (error) {
      console.error('LogoutUserUseCase execute error:', error);
      throw new Error('登出过程中发生错误');
    }
  }
}

module.exports = LogoutUserUseCase;
