/**
 * 完成练习会话用例
 *
 * Phase 3.3: Application层用例
 *
 * 职责：
 * - 结束练习会话
 * - 计算最终统计结果
 * - 生成学习分析报告
 * - 保存会话历史记录
 */

class FinishPracticeSessionUseCase {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入
   * @param {IPracticeSessionRepository} dependencies.practiceSessionRepository - 会话仓储
   * @param {IAnswerRepository} dependencies.answerRepository - 答案仓储
   * @param {IPracticeRepository} dependencies.practiceRepository - 练习仓储
   */
  constructor({ practiceSessionRepository, answerRepository, practiceRepository }) {
    if (!practiceSessionRepository) {
      throw new Error('practiceSessionRepository is required')
    }
    if (!answerRepository) {
      throw new Error('answerRepository is required')
    }
    if (!practiceRepository) {
      throw new Error('practiceRepository is required')
    }

    this.practiceSessionRepository = practiceSessionRepository
    this.answerRepository = answerRepository
    this.practiceRepository = practiceRepository
  }

  /**
   * 执行完成练习会话
   * @param {Object} params - 参数
   * @param {string} params.sessionId - 会话ID
   * @param {string} params.userId - 用户ID
   * @returns {Promise<Object>} 完成结果和统计报告
   */
  async execute({ sessionId, userId }) {
    // 参数验证
    if (!sessionId) {
      throw new Error('Session ID is required')
    }
    if (!userId) {
      throw new Error('User ID is required')
    }

    try {
      // 1. 获取会话
      const session = await this.practiceSessionRepository.findById(sessionId)
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`)
      }

      if (session.status === 'completed') {
        throw new Error('Session is already completed')
      }

      // 2. 完成会话
      session.complete()

      // 3. 获取所有答案记录
      const answers = await this.answerRepository.findBySessionId(sessionId)

      // 4. 计算详细统计
      const finalStats = this._calculateFinalStatistics(session, answers)

      // 5. 生成学习分析报告
      const analysisReport = this._generateAnalysisReport(session, answers, finalStats)

      // 6. 保存最终会话状态
      await this.practiceSessionRepository.update(sessionId, {
        status: session.status,
        endTime: session.endTime,
        duration: session.duration,
        statistics: finalStats
      })

      // 7. 保存练习记录（用于历史统计）
      await this.practiceRepository.savePracticeRecord(userId, {
        sessionId,
        paperId: session.paperId,
        type: session.type,
        mode: session.mode,
        startTime: session.startTime,
        endTime: session.endTime,
        duration: session.duration,
        statistics: finalStats,
        analysis: analysisReport
      })

      // 8. 返回完成结果
      return {
        sessionId,
        paperId: session.paperId,
        status: session.status,
        duration: session.duration,
        statistics: finalStats,
        analysis: analysisReport,
        summary: this._generateSummary(session, finalStats)
      }

    } catch (error) {
      console.error('FinishPracticeSessionUseCase execute error:', error)
      throw new Error(`完成练习会话失败: ${error.message}`)
    }
  }

  /**
   * 计算最终统计数据
   * @private
   * @param {PracticeSession} session - 会话实体
   * @param {Array<Answer>} answers - 答案记录
   * @returns {Object} 最终统计
   */
  _calculateFinalStatistics(session, answers) {
    const stats = { ...session.statistics }

    // 基础统计
    stats.totalTime = session.duration
    stats.averageTimePerQuestion = answers.length > 0 ?
      answers.reduce((sum, answer) => sum + answer.timeSpent, 0) / answers.length : 0

    // 题型分析
    stats.questionTypeStats = this._analyzeByQuestionType(answers)

    // 时间分析
    stats.timeAnalysis = this._analyzeTimeSpent(answers)

    // 难度分析
    stats.difficultyAnalysis = this._analyzeByDifficulty(answers)

    // 掌握度分析
    stats.masteryAnalysis = this._analyzeMastery(answers)

    return stats
  }

  /**
   * 按题型分析
   * @private
   * @param {Array<Answer>} answers - 答案记录
   * @returns {Object} 题型统计
   */
  _analyzeByQuestionType(answers) {
    const typeStats = {}

    answers.forEach(answer => {
      const type = answer.metadata?.questionType || 'unknown'
      if (!typeStats[type]) {
        typeStats[type] = { total: 0, correct: 0, averageTime: 0 }
      }

      typeStats[type].total++
      if (answer.isCorrect) typeStats[type].correct++
      typeStats[type].averageTime += answer.timeSpent
    })

    // 计算准确率和平均时间
    Object.keys(typeStats).forEach(type => {
      const stat = typeStats[type]
      stat.accuracy = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0
      stat.averageTime = stat.total > 0 ? stat.averageTime / stat.total : 0
    })

    return typeStats
  }

  /**
   * 时间花费分析
   * @private
   * @param {Array<Answer>} answers - 答案记录
   * @returns {Object} 时间分析
   */
  _analyzeTimeSpent(answers) {
    if (answers.length === 0) return { fastest: 0, slowest: 0, average: 0 }

    const times = answers.map(a => a.timeSpent).sort((a, b) => a - b)

    return {
      fastest: times[0],
      slowest: times[times.length - 1],
      average: times.reduce((sum, time) => sum + time, 0) / times.length,
      median: times[Math.floor(times.length / 2)]
    }
  }

  /**
   * 按难度分析
   * @private
   * @param {Array<Answer>} answers - 答案记录
   * @returns {Object} 难度分析
   */
  _analyzeByDifficulty(answers) {
    const difficultyStats = { easy: { total: 0, correct: 0 }, medium: { total: 0, correct: 0 }, hard: { total: 0, correct: 0 } }

    answers.forEach(answer => {
      const difficulty = answer.metadata?.difficulty || 'medium'
      if (difficultyStats[difficulty]) {
        difficultyStats[difficulty].total++
        if (answer.isCorrect) difficultyStats[difficulty].correct++
      }
    })

    // 计算准确率
    Object.keys(difficultyStats).forEach(difficulty => {
      const stat = difficultyStats[difficulty]
      stat.accuracy = stat.total > 0 ? (stat.correct / stat.total) * 100 : 0
    })

    return difficultyStats
  }

  /**
   * 掌握度分析
   * @private
   * @param {Array<Answer>} answers - 答案记录
   * @returns {Object} 掌握度分析
   */
  _analyzeMastery(answers) {
    let firstTimeCorrect = 0
    let neededRetry = 0
    let totalAttempts = 0

    answers.forEach(answer => {
      totalAttempts += answer.attempts
      if (answer.attempts === 1 && answer.isCorrect) {
        firstTimeCorrect++
      } else if (answer.attempts > 1) {
        neededRetry++
      }
    })

    return {
      firstTimeCorrectRate: answers.length > 0 ? (firstTimeCorrect / answers.length) * 100 : 0,
      retryRate: answers.length > 0 ? (neededRetry / answers.length) * 100 : 0,
      averageAttempts: answers.length > 0 ? totalAttempts / answers.length : 0,
      masteryLevel: this._calculateMasteryLevel(firstTimeCorrect / answers.length)
    }
  }

  /**
   * 计算掌握度等级
   * @private
   * @param {number} firstTimeCorrectRate - 首次正确率
   * @returns {string} 掌握度等级
   */
  _calculateMasteryLevel(firstTimeCorrectRate) {
    if (firstTimeCorrectRate >= 0.9) return 'excellent'
    if (firstTimeCorrectRate >= 0.8) return 'good'
    if (firstTimeCorrectRate >= 0.7) return 'fair'
    if (firstTimeCorrectRate >= 0.6) return 'needs_improvement'
    return 'needs_review'
  }

  /**
   * 生成学习分析报告
   * @private
   * @param {PracticeSession} session - 会话实体
   * @param {Array<Answer>} answers - 答案记录
   * @param {Object} stats - 统计数据
   * @returns {Object} 分析报告
   */
  _generateAnalysisReport(session, answers, stats) {
    const report = {
      sessionId: session.id,
      paperId: session.paperId,
      mode: session.mode,
      type: session.type,
      duration: session.duration,
      strengths: [],
      weaknesses: [],
      recommendations: [],
      improvementAreas: []
    }

    // 分析优势
    if (stats.accuracy >= 80) {
      report.strengths.push('整体表现优秀')
    }
    if (stats.masteryAnalysis.firstTimeCorrectRate >= 80) {
      report.strengths.push('掌握度很高')
    }

    // 分析弱点
    const weakTypes = Object.entries(stats.questionTypeStats)
      .filter(([, stat]) => stat.accuracy < 70)
      .map(([type]) => type)

    if (weakTypes.length > 0) {
      report.weaknesses.push(`题型薄弱: ${weakTypes.join(', ')}`)
    }

    // 生成建议
    if (stats.averageTimePerQuestion > 120) {
      report.recommendations.push('可以适当加快答题速度')
    }
    if (stats.masteryAnalysis.retryRate > 30) {
      report.recommendations.push('建议加强基础知识复习')
    }

    // 改进方向
    if (stats.difficultyAnalysis.hard && stats.difficultyAnalysis.hard.accuracy < 60) {
      report.improvementAreas.push('重点练习高难度题目')
    }

    return report
  }

  /**
   * 生成总结信息
   * @private
   * @param {PracticeSession} session - 会话实体
   * @param {Object} stats - 统计数据
   * @returns {Object} 总结信息
   */
  _generateSummary(session, stats) {
    const summary = {
      totalQuestions: stats.total,
      correctAnswers: stats.correct,
      accuracy: stats.accuracy,
      totalTime: session.duration,
      averageTimePerQuestion: Math.round(stats.averageTimePerQuestion),
      masteryLevel: stats.masteryAnalysis.masteryLevel,
      completionRate: (stats.answered / stats.total) * 100
    }

    // 生成评语
    if (stats.accuracy >= 90) {
      summary.comment = '🎉 表现卓越！继续保持！'
    } else if (stats.accuracy >= 80) {
      summary.comment = '🌟 表现良好！继续努力！'
    } else if (stats.accuracy >= 70) {
      summary.comment = '👍 表现不错！还有进步空间！'
    } else if (stats.accuracy >= 60) {
      summary.comment = '💪 继续加油！多加练习！'
    } else {
      summary.comment = '📚 坚持练习！熟能生巧！'
    }

    return summary
  }
}

module.exports = FinishPracticeSessionUseCase
