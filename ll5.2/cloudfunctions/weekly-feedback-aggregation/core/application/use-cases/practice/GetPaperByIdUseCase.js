/**
 * 获取试卷用例
 * 根据ID获取指定的试卷数据
 */
class GetPaperByIdUseCase {
  constructor(practiceRepository) {
    if (!practiceRepository) {
      throw new Error('practiceRepository is required');
    }
    this.practiceRepository = practiceRepository;
  }

  /**
   * 执行获取试卷
   * @param {string} paperId - 试卷ID
   * @returns {Promise<Object|null>} 试卷数据或null
   */
  async execute(paperId) {
    if (!paperId) {
      throw new Error('Paper ID is required');
    }

    try {
      const paper = await this.practiceRepository.getPaperById(paperId);

      if (!paper) {
        return null;
      }

      // 标准化试卷数据结构
      return {
        id: paper.id,
        title: paper.title,
        type: paper.type,
        questions: paper.questions || [],
        passages: paper.passages || [],
        totalQuestions: paper.questions?.length || 0,
        estimatedTime: paper.estimatedTime || 0,
        difficulty: paper.difficulty || 'normal'
      };
    } catch (error) {
      console.error('GetPaperByIdUseCase execute error:', error);
      throw new Error(`获取试卷失败: ${error.message}`);
    }
  }
}

module.exports = GetPaperByIdUseCase;
