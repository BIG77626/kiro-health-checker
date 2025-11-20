/**
 * 同步用户数据用例
 *
 * 负责将本地学习记录同步到云端
 */
class SyncUserDataUseCase {
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
   * 执行数据同步
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 同步结果
   */
  async execute(userId) {
    if (!userId) {
      throw new Error('UserId is required');
    }

    try {
      // 获取本地存储的学习记录
      const localRecords = await this.storageAdapter.get('localStudyRecords') || [];

      if (localRecords.length === 0) {
        return {
          success: true,
          syncedCount: 0,
          message: '没有本地数据需要同步'
        };
      }

      // 同步到云端
      const syncSuccess = await this.userRepository.syncToCloud(userId, localRecords);

      if (syncSuccess) {
        // 同步成功后清除本地记录
        await this.storageAdapter.remove('localStudyRecords');

        return {
          success: true,
          syncedCount: localRecords.length,
          message: `成功同步 ${localRecords.length} 条学习记录到云端`
        };
      } else {
        throw new Error('云端同步失败');
      }

    } catch (error) {
      console.error('SyncUserDataUseCase execute error:', error);
      throw new Error(`数据同步失败: ${error.message}`);
    }
  }
}

module.exports = SyncUserDataUseCase;
