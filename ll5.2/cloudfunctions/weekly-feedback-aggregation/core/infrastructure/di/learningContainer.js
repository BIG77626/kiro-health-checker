/**
 * 学习会话相关依赖注入容器
 * 专门为间隔重复学习功能配置的DI容器
 */
const { container } = require('./container')

// 学习相关的接口定义
const IVocabularyRepository = require('../../application/interfaces/IVocabularyRepository')
const IDateService = require('../../application/interfaces/IDateService')
const IStorageAdapter = require('../../application/interfaces/IStorageAdapter')

// 实现类
const VocabularyRepositoryImpl = require('../repositories/VocabularyRepositoryImpl')
const DateServiceImpl = require('../services/DateServiceImpl')
const SpacedRepetitionEngine = require('../../domain/services/SpacedRepetitionEngine')

// Use Cases
const StartLearningSessionUseCase = require('../../application/use-cases/learning/StartLearningSessionUseCase')
const RecordReviewResultUseCase = require('../../application/use-cases/learning/RecordReviewResultUseCase')

/**
 * 创建学习相关的DI容器
 * @param {string} platform - 平台类型：'wechat' | 'web' | 'test'
 * @returns {Object} 配置好的容器实例
 */
function createLearningContainer(platform = 'wechat') {
  console.log('[LearningContainer] 初始化学习会话相关依赖，平台:', platform)

  // 根据平台选择存储适配器
  let StorageAdapterClass
  if (platform === 'test') {
    // 测试环境使用内存存储
    StorageAdapterClass = require('../adapters/storage/MemoryStorageAdapter')
    console.log('[LearningContainer] 使用 MemoryStorageAdapter（测试环境）')
  } else {
    // 生产环境尝试使用微信存储
    try {
      StorageAdapterClass = require('../adapters/storage/WeChatStorageAdapter')
      console.log('[LearningContainer] 使用 WeChatStorageAdapter（小程序环境）')
    } catch (error) {
      // 回退到内存存储
      console.warn('[LearningContainer] WeChatStorageAdapter 不可用，回退到 MemoryStorageAdapter')
      StorageAdapterClass = require('../adapters/storage/MemoryStorageAdapter')
    }
  }

  // 1. 注册存储适配器（单例）
  container.registerSingleton('IStorageAdapter', () => new StorageAdapterClass())

  // 2. 注册日期服务（单例）
  container.registerSingleton('IDateService', () => new DateServiceImpl())

  // 3. 注册领域服务（单例）
  container.registerSingleton('SpacedRepetitionEngine', () => new SpacedRepetitionEngine())

  // 4. 注册仓储（单例）
  container.registerSingleton('IVocabularyRepository', (c) => {
    return new VocabularyRepositoryImpl(
      c.resolve('IStorageAdapter'),
      c.resolve('IDateService')
    )
  })

  // 5. 注册 Use Cases（每次创建新实例）
  container.register('StartLearningSessionUseCase', (c) => {
    return new StartLearningSessionUseCase({
      vocabularyRepository: c.resolve('IVocabularyRepository'),
      dateService: c.resolve('IDateService'),
      spacedRepetitionEngine: c.resolve('SpacedRepetitionEngine')
    })
  })

  container.register('RecordReviewResultUseCase', (c) => {
    return new RecordReviewResultUseCase({
      vocabularyRepository: c.resolve('IVocabularyRepository'),
      dateService: c.resolve('IDateService'),
      spacedRepetitionEngine: c.resolve('SpacedRepetitionEngine')
    })
  })

  console.log('[LearningContainer] 学习会话依赖初始化完成')
  console.log('[LearningContainer] 已注册服务:', [
    'IStorageAdapter',
    'IDateService',
    'SpacedRepetitionEngine',
    'IVocabularyRepository',
    'StartLearningSessionUseCase',
    'RecordReviewResultUseCase'
  ])

  return container
}

/**
 * 容器测试函数
 * 用于验证所有依赖是否可以正确解析
 */
function testLearningContainer() {
  try {
    const testContainer = createLearningContainer('test')

    // 测试所有服务都能被解析
    const storage = testContainer.resolve('IStorageAdapter')
    const dateService = testContainer.resolve('IDateService')
    const engine = testContainer.resolve('SpacedRepetitionEngine')
    const repository = testContainer.resolve('IVocabularyRepository')
    const startUseCase = testContainer.resolve('StartLearningSessionUseCase')
    const recordUseCase = testContainer.resolve('RecordReviewResultUseCase')

    console.log('[LearningContainer] ✅ 容器测试通过')
    return { success: true }
  } catch (error) {
    console.error('[LearningContainer] ❌ 容器测试失败:', error)
    return { success: false, error: error.message }
  }
}

module.exports = {
  createLearningContainer,
  testLearningContainer
}
