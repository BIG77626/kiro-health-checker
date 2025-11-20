/**
 * 提交答案用例
 *
 * Phase 3.3: Application层用例
 *
 * 职责：
 * - 处理用户提交的答案
 * - 更新会话状态和统计
 * - 记录答案历史
 * - 验证答案正确性
 */

const Answer = require('../../../domain/entities/Answer')

class SubmitAnswerUseCase {
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
   * 执行提交答案
   * @param {Object} params - 参数
   * @param {string} params.sessionId - 会话ID
   * @param {string} params.questionId - 题目ID
   * @param {any} params.answer - 用户答案
   * @param {number} params.timeSpent - 答题耗时（秒）
   * @param {Object} params.metadata - 元数据
   * @returns {Promise<Object>} 答案结果
   */
  async execute({ sessionId, questionId, answer, timeSpent = 0, metadata = {} }) {
    // 参数验证
    if (!sessionId) {
      throw new Error('Session ID is required')
    }
    if (!questionId) {
      throw new Error('Question ID is required')
    }
    if (timeSpent < 0) {
      throw new Error('Time spent cannot be negative')
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

      // 2. 获取题目信息
      const question = await this.questionRepository.findById(questionId)
      if (!question) {
        throw new Error(`Question not found: ${questionId}`)
      }

      // 3. 检查是否已有答案记录（处理多次尝试）
      let answerEntity
      const existingAnswer = await this.answerRepository.findByQuestionAndSession(questionId, sessionId)
      if (existingAnswer) {
        // 更新现有答案
        existingAnswer.updateAnswer(answer, timeSpent)
        // 重新创建答案实体（避免修改已存在的实体）
        answerEntity = new Answer({
          questionId,
          sessionId,
          answer: existingAnswer.answer,
          correctAnswer: question.correctAnswer,
          timeSpent: existingAnswer.timeSpent,
          attempts: existingAnswer.attempts,
          isCorrect: existingAnswer.isCorrect,
          metadata: {
            ...metadata,
            questionType: question.type,
            difficulty: question.getDifficulty(),
            attempts: existingAnswer.attempts
          }
        })
      } else {
        // 创建新答案记录
        answerEntity = new Answer({
          questionId,
          sessionId,
          answer,
          correctAnswer: question.correctAnswer,
          timeSpent,
          metadata: {
            ...metadata,
            questionType: question.type,
            difficulty: question.getDifficulty(),
            attempts: 1
          }
        })
      }

      // 5. 保存答案
      try {
        const saved = await this.answerRepository.save(answerEntity)
        if (!saved) {
          throw new Error('Failed to save answer')
        }
      } catch (saveError) {
        throw new Error(`Failed to save answer: ${saveError.message}`)
      }

      // 6. 确保会话中存储了正确答案（用于统计）
      if (!session.correctAnswers || !session.correctAnswers[questionId]) {
        if (!session.correctAnswers) {
          session.correctAnswers = {}
        }
        session.correctAnswers[questionId] = question.correctAnswer
      }

      // 7. 更新会话统计
      session.submitAnswer(questionId, answerEntity.answer)
      await this.practiceSessionRepository.update(sessionId, {
        statistics: session.statistics,
        currentQuestionIndex: session.currentQuestionIndex,
        userAnswers: session.userAnswers,
        correctAnswers: session.correctAnswers
      })

      // 8. 返回结果
      return {
        questionId,
        answer: answerEntity.answer,
        isCorrect: answerEntity.isCorrect,
        attempts: answerEntity.attempts,
        timeSpent: answerEntity.timeSpent,
        sessionProgress: {
          answered: session.statistics.answered,
          correct: session.statistics.correct,
          accuracy: session.statistics.accuracy,
          currentIndex: session.currentQuestionIndex
        },
        feedback: this._generateFeedback(answerEntity, question)
      }

    } catch (error) {
      console.error('SubmitAnswerUseCase execute error:', error)
      throw new Error(`提交答案失败: ${error.message}`)
    }
  }

  /**
   * 生成反馈信息
   * @private
   * @param {Answer} answer - 答案实体
   * @param {Question} question - 题目实体
   * @returns {Object} 反馈信息
   */
  _generateFeedback(answer, question) {
    const feedback = {
      isCorrect: answer.isCorrect,
      message: '',
      suggestions: []
    }

    if (answer.isCorrect) {
      feedback.message = '✅ 回答正确！'

      if (answer.attempts === 1) {
        feedback.message += ' 第一次就答对了，很棒！'
      } else {
        feedback.message += ` 用${answer.attempts}次尝试成功，坚持就是胜利！`
      }

      // 针对阅读理解的特殊反馈
      if (question.type === 'reading' && question.evidenceSentences.length > 0) {
        feedback.suggestions.push('注意证据句的定位技巧')
      }
    } else {
      const correctAnswerText = question.getFormattedAnswer(question.correctAnswer)
      feedback.message = `❌ 正确答案是: ${correctAnswerText}`

      if (answer.attempts > 1) {
        feedback.message += ` (第${answer.attempts}次尝试)`
      }

      // 根据题型提供建议
      switch (question.type) {
        case 'reading':
          feedback.suggestions.push('仔细阅读文章，寻找关键词')
          if (question.evidenceParagraphs.length > 0) {
            feedback.suggestions.push(`重点关注第${question.evidenceParagraphs.join('、')}段`)
          }
          break
        case 'cloze':
          feedback.suggestions.push('注意词性搭配和语法结构')
          break
        case 'translation':
          feedback.suggestions.push('检查翻译的准确性和流畅性')
          break
        case 'writing':
          feedback.suggestions.push('注意语法、拼写和表达的准确性')
          break
      }

      // 添加难度提示
      if (question.difficultyTips.length > 0) {
        feedback.suggestions.push(...question.difficultyTips.slice(0, 2))
      }
    }

    return feedback
  }
}

module.exports = SubmitAnswerUseCase
