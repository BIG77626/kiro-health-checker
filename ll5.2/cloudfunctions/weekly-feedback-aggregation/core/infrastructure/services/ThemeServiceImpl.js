/**
 * 主题服务实现
 * 通过IStorageAdapter管理主题设置
 * 
 * 架构铁律合规性：
 * - ✅ 依赖接口而非具体实现
 * - ✅ 所有存储操作通过IStorageAdapter
 * - ✅ 输入验证 (S1铁律)
 * - ✅ 错误链完整 (E1铁律)
 * 
 * @class ThemeServiceImpl
 * @implements {IThemeService}
 */

const IThemeService = require('../../application/interfaces/IThemeService')

class ThemeServiceImpl extends IThemeService {
  /**
   * 存储键常量
   */
  static STORAGE_KEYS = {
    HAS_SHOWN_SETUP: 'hasShownThemeSetup',
    THEME: 'theme',
    FOLLOW_SYSTEM: 'theme_followSystem',
    USER_THEME: 'theme_userTheme'
  }

  /**
   * 有效主题值
   */
  static VALID_THEMES = ['light', 'dark']

  /**
   * 构造函数
   * @param {IStorageAdapter} storageAdapter - 存储适配器
   */
  constructor(storageAdapter) {
    super()
    
    if (!storageAdapter) {
      throw new Error('storageAdapter is required')
    }
    
    this.storage = storageAdapter
    console.log('[ThemeServiceImpl] 初始化完成')
  }

  /**
   * 检查是否已显示过主题设置
   * @returns {Promise<boolean>}
   */
  async hasShownThemeSetup() {
    try {
      const value = await this.storage.get(ThemeServiceImpl.STORAGE_KEYS.HAS_SHOWN_SETUP)
      return value === true
    } catch (error) {
      console.error('[ThemeServiceImpl] 检查主题设置状态失败:', error)
      // 默认返回false，允许再次显示
      return false
    }
  }

  /**
   * 标记已显示过主题设置
   * @returns {Promise<void>}
   */
  async markThemeSetupShown() {
    try {
      await this.storage.save(ThemeServiceImpl.STORAGE_KEYS.HAS_SHOWN_SETUP, true)
      console.log('[ThemeServiceImpl] 已标记主题设置已显示')
    } catch (error) {
      throw new Error(
        `Failed to mark theme setup as shown`,
        { cause: error }
      )
    }
  }

  /**
   * 获取当前主题
   * @returns {Promise<string>} 'light' | 'dark'
   */
  async getCurrentTheme() {
    try {
      const theme = await this.storage.get(ThemeServiceImpl.STORAGE_KEYS.THEME)
      
      // 验证主题值
      if (theme && ThemeServiceImpl.VALID_THEMES.includes(theme)) {
        return theme
      }
      
      // 默认返回light
      return 'light'
    } catch (error) {
      console.error('[ThemeServiceImpl] 获取当前主题失败:', error)
      return 'light'
    }
  }

  /**
   * 设置主题
   * @param {string} theme - 'light' | 'dark'
   * @returns {Promise<void>}
   */
  async setTheme(theme) {
    // S1铁律: 输入验证
    if (!theme || typeof theme !== 'string') {
      throw new Error('Theme must be a non-empty string')
    }
    
    if (!ThemeServiceImpl.VALID_THEMES.includes(theme)) {
      throw new Error(
        `Invalid theme: ${theme}. Must be one of: ${ThemeServiceImpl.VALID_THEMES.join(', ')}`
      )
    }
    
    try {
      await this.storage.save(ThemeServiceImpl.STORAGE_KEYS.THEME, theme)
      console.log(`[ThemeServiceImpl] 主题已设置为: ${theme}`)
    } catch (error) {
      throw new Error(
        `Failed to set theme to ${theme}`,
        { cause: error }
      )
    }
  }

  /**
   * 是否跟随系统主题
   * @returns {Promise<boolean>}
   */
  async isFollowingSystem() {
    try {
      const value = await this.storage.get(ThemeServiceImpl.STORAGE_KEYS.FOLLOW_SYSTEM)
      return value === true
    } catch (error) {
      console.error('[ThemeServiceImpl] 检查跟随系统状态失败:', error)
      return false
    }
  }

  /**
   * 设置是否跟随系统主题
   * @param {boolean} follow
   * @returns {Promise<void>}
   */
  async setFollowSystem(follow) {
    // S1铁律: 输入验证
    if (typeof follow !== 'boolean') {
      throw new Error('Follow must be a boolean value')
    }
    
    try {
      await this.storage.save(ThemeServiceImpl.STORAGE_KEYS.FOLLOW_SYSTEM, follow)
      console.log(`[ThemeServiceImpl] 跟随系统主题已设置为: ${follow}`)
    } catch (error) {
      throw new Error(
        `Failed to set follow system to ${follow}`,
        { cause: error }
      )
    }
  }
}

module.exports = ThemeServiceImpl

