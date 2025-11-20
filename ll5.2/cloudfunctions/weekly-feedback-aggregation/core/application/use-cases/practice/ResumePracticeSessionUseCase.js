/**
 * 恢复练习会话用例
 *
 * Phase 3.3: Application层用例（业务流程补充）
 *
 * 职责：
 * - 检测并恢复用户的未完成会话
 * - 恢复会话上下文（进度、答案、统计）
 * - 验证会话有效性
 * - 支持多种中断场景（关闭小程序、切换页面、网络中断等）
 * 
 * 业务场景：
 * - 用户关闭小程序后重新打开
 * - 用户从其他页面返回练习页
 * - 网络中断后恢复
 * - 应用崩溃后恢复
 */

const PracticeSession = require('../../../domain/entities/PracticeSession')

class ResumePracticeSessionUseCase {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入
   * @param {IPracticeSessionRepository} dependencies.practiceSessionRepository - 会话仓储
   * @param {IAnswerRepository} dependencies.answerRepository - 答案仓储
   * @param {IQuestionRepository} dependencies.questionRepository - 题目仓储
   */
  constructor({ practiceSessionRepository, answerRepository, questionRepository }) {
    if (!practiceSessionRepository) {
      throw new Error('practiceSessionRepository is required')
    }
    if (!answerRepository) {
      throw new Error('answerRepository is required')
    }
    if (!questionRepository) {
      throw new Error('questionRepository is required')
    }

    this.practiceSessionRepository = practiceSessionRepository
    this.answerRepository = answerRepository
    this.questionRepository = questionRepository
  }

  /**
   * 执行恢复练习会话
   * @param {Object} params - 参数
   * @param {string} params.sessionId - 会话ID（可选，如果不提供则查找最近的未完成会话）
   * @param {string} params.userId - 用户ID
   * @param {string} params.paperId - 试卷ID（可选，用于查找特定试卷的会话）
   * @returns {Promise<Object>} 恢复的会话信息
   */
  async execute({ sessionId, userId, paperId }) {
    // 参数验证
    if (!userId && !sessionId) {
      throw new Error('Either userId or sessionId is required')
    }

    try {
      let session = null

      // 1. 查找要恢复的会话
      if (sessionId) {
        // 根据会话ID查找
        session = await this.practiceSessionRepository.findById(sessionId)
        if (!session) {
          throw new Error(`Session not found: ${sessionId}`)
        }
      } else if (paperId) {
        // 根据试卷ID查找进行中的会话
        session = await this.practiceSessionRepository.findActiveByPaperId(paperId)
        if (!session) {
          return {
            canResume: false,
            reason: 'No active session found for this paper',
            suggestion: 'Start a new practice session'
          }
        }
      } else {
        // 查找用户最近的未完成会话
        const recentSessions = await this.practiceSessionRepository.findByUserId(userId, {
          status: ['answering', 'paused'],
          limit: 1,
          sortBy: 'updatedAt',
          sortOrder: 'desc'
        })

        if (!recentSessions || recentSessions.length === 0) {
          return {
            canResume: false,
            reason: 'No recent unfinished sessions found',
            suggestion: 'Start a new practice session'
          }
        }

        session = recentSessions[0]
      }

      // 2. 验证会话状态
      if (session.status === 'completed') {
        return {
          canResume: false,
          reason: 'Session already completed',
          sessionId: session.id,
          completedAt: session.endTime,
          suggestion: 'View results or start a new session'
        }
      }

      if (session.status === 'cancelled') {
        return {
          canResume: false,
          reason: 'Session was cancelled',
          sessionId: session.id,
          suggestion: 'Start a new practice session'
        }
      }

      // 3. 检查会话是否过期（超过24小时）
      const SESSION_TIMEOUT = 24 * 60 * 60 * 1000 // 24小时
      const now = Date.now()
      const sessionAge = now - session.startTime
      
      if (sessionAge > SESSION_TIMEOUT) {
        // 自动标记为过期
        await this.practiceSessionRepository.update(session.id, {
          status: 'cancelled',
          metadata: {
            ...session.metadata,
            cancelReason: 'timeout',
            cancelledAt: now
          }
        })

        return {
          canResume: false,
          reason: 'Session expired (timeout: 24 hours)',
          sessionId: session.id,
          startTime: session.startTime,
          suggestion: 'Start a new practice session'
        }
      }

      // 4. 加载已提交的答案
      const submittedAnswers = await this.answerRepository.findBySessionId(session.id)
      
      // 5. 重建会话上下文
      const answeredQuestionIds = new Set(submittedAnswers.map(a => a.questionId))
      const answeredCount = answeredQuestionIds.size

      // 6. 计算统计信息
      const correctCount = submittedAnswers.filter(a => a.isCorrect).length
      const totalTimeSpent = submittedAnswers.reduce((sum, a) => sum + (a.timeSpent || 0), 0)

      // 更新会话统计（确保与实际答案一致）
      session.statistics = {
        total: session.totalQuestions,
        answered: answeredCount,
        correct: correctCount,
        accuracy: answeredCount > 0 ? (correctCount / answeredCount * 100).toFixed(1) : 0,
        timeSpent: totalTimeSpent,
        attempts: submittedAnswers.reduce((sum, a) => sum + (a.attempts || 1), 0)
      }

      // 7. 恢复用户答案映射
      session.userAnswers = {}
      submittedAnswers.forEach(answer => {
        session.userAnswers[answer.questionId] = answer.answer
      })

      // 8. 确定当前题目索引
      const questionIds = session.metadata?.questionIds || []
      let currentQuestionIndex = 0

      // 找到第一道未答题目的索引
      for (let i = 0; i < questionIds.length; i++) {
        if (!answeredQuestionIds.has(questionIds[i])) {
          currentQuestionIndex = i
          break
        }
      }

      // 如果所有题目都已答完，但会话未标记为完成，则指向最后一题
      if (currentQuestionIndex === 0 && answeredCount === session.totalQuestions) {
        currentQuestionIndex = session.totalQuestions - 1
      }

      session.currentQuestionIndex = currentQuestionIndex

      // 9. 更新会话状态为 answering（如果之前是 paused）
      if (session.status === 'paused' || session.status === 'idle') {
        session.status = 'answering'
      }

      // 10. 计算新的恢复计数
      const newResumeCount = (session.metadata?.resumeCount || 0) + 1

      // 11. 持久化恢复的会话状态
      await this.practiceSessionRepository.update(session.id, {
        status: session.status,
        currentQuestionIndex: session.currentQuestionIndex,
        statistics: session.statistics,
        userAnswers: session.userAnswers,
        metadata: {
          ...session.metadata,
          lastResumedAt: now,
          resumeCount: newResumeCount
        }
      })

      // 12. 返回恢复的会话信息
      return {
        canResume: true,
        sessionId: session.id,
        paperId: session.paperId,
        title: session.title,
        mode: session.mode,
        type: session.type,
        status: session.status,
        progress: {
          currentQuestionIndex: session.currentQuestionIndex,
          totalQuestions: session.totalQuestions,
          answeredCount: answeredCount,
          remainingCount: session.totalQuestions - answeredCount,
          completionRate: (answeredCount / session.totalQuestions * 100).toFixed(1)
        },
        statistics: session.statistics,
        sessionInfo: {
          startTime: session.startTime,
          duration: now - session.startTime,
          lastResumedAt: now,
          resumeCount: newResumeCount // 使用新计算的值
        },
        questionIds: questionIds,
        message: 'Session resumed successfully. Use GetNextQuestionUseCase to continue.'
      }

    } catch (error) {
      console.error('ResumePracticeSessionUseCase execute error:', error)
      throw new Error(`恢复练习会话失败: ${error.message}`)
    }
  }

