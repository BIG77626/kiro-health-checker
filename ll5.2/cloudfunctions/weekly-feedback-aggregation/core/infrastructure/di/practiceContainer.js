/**
 * 练习会话相关依赖注入容器
 * 专门为Practice页面配置的DI容器，支持4种题型和完整练习生命周期
 */
const { container } = require('./container')

// Practice相关的接口定义
const IPracticeSessionRepository = require('../../application/interfaces/IPracticeSessionRepository')
const IQuestionRepository = require('../../application/interfaces/IQuestionRepository')
const IAnswerRepository = require('../../application/interfaces/IAnswerRepository')
const IDateService = require('../../application/interfaces/IDateService')
const IStorageAdapter = require('../../application/interfaces/IStorageAdapter')
const IAIService = require('../../application/interfaces/IAIService')
const ICloudAdapter = require('../../application/interfaces/ICloudAdapter')

// 实现类
const PracticeSessionRepository = require('../repositories/PracticeSessionRepository')
const QuestionRepository = require('../repositories/QuestionRepository')
const AnswerRepository = require('../repositories/AnswerRepository')
const DateServiceImpl = require('../services/DateServiceImpl')

// Use Cases
const StartPracticeSessionUseCase = require('../../application/use-cases/practice/StartPracticeSessionUseCase')
const SubmitAnswerUseCase = require('../../application/use-cases/practice/SubmitAnswerUseCase')
const FinishPracticeSessionUseCase = require('../../application/use-cases/practice/FinishPracticeSessionUseCase')
const GetSessionStatisticsUseCase = require('../../application/use-cases/practice/GetSessionStatisticsUseCase')
const ResumePracticeSessionUseCase = require('../../application/use-cases/practice/ResumePracticeSessionUseCase')
const GetNextQuestionUseCase = require('../../application/use-cases/practice/GetNextQuestionUseCase')
const GetPaperByIdUseCase = require('../../application/use-cases/practice/GetPaperByIdUseCase')
const SubmitAnswersUseCase = require('../../application/use-cases/practice/SubmitAnswersUseCase')
const RecordAnswerUseCase = require('../../application/use-cases/practice/RecordAnswerUseCase')
const GetPracticeStatisticsUseCase = require('../../application/use-cases/practice/GetPracticeStatisticsUseCase')

/**
 * 创建练习相关的DI容器
 * @param {string} platform - 平台类型：'wechat' | 'web' | 'test'
 * @returns {Object} 配置好的容器实例
 */
