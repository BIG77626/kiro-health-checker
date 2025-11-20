/**
 * Profile页面依赖注入容器
 *
 * 专门为个人中心页面配置的DI容器
 * 管理用户资料、登录、数据同步等功能的依赖关系
 */
const { container } = require('./container')

// 应用层接口
const IUserRepository = require('../../application/interfaces/IUserRepository')
const IDateService = require('../../application/interfaces/IDateService')
const IStorageAdapter = require('../../application/interfaces/IStorageAdapter')
const ICloudAdapter = require('../../application/interfaces/ICloudAdapter')

// 实现类
const UserRepositoryImpl = require('../repositories/UserRepositoryImpl')
const DateServiceImpl = require('../services/DateServiceImpl')
const WeChatCloudAdapter = require('../adapters/cloud/WeChatCloudAdapter')

// Profile相关的Use Cases
const GetUserProfileUseCase = require('../../application/use-cases/user/GetUserProfileUseCase')
const GetStudyStatisticsUseCase = require('../../application/use-cases/user/GetStudyStatisticsUseCase')
const WeChatLoginUseCase = require('../../application/use-cases/user/WeChatLoginUseCase')
const LogoutUserUseCase = require('../../application/use-cases/user/LogoutUserUseCase')
const SyncUserDataUseCase = require('../../application/use-cases/user/SyncUserDataUseCase')
const ClearCacheUseCase = require('../../application/use-cases/system/ClearCacheUseCase')

// ViewModel
const ProfileViewModel = require('../../../pages/profile/ProfileViewModel')

/**
 * 创建Profile页面的DI容器
 * @param {string} platform - 平台类型：'wechat' | 'web' | 'test'
 * @returns {Object} 配置好的容器实例
 */
function createProfileContainer(platform = 'wechat') {
  console.log('[ProfileContainer] 初始化个人中心页面相关依赖，平台:', platform)

  // 根据平台选择适配器
  let StorageAdapterClass
  let CloudAdapterClass

  if (platform === 'test') {
    // 测试环境使用内存存储和Mock云端
    StorageAdapterClass = require('../adapters/storage/MemoryStorageAdapter')
    CloudAdapterClass = require('../adapters/cloud/MockCloudAdapter')
    console.log('[ProfileContainer] 使用 MemoryStorageAdapter + MockCloudAdapter（测试环境）')
  } else {
    // 生产环境使用微信存储和云端
    try {
      StorageAdapterClass = require('../adapters/storage/WeChatStorageAdapter')
      CloudAdapterClass = WeChatCloudAdapter
      console.log('[ProfileContainer] 使用 WeChatStorageAdapter + WeChatCloudAdapter（小程序环境）')
    } catch (error) {
      // 回退到内存存储
      console.warn('[ProfileContainer] 微信适配器不可用，回退到内存存储')
      StorageAdapterClass = require('../adapters/storage/MemoryStorageAdapter')
      CloudAdapterClass = require('../adapters/cloud/MockCloudAdapter')
    }
  }

  // 1. 注册基础服务（单例）
  container.registerSingleton('storageAdapter', () => new StorageAdapterClass())
  container.registerSingleton('cloudAdapter', () => new CloudAdapterClass())
  container.registerSingleton('dateService', () => new DateServiceImpl())

  // 2. 注册仓储层（单例）
  container.registerSingleton('userRepository', (c) => new UserRepositoryImpl(c.resolve('storageAdapter')))

  // 3. 注册应用层Use Cases
  container.register('getUserProfileUseCase', (c) => {
    return new GetUserProfileUseCase(
      c.resolve('userRepository'),
      c.resolve('dateService')
    )
  })

  container.register('getStudyStatisticsUseCase', (c) => {
    return new GetStudyStatisticsUseCase(
      c.resolve('userRepository'),
      c.resolve('dateService')
    )
  })

  container.register('weChatLoginUseCase', (c) => {
    return new WeChatLoginUseCase(
      c.resolve('userRepository'),
      c.resolve('cloudAdapter')
    )
  })

  container.register('logoutUserUseCase', (c) => {
    return new LogoutUserUseCase(
      c.resolve('userRepository'),
      c.resolve('storageAdapter')
    )
  })

  container.register('syncUserDataUseCase', (c) => {
    return new SyncUserDataUseCase(
      c.resolve('userRepository'),
      c.resolve('storageAdapter')
    )
  })

  container.register('clearCacheUseCase', (c) => {
    return new ClearCacheUseCase(
      c.resolve('storageAdapter')
    )
  })

  // 4. 注册视图模型
  container.register('profileViewModel', (c) => {
    return new ProfileViewModel({
      getUserProfileUseCase: c.resolve('getUserProfileUseCase'),
      getStudyStatisticsUseCase: c.resolve('getStudyStatisticsUseCase'),
      weChatLoginUseCase: c.resolve('weChatLoginUseCase'),
      logoutUserUseCase: c.resolve('logoutUserUseCase'),
      syncUserDataUseCase: c.resolve('syncUserDataUseCase'),
      clearCacheUseCase: c.resolve('clearCacheUseCase'),
      storageAdapter: c.resolve('storageAdapter'),
      dateService: c.resolve('dateService')
    })
  })

  console.log('[ProfileContainer] Profile页面依赖注入容器初始化完成')

  return container
}

module.exports = createProfileContainer
