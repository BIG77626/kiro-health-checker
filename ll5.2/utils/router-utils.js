/**
 * 路由导航工具函数
 * 
 * 从 util.js 拆分出来的专用模块
 * Skill: development-discipline § Part 6 Pattern 1（上帝对象拆分）
 */

/**
 * 创建页面URL（保持与原项目兼容）
 * @param {String} pageName - 页面名称
 * @returns {String} 页面路径
 */
const createPageUrl = (pageName) => {
  const pageMap = {
    Home: '/pages/home/home',
    Study: '/pages/study/study',
    Report: '/pages/report/report',
    Profile: '/pages/profile/profile',
    PaperDetail: '/pages/paperdetail/paperdetail',
    Reader: '/pages/reader/reader',
    Practice: '/pages/practice/practice'
  }
  return pageMap[pageName] || '/pages/home/home'
}

module.exports = {
  createPageUrl
}
