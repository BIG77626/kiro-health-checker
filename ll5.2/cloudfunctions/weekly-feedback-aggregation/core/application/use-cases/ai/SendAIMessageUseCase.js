/**
 * 发送AI消息用例
 * 处理用户与AI的对话交互
 */
class SendAIMessageUseCase {
  constructor(aiService) {
    if (!aiService) {
      throw new Error('aiService is required');
    }
    this.aiService = aiService;
  }

  /**
   * 执行发送AI消息
   * @param {Object} params - 参数
   * @param {string} params.userId - 用户ID
   * @param {string} params.message - 用户消息
   * @param {Object} params.context - 上下文信息
   * @returns {Promise<Object>} AI回复结果
   */
  async execute({ userId, message, context = {} }) {
    if (!userId) {
      throw new Error('User ID is required');
    }
    if (!message || !message.trim()) {
      throw new Error('Message is required');
    }

    try {
      const result = await this.aiService.sendMessage(userId, message.trim(), context);

      return {
        success: true,
        response: result,
        data: {
          response: result
        }
      };
    } catch (error) {
      console.error('SendAIMessageUseCase execute error:', error);
      throw new Error(`AI对话失败: ${error.message}`);
    }
  }
}

module.exports = SendAIMessageUseCase;
