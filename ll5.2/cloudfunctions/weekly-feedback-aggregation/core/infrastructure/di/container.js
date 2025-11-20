/**
 * 依赖注入容器
 * 负责组装和管理所有依赖关系
 *
 * 架构铁律合规：
 * - M1: Map清理策略 - 单例缓存清理
 */
const { addLRUCleanup, addMemoryMonitor } = require('../utils/map-cleanup-utils')

class DIContainer {
  constructor() {
    // 服务注册表 (相对稳定，无需复杂清理)
    this.services = new Map()

    // 单例缓存 (符合M1: Map清理策略 - LRU清理)
    this.singletons = new Map()
    this.singletonsController = addLRUCleanup(this.singletons, {
      maxSize: 50,         // 最大缓存50个单例
      ttl: 24 * 60 * 60 * 1000,  // 24小时TTL
      cleanupInterval: 60 * 60 * 1000  // 1小时清理一次
    })

    // 内存监控 (符合M1)
    this.memoryMonitor = addMemoryMonitor(this.singletons, 'DIContainer-Singletons')
  }

  register(name, factory) {
    this.services.set(name, { type: 'factory', factory })
  }

  registerSingleton(name, factory) {
    this.services.set(name, { type: 'singleton', factory })
  }

  resolve(name) {
    const service = this.services.get(name)
    if (!service) {
      throw new Error(`Service "${name}" not registered`)
    }

    if (service.type === 'singleton') {
      if (!this.singletons.has(name)) {
        this.singletons.set(name, service.factory(this))
      }
      return this.singletons.get(name)
    }

    return service.factory(this)
  }

  /**
   * 获取容器统计信息 (符合M1: Map清理策略)
   * @returns {Object} 统计信息
   */
  getStats() {
    return {
      services: {
        count: this.services.size,
        types: Array.from(this.services.values()).reduce((acc, service) => {
          acc[service.type] = (acc[service.type] || 0) + 1
          return acc
        }, {})
      },
      singletons: this.singletonsController.getStats(),
      memory: this.memoryMonitor.getStats()
    }
  }

  /**
   * 手动清理单例缓存 (符合M1: Map清理策略)
   */
  cleanup() {
    this.singletonsController.cleanup()
    console.log('[DIContainer] Singleton cache cleaned up')
  }

  /**
   * 销毁容器，清理所有资源 (符合M2: 定时器生命周期管理)
   */
  destroy() {
    // 清理单例缓存控制器
    if (this.singletonsController) {
      this.singletonsController.destroy()
    }

    // 清理注册表
    this.services.clear()
    this.singletons.clear()

    console.log('[DIContainer] Container destroyed and resources cleaned up')
  }
}

// 创建全局容器实例
const container = new DIContainer()

/**
 * 初始化容器
 * Phase 1: 只初始化本地功能，无云端依赖
 */
