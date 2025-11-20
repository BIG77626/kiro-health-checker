/**
 * 工具函数兼容层
 * 
 * ⚠️ 此文件已重构为兼容层，实际实现已拆分到专用模块
 * 
 * 重构策略:
 * - 按职责拆分为 4 个专用模块（date/ui/router/functional）
 * - 此文件保留向后兼容，导入并重新导出所有函数
 * - 新代码建议直接导入专用模块
 * 
 * Skill: development-discipline § Part 6 Pattern 1（上帝对象拆分）
 * 
 * 专用模块:
 * - date-utils.js - 日期时间处理
 * - ui-utils.js - UI交互（loading/toast）
 * - router-utils.js - 页面路由
 * - functional-utils.js - 函数式编程（debounce/throttle）
 */

// 导入专用模块
const dateUtils = require('./date-utils')
const uiUtils = require('./ui-utils')
const routerUtils = require('./router-utils')
const functionalUtils = require('./functional-utils')

// 重新导出所有函数（向后兼容）
module.exports = {
  // 日期时间工具
  formatTime: dateUtils.formatTime,
  getDateString: dateUtils.getDateString,
  getDaysDiff: dateUtils.getDaysDiff,
  formatStudyTime: dateUtils.formatStudyTime,

  // UI交互工具
  showLoading: uiUtils.showLoading,
  hideLoading: uiUtils.hideLoading,
  showSuccess: uiUtils.showSuccess,
  showError: uiUtils.showError,

  // 路由工具
  createPageUrl: routerUtils.createPageUrl,

  // 函数式编程工具
  debounce: functionalUtils.debounce,
  throttle: functionalUtils.throttle
}
