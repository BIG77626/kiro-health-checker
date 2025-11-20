/**
 * 获取练习统计用例
 * 获取用户的练习统计数据
 */
class GetPracticeStatisticsUseCase {
  constructor(practiceRepository) {
    if (!practiceRepository) {
      throw new Error('practiceRepository is required');
    }
    this.practiceRepository = practiceRepository;
  }

  /**
   * 执行获取练习统计
   * @param {Object} params - 参数
   * @param {string} params.userId - 用户ID
   * @param {string} params.paperId - 试卷ID（可选）
   * @returns {Promise<Object>} 统计数据
   */
  async execute({ userId, paperId = null }) {
    if (!userId) {
      throw new Error('User ID is required');
    }

    try {
      const stats = await this.practiceRepository.getPracticeStatistics(userId, paperId);

      return {
        totalPractices: stats.totalPractices || 0,
        totalQuestions: stats.totalQuestions || 0,
        totalCorrect: stats.totalCorrect || 0,
        averageAccuracy: stats.averageAccuracy || 0,
        totalTimeSpent: stats.totalTimeSpent || 0,
        practiceHistory: stats.practiceHistory || [],
        weakPoints: stats.weakPoints || [],
        improvementTrend: stats.improvementTrend || []
      };
    } catch (error) {
      console.error('GetPracticeStatisticsUseCase execute error:', error);
      throw new Error(`获取练习统计失败: ${error.message}`);
    }
  }
}

module.exports = GetPracticeStatisticsUseCase;
