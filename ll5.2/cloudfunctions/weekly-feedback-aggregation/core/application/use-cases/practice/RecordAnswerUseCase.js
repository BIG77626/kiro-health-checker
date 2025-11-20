/**
 * 记录答案用例
 * 记录用户对单个题目的答案
 */
class RecordAnswerUseCase {
  constructor(practiceRepository) {
    if (!practiceRepository) {
      throw new Error('practiceRepository is required');
    }
    this.practiceRepository = practiceRepository;
  }

  /**
   * 执行记录答案
   * @param {Object} params - 参数
   * @param {string} params.userId - 用户ID
   * @param {string} params.paperId - 试卷ID
   * @param {string|number} params.questionId - 题目ID
   * @param {any} params.answer - 用户答案
   * @param {number} params.timeSpent - 答题耗时(毫秒)
   * @returns {Promise<boolean>} 记录是否成功
   */
  async execute({ userId, paperId, questionId, answer, timeSpent = 0 }) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!paperId) {
      throw new Error('Paper ID is required');
    }
    if (!questionId) {
      throw new Error('Question ID is required');
    }

    try {
      const answerRecord = {
        questionId,
        answer,
        timeSpent,
        timestamp: new Date().toISOString()
      };

      // 更新练习进度
      const progress = await this.practiceRepository.getPracticeProgress(userId, paperId);
      const currentProgress = progress || {};
      const currentAnswers = currentProgress.userAnswers || {};
      const updatedProgress = {
        ...currentProgress,
        userAnswers: {
          ...currentAnswers,
          [questionId]: answerRecord
        },
        lastUpdateTime: new Date().toISOString()
      };

      const success = await this.practiceRepository.updatePracticeProgress(userId, paperId, updatedProgress);

      return success;
    } catch (error) {
      console.error('RecordAnswerUseCase execute error:', error);
      throw new Error(`记录答案失败: ${error.message}`);
    }
  }
}

module.exports = RecordAnswerUseCase;
