/**
 * 清除缓存用例
 *
 * 负责清理系统缓存数据
 */
class ClearCacheUseCase {
  constructor(storageAdapter) {
    this.storageAdapter = storageAdapter;
  }

  /**
   * 执行缓存清理
   * @param {Object} options - 清理选项
   * @param {boolean} options.keepUserData - 是否保留用户数据
   * @param {boolean} options.keepSettings - 是否保留设置数据
   * @returns {Promise<Object>} 清理结果
   */
  async execute(options = {}) {
    const { keepUserData = true, keepSettings = true } = options;

    try {
      const clearedKeys = [];

      // 获取所有存储的键
      const allKeys = await this.storageAdapter.getAllKeys();

      for (const key of allKeys) {
        // 根据选项决定是否保留某些数据
        if (keepUserData && (key === 'userInfo' || key === 'openid')) {
          continue;
        }

        if (keepSettings && key.includes('setting')) {
          continue;
        }

        // 清理缓存数据
        await this.storageAdapter.remove(key);
        clearedKeys.push(key);
      }

      return {
        success: true,
        clearedCount: clearedKeys.length,
        clearedKeys: clearedKeys,
        message: `成功清理 ${clearedKeys.length} 项缓存数据`
      };

    } catch (error) {
      console.error('ClearCacheUseCase execute error:', error);
      throw new Error(`缓存清理失败: ${error.message}`);
    }
  }
}

module.exports = ClearCacheUseCase;
