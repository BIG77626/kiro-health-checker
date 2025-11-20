/**
 * 主题服务接口
 * 管理主题设置相关的业务逻辑
 * 
 * 架构铁律合规性：
 * - ✅ 接口定义在Application层
 * - ✅ 不依赖任何平台API
 * - ✅ 纯业务逻辑抽象
 * 
 * @interface IThemeService
 */
class IThemeService {
  /**
   * 检查是否已显示过主题设置
   * @returns {Promise<boolean>}
   */
  async hasShownThemeSetup() {
    throw new Error('IThemeService.hasShownThemeSetup() must be implemented')
  }

  /**
   * 标记已显示过主题设置
   * @returns {Promise<void>}
   */
  async markThemeSetupShown() {
    throw new Error('IThemeService.markThemeSetupShown() must be implemented')
  }

  /**
   * 获取当前主题
   * @returns {Promise<string>} 'light' | 'dark'
   */
  async getCurrentTheme() {
    throw new Error('IThemeService.getCurrentTheme() must be implemented')
  }

  /**
   * 设置主题
   * @param {string} theme - 'light' | 'dark'
   * @returns {Promise<void>}
   */
  async setTheme(theme) {
    throw new Error('IThemeService.setTheme() must be implemented')
  }

  /**
   * 是否跟随系统主题
   * @returns {Promise<boolean>}
   */
  async isFollowingSystem() {
    throw new Error('IThemeService.isFollowingSystem() must be implemented')
  }

  /**
   * 设置是否跟随系统主题
   * @param {boolean} follow
   * @returns {Promise<void>}
   */
  async setFollowSystem(follow) {
    throw new Error('IThemeService.setFollowSystem() must be implemented')
  }
}

module.exports = IThemeService

