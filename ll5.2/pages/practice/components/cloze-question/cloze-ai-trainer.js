// cloze-ai-trainer.js
// 完型填空专属AI训练师 - 关注词汇搭配和语法，而非逻辑推理

class ClozeAITrainer {
  constructor() {
    // 监控指标
    this.metrics = {
      hesitationTime: {},      // 每个空格的犹豫时间 {blankId: seconds}
      errorPattern: [],        // 错误模式记录
      blankSkipCount: 0,       // 跳过次数
      consecutiveErrors: 0,    // 连续错误次数
      totalErrors: 0,          // 总错误次数
      answerStartTime: {},     // 每个空格开始答题时间
      viewedHintLevels: {}     // 已查看的提示级别 {blankId: [1,2,3]}
    }
    
    // 当前空格的提示级别
    this.currentHintLevel = {}
    
    // 已触发提示的空格
    this.triggeredBlanks = new Set()
  }

  /**
   * 开始监控某个空格
   */
  startMonitoring(blankId) {
    this.metrics.answerStartTime[blankId] = Date.now()
    
    if (!this.currentHintLevel[blankId]) {
      this.currentHintLevel[blankId] = 0
    }
    
    console.log('🎯 开始监控空格:', blankId)
  }

  /**
   * 监控答题犹豫
   */
  monitorHesitation(blankId) {
    if (!this.metrics.answerStartTime[blankId]) {
      return null
    }
    
    const timeSpent = Math.floor((Date.now() - this.metrics.answerStartTime[blankId]) / 1000)
    this.metrics.hesitationTime[blankId] = timeSpent
    
    // 触发条件1：单个空格停留超过30秒，给Level 1提示
    if (timeSpent > 30 && this.currentHintLevel[blankId] === 0) {
      console.log('⏰ 犹豫时间过长:', timeSpent, '秒')
      return { blankId, triggerReason: 'hesitation' }
    }
    
    // 触发条件2：停留超过60秒，自动升级到Level 2
    if (timeSpent > 60 && this.currentHintLevel[blankId] === 1) {
      console.log('⏰⏰ 犹豫时间很长:', timeSpent, '秒')
      return { blankId, triggerReason: 'longHesitation' }
    }
    
    return null
  }

  /**
   * 监控错误模式
   */
  monitorError(blankId, userAnswer, correctAnswer, blank) {
    this.metrics.totalErrors++
    this.metrics.consecutiveErrors++
    
    // 分析错误类型
    const errorType = this.analyzeErrorType(userAnswer, correctAnswer, blank)
    
    this.metrics.errorPattern.push({
      blankId,
      type: errorType,
      userAnswer,
      correctAnswer,
      timestamp: Date.now()
    })
    
    console.log('❌ 答错了, 错误类型:', errorType, '连续错误:', this.metrics.consecutiveErrors)
    
    // 触发条件3：连续错误2次，给更高级别提示
    if (this.metrics.consecutiveErrors >= 2) {
      return { blankId, triggerReason: 'consecutiveErrors', errorType }
    }
    
    // 触发条件4：单个空格错误2次，给Level 3提示
    const blankErrors = this.metrics.errorPattern.filter(e => e.blankId === blankId)
    if (blankErrors.length >= 2 && this.currentHintLevel[blankId] < 3) {
      return { blankId, triggerReason: 'sameBlankErrors', errorType }
    }
    
    return null
  }

  /**
   * 记录正确答案（重置连续错误）
   */
  recordCorrect(_blankId) {
    this.metrics.consecutiveErrors = 0
    console.log('✅ 答对了！重置连续错误计数')
  }

  /**
   * 记录查看答案次数
   */
  recordViewAnswer(blankId) {
    const viewCount = this.metrics.errorPattern.filter(
      e => e.blankId === blankId && e.type === 'viewAnswer'
    ).length
    
    // 触发条件5：查看答案3次，给Level 4（直接答案）
    if (viewCount >= 3) {
      return { blankId, triggerReason: 'frequentViewAnswer' }
    }
    
    return null
  }