function initializeContainer(platform = 'wechat') {
  console.log('[DIContainer] 初始化 Phase 1 - 本地功能')

  // 1. 注册存储适配器（单例）
  if (platform === 'wechat') {
    const WeChatStorageAdapter = require('../adapters/storage/WeChatStorageAdapter')
    container.registerSingleton('storageAdapter', () => new WeChatStorageAdapter())
  } else if (platform === 'web') {
    // TODO: Web 存储适配器
  }

  // 2. 注册云适配器（单例）
  if (platform === 'wechat') {
    const WeChatCloudAdapter = require('../adapters/cloud/WeChatCloudAdapter')
    container.registerSingleton('cloudAdapter', () => new WeChatCloudAdapter())
  }

  // 3. 注册仓储（单例）
  const UserRepositoryImpl = require('../repositories/UserRepositoryImpl')
  container.registerSingleton('userRepository', (c) => {
    return new UserRepositoryImpl(c.resolve('storageAdapter'))
  })

  // 4. 注册日期服务（单例）
  const DateServiceImpl = require('../services/DateServiceImpl')
  container.registerSingleton('dateService', () => new DateServiceImpl())

  // 5. 注册用例（每次创建新实例）
  const LoginUserUseCase = require('../../application/use-cases/user/LoginUserUseCase')
  container.register('loginUserUseCase', (c) => {
    return new LoginUserUseCase(c.resolve('userRepository'))
  })

  const RegisterUserUseCase = require('../../application/use-cases/user/RegisterUserUseCase')
  container.register('registerUserUseCase', (c) => {
    return new RegisterUserUseCase(c.resolve('userRepository'))
  })

  // Phase 3.2 新增用例
  const GetUserProfileUseCase = require('../../application/use-cases/user/GetUserProfileUseCase')
  container.register('getUserProfileUseCase', (c) => {
    return new GetUserProfileUseCase(c.resolve('userRepository'), c.resolve('dateService'))
  })

  const GetStudyStatisticsUseCase = require('../../application/use-cases/user/GetStudyStatisticsUseCase')
  container.register('getStudyStatisticsUseCase', (c) => {
    return new GetStudyStatisticsUseCase(c.resolve('userRepository'), c.resolve('dateService'))
  })

  const WeChatLoginUseCase = require('../../application/use-cases/user/WeChatLoginUseCase')
  container.register('weChatLoginUseCase', (c) => {
    return new WeChatLoginUseCase(c.resolve('userRepository'), c.resolve('cloudAdapter'))
  })

  const LogoutUserUseCase = require('../../application/use-cases/user/LogoutUserUseCase')
  container.register('logoutUserUseCase', (c) => {
    return new LogoutUserUseCase(c.resolve('userRepository'), c.resolve('storageAdapter'))
  })

  const SyncUserDataUseCase = require('../../application/use-cases/user/SyncUserDataUseCase')
  container.register('syncUserDataUseCase', (c) => {
    return new SyncUserDataUseCase(c.resolve('userRepository'), c.resolve('storageAdapter'))
  })

  const ClearCacheUseCase = require('../../application/use-cases/system/ClearCacheUseCase')
  container.register('clearCacheUseCase', (c) => {
    return new ClearCacheUseCase(c.resolve('storageAdapter'))
  })

  // AI相关服务和用例
  const AIServiceImpl = require('../services/AIServiceImpl')
  container.registerSingleton('aiService', () => new AIServiceImpl())

  const SendAIMessageUseCase = require('../../application/use-cases/ai/SendAIMessageUseCase')
  container.register('sendAIMessageUseCase', (c) => {
    return new SendAIMessageUseCase(c.resolve('aiService'))
  })

  const GetRecommendedCoursesUseCase = require('../../application/use-cases/ai/GetRecommendedCoursesUseCase')
  container.register('getRecommendedCoursesUseCase', (c) => {
    return new GetRecommendedCoursesUseCase(c.resolve('aiService'))
  })

  const GetCourseDetailUseCase = require('../../application/use-cases/ai/GetCourseDetailUseCase')
  container.register('getCourseDetailUseCase', (c) => {
    return new GetCourseDetailUseCase(c.resolve('aiService'))
  })

  // 练习相关服务和用例
  const PracticeRepositoryImpl = require('../repositories/PracticeRepositoryImpl')
  container.registerSingleton('practiceRepository', () => new PracticeRepositoryImpl(container.resolve('storageAdapter')))

  const GetPaperByIdUseCase = require('../../application/use-cases/practice/GetPaperByIdUseCase')
  container.register('getPaperByIdUseCase', (c) => {
    return new GetPaperByIdUseCase(c.resolve('practiceRepository'))
  })

  const RecordAnswerUseCase = require('../../application/use-cases/practice/RecordAnswerUseCase')
  container.register('recordAnswerUseCase', (c) => {
    return new RecordAnswerUseCase(c.resolve('practiceRepository'))
  })

  const SubmitAnswersUseCase = require('../../application/use-cases/practice/SubmitAnswersUseCase')
  container.register('submitAnswersUseCase', (c) => {
    return new SubmitAnswersUseCase(c.resolve('practiceRepository'))
  })

  const GetPracticeStatisticsUseCase = require('../../application/use-cases/practice/GetPracticeStatisticsUseCase')
  container.register('getPracticeStatisticsUseCase', (c) => {
    return new GetPracticeStatisticsUseCase(c.resolve('practiceRepository'))
  })

  console.log('[DIContainer] Phase 1 + 3.2 初始化完成')
  console.log('[DIContainer] 已注册服务: storageAdapter, cloudAdapter, userRepository, dateService, 多个用例...')
}

module.exports = {
  container,
  initializeContainer
}
