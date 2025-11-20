/**
 * 替代策略配置 - P1-003短期反馈响应
 * 
 * === AI Native理念 ===
 * 当用户"踩"AI建议时，立即提供3种不同角度的替代方案：
 * 1. 简化策略 - 降低复杂度，更易理解
 * 2. 详细策略 - 增加深度，提供更多细节
 * 3. 换角度策略 - 从不同视角重新阐述
 * 
 * === 使用场景 ===
 * - conversation: AI对话建议
 * - translation: 翻译结果
 * - writing: 写作批改
 * - recommendation: 学习推荐
 * 
 * === 失败场景处理 ===
 * - 所有策略失败 → 使用通用回复模板
 * - AI服务不可用 → 降级到预设模板
 * - 超时 → 异步生成，先返回loading状态
 * 
 * @module AlternativeStrategies
 */

/**
 * 策略1: 简化表达
 * 目标: 降低复杂度，使用更简单的语言
 */
const SIMPLIFY_STRATEGY = {
  id: 'simplify',
  name: '简化表达',
  description: '用更简单的方式重新表达',
  
  /**
   * 生成简化版Prompt
   * @param {Object} context - 原始内容上下文
   * @param {string} context.contentType - 内容类型
   * @param {string} context.originalContent - 原始内容
   * @param {Object} context.metadata - 额外元数据
   * @returns {string} - 简化策略的Prompt
   */
  generatePrompt(context) {
    const { contentType, originalContent, metadata } = context
    
    const basePrompt = `请用更简单、更直白的方式重新表达以下内容。
要求：
- 使用简单词汇，避免复杂表述
- 句子简短，逻辑清晰
- 保留核心要点，去除冗余

原始内容：
${originalContent}
`
    
    // 根据内容类型定制
    switch (contentType) {
      case 'conversation':
        return basePrompt + `\n提示：这是AI对话回复，用户可能觉得太复杂了。`
      
      case 'translation':
        return basePrompt + `\n提示：这是翻译结果，用户可能觉得不够流畅。请提供更通俗易懂的译文。`
      
      case 'writing':
        return basePrompt + `\n提示：这是写作批改建议，用户可能觉得太专业了。请用更简单的方式指出问题。`
      
      case 'recommendation':
        return basePrompt + `\n提示：这是学习推荐，用户可能觉得太抽象了。请用更具体的方式说明。`
      
      default:
        return basePrompt
    }
  },
  
  /**
   * 预设模板（AI服务不可用时）
   */
  fallbackTemplate: {
    conversation: '让我用更简单的话来说：[核心观点]',
    translation: '换个更通俗的说法：[译文]',
    writing: '简单来说，你需要注意：[要点]',
    recommendation: '我建议你这样做：[具体步骤]'
  }
}

/**
 * 策略2: 详细解释
 * 目标: 增加深度，提供更多背景和细节
 */
const ELABORATE_STRATEGY = {
  id: 'elaborate',
  name: '详细解释',
  description: '提供更多细节和背景信息',
  
  generatePrompt(context) {
    const { contentType, originalContent, metadata } = context
    
    const basePrompt = `请对以下内容进行更详细的解释和扩展。
要求：
- 补充背景知识和原理
- 提供具体例子和案例
- 解释"为什么"和"怎么做"
- 逻辑完整，层次清晰

原始内容：
${originalContent}
`
    
    switch (contentType) {
      case 'conversation':
        return basePrompt + `\n提示：这是AI对话回复，用户可能觉得不够详细。请补充更多背景和例子。`
      
      case 'translation':
        return basePrompt + `\n提示：这是翻译结果，用户可能想知道更多细节。请解释翻译思路和难点。`
      
      case 'writing':
        return basePrompt + `\n提示：这是写作批改建议，用户可能想知道更多原因。请详细解释为什么要这样改。`
      
      case 'recommendation':
        return basePrompt + `\n提示：这是学习推荐，用户可能想知道具体怎么做。请提供详细的学习路径和方法。`
      
      default:
        return basePrompt
    }
  },
  
  fallbackTemplate: {
    conversation: '让我详细解释一下：[详细论述]。具体来说，[例子]',
    translation: '这里的翻译考虑了：[翻译思路]。具体分析：[细节]',
    writing: '这样改的原因是：[原理]。举个例子：[案例]',
    recommendation: '详细学习路径：1. [步骤1] 2. [步骤2] 3. [步骤3]'
  }
}