  /**
   * 获取渐进式提示（4级）
   */
  getProgressiveHint(blankId, blank, triggerReason) {
    // 确定提示级别
    let targetLevel = this.currentHintLevel[blankId] || 0
    
    // 根据触发原因决定提示级别
    if (triggerReason === 'hesitation') {
      targetLevel = Math.max(targetLevel, 1)
    } else if (triggerReason === 'longHesitation') {
      targetLevel = Math.max(targetLevel, 2)
    } else if (triggerReason === 'consecutiveErrors' || triggerReason === 'sameBlankErrors') {
      targetLevel = Math.min(targetLevel + 1, 3)
    } else if (triggerReason === 'frequentViewAnswer') {
      targetLevel = 4
    }
    
    // 更新当前级别
    this.currentHintLevel[blankId] = targetLevel
    
    // 记录已查看的级别
    if (!this.metrics.viewedHintLevels[blankId]) {
      this.metrics.viewedHintLevels[blankId] = []
    }
    this.metrics.viewedHintLevels[blankId].push(targetLevel)
    
    console.log('💡 生成提示, 空格:', blankId, '级别:', targetLevel)
    
    return this.generateHintByLevel(targetLevel, blank, blankId)
  }

  /**
   * 根据级别生成提示
   */
  generateHintByLevel(level, blank, _blankId) {
    const hints = {
      1: {
        level: 1,
        title: '词性提示',
        message: '想想这里需要什么词性？',
        detail: this.getWordClassHint(blank),
        icon: '💡',
        color: '#4F7FE8'
      },
      2: {
        level: 2,
        title: '语义提示',
        message: '注意上下文的语义关系',
        detail: this.getSemanticHint(blank),
        icon: '🔍',
        color: '#F59E0B'
      },
      3: {
        level: 3,
        title: '搭配提示',
        message: '看看固定搭配和常见用法',
        detail: this.getCollocationHint(blank),
        icon: '🎯',
        color: '#10B981'
      },
      4: {
        level: 4,
        title: '答案提示',
        message: '参考答案',
        detail: this.getDirectHint(blank),
        icon: '✅',
        color: '#EF4444'
      }
    }
    
    return hints[level] || hints[1]
  }

  /**
   * Level 1: 词性提示
   */
  getWordClassHint(blank) {
    const context = blank.context || ''
    
    // 简单的词性判断规则
    if (/\b(a|an|the)\s+___/.test(context)) {
      return '这里需要一个名词（注意单复数）'
    } else if (/___\s+(the|a|an|that|which)/.test(context)) {
      return '这里需要一个动词（注意时态和语态）'
    } else if (/(very|so|too|quite)\s+___/.test(context)) {
      return '这里需要一个形容词或副词'
    } else if (/___\s+and\s+___/.test(context)) {
      return '注意并列结构，前后词性应该一致'
    } else if (/\b___ly\b/.test(blank.answer || '')) {
      return '答案可能是副词形式（-ly结尾）'
    }
    
    return '仔细看前后词，判断需要什么词性（名词/动词/形容词/副词）'
  }

  /**
   * Level 2: 语义提示
   */
  getSemanticHint(blank) {
    const context = blank.context || ''
    
    // 检测逻辑关系词
    if (/however|but|yet|nevertheless/.test(context)) {
      return '注意转折关系，前后语义相反或对比'
    } else if (/because|since|as|for/.test(context)) {
      return '注意因果关系，选择符合逻辑的词'
    } else if (/and|also|moreover|furthermore/.test(context)) {
      return '注意并列关系，语义应该一致或递进'
    } else if (/although|though|while/.test(context)) {
      return '注意让步关系，表达"虽然...但是..."'
    } else if (/therefore|thus|hence|consequently/.test(context)) {
      return '注意结果关系，选择表示结果的词'
    }
    
    // 检测情感色彩
    if (/positive|good|benefit|advantage|improve/.test(context)) {
      return '上下文偏积极，选择正面意义的词'
    } else if (/negative|bad|harm|disadvantage|decline/.test(context)) {
      return '上下文偏消极，选择负面意义的词'
    }
    
    return '分析前后句的逻辑关系（转折/因果/并列）'
  }

  /**
   * Level 3: 搭配提示
   */
  getCollocationHint(blank) {
    const answer = blank.answer || ''
    
    // 如果有搭配信息
    if (blank.collocation) {
      return `常见搭配：${blank.collocation}`
    }
    
    // 根据答案给出搭配提示
    const commonCollocations = {
      'make': 'make a decision / make progress / make sense',
      'take': 'take action / take place / take advantage of',
      'have': 'have access to / have an impact on',
      'give': 'give rise to / give way to',
      'pay': 'pay attention to / pay a visit to',
      'keep': 'keep in mind / keep track of',
      'break': 'break down / break through / break out'
    }
    
    const baseWord = answer.split(' ')[0]
    if (commonCollocations[baseWord]) {
      return `"${baseWord}"的常见搭配：${commonCollocations[baseWord]}`
    }
    
    return '注意固定搭配和习惯用法'
  }

