/**
 * 函数式编程工具
 * 
 * 从 util.js 拆分出来的专用模块
 * Skill: development-discipline § Part 6 Pattern 1（上帝对象拆分）
 */

/**
 * 防抖函数
 * @param {Function} fn - 要执行的函数
 * @param {Number} delay - 延迟时间（毫秒）
 * @returns {Function} 防抖后的函数
 */
const debounce = (fn, delay = 300) => {
  let timer = null
  return function (...args) {
    if (timer) { clearTimeout(timer) }
    timer = setTimeout(() => {
      fn.apply(this, args)
    }, delay)
  }
}

/**
 * 节流函数
 * 首次调用立即执行，后续调用在冷却期内被忽略
 * @param {Function} fn - 要执行的函数
 * @param {Number} delay - 冷却时间（毫秒）
 * @returns {Function} 节流后的函数
 */
const throttle = (fn, delay = 300) => {
  let lastRun = 0
  return function (...args) {
    const now = Date.now()
    if (now - lastRun >= delay) {
      fn.apply(this, args)
      lastRun = now
    }
  }
}

module.exports = {
  debounce,
  throttle
}
