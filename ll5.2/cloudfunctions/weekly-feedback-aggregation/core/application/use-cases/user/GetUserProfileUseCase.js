/**
 * 获取用户资料用例
 *
 * 负责获取用户的完整资料信息，包括基本信息和学习统计
 */
class GetUserProfileUseCase {
  constructor(userRepository, dateService) {
    if (!userRepository) {
      throw new Error('userRepository is required');
    }
    if (!dateService) {
      throw new Error('dateService is required');
    }

    this.userRepository = userRepository;
    this.dateService = dateService;
  }

  /**
   * 执行获取用户资料
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 用户资料
   */
  async execute(userId) {
    if (!userId) {
      throw new Error('UserId is required');
    }

    // 获取用户信息
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // 获取学习统计数据
    const studyStatistics = await this.userRepository.getStudyStatistics(userId);

    // 获取当前时间用于计算相对时间
    const now = this.dateService.now();

    return {
      userId: user.id,
      userInfo: user.userInfo || {},
      studyStatistics: {
        studyDays: studyStatistics.studyDays || 0,
        totalStudyTime: studyStatistics.totalStudyTime || 0,
        totalQuestions: studyStatistics.totalQuestions || 0,
        bestAccuracy: studyStatistics.bestAccuracy || 0,
        lastStudyDate: studyStatistics.lastStudyDate,
        daysSinceLastStudy: studyStatistics.lastStudyDate
          ? this.dateService.daysDiff(now, new Date(studyStatistics.lastStudyDate))
          : null
      },
      isLoggedIn: true,
      lastUpdated: now.toISOString()
    };
  }
}

module.exports = GetUserProfileUseCase;
