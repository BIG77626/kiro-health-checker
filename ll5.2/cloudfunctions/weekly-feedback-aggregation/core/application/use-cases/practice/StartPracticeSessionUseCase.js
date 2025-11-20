/**
 * 开始练习会话用例
 *
 * Phase 3.3: Application层用例
 *
 * 职责：
 * - 创建新的练习会话
 * - 加载试卷元信息（不加载全部题目，仅统计数量）
 * - 初始化会话状态
 * - 验证会话参数
 * 
 * 性能优化：
 * - 只加载试卷元信息，不加载题目内容
 * - 题目按需加载，由 GetNextQuestionUseCase 负责
 * - 避免首屏白屏时间过长
 */

const PracticeSession = require('../../../domain/entities/PracticeSession')
const Question = require('../../../domain/entities/Question')

class StartPracticeSessionUseCase {
  /**
   * 构造函数
   * @param {Object} dependencies - 依赖注入
   * @param {IPracticeSessionRepository} dependencies.practiceSessionRepository - 会话仓储
   * @param {IQuestionRepository} dependencies.questionRepository - 题目仓储
   * @param {IPracticeRepository} dependencies.practiceRepository - 练习仓储（获取试卷）
   */
  constructor({ practiceSessionRepository, questionRepository, practiceRepository }) {
    if (!practiceSessionRepository) {
      throw new Error('practiceSessionRepository is required')
    }
    if (!questionRepository) {
      throw new Error('questionRepository is required')
    }
    if (!practiceRepository) {
      throw new Error('practiceRepository is required')
    }

    this.practiceSessionRepository = practiceSessionRepository
    this.questionRepository = questionRepository
    this.practiceRepository = practiceRepository
  }

  /**
   * 执行开始练习会话
   * @param {Object} params - 参数
   * @param {string} params.paperId - 试卷ID
   * @param {string} params.userId - 用户ID
   * @param {string} params.mode - 模式：'practice' | 'exam'
   * @param {string} params.type - 题型：'reading' | 'cloze' | 'translation' | 'writing'
   * @returns {Promise<Object>} 会话信息
   */
  async execute({ paperId, userId, mode = 'practice', type = 'reading' }) {
    // 参数验证
    if (!paperId) {
      throw new Error('Paper ID is required')
    }
    if (!userId) {
      throw new Error('User ID is required')
    }

    try {
      // 1. 检查是否存在进行中的会话
      const existingSession = await this.practiceSessionRepository.findActiveByPaperId(paperId)
      if (existingSession && existingSession.status !== 'completed') {
        throw new Error('An active session already exists for this paper')
      }

      // 2. 获取试卷数据
      const paper = await this.practiceRepository.getPaperById(paperId)
      if (!paper) {
        throw new Error(`Paper not found: ${paperId}`)
      }

      // 3. 创建练习会话
      const session = new PracticeSession({
        paperId,
        title: paper.title || `练习会话-${paperId.slice(-6)}`,
        mode,
        type,
        paper
      })

      // 4. 获取题目数量（性能优化：不加载题目内容）
      // 优先从试卷元数据获取题目数量
      const questionCount = paper.questionCount || paper.questions?.length || 0
      
      // 如果试卷没有题目数量信息，则查询题目ID列表
      let questionIds = []
      if (questionCount === 0) {
        const questions = await this.questionRepository.findByPaperId(paperId)
        if (questions.length === 0) {
          throw new Error(`No questions found for paper: ${paperId}`)
        }
        questionIds = questions.map(q => q.id)
      } else {
        // 从试卷元数据获取题目ID列表
        questionIds = paper.questionIds || paper.questions?.map(q => q.id) || []
      }

      if (questionIds.length === 0) {
        throw new Error(`No questions found for paper: ${paperId}`)
      }

      // 5. 初始化会话数据（不加载题目内容，只记录题目ID列表）
      session.start()
      session.totalQuestions = questionIds.length
      session.status = 'answering'
      session.metadata.questionIds = questionIds // 存储题目ID列表，供后续按需加载
      session.metadata.updatedAt = Date.now()

      // 6. 保存会话
      const saved = await this.practiceSessionRepository.save(session)
      if (!saved) {
        throw new Error('Failed to save practice session')
      }

      // 7. 返回会话信息（不包含题目内容）
      return {
        sessionId: session.id,
        paperId: session.paperId,
        title: session.title,
        mode: session.mode,
        type: session.type,
        status: session.status,
        totalQuestions: session.totalQuestions,
        currentQuestionIndex: session.currentQuestionIndex,
        startTime: session.startTime,
        questionIds: questionIds, // 返回题目ID列表，供后续按需加载
        // 性能优化：不返回题目内容，由 GetNextQuestionUseCase 按需加载
        message: 'Session created successfully. Use GetNextQuestionUseCase to load questions on demand.'
      }

    } catch (error) {
      console.error('StartPracticeSessionUseCase execute error:', error)
      throw new Error(`开始练习会话失败: ${error.message}`)
    }
  }
}

module.exports = StartPracticeSessionUseCase
