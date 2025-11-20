/**
 * 获取会话统计用例
 *
 * Phase 3.3: Application层用例
 *
 * 职责：
 * - 获取练习会话的实时统计信息
 * - 提供进度跟踪和性能指标
 * - 支持学习分析和反馈
 */

class GetSessionStatisticsUseCase {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入
   * @param {IPracticeSessionRepository} dependencies.practiceSessionRepository - 会话仓储
   * @param {IAnswerRepository} dependencies.answerRepository - 答案仓储
   */
  constructor({ practiceSessionRepository, answerRepository }) {
    if (!practiceSessionRepository) {
      throw new Error('practiceSessionRepository is required')
    }
    if (!answerRepository) {
      throw new Error('answerRepository is required')
    }

    this.practiceSessionRepository = practiceSessionRepository
    this.answerRepository = answerRepository
  }

  /**
   * 执行获取会话统计
   * @param {Object} params - 参数
   * @param {string} params.sessionId - 会话ID
   * @param {boolean} params.includeDetailedAnalysis - 是否包含详细分析
   * @returns {Promise<Object>} 统计信息
   */
  async execute({ sessionId, includeDetailedAnalysis = false }) {
    // 参数验证
    if (!sessionId) {
      throw new Error('Session ID is required')
    }

    try {
      // 1. 获取会话信息
      const session = await this.practiceSessionRepository.findById(sessionId)
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`)
      }

      // 2. 获取答案记录
      const answers = await this.answerRepository.findBySessionId(sessionId)

      // 3. 计算基础统计
      const basicStats = this._calculateBasicStats(session, answers)

      // 4. 计算实时统计（包含当前会话状态）
      const realtimeStats = this._calculateRealtimeStats(session, answers)

      // 5. 构建响应
      const result = {
        sessionId,
        paperId: session.paperId,
        mode: session.mode,
        type: session.type,
        status: session.status,
        startTime: session.startTime,
        currentTime: Date.now(),
        elapsedTime: Math.floor((Date.now() - session.startTime) / 1000),
        ...basicStats,
        ...realtimeStats
      }

      // 6. 添加详细分析（可选）
      if (includeDetailedAnalysis) {
        result.detailedAnalysis = this._generateDetailedAnalysis(session, answers)
      }

      // 7. 添加进度提示
      result.progressTips = this._generateProgressTips(result)

      return result

    } catch (error) {
      console.error('GetSessionStatisticsUseCase execute error:', error)
      throw new Error(`获取会话统计失败: ${error.message}`)
    }
  }

  /**
   * 计算基础统计
   * @private
   * @param {PracticeSession} session - 会话实体
   * @param {Array<Answer>} answers - 答案记录
   * @returns {Object} 基础统计
   */
  _calculateBasicStats(session, answers) {
    return {
      totalQuestions: session.totalQuestions,
      answeredQuestions: answers.length,
      remainingQuestions: session.totalQuestions - answers.length,
      completionRate: session.totalQuestions > 0 ?
        ((answers.length / session.totalQuestions) * 100).toFixed(1) : 0,

      // 准确率统计
      correctAnswers: answers.filter(a => a.isCorrect).length,
      accuracy: answers.length > 0 ?
        ((answers.filter(a => a.isCorrect).length / answers.length) * 100).toFixed(1) : 0,

      // 时间统计
      totalTimeSpent: answers.reduce((sum, answer) => sum + answer.timeSpent, 0),
      averageTimePerQuestion: answers.length > 0 ?
        Math.round(answers.reduce((sum, answer) => sum + answer.timeSpent, 0) / answers.length) : 0
    }
  }

  /**
   * 计算实时统计
   * @private
   * @param {PracticeSession} session - 会话实体
   * @param {Array<Answer>} answers - 答案记录
   * @returns {Object} 实时统计
   */
  _calculateRealtimeStats(session, answers) {
    const stats = {
      currentQuestionIndex: session.currentQuestionIndex,
      sessionStatus: session.status,
      estimatedTimeRemaining: 0,
      predictedAccuracy: 0,
      performanceTrend: 'stable'
    }

    if (answers.length > 0) {
      // 估算剩余时间
      const avgTimePerQuestion = answers.reduce((sum, a) => sum + a.timeSpent, 0) / answers.length
      const remainingQuestions = session.totalQuestions - answers.length
      stats.estimatedTimeRemaining = Math.round(avgTimePerQuestion * remainingQuestions)

      // 预测最终准确率（基于当前趋势）
      const currentAccuracy = answers.filter(a => a.isCorrect).length / answers.length
      stats.predictedAccuracy = Math.round(currentAccuracy * 100)

      // 性能趋势分析（最近5题）
      const recentAnswers = answers.slice(-5)
      if (recentAnswers.length >= 3) {
        const recentAccuracy = recentAnswers.filter(a => a.isCorrect).length / recentAnswers.length
        const overallAccuracy = answers.filter(a => a.isCorrect).length / answers.length

        if (recentAccuracy > overallAccuracy + 0.1) {
          stats.performanceTrend = 'improving'
        } else if (recentAccuracy < overallAccuracy - 0.1) {
          stats.performanceTrend = 'declining'
        }
      }
    }

    return stats
  }

  /**
   * 生成详细分析
   * @private
   * @param {PracticeSession} session - 会话实体
   * @param {Array<Answer>} answers - 答案记录
   * @returns {Object} 详细分析
   */
  _generateDetailedAnalysis(session, answers) {
    return {
      // 题型分析
      questionTypeBreakdown: this._analyzeByQuestionType(answers),

      // 时间分布分析
      timeDistribution: this._analyzeTimeDistribution(answers),

      // 难度分析
      difficultyBreakdown: this._analyzeByDifficulty(answers),

      // 答题模式分析
      answeringPattern: this._analyzeAnsweringPattern(answers),

      // 学习建议
      recommendations: this._generateRecommendations(session, answers)
    }
  }

  /**
   * 按题型分析
   * @private
   * @param {Array<Answer>} answers - 答案记录
   * @returns {Object} 题型分析
   */
  _analyzeByQuestionType(answers) {
    const typeStats = {}

    answers.forEach(answer => {
      const type = answer.metadata?.questionType || 'unknown'
      if (!typeStats[type]) {
        typeStats[type] = { count: 0, correct: 0, avgTime: 0 }
      }

      typeStats[type].count++
      if (answer.isCorrect) typeStats[type].correct++
      typeStats[type].avgTime += answer.timeSpent
    })

    // 计算统计
    Object.keys(typeStats).forEach(type => {
      const stat = typeStats[type]
      stat.accuracy = stat.count > 0 ? ((stat.correct / stat.count) * 100).toFixed(1) : 0
      stat.avgTime = stat.count > 0 ? Math.round(stat.avgTime / stat.count) : 0
    })

    return typeStats
  }

  /**
   * 时间分布分析
   * @private
   * @param {Array<Answer>} answers - 答案记录
   * @returns {Object} 时间分布
   */
  _analyzeTimeDistribution(answers) {
    if (answers.length === 0) return { fastest: 0, slowest: 0, average: 0 }

    const times = answers.map(a => a.timeSpent).sort((a, b) => a - b)

    return {
      fastest: times[0],
      slowest: times[times.length - 1],
      average: Math.round(times.reduce((sum, t) => sum + t, 0) / times.length),
      median: times[Math.floor(times.length / 2)],
      quartile25: times[Math.floor(times.length * 0.25)],
      quartile75: times[Math.floor(times.length * 0.75)]
    }
  }

  /**
   * 按难度分析
   * @private
   * @param {Array<Answer>} answers - 答案记录
   * @returns {Object} 难度分析
   */
  _analyzeByDifficulty(answers) {
    const difficultyStats = { easy: { count: 0, correct: 0 }, medium: { count: 0, correct: 0 }, hard: { count: 0, correct: 0 } }

    answers.forEach(answer => {
      const difficulty = answer.metadata?.difficulty || 'medium'
      if (difficultyStats[difficulty]) {
        difficultyStats[difficulty].count++
        if (answer.isCorrect) difficultyStats[difficulty].correct++
      }
    })

    // 计算准确率
    Object.keys(difficultyStats).forEach(difficulty => {
      const stat = difficultyStats[difficulty]
      stat.accuracy = stat.count > 0 ? ((stat.correct / stat.count) * 100).toFixed(1) : 0
    })

    return difficultyStats
  }

  /**
   * 答题模式分析
   * @private
   * @param {Array<Answer>} answers - 答案记录
   * @returns {Object} 答题模式
   */
  _analyzeAnsweringPattern(answers) {
    const patterns = {
      firstTimeCorrect: 0,
      neededRetry: 0,
      consistentPerformance: true,
      speedVariability: 'low'
    }

    let prevTime = null
    let timeVariance = 0

    answers.forEach(answer => {
      // 首次正确统计
      if (answer.attempts === 1 && answer.isCorrect) {
        patterns.firstTimeCorrect++
      } else if (answer.attempts > 1) {
        patterns.neededRetry++
      }

      // 时间变异性分析
      if (prevTime !== null) {
        timeVariance += Math.pow(answer.timeSpent - prevTime, 2)
      }
      prevTime = answer.timeSpent
    })

    // 计算变异系数
    if (answers.length > 1) {
      const avgTime = answers.reduce((sum, a) => sum + a.timeSpent, 0) / answers.length
      const variance = timeVariance / (answers.length - 1)
      const stdDev = Math.sqrt(variance)
      const cv = avgTime > 0 ? (stdDev / avgTime) : 0

      if (cv > 0.5) patterns.speedVariability = 'high'
      else if (cv > 0.3) patterns.speedVariability = 'medium'
    }

    return patterns
  }

  /**
   * 生成学习建议
   * @private
   * @param {PracticeSession} session - 会话实体
   * @param {Array<Answer>} answers - 答案记录
   * @returns {Array<string>} 建议列表
   */
  _generateRecommendations(session, answers) {
    const recommendations = []

    if (answers.length === 0) return recommendations

    const stats = this._calculateBasicStats(session, answers)

    // 时间建议
    if (stats.averageTimePerQuestion > 120) {
      recommendations.push('答题速度可以适当加快，建议控制在2分钟以内')
    } else if (stats.averageTimePerQuestion < 30) {
      recommendations.push('可以适当放慢速度，仔细思考后再作答')
    }

    // 准确率建议
    if (stats.accuracy < 60) {
      recommendations.push('建议加强基础知识复习，准确率有待提升')
    } else if (stats.accuracy > 90) {
      recommendations.push('表现优秀，可以尝试更有挑战性的题目')
    }

    // 答题模式建议
    const pattern = this._analyzeAnsweringPattern(answers)
    if (pattern.neededRetry > answers.length * 0.3) {
      recommendations.push('多次尝试率较高，建议先理解再作答')
    }

    // 题型建议
    const typeAnalysis = this._analyzeByQuestionType(answers)
    const weakTypes = Object.entries(typeAnalysis)
      .filter(([, stat]) => parseFloat(stat.accuracy) < 70)
      .map(([type]) => type)

    if (weakTypes.length > 0) {
      recommendations.push(`建议重点练习${weakTypes.join('、')}类型的题目`)
    }

    return recommendations
  }

  /**
   * 生成进度提示
   * @private
   * @param {Object} stats - 统计数据
   * @returns {Array<string>} 进度提示
   */
  _generateProgressTips(stats) {
    const tips = []

    // 完成度提示
    const completionRate = parseFloat(stats.completionRate)
    if (completionRate < 25) {
      tips.push('练习刚刚开始，保持专注！')
    } else if (completionRate < 50) {
      tips.push('已完成一半，继续加油！')
    } else if (completionRate < 75) {
      tips.push('即将完成，保持良好状态！')
    } else {
      tips.push('即将完成，总结一下表现吧！')
    }

    // 表现提示
    const accuracy = parseFloat(stats.accuracy)
    if (stats.answeredQuestions > 0) {
      if (accuracy >= 80) {
        tips.push('表现很好，继续保持！')
      } else if (accuracy >= 60) {
        tips.push('表现不错，还有进步空间')
      } else {
        tips.push('需要更多练习，加油！')
      }
    }

    // 时间提示
    if (stats.estimatedTimeRemaining > 0) {
      const minutes = Math.floor(stats.estimatedTimeRemaining / 60)
      const seconds = stats.estimatedTimeRemaining % 60
      if (minutes > 0) {
        tips.push(`预计还需要${minutes}分${seconds}秒完成`)
      } else {
        tips.push(`预计还需要${seconds}秒完成`)
      }
    }

    return tips
  }
}

module.exports = GetSessionStatisticsUseCase
