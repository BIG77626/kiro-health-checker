/**
 * 微信云函数AI服务代理
 * 
 * 安全设计：所有AI调用通过云函数代理，密钥不暴露在客户端
 * 
 * 注意：此代理实现IAIService接口，以便在DI容器中作为IAIService使用
 * 
 * @class WeChatCloudAIServiceProxy
 * @implements {IAIService}
 */
const IAIService = require('../../../application/interfaces/IAIService')
const ICloudAdapter = require('../../../application/interfaces/ICloudAdapter')

class WeChatCloudAIServiceProxy extends IAIService {
  /**
   * 构造函数
   * @param {ICloudAdapter} cloudAdapter - 云函数适配器
   */
  constructor(cloudAdapter) {
    super()
    
    if (!cloudAdapter) {
      throw new Error('cloudAdapter is required')
    }
    
    if (typeof cloudAdapter.callFunction !== 'function') {
      throw new Error('cloudAdapter must implement callFunction')
    }
    
    this.cloudAdapter = cloudAdapter
    this.cloudFunctionName = 'ai-service' // 统一的AI服务云函数名称
  }

  /**
   * 获取题目提示（通过云函数代理）
   * @param {string} questionId - 题目ID
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} AI生成的提示内容
   */
  async getHint(questionId, context = {}) {
    try {
      const result = await this.cloudAdapter.callFunction(this.cloudFunctionName, {
        action: 'getHint',
        questionId,
        context
      })

      if (!result.success) {
        throw new Error(result.error || '获取提示失败')
      }

      return {
        success: true,
        hint: result.data.hint,
        questionId: result.data.questionId,
        timestamp: result.data.timestamp || Date.now()
      }
    } catch (error) {
      console.error('[WeChatCloudAIServiceProxy] getHint failed:', error)
      return {
        success: false,
        error: error.message || '获取提示失败，请稍后重试',
        hint: '提示功能暂时不可用，请稍后重试。'
      }
    }
  }

  /**
   * 批改作文（通过云函数代理）
   * @param {string} essayContent - 作文内容
   * @param {string} questionId - 题目ID
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 批改结果
   */
  async gradeEssay(essayContent, questionId, context = {}) {
    try {
      const result = await this.cloudAdapter.callFunction(this.cloudFunctionName, {
        action: 'gradeEssay',
        essayContent,
        questionId,
        context
      })

      if (!result.success) {
        throw new Error(result.error || '批改失败')
      }

      return {
        success: true,
        ...result.data
      }
    } catch (error) {
      console.error('[WeChatCloudAIServiceProxy] gradeEssay failed:', error)
      return {
        success: false,
        error: error.message || '批改失败，请稍后重试',
        scores: {
          content: 0,
          structure: 0,
          language: 0,
          total: 0
        },
        feedback: {
          strengths: [],
          improvements: ['批改服务暂时不可用，请稍后重试']
        },
        suggestions: [],
        detailedComments: `批改服务暂时不可用：${error.message}。请稍后重试。`,
        isFallback: true
      }
    }
  }

  /**
   * 发送消息（通过云函数代理）
   * @param {string} userId - 用户ID
   * @param {string} message - 消息内容
   * @returns {Promise<Object>} AI回复
   */
  async sendMessage(userId, message) {
    try {
      const result = await this.cloudAdapter.callFunction(this.cloudFunctionName, {
        action: 'sendMessage',
        userId,
        message
      })

      if (!result.success) {
        throw new Error(result.error || '发送消息失败')
      }

      return result.data
    } catch (error) {
      console.error('[WeChatCloudAIServiceProxy] sendMessage failed:', error)
      throw error
    }
  }

  /**
   * 生成学习计划（通过云函数代理）
   * @param {Object} userProfile - 用户信息
   * @param {Object} learningGoals - 学习目标
   * @returns {Promise<Object>} 学习计划
   */
  async generateLearningPlan(userProfile, learningGoals) {
    try {
      const result = await this.cloudAdapter.callFunction(this.cloudFunctionName, {
        action: 'generateLearningPlan',
        userProfile,
        learningGoals
      })

      if (!result.success) {
        throw new Error(result.error || '生成学习计划失败')
      }

      return result.data
    } catch (error) {
      console.error('[WeChatCloudAIServiceProxy] generateLearningPlan failed:', error)
      throw error
    }
  }

  // ========== IAIService接口的其他方法实现 ==========

  /**
   * 生成学习提示（兼容IAIService接口）
   * @param {string} question - 用户的问题或学习内容
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} AI生成的提示内容
   */
  async generateHint(question, context = {}) {
    // 兼容旧接口，内部调用getHint
    const questionId = context.questionId || `temp_${Date.now()}`
    const result = await this.getHint(questionId, { ...context, question })
    return {
      hint: result.hint,
      suggestions: result.suggestions || [],
      metadata: {
        isProxy: true,
        responseId: `proxy_hint_${Date.now()}`
      }
    }
  }

  /**
   * 分析用户学习数据（通过云函数代理）
   * @param {string} userId - 用户ID
   * @param {Object} data - 学习数据
   * @returns {Promise<Object>} 分析报告
   */
  async analyzeData(userId, data) {
    try {
      const result = await this.cloudAdapter.callFunction(this.cloudFunctionName, {
        action: 'analyzeData',
        userId,
        data
      })

      if (!result.success) {
        throw new Error(result.error || '分析数据失败')
      }

      return result.data
    } catch (error) {
      console.error('[WeChatCloudAIServiceProxy] analyzeData failed:', error)
      throw error
    }
  }

  /**
   * 根据用户目标和数据生成学习计划（兼容IAIService接口）
   * @param {string} userId - 用户ID
   * @param {Object} goals - 学习目标
   * @returns {Promise<Object>} 学习计划
   */
  async generatePlan(userId, goals) {
    // 兼容旧接口，内部调用generateLearningPlan
    const userProfile = { userId }
    return await this.generateLearningPlan(userProfile, goals)
  }

  /**
   * 获取推荐课程（通过云函数代理）
   * @param {Object} params - 查询参数
   * @returns {Promise<Array>} 推荐课程列表
   */
  async getRecommendedCourses(params = {}) {
    try {
      const result = await this.cloudAdapter.callFunction(this.cloudFunctionName, {
        action: 'getRecommendedCourses',
        params
      })

      if (!result.success) {
        throw new Error(result.error || '获取推荐课程失败')
      }

      return result.data || []
    } catch (error) {
      console.error('[WeChatCloudAIServiceProxy] getRecommendedCourses failed:', error)
      return []
    }
  }

  /**
   * 获取课程详情（通过云函数代理）
   * @param {string} courseId - 课程ID
   * @returns {Promise<Object>} 课程详情
   */
  async getCourseDetail(courseId) {
    try {
      const result = await this.cloudAdapter.callFunction(this.cloudFunctionName, {
        action: 'getCourseDetail',
        courseId
      })

      if (!result.success) {
        throw new Error(result.error || '获取课程详情失败')
      }

      return result.data
    } catch (error) {
      console.error('[WeChatCloudAIServiceProxy] getCourseDetail failed:', error)
      throw error
    }
  }
}

module.exports = WeChatCloudAIServiceProxy