/**
 * 策略3: 换角度阐述
 * 目标: 从不同视角重新表达，提供新的理解方式
 */
const REFRAME_STRATEGY = {
  id: 'reframe',
  name: '换个角度',
  description: '从不同视角重新理解',
  
  generatePrompt(context) {
    const { contentType, originalContent, metadata } = context
    
    const basePrompt = `请从不同的角度重新阐述以下内容。
要求：
- 切换视角或立场
- 提供新的理解方式
- 打破固有思维
- 保持准确性

原始内容：
${originalContent}
`
    
    switch (contentType) {
      case 'conversation':
        return basePrompt + `\n提示：这是AI对话回复，用户可能觉得角度不合适。请从实用性、效率、趣味性等不同角度重新表达。`
      
      case 'translation':
        return basePrompt + `\n提示：这是翻译结果，用户可能想要不同风格。请提供更口语化/更书面化的译文。`
      
      case 'writing':
        return basePrompt + `\n提示：这是写作批改建议，用户可能想换个角度理解。请从读者视角/考试评分视角重新分析。`
      
      case 'recommendation':
        return basePrompt + `\n提示：这是学习推荐，用户可能想换个方式学习。请提供不同的学习方法或路径。`
      
      default:
        return basePrompt
    }
  },
  
  fallbackTemplate: {
    conversation: '换个角度看：[新视角]。这样理解可能更合适：[重新表述]',
    translation: '如果换种说法：[不同风格译文]',
    writing: '从另一个角度：[新的建议]',
    recommendation: '你也可以尝试：[替代方案]'
  }
}

/**
 * 通用回复模板（所有策略失败时使用）
 */
const GENERIC_FALLBACK = {
  conversation: '抱歉我的回答不够好。让我换个方式来帮助你解决这个问题。',
  translation: '让我重新为你翻译这段内容，争取更准确。',
  writing: '我会用更合适的方式来指出这些问题。',
  recommendation: '让我为你推荐一个更适合你的学习方案。'
}

/**
 * 导出所有策略
 */
module.exports = {
  // 3种核心策略
  SIMPLIFY_STRATEGY,
  ELABORATE_STRATEGY,
  REFRAME_STRATEGY,
  
  // 通用降级模板
  GENERIC_FALLBACK,
  
  /**
   * 获取所有可用策略
   * @returns {Array} 策略数组
   */
  getAllStrategies() {
    return [
      SIMPLIFY_STRATEGY,
      ELABORATE_STRATEGY,
      REFRAME_STRATEGY
    ]
  },
  
  /**
   * 根据反馈类型选择最佳策略
   * @param {string} feedbackType - 反馈类型（accuracy/clarity/relevance/style）
   * @returns {Object} 推荐的策略
   */
  selectBestStrategy(feedbackType) {
    switch (feedbackType) {
      case 'clarity':
        return SIMPLIFY_STRATEGY // 不够清晰 → 简化
      
      case 'depth':
        return ELABORATE_STRATEGY // 不够深入 → 详细
      
      case 'relevance':
      case 'style':
        return REFRAME_STRATEGY // 不够相关 → 换角度
      
      default:
        return SIMPLIFY_STRATEGY // 默认简化
    }
  },
  
  /**
   * 获取降级模板
   * @param {string} contentType - 内容类型
   * @param {string} strategyId - 策略ID
   * @returns {string} 降级模板
   */
  getFallbackTemplate(contentType, strategyId) {
    const strategy = this.getAllStrategies().find(s => s.id === strategyId)
    
    if (strategy && strategy.fallbackTemplate[contentType]) {
      return strategy.fallbackTemplate[contentType]
    }
    
    // 使用通用降级
    return GENERIC_FALLBACK[contentType] || GENERIC_FALLBACK.conversation
  }
}
