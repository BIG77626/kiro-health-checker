/**
 * AI服务代理接口
 * 
 * 安全设计：客户端不应直接调用厂商API，应通过代理层
 * 代理层负责：
 * 1. 密钥管理（密钥存储在服务端/云函数）
 * 2. 限流控制
 * 3. 重试机制
 * 4. 审计日志
 * 
 * @class IAIServiceProxy
 */
class IAIServiceProxy {
  /**
   * 获取题目提示（通过云函数代理）
   * @param {string} questionId - 题目ID
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} AI生成的提示内容
   */
  async getHint(questionId, context = {}) {
    throw new Error('Must implement getHint()')
  }

  /**
   * 批改作文（通过云函数代理）
   * @param {string} essayContent - 作文内容
   * @param {string} questionId - 题目ID
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} 批改结果
   */
  async gradeEssay(essayContent, questionId, context = {}) {
    throw new Error('Must implement gradeEssay()')
  }

  /**
   * 发送消息（通过云函数代理）
   * @param {string} userId - 用户ID
   * @param {string} message - 消息内容
   * @returns {Promise<Object>} AI回复
   */
  async sendMessage(userId, message) {
    throw new Error('Must implement sendMessage()')
  }

  /**
   * 生成学习计划（通过云函数代理）
   * @param {Object} userProfile - 用户信息
   * @param {Object} learningGoals - 学习目标
   * @returns {Promise<Object>} 学习计划
   */
  async generateLearningPlan(userProfile, learningGoals) {
    throw new Error('Must implement generateLearningPlan()')
  }
}

module.exports = IAIServiceProxy

