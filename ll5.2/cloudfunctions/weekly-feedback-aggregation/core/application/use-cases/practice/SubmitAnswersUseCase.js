/**
 * 提交答案用例
 * 提交整个试卷的答案并计算结果
 */
class SubmitAnswersUseCase {
  constructor(practiceRepository) {
    if (!practiceRepository) {
      throw new Error('practiceRepository is required');
    }
    this.practiceRepository = practiceRepository;
  }

  /**
   * 执行提交答案
   * @param {Object} params - 参数
   * @param {string} params.userId - 用户ID
   * @param {string} params.paperId - 试卷ID
   * @param {Object} params.userAnswers - 用户答案对象
   * @param {number} params.totalTimeSpent - 总答题时间
   * @returns {Promise<Object>} 提交结果
   */
  async execute({ userId, paperId, userAnswers, totalTimeSpent }) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!paperId) {
      throw new Error('Paper ID is required');
    }
    if (!userAnswers) {
      throw new Error('User answers are required');
    }

    try {
      // 获取试卷数据以计算正确率
      const paper = await this.practiceRepository.getPaperById(paperId);
      if (!paper) {
        throw new Error('Paper not found');
      }

      // 计算答题统计
      const stats = this.calculateStatistics(paper.questions, userAnswers);

      // 创建练习记录
      const practiceRecord = {
        userId,
        paperId,
        userAnswers,
        statistics: stats,
        totalTimeSpent,
        submittedAt: new Date().toISOString(),
        status: 'completed'
      };

      // 保存练习记录
      const saveSuccess = await this.practiceRepository.savePracticeRecord(userId, practiceRecord);

      if (!saveSuccess) {
        throw new Error('Failed to save practice record');
      }

      // 清除练习进度
      await this.practiceRepository.clearPracticeProgress(userId, paperId);

      return {
        success: true,
        statistics: stats,
        recordId: practiceRecord.submittedAt, // 临时使用提交时间作为记录ID
        message: '答案提交成功'
      };
    } catch (error) {
      console.error('SubmitAnswersUseCase execute error:', error);
      throw new Error(`提交答案失败: ${error.message}`);
    }
  }

  /**
   * 计算答题统计
   * @param {Array} questions - 题目列表
   * @param {Object} userAnswers - 用户答案
   * @returns {Object} 统计结果
   */
  calculateStatistics(questions, userAnswers) {
    const total = questions.length;
    let correct = 0;
    let answered = 0;

    questions.forEach(question => {
      const userAnswer = userAnswers[question.id];
      if (userAnswer !== undefined && userAnswer !== null && userAnswer !== '' &&
          (userAnswer.answer !== undefined && userAnswer.answer !== null && userAnswer.answer !== '')) {
        answered++;
        // 这里需要根据题目类型判断是否正确
        // 简化为字符串比较，实际应该更复杂
        if (this.isAnswerCorrect(question, userAnswer.answer || userAnswer)) {
          correct++;
        }
      }
    });

    return {
      total,
      answered,
      correct,
      accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0
    };
  }

  /**
   * 判断答案是否正确
   * @param {Object} question - 题目
   * @param {any} userAnswer - 用户答案
   * @returns {boolean} 是否正确
   */
  isAnswerCorrect(question, userAnswer) {
    // 简化的正确性判断逻辑
    // 实际应该根据题目类型进行不同的判断
    const correctAnswer = question.correctAnswer || question.answer;

    if (Array.isArray(correctAnswer)) {
      // 多选题
      return Array.isArray(userAnswer) &&
             correctAnswer.length === userAnswer.length &&
             correctAnswer.every(ans => userAnswer.includes(ans));
    } else {
      // 单选题或文本题 - 大小写敏感
      return String(correctAnswer) === String(userAnswer);
    }
  }
}

module.exports = SubmitAnswersUseCase;