  /**
   * 暂停会话（用户主动暂停）
   * @param {Object} params - 参数
   * @param {string} params.sessionId - 会话ID
   * @returns {Promise<boolean>} 是否暂停成功
   */
  async pauseSession({ sessionId }) {
    if (!sessionId) {
      throw new Error('Session ID is required')
    }

    try {
      const session = await this.practiceSessionRepository.findById(sessionId)
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`)
      }

      if (session.status !== 'answering') {
        throw new Error(`Cannot pause session in status: ${session.status}`)
      }

      await this.practiceSessionRepository.update(sessionId, {
        status: 'paused',
        metadata: {
          ...session.metadata,
          pausedAt: Date.now()
        }
      })

      return true
    } catch (error) {
      console.error('Pause session error:', error)
      throw new Error(`暂停会话失败: ${error.message}`)
    }
  }

  /**
   * 取消会话（用户主动取消）
   * @param {Object} params - 参数
   * @param {string} params.sessionId - 会话ID
   * @param {string} params.reason - 取消原因
   * @returns {Promise<boolean>} 是否取消成功
   */
  async cancelSession({ sessionId, reason = 'user_cancelled' }) {
    if (!sessionId) {
      throw new Error('Session ID is required')
    }

    try {
      const session = await this.practiceSessionRepository.findById(sessionId)
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`)
      }

      if (session.status === 'completed') {
        throw new Error('Cannot cancel completed session')
      }

      await this.practiceSessionRepository.update(sessionId, {
        status: 'cancelled',
        metadata: {
          ...session.metadata,
          cancelReason: reason,
          cancelledAt: Date.now()
        }
      })

      return true
    } catch (error) {
      console.error('Cancel session error:', error)
      throw new Error(`取消会话失败: ${error.message}`)
    }
  }
}

module.exports = ResumePracticeSessionUseCase

