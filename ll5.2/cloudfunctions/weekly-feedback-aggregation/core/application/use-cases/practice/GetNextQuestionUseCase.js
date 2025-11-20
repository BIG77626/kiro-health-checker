/**
 * 获取下一道题目用例
 *
 * Phase 3.3: Application层用例（性能优化）
 *
 * 职责：
 * - 按需加载单道题目内容
 * - 支持顺序获取和跳转获取
 * - 优化首屏加载性能
 * 
 * 性能优化：
 * - 每次只加载一道题目，避免全量加载
 * - 支持缓存策略（由 Infrastructure 层实现）
 * - 减少内存占用和网络传输
 */

const Question = require('../../../domain/entities/Question')

class GetNextQuestionUseCase {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入
   * @param {IPracticeSessionRepository} dependencies.practiceSessionRepository - 会话仓储
   * @param {IQuestionRepository} dependencies.questionRepository - 题目仓储
   */
  constructor({ practiceSessionRepository, questionRepository }) {
    if (!practiceSessionRepository) {
      throw new Error('practiceSessionRepository is required')
    }
    if (!questionRepository) {
      throw new Error('questionRepository is required')
    }

    this.practiceSessionRepository = practiceSessionRepository
    this.questionRepository = questionRepository
  }

  /**
   * 执行获取下一道题目
   * @param {Object} params - 参数
   * @param {string} params.sessionId - 会话ID
   * @param {number} params.questionIndex - 题目索引（可选，默认为当前题目索引）
   * @returns {Promise<Object>} 题目信息
   */
  async execute({ sessionId, questionIndex }) {
    // 参数验证
    if (!sessionId) {
      throw new Error('Session ID is required')
    }

    try {
      // 1. 获取会话
      const session = await this.practiceSessionRepository.findById(sessionId)
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`)
      }

      if (session.status !== 'answering') {
        throw new Error(`Session is not in answering state: ${session.status}`)
      }

      // 2. 确定要加载的题目索引
      const targetIndex = questionIndex !== undefined ? questionIndex : session.currentQuestionIndex
      
      if (targetIndex < 0 || targetIndex >= session.totalQuestions) {
        throw new Error(`Invalid question index: ${targetIndex}. Total questions: ${session.totalQuestions}`)
      }

      // 3. 获取题目ID列表
      const questionIds = session.metadata?.questionIds || []
      if (questionIds.length === 0) {
        throw new Error('Question IDs not found in session metadata. Please restart the session.')
      }

      const questionId = questionIds[targetIndex]
      if (!questionId) {
        throw new Error(`Question ID not found at index ${targetIndex}`)
      }

      // 4. 加载题目内容
      const questionData = await this.questionRepository.findById(questionId)
      if (!questionData) {
        throw new Error(`Question not found: ${questionId}`)
      }

      // 5. 转换为Question实体
      const question = new Question({
        id: questionData.id,
        type: questionData.type || session.type,
        question: questionData.question || questionData.stem || '',
        options: questionData.options || [],
        correctAnswer: questionData.correct_answer || questionData.correctAnswer || '',
        explanation: questionData.explanation || '',
        passageId: questionData.passage_id || questionData.passageId,
        difficultyTips: questionData.difficulty_tips || questionData.difficultyTips || [],
        evidenceParagraphs: questionData.evidence_paragraphs || questionData.evidenceParagraphs || [],
        evidenceSentences: questionData.evidence_sentences || questionData.evidenceSentences || [],
        metadata: questionData.metadata
      })

      // 6. 更新会话的当前题目索引（如果是顺序加载）
      if (questionIndex === undefined && targetIndex === session.currentQuestionIndex) {
        // 只在顺序获取且成功加载后更新索引
        // 注意：不自动递增，由页面层决定何时翻页
      }

      // 7. 存储正确答案到会话（用于后续统计）
      if (!session.correctAnswers) {
        session.correctAnswers = {}
      }
      if (!session.correctAnswers[question.id]) {
        session.correctAnswers[question.id] = question.correctAnswer
        await this.practiceSessionRepository.update(sessionId, {
          correctAnswers: session.correctAnswers
        })
      }

      // 8. 返回题目信息
      return {
        sessionId: session.id,
        question: {
          id: question.id,
          type: question.type,
          question: question.question,
          options: question.options,
          passageId: question.passageId,
          difficulty: question.getDifficulty(),
          points: question.getPoints(),
          timeLimit: question.getTimeLimit()
        },
        progress: {
          currentIndex: targetIndex,
          totalQuestions: session.totalQuestions,
          completionRate: ((targetIndex + 1) / session.totalQuestions * 100).toFixed(1)
        },
        hasNext: targetIndex < session.totalQuestions - 1,
        hasPrevious: targetIndex > 0
      }

    } catch (error) {
      console.error('GetNextQuestionUseCase execute error:', error)
      throw new Error(`获取题目失败: ${error.message}`)
    }
  }

  /**
   * 预加载下一道题目（可选的性能优化）
   * @param {Object} params - 参数
   * @param {string} params.sessionId - 会话ID
   * @param {number} params.nextIndex - 下一题索引
   * @returns {Promise<boolean>} 是否预加载成功
   */
  async preloadNext({ sessionId, nextIndex }) {
    try {
      const session = await this.practiceSessionRepository.findById(sessionId)
      if (!session || session.status !== 'answering') {
        return false
      }

      const questionIds = session.metadata?.questionIds || []
      const questionId = questionIds[nextIndex]
      
      if (!questionId) {
        return false
      }

      // 触发预加载（实际加载由 Repository 层的缓存机制处理）
      await this.questionRepository.findById(questionId)
      
      return true
    } catch (error) {
      console.warn('Preload next question failed:', error)
      return false
    }
  }
}

module.exports = GetNextQuestionUseCase

