/**
 * 获取学习统计用例
 *
 * 专门负责计算和返回用户的学习统计数据
 */
class GetStudyStatisticsUseCase {
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
   * 执行获取学习统计
   * @param {string} userId - 用户ID
   * @returns {Promise<Object>} 学习统计数据
   */
  async execute(userId) {
    if (!userId) {
      throw new Error('UserId is required');
    }

    // 从仓储获取统计数据
    const statistics = await this.userRepository.getStudyStatistics(userId);

    // 确保返回完整的统计对象
    return {
      studyDays: statistics.studyDays || 0,
      totalStudyTime: statistics.totalStudyTime || 0, // 单位：小时
      totalQuestions: statistics.totalQuestions || 0,
      bestAccuracy: statistics.bestAccuracy || 0, // 百分比
      lastStudyDate: statistics.lastStudyDate,
      averageAccuracy: statistics.averageAccuracy || 0,
      studyStreak: statistics.studyStreak || 0, // 连续学习天数
      weeklyProgress: statistics.weeklyProgress || [], // 最近7天进度
      monthlyProgress: statistics.monthlyProgress || [], // 最近30天进度
      strongestSubject: statistics.strongestSubject,
      weakestSubject: statistics.weakestSubject
    };
  }
}

module.exports = GetStudyStatisticsUseCase;
