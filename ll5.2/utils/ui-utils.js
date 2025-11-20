/**
 * UI交互工具函数
 * 
 * 从 util.js 拆分出来的专用模块
 * Skill: development-discipline § Part 6 Pattern 1（上帝对象拆分）
 */

/**
 * 显示加载提示
 * @param {String} title - 提示文字
 */
const showLoading = (title = '加载中...') => {
  wx.showLoading({
    title,
    mask: true
  })
}

/**
 * 隐藏加载提示
 */
const hideLoading = () => {
  wx.hideLoading()
}

/**
 * 显示成功提示
 * @param {String} title - 提示文字
 */
const showSuccess = (title = '操作成功') => {
  wx.showToast({
    title,
    icon: 'success',
    duration: 2000
  })
}

/**
 * 显示错误提示
 * @param {String} title - 提示文字
 */
const showError = (title = '操作失败') => {
  wx.showToast({
    title,
    icon: 'error',
    duration: 2000
  })
}

module.exports = {
  showLoading,
  hideLoading,
  showSuccess,
  showError
}
