/**
 * 主题相关依赖注入容器
 * 
 * 架构铁律合规性:
 * - ✅ 依赖注入遵循接口隔离原则
 * - ✅ 单例模式避免资源浪费
 * - ✅ 平台适配器可替换
 * 
 * @module themeContainer
 */

const { container } = require('./container')

/**
 * 创建主题相关的DI容器
 * @param {string} platform - 平台类型：'wechat' | 'web' | 'test'
 * @returns {Object} 配置好的容器实例
 */
function createThemeContainer(platform = 'wechat') {
  console.log('[ThemeContainer] 初始化主题相关依赖，平台:', platform)

  // 根据平台选择存储适配器
  let StorageAdapterClass
  if (platform === 'test') {
    StorageAdapterClass = require('../adapters/storage/MemoryStorageAdapter')
    console.log('[ThemeContainer] 使用 MemoryStorageAdapter（测试环境）')
  } else {
    try {
      StorageAdapterClass = require('../adapters/storage/WeChatStorageAdapter')
      console.log('[ThemeContainer] 使用 WeChatStorageAdapter（小程序环境）')
    } catch (error) {
      console.warn('[ThemeContainer] WeChatStorageAdapter 不可用，回退到 MemoryStorageAdapter')
      StorageAdapterClass = require('../adapters/storage/MemoryStorageAdapter')
    }
  }

  // 1. 注册存储适配器（单例）
  container.registerSingleton('IStorageAdapter', () => new StorageAdapterClass())

  // 2. 注册主题服务（单例）
  container.registerSingleton('IThemeService', (c) => {
    const ThemeServiceImpl = require('../services/ThemeServiceImpl')
    return new ThemeServiceImpl(c.resolve('IStorageAdapter'))
  })

  // 3. 注册Use Cases
  container.register('checkThemeSetupStatusUseCase', (c) => {
    const CheckThemeSetupStatusUseCase = require('../../application/use-cases/theme/CheckThemeSetupStatusUseCase')
    return new CheckThemeSetupStatusUseCase(c.resolve('IThemeService'))
  })

  container.register('markThemeSetupShownUseCase', (c) => {
    const MarkThemeSetupShownUseCase = require('../../application/use-cases/theme/MarkThemeSetupShownUseCase')
    return new MarkThemeSetupShownUseCase(c.resolve('IThemeService'))
  })

  console.log('[ThemeContainer] 主题依赖注入容器初始化完成')
  return container
}

module.exports = { createThemeContainer }

