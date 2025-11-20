/**
 * 日期时间工具函数
 * 
 * 从 util.js 拆分出来的专用模块
 * Skill: development-discipline § Part 6 Pattern 1（上帝对象拆分）
 */

/**
 * 格式化数字（私有辅助函数）
 * @private
 */
const formatNumber = n => {
  n = n.toString()
  return n[1] ? n : `0${n}`
}

/**
 * 格式化时间
 * @param {Date} date 
 * @returns {String} 格式: YYYY/MM/DD HH:mm:ss
 */
const formatTime = date => {
  // 防御性检查：处理null/undefined/invalid
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    date = new Date()
  }
  
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const minute = date.getMinutes()
  const second = date.getSeconds()

  return [year, month, day].map(formatNumber).join('/') + ' ' + [hour, minute, second].map(formatNumber).join(':')
}

/**
 * 获取日期字符串
 * @param {Date} date - 默认当前日期
 * @returns {String} 格式: YYYY-MM-DD
 */
const getDateString = (date = new Date()) => {
  return date.toISOString().split('T')[0]
}

/**
 * 计算两个日期的天数差
 * @param {Date|String} date1 
 * @param {Date|String} date2 
 * @returns {Number} 天数差（绝对值）
 */
const getDaysDiff = (date1, date2) => {
  const time1 = new Date(date1).getTime()
  const time2 = new Date(date2).getTime()
  return Math.abs(Math.floor((time1 - time2) / (1000 * 60 * 60 * 24)))
}

/**
 * 格式化学习时长
 * @param {Number} seconds - 秒数
 * @returns {String} 格式化后的时长
 */
const formatStudyTime = (seconds) => {
  if (seconds < 60) {
    return `${seconds}秒`
  } else if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}分钟`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}小时${minutes}分钟`
  }
}

module.exports = {
  formatTime,
  getDateString,
  getDaysDiff,
  formatStudyTime
}