  /**
   * Level 4: 直接提示答案
   */
  getDirectHint(blank) {
    const answer = blank.answer || ''
    return `答案是：${answer}`
  }

  /**
   * 分析错误类型
   */
  analyzeErrorType(userAnswer, correctAnswer, _blank) {
    if (!userAnswer || !correctAnswer) {
      return 'unknown'
    }
    
    const userLower = userAnswer.toLowerCase().trim()
    const correctLower = correctAnswer.toLowerCase().trim()
    
    // 1. 拼写相似（编辑距离小）
    if (this.isSimilarSpelling(userLower, correctLower)) {
      return 'spelling'
    }
    
    // 2. 词性错误（词根相同但形式不同）
    if (this.isSameRoot(userLower, correctLower)) {
      return 'wordClass'
    }
    
    // 3. 语义相反
    if (this.isOppositeWord(userLower, correctLower)) {
      return 'semantic_opposite'
    }
    
    // 4. 语义相近但不准确
    if (this.isSimilarWord(userLower, correctLower)) {
      return 'semantic_similar'
    }
    
    // 5. 默认为语义错误
    return 'semantic'
  }

  /**
   * 判断拼写相似度
   */
  isSimilarSpelling(str1, str2) {
    if (str1 === str2) return false
    
    const maxLen = Math.max(str1.length, str2.length)
    let matches = 0
    
    for (let i = 0; i < Math.min(str1.length, str2.length); i++) {
      if (str1[i] === str2[i]) matches++
    }
    
    return (matches / maxLen) > 0.7
  }

  /**
   * 判断是否同根词
   */
  isSameRoot(str1, str2) {
    // 简单判断：去除常见后缀后是否相同
    const suffixes = ['ed', 'ing', 'ly', 'tion', 'ment', 'ness', 'ful', 'less', 'ous', 'ive', 'able']
    
    let root1 = str1
    let root2 = str2
    
    suffixes.forEach(suffix => {
      if (root1.endsWith(suffix)) {
        root1 = root1.slice(0, -suffix.length)
      }
      if (root2.endsWith(suffix)) {
        root2 = root2.slice(0, -suffix.length)
      }
    })
    
    return root1 === root2 && str1 !== str2
  }

  /**
   * 判断是否反义词（简单版本）
   */
  isOppositeWord(str1, str2) {
    const oppositePairs = [
      ['increase', 'decrease'],
      ['rise', 'fall'],
      ['good', 'bad'],
      ['positive', 'negative'],
      ['benefit', 'harm'],
      ['advantage', 'disadvantage']
    ]
    
    return oppositePairs.some(pair => 
      (pair[0] === str1 && pair[1] === str2) || 
      (pair[1] === str1 && pair[0] === str2)
    )
  }

  /**
   * 判断是否近义词（简单版本）
   */
  isSimilarWord(_str1, _str2) {
    // 这里应该使用词向量或同义词库，目前返回false
    return false
  }

  /**
   * 请求下一级提示
   */
  requestNextLevelHint(blankId, blank) {
    const currentLevel = this.currentHintLevel[blankId] || 0
    const nextLevel = Math.min(currentLevel + 1, 4)
    
    this.currentHintLevel[blankId] = nextLevel
    
    console.log('👆 用户请求下一级提示, 当前级别:', nextLevel)
    
    return this.generateHintByLevel(nextLevel, blank, blankId)
  }

  /**
   * 获取统计数据
   */
  getStats() {
    return {
      totalErrors: this.metrics.totalErrors,
      consecutiveErrors: this.metrics.consecutiveErrors,
      hesitationTime: this.metrics.hesitationTime,
      errorPattern: this.metrics.errorPattern,
      viewedHintLevels: this.metrics.viewedHintLevels
    }
  }

  /**
   * 重置监控
   */
  reset() {
    this.metrics = {
      hesitationTime: {},
      errorPattern: [],
      blankSkipCount: 0,
      consecutiveErrors: 0,
      totalErrors: 0,
      answerStartTime: {},
      viewedHintLevels: {}
    }
    
    this.currentHintLevel = {}
    this.triggeredBlanks.clear()
    
    console.log('🔄 完型填空AI监控已重置')
  }
}

module.exports = ClozeAITrainer