function createPracticeContainer(platform = 'wechat') {
  console.log('[PracticeContainer] 初始化练习会话相关依赖，平台:', platform)

  // 根据平台选择存储适配器
  let StorageAdapterClass
  if (platform === 'test') {
    // 测试环境使用内存存储
    StorageAdapterClass = require('../adapters/storage/MemoryStorageAdapter')
    console.log('[PracticeContainer] 使用 MemoryStorageAdapter（测试环境）')
  } else {
    // 生产环境尝试使用微信存储
    try {
      StorageAdapterClass = require('../adapters/storage/WeChatStorageAdapter')
      console.log('[PracticeContainer] 使用 WeChatStorageAdapter（小程序环境）')
    } catch (error) {
      // 回退到内存存储
      console.warn('[PracticeContainer] WeChatStorageAdapter 不可用，回退到 MemoryStorageAdapter')
      StorageAdapterClass = require('../adapters/storage/MemoryStorageAdapter')
    }
  }

  // 1. 注册存储适配器（单例）
  container.registerSingleton('IStorageAdapter', () => new StorageAdapterClass())

  // 2. 注册日期服务（单例）
  container.registerSingleton('IDateService', () => new DateServiceImpl())

  // 2.5. 注册云函数适配器（单例，用于AI服务代理）
  if (platform === 'wechat') {
    try {
      const WeChatCloudAdapter = require('../adapters/cloud/WeChatCloudAdapter')
      container.registerSingleton('ICloudAdapter', () => {
        console.log('[PracticeContainer] 注册 WeChatCloudAdapter')
        return new WeChatCloudAdapter()
      })
    } catch (error) {
      console.warn('[PracticeContainer] WeChatCloudAdapter不可用，AI服务代理将回退到MockAIService')
    }
  }

  // 3. 注册AI服务（单例）
  // 安全设计：微信小程序环境使用云函数代理，密钥不暴露在客户端
  container.registerSingleton('IAIService', (c) => {
    if (platform === 'test') {
      // 测试环境使用模拟AI服务
      const MockAIService = require('../adapters/ai/MockAIService')
      console.log('[PracticeContainer] 使用 MockAIService（测试环境）')
      return new MockAIService()
    } else if (platform === 'wechat') {
      // 微信小程序环境：使用云函数代理（安全）
      try {
        const WeChatCloudAIServiceProxy = require('../adapters/ai/WeChatCloudAIServiceProxy')
        const cloudAdapter = c.resolve('ICloudAdapter')
        
        if (!cloudAdapter) {
          console.warn('[PracticeContainer] ICloudAdapter未注册，回退到MockAIService')
          const MockAIService = require('../adapters/ai/MockAIService')
          return new MockAIService()
        }
        
        console.log('[PracticeContainer] 使用 WeChatCloudAIServiceProxy（云函数代理，安全）')
        return new WeChatCloudAIServiceProxy(cloudAdapter)
      } catch (error) {
        console.warn('[PracticeContainer] WeChatCloudAIServiceProxy不可用，回退到MockAIService:', error.message)
        const MockAIService = require('../adapters/ai/MockAIService')
        return new MockAIService()
      }
    } else {
      // Node.js/浏览器环境：可以使用QwenAIAdapter（仅后端环境）
      try {
        const QwenAIAdapter = require('../adapters/ai/QwenAIAdapter')
        console.log('[PracticeContainer] 使用 QwenAIAdapter（后端环境）')
        console.warn('[PracticeContainer] ⚠️ 注意：QwenAIAdapter仅应在后端环境使用，不应在客户端使用')
        return new QwenAIAdapter()
      } catch (error) {
        console.warn('[PracticeContainer] QwenAIAdapter不可用，回退到MockAIService')
        const MockAIService = require('../adapters/ai/MockAIService')
        return new MockAIService()
      }
    }
  })

  // 4. 注册Repository（单例）
  container.registerSingleton('IPracticeSessionRepository', (c) => {
    return new PracticeSessionRepository(c.resolve('IStorageAdapter'))
  })

  container.registerSingleton('IQuestionRepository', (c) => {
    return new QuestionRepository(c.resolve('IStorageAdapter'))
  })

  container.registerSingleton('IAnswerRepository', (c) => {
    return new AnswerRepository(c.resolve('IStorageAdapter'), c.resolve('IDateService'))
  })

  // 5. 注册Use Cases
  container.register('startPracticeSessionUseCase', (c) => {
    return new StartPracticeSessionUseCase(
      c.resolve('IPracticeSessionRepository'),
      c.resolve('IQuestionRepository'),
      c.resolve('IDateService')
    )
  })

  container.register('submitAnswerUseCase', (c) => {
    return new SubmitAnswerUseCase(
      c.resolve('IAnswerRepository'),
      c.resolve('IQuestionRepository'),
      c.resolve('IPracticeSessionRepository')
    )
  })

  container.register('finishPracticeSessionUseCase', (c) => {
    return new FinishPracticeSessionUseCase(
      c.resolve('IPracticeSessionRepository'),
      c.resolve('IAnswerRepository'),
      c.resolve('IDateService')
    )
  })

  container.register('getSessionStatisticsUseCase', (c) => {
    return new GetSessionStatisticsUseCase(
      c.resolve('IPracticeSessionRepository'),
      c.resolve('IAnswerRepository')
    )
  })

  container.register('resumePracticeSessionUseCase', (c) => {
    return new ResumePracticeSessionUseCase(
      c.resolve('IPracticeSessionRepository'),
      c.resolve('IAnswerRepository'),
      c.resolve('IDateService')
    )
  })

  container.register('getNextQuestionUseCase', (c) => {
    return new GetNextQuestionUseCase(
      c.resolve('IQuestionRepository'),
      c.resolve('IAnswerRepository'),
      c.resolve('IPracticeSessionRepository')
    )
  })

  container.register('getPaperByIdUseCase', (c) => {
    return new GetPaperByIdUseCase(
      c.resolve('IQuestionRepository')
    )
  })

  container.register('submitAnswersUseCase', (c) => {
    return new SubmitAnswersUseCase(
      c.resolve('IAnswerRepository'),
      c.resolve('IPracticeSessionRepository'),
      c.resolve('IDateService')
    )
  })

  container.register('recordAnswerUseCase', (c) => {
    return new RecordAnswerUseCase(
      c.resolve('IAnswerRepository'),
      c.resolve('IPracticeSessionRepository')
    )
  })

  container.register('getPracticeStatisticsUseCase', (c) => {
    return new GetPracticeStatisticsUseCase(
      c.resolve('IPracticeSessionRepository'),
      c.resolve('IAnswerRepository')
    )
  })

  // 6. 注册ViewModel
  container.register('practiceViewModel', (c) => {
    return new (require('../../../pages/practice/PracticeViewModel'))({
      startPracticeSessionUseCase: c.resolve('startPracticeSessionUseCase'),
      submitAnswerUseCase: c.resolve('submitAnswerUseCase'),
      finishPracticeSessionUseCase: c.resolve('finishPracticeSessionUseCase'),
      getSessionStatisticsUseCase: c.resolve('getSessionStatisticsUseCase'),
      resumePracticeSessionUseCase: c.resolve('resumePracticeSessionUseCase'),
      getNextQuestionUseCase: c.resolve('getNextQuestionUseCase'),
      getPaperByIdUseCase: c.resolve('getPaperByIdUseCase'),
      submitAnswersUseCase: c.resolve('submitAnswersUseCase'),
      recordAnswerUseCase: c.resolve('recordAnswerUseCase'),
      getPracticeStatisticsUseCase: c.resolve('getPracticeStatisticsUseCase'),
      dateService: c.resolve('IDateService'),
      storageAdapter: c.resolve('IStorageAdapter'),
      aiService: c.resolve('IAIService') // 注入AI服务
    })
  })

  console.log('[PracticeContainer] 练习会话依赖注入容器初始化完成')
  return container
}

module.exports = createPracticeContainer
