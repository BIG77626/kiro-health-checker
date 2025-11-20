/**
 * AI 服务接口
 * 定义 AI 助手提供的各种功能，如生成提示、分析数据、制定计划等
 */
class IAIService {
  /**
   * 生成学习提示或建议
   * @param {string} question - 用户问题或学习内容
   * @param {Object} context - 上下文信息
   * @returns {Promise<Object>} AI生成的提示内容，包含hint和suggestions
   */
  async generateHint(question, context = {}) {
    throw new Error('Must implement generateHint()')
  }

  /**
   * 分析用户学习数据并提供诊断
   * @param {string} userId - 用户ID
   * @param {Object} data - 学习数据
   * @returns {Promise<Object>} 分析报告
   */
  async analyzeData(userId, data) {
    throw new Error('Must implement analyzeData()')
  }

  /**
   * 根据用户目标和数据生成学习计划
   * @param {string} userId - 用户ID
   * @param {Object} goals - 学习目标
   * @returns {Promise<Object>} 学习计划
   */
  async generatePlan(userId, goals) {
    throw new Error('Must implement generatePlan()')
  }

  /**
   * 处理AI对话消息
   * @param {string} userId - 用户ID
   * @param {string} message - 用户消息
   * @returns {Promise<Object>} AI回复
   */
  async sendMessage(userId, message) {
    throw new Error('Must implement sendMessage()')
  }

  /**
   * 获取推荐课程
   * @param {Object} params - 查询参数
   * @param {string} params.category - 课程类别
   * @param {number} params.limit - 限制数量
   * @returns {Promise<Array>} 推荐课程列表
   */
  async getRecommendedCourses(params = {}) {
    throw new Error('Must implement getRecommendedCourses()')
  }

  /**
   * 获取课程详情
   * @param {string} courseId - 课程ID
   * @returns {Promise<Object>} 课程详情
   */
  async getCourseDetail(courseId) {
    throw new Error('Must implement getCourseDetail()')
  }

  /**
   * 获取题目提示（用于练习页面）
   * @param {string} questionId - 题目ID
   * @param {Object} context - 上下文信息（包含题目内容、用户答案、题型等）
   * @returns {Promise<Object>} AI生成的提示内容
   */
  async getHint(questionId, context = {}) {
    throw new Error('Must implement getHint()')
  }

  /**
   * 批改作文（用于写作练习）
   * @param {string} essayContent - 作文内容
   * @param {string} questionId - 题目ID
   * @param {Object} context - 上下文信息（包含题目要求、评分标准等）
   * @returns {Promise<Object>} 批改结果，包含评分、反馈、建议等
   */
  async gradeEssay(essayContent, questionId, context = {}) {
    throw new Error('Must implement gradeEssay()')
  }
}

module.exports = IAIService;