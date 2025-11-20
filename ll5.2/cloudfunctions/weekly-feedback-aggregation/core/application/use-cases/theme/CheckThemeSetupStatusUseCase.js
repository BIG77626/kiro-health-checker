/**
 * 检查主题设置状态Use Case
 *
 * 架构铁律合规性:
 * - ✅ A1 强制超时机制 - 继承BaseUseCase自动获得超时保护
 * - ✅ Use Case只编排业务逻辑
 * - ✅ 依赖接口而非具体实现
 * - ✅ 错误链完整 (E1铁律)
 *
 * @class CheckThemeSetupStatusUseCase
 */
const BaseUseCase = require('../BaseUseCase')

class CheckThemeSetupStatusUseCase extends BaseUseCase {
  /**
   * 构造函数
   * @param {IThemeService} themeService - 主题服务
   */
  constructor(themeService) {
    super() // 🏛️ 架构铁律合规: 必须调用父类构造函数

    if (!themeService) {
      throw new Error('themeService is required')
    }
    this.themeService = themeService
  }

  /**
   * 执行检查
   * @returns {Promise<{success: boolean, data: {hasShown: boolean}}>}
   */
  async execute() {
    const hasShown = await this.themeService.hasShownThemeSetup()
    return this.createSuccessResponse({ hasShown })
  }
}

module.exports = CheckThemeSetupStatusUseCase

