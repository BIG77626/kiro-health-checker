const IPracticeRepository = require('../../application/interfaces/IPracticeRepository');

/**
 * 练习仓储实现
 * 实现练习相关数据的存储和访问
 */
class PracticeRepositoryImpl extends IPracticeRepository {
  constructor(storageAdapter) {
    super();
    if (!storageAdapter) {
      throw new Error('storageAdapter is required');
    }
    this.storageAdapter = storageAdapter;

    // 示例试卷数据
    this.samplePapers = {
      'sample-reading-001': {
        id: 'sample-reading-001',
        title: '考研英语阅读理解专项练习',
        type: 'reading',
        questions: [
          {
            id: 'q1',
            type: 'reading',
            passage: 'The concept of sustainable development has become increasingly important...',
            question: 'What is the main idea of the passage?',
            options: ['A', 'B', 'C', 'D'],
            correctAnswer: 'A'
          }
        ],
        passages: [],
        estimatedTime: 3600000, // 1小时
        difficulty: 'normal'
      },
      'sample-cloze-001': {
        id: 'sample-cloze-001',
        title: '完型填空专项练习',
        type: 'cloze',
        questions: [
          {
            id: 'q1',
            type: 'cloze',
            passage: 'The Internet has revolutionized the way we ____ information.',
            options: ['access', 'excess', 'success', 'process'],
            correctAnswer: 'access'
          }
        ],
        passages: [],
        estimatedTime: 1800000, // 30分钟
        difficulty: 'normal'
      }
    };
  }

  async getPaperById(paperId) {
    try {
      // 先检查示例数据
      if (this.samplePapers[paperId]) {
        return this.samplePapers[paperId];
      }

      // 从存储中获取试卷数据
      const paper = await this.storageAdapter.get(`paper_${paperId}`);
      return paper;
    } catch (error) {
      console.error('PracticeRepositoryImpl.getPaperById error:', error);
      throw new Error(`Failed to get paper: ${error.message}`);
    }
  }

  async getRecommendedPaper() {
    try {
      // 返回第一个示例试卷作为推荐
      const paperIds = Object.keys(this.samplePapers);
      if (paperIds.length > 0) {
        return this.samplePapers[paperIds[0]];
      }
      return null;
    } catch (error) {
      console.error('PracticeRepositoryImpl.getRecommendedPaper error:', error);
      throw new Error(`Failed to get recommended paper: ${error.message}`);
    }
  }

  async savePracticeRecord(userId, record) {
    try {
      const key = `practice_record_${userId}_${Date.now()}`;
      await this.storageAdapter.save(key, record);
      return true;
    } catch (error) {
      console.error('PracticeRepositoryImpl.savePracticeRecord error:', error);
      return false;
    }
  }

  async getPracticeHistory(userId, limit = 100) {
    try {
      // 这里应该从存储中获取用户的练习历史
      // 暂时返回空数组
      return [];
    } catch (error) {
      console.error('PracticeRepositoryImpl.getPracticeHistory error:', error);
      throw new Error(`Failed to get practice history: ${error.message}`);
    }
  }

  async getPracticeStatistics(userId, paperId = null) {
    try {
      // 这里应该计算用户的练习统计
      // 暂时返回默认统计
      return {
        totalPractices: 0,
        totalQuestions: 0,
        totalCorrect: 0,
        averageAccuracy: 0,
        totalTimeSpent: 0,
        practiceHistory: [],
        weakPoints: [],
        improvementTrend: []
      };
    } catch (error) {
      console.error('PracticeRepositoryImpl.getPracticeStatistics error:', error);
      throw new Error(`Failed to get practice statistics: ${error.message}`);
    }
  }

  async updatePracticeProgress(userId, paperId, progress) {
    try {
      const key = `practice_progress_${userId}_${paperId}`;
      await this.storageAdapter.save(key, progress);
      return true;
    } catch (error) {
      console.error('PracticeRepositoryImpl.updatePracticeProgress error:', error);
      return false;
    }
  }

  async getPracticeProgress(userId, paperId) {
    try {
      const key = `practice_progress_${userId}_${paperId}`;
      const progress = await this.storageAdapter.get(key);
      return progress || null;
    } catch (error) {
      console.error('PracticeRepositoryImpl.getPracticeProgress error:', error);
      throw new Error(`Failed to get practice progress: ${error.message}`);
    }
  }

  async clearPracticeProgress(userId, paperId = null) {
    try {
      if (paperId) {
        // 清除特定试卷的进度
        const key = `practice_progress_${userId}_${paperId}`;
        await this.storageAdapter.remove(key);
      } else {
        // 清除所有进度（这里需要获取所有相关的键，暂时不实现）
        console.warn('Clearing all practice progress not implemented');
      }
      return true;
    } catch (error) {
      console.error('PracticeRepositoryImpl.clearPracticeProgress error:', error);
      return false;
    }
  }
}

module.exports = PracticeRepositoryImpl;
