const IAIService = require('../../../application/interfaces/IAIService')

/**
 * 模拟AI服务适配器
 * 用于测试环境，提供固定的模拟响应
 *
 * @class MockAIService
 * @implements {IAIService}
 */
class MockAIService extends IAIService {
  /**
   * 构造函数
   */
  constructor() {
    super()
    console.log('[MockAIService] 初始化完成（测试环境）')
  }

  /**
   * 生成学习提示（纯Mock数据，无业务逻辑）
   * @param {string} question - 用户的问题或学习内容
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 预定义的模拟响应
   */
  async generateHint(question, context = {}) {
    console.log('[MockAIService] 返回预定义模拟提示数据')

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 200))

    // 返回预定义的结构化数据，不包含任何业务逻辑判断
    return {
      hint: '这是预定义的AI提示内容，用于测试环境的模拟响应。',
      suggestions: [
        '建议1：保持良好的学习习惯',
        '建议2：定期复习巩固知识',
        '建议3：多做练习提高熟练度'
      ],
      metadata: {
        model: 'mock-ai-service',
        isMock: true,
        responseId: 'mock_hint_001'
      }
    }
  }

  /**
   * 分析学习数据（纯Mock数据）
   * @param {Object} learningData - 学习数据
   * @returns {Promise<Object>} 预定义的模拟分析结果
   */
  async analyzeData(learningData) {
    console.log('[MockAIService] 返回预定义模拟分析数据')

    await new Promise(resolve => setTimeout(resolve, 150))

    return {
      diagnosis: '这是预定义的学习诊断结果，用于测试环境的模拟响应。',
      recommendations: [
        '建议1：加强基础知识学习',
        '建议2：增加练习频率',
        '建议3：定期进行自我评估'
      ],
      strengths: [
        '优点1：学习态度积极',
        '优点2：坚持力强',
        '优点3：基础扎实'
      ],
      weaknesses: [
        '不足1：需要提高速度',
        '不足2：准确率待提升',
        '不足3：知识面需扩展'
      ],
      metadata: {
        isMock: true,
        analysisId: 'mock_analysis_001'
      }
    }
  }

  /**
   * 分析学习数据（纯Mock数据）
   * @param {string} userId - 用户ID
   * @param {Object} data - 学习数据
   * @returns {Promise<Object>} 预定义的模拟分析结果
   */
  async analyzeData(userId, data) {
    console.log('[MockAIService] 返回预定义模拟分析数据')

    await new Promise(resolve => setTimeout(resolve, 300))

    return {
      diagnosis: '您的学习进度良好，但词汇记忆需要加强。建议增加每日词汇练习时间。',
      recommendations: [
        '每日词汇练习时间增加到1小时',
        '重点复习错题',
        '参加模拟测试检验效果'
      ],
      strengths: [
        '学习态度认真',
        '坚持每天练习',
        '基础知识扎实'
      ],
      weaknesses: [
        '词汇量需要扩大',
        '阅读速度有待提高',
        '写作技巧需要加强'
      ],
      metadata: {
        isMock: true,
        analysisId: 'mock_analysis_001'
      }
    }
  }

  /**
   * 生成学习计划（接口实现）
   * @param {string} userId - 用户ID
   * @param {Object} goals - 学习目标
   * @returns {Promise<Object>} 模拟学习计划
   */
  async generatePlan(userId, goals) {
    console.log('[MockAIService] 模拟生成学习计划')

    await new Promise(resolve => setTimeout(resolve, 400))

    return {
      plan: '个性化考研英语学习计划',
      phases: [
        {
          name: '基础强化阶段（1-2月）',
          duration: '8周',
          focus: '打好词汇和语法基础',
          tasks: ['每日背诵50单词', '完成语法练习', '阅读简单文章']
        },
        {
          name: '综合提升阶段（3-4月）',
          duration: '8周',
          focus: '提高阅读和写作能力',
          tasks: ['练习完型填空', '写作训练', '模拟测试']
        },
        {
          name: '冲刺突破阶段（5-6月）',
          duration: '8周',
          focus: '查漏补缺，强化弱项',
          tasks: ['真题练习', '错题复习', '心态调整']
        }
      ],
      dailyTasks: [
        '晨读英语文章30分钟',
        '背诵新单词20个',
        '练习一套阅读题',
        '写作练习200字'
      ],
      notes: [
        '保持每天学习习惯',
        '定期进行自我测试',
        '遇到困难及时调整',
        '保持良好心态'
      ]
    }
  }

  /**
   * 获取推荐课程（纯Mock数据）
   * @param {Object} params - 查询参数
   * @returns {Promise<Array>} 预定义的课程列表
   */
  async getRecommendedCourses(params = {}) {
    console.log('[MockAIService] 返回预定义课程数据')

    await new Promise(resolve => setTimeout(resolve, 150))

    // 返回预定义的结构化数据，不包含业务逻辑过滤
    return [
      {
        id: 'vocabulary_master',
        title: '词汇大师训练营',
        description: '系统学习考研词汇，提高记忆效率',
        category: 'vocabulary',
        difficulty: 'intermediate',
        estimatedTime: '30天',
        rating: 4.8
      },
      {
        id: 'reading_comprehension',
        title: '阅读理解进阶',
        description: '掌握阅读技巧，提高理解速度',
        category: 'reading',
        difficulty: 'advanced',
        estimatedTime: '25天',
        rating: 4.6
      },
      {
        id: 'writing_master',
        title: '写作能力提升',
        description: '学习写作技巧，掌握表达方法',
        category: 'writing',
        difficulty: 'advanced',
        estimatedTime: '20天',
        rating: 4.7
      }
    ]
  }

  /**
   * 处理AI对话消息（接口实现）
   * @param {string} userId - 用户ID
   * @param {string} message - 用户消息
   * @returns {Promise<Object>} AI回复
   */
  async sendMessage(userId, message) {
    console.log('[MockAIService] 模拟发送消息:', message.substring(0, 50))

    await new Promise(resolve => setTimeout(resolve, 200))

    return this.generateHint(message, { context: 'ai_assistant_chat' })
  }

  /**
   * 获取课程详情（纯Mock数据）
   * @param {string} courseId - 课程ID
   * @returns {Promise<Object>} 预定义的课程详情
   */
  async getCourseDetail(courseId) {
    console.log('[MockAIService] 返回预定义课程详情数据')

    await new Promise(resolve => setTimeout(resolve, 120))

    // 总是返回预定义的词汇课程详情，不包含业务逻辑判断
    return {
      id: 'vocabulary_master',
      title: '词汇大师训练营',
      description: '系统学习考研词汇，提高记忆效率',
      category: 'vocabulary',
      difficulty: 'intermediate',
      estimatedTime: '30天',
      totalLessons: 30,
      completedLessons: 0,
      rating: 4.8,
      instructor: 'AI词汇专家',
      features: [
        '每日单词学习计划',
        '智能记忆复习',
        '词根词缀剖析',
        '真题词汇练习'
      ],
      syllabus: [
        { week: 1, title: '基础词汇积累', lessons: 7 },
        { week: 2, title: '词根词缀学习', lessons: 7 },
        { week: 3, title: '同义词辨析', lessons: 7 },
        { week: 4, title: '专项练习强化', lessons: 9 }
      ],
      metadata: {
        isMock: true,
        courseId: 'mock_course_001'
      }
    }
  }

  /**
   * 获取题目提示（用于练习页面）
   * @param {string} questionId - 题目ID
   * @param {Object} context - 上下文信息（包含题目内容、用户答案、题型等）
   * @returns {Promise<Object>} AI生成的提示内容
   */
  async getHint(questionId, context = {}) {
    console.log('[MockAIService] 返回预定义提示数据')

    await new Promise(resolve => setTimeout(resolve, 200))

    return {
      hint: '这是预定义的AI提示内容，用于测试环境的模拟响应。请仔细阅读题目，注意关键信息。',
      questionId,
      timestamp: Date.now(),
      metadata: {
        isMock: true,
        responseId: 'mock_hint_002'
      }
    }
  }

  /**
   * 批改作文（用于写作练习）
   * @param {string} essayContent - 作文内容
   * @param {string} questionId - 题目ID
   * @param {Object} context - 上下文信息（包含题目要求、评分标准等）
   * @returns {Promise<Object>} 批改结果，包含评分、反馈、建议等
   */
  async gradeEssay(essayContent, questionId, context = {}) {
    console.log('[MockAIService] 返回预定义批改结果')

    await new Promise(resolve => setTimeout(resolve, 500))

    const charCount = essayContent.length
    const contentScore = Math.min(10, Math.floor(charCount / 20) + 6)
    const languageScore = Math.min(10, Math.floor(charCount / 25) + 5)
    const structureScore = Math.min(10, Math.floor(charCount / 22) + 6)
    const totalScore = contentScore + languageScore + structureScore

    return {
      scores: {
        content: contentScore,
        structure: structureScore,
        language: languageScore,
        total: totalScore
      },
      feedback: {
        strengths: ['字数符合要求', '结构基本完整'],
        improvements: ['这是模拟批改结果，实际使用时需要真实AI服务']
      },
      suggestions: [
        '检查文章结构是否完整',
        '注意语法和拼写错误',
        '确保回答了题目要求'
      ],
      detailedComments: '这是预定义的批改结果，用于测试环境的模拟响应。实际使用时，AI会根据作文内容提供详细的批改意见。',
      questionId,
      timestamp: Date.now(),
      isFallback: true,
      metadata: {
        isMock: true,
        responseId: 'mock_grading_001'
      }
    }
  }
}

module.exports = MockAIService
