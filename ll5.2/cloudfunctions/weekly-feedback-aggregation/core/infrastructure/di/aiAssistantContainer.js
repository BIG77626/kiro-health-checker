/**
 * AI助手相关依赖注入容器
 * 专门为AI-Assistant页面配置的DI容器，支持AI对话、学习诊断等功能
 */
const { container } = require('./container')

// AI助手相关的接口定义
const IDateService = require('../../application/interfaces/IDateService')
const IStorageAdapter = require('../../application/interfaces/IStorageAdapter')
const IAIService = require('../../application/interfaces/IAIService')

// 实现类
const DateServiceImpl = require('../services/DateServiceImpl')

/**
 * 创建AI助手相关的DI容器
 * @param {string} platform - 平台类型：'wechat' | 'web' | 'test'
 * @returns {Object} 配置好的容器实例
 */
function createAIAssistantContainer(platform = 'wechat') {
  console.log('[AIAssistantContainer] 初始化AI助手相关依赖，平台:', platform)

  // 根据平台选择存储适配器
  let StorageAdapterClass
  if (platform === 'test') {
    // 测试环境使用内存存储
    StorageAdapterClass = require('../adapters/storage/MemoryStorageAdapter')
    console.log('[AIAssistantContainer] 使用 MemoryStorageAdapter（测试环境）')
  } else {
    // 生产环境尝试使用微信存储
    try {
      StorageAdapterClass = require('../adapters/storage/WeChatStorageAdapter')
      console.log('[AIAssistantContainer] 使用 WeChatStorageAdapter（小程序环境）')
    } catch (error) {
      // 回退到内存存储
      console.warn('[AIAssistantContainer] WeChatStorageAdapter 不可用，回退到 MemoryStorageAdapter')
      StorageAdapterClass = require('../adapters/storage/MemoryStorageAdapter')
    }
  }

  // 根据平台选择AI服务适配器
  let AIServiceClass
  if (platform === 'test') {
    // 测试环境使用模拟AI服务
    AIServiceClass = require('../adapters/ai/MockAIService')
    console.log('[AIAssistantContainer] 使用 MockAIService（测试环境）')
  } else {
    // 生产环境使用Qwen AI服务
    try {
      AIServiceClass = require('../adapters/ai/QwenAIAdapter')
      console.log('[AIAssistantContainer] 使用 QwenAIAdapter（生产环境）')
    } catch (error) {
      // 回退到模拟服务
      console.warn('[AIAssistantContainer] QwenAIAdapter 不可用，回退到 MockAIService')
      AIServiceClass = require('../adapters/ai/MockAIService')
    }
  }

  // 1. 注册存储适配器（单例）
  container.registerSingleton('IStorageAdapter', () => new StorageAdapterClass())

  // 2. 注册日期服务（单例）
  container.registerSingleton('IDateService', () => new DateServiceImpl())

  // 3. 注册AI服务（单例）
  container.registerSingleton('IAIService', () => {
    const aiService = new AIServiceClass()
    console.log('[AIAssistantContainer] AI服务初始化完成')
    return aiService
  })

  // 4. 注册ViewModel
  container.register('aiAssistantViewModel', (c) => {
    return new (require('../../../pages/ai-assistant/AIAssistantViewModel'))({
      aiService: c.resolve('IAIService'),
      storageAdapter: c.resolve('IStorageAdapter'),
      dateService: c.resolve('IDateService')
    })
  })

  console.log('[AIAssistantContainer] AI助手依赖注入容器初始化完成')
  return container
}

module.exports = createAIAssistantContainer
