/**
 * 标记主题设置已显示Use Case
 *
 * 架构铁律合规性:
 * - ✅ A1 强制超时机制 - 继承BaseUseCase自动获得超时保护
 * - ✅ Use Case只编排业务逻辑
 * - ✅ 依赖接口而非具体实现
 * - ✅ 错误链完整 (E1铁律)
 *
 * @class MarkThemeSetupShownUseCase
 */
const BaseUseCase = require('../BaseUseCase')

class MarkThemeSetupShownUseCase extends BaseUseCase {
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
   * 执行标记
   * @returns {Promise<{success: boolean}>}
   */
  async execute() {
    await this.themeService.markThemeSetupShown()
    return this.createSuccessResponse()
  }
}

module.exports = MarkThemeSetupShownUseCase

