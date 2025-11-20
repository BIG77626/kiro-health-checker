// reading-ai-tutor.js
// 阅读理解专属AI导师 - 关注阅读策略，而非答题技巧

class ReadingAITutor {
  constructor() {
    // 监控指标
    this.metrics = {
      scrollDepth: 0,          // 滚动深度 (%)
      readingSpeed: 0,         // 阅读速度 (词/分钟)
      returnCount: 0,          // 回读次数
      highlightClicks: 0,      // 段落定位点击次数
      timePerParagraph: [],    // 每段阅读时间
      totalReadingTime: 0,     // 总阅读时间 (秒)
      wordsRead: 0,            // 已读字数
      lastScrollTop: 0,        // 上次滚动位置
      readingStartTime: 0      // 开始阅读时间
    }
    
    // 触发状态
    this.triggers = {
      slowReading: false,
      noScrolling: false,
      frequentReturn: false,
      answerWithoutReading: false
    }
    
    // 已触发的提示类型（避免重复）
    this.triggeredHints = new Set()
  }

  /**
   * 初始化阅读监控
   */
  startReading(totalWords) {
    this.metrics.readingStartTime = Date.now()
    this.metrics.wordsRead = 0
    this.metrics.totalReadingTime = 0
    
    console.log('📖 开始阅读监控, 总字数:', totalWords)
  }

  /**
   * 监控滚动行为
   */
  monitorScroll(scrollTop, scrollHeight, contentHeight) {
    // 更新滚动深度
    const maxScroll = scrollHeight - contentHeight
    if (maxScroll > 0) {
      this.metrics.scrollDepth = Math.round((scrollTop / maxScroll) * 100)
    }
    
    // 检测回读
    if (scrollTop < this.metrics.lastScrollTop) {
      this.metrics.returnCount++
      console.log('⬆️ 检测到回读, 总次数:', this.metrics.returnCount)
    }
    
    this.metrics.lastScrollTop = scrollTop
    
    // 更新阅读时间
    if (this.metrics.readingStartTime > 0) {
      this.metrics.totalReadingTime = Math.floor((Date.now() - this.metrics.readingStartTime) / 1000)
    }
    
    // 触发条件检查
    return this.checkTriggers()
  }

  /**
   * 监控阅读速度
   */
  monitorReadingSpeed(currentWordsRead) {
    this.metrics.wordsRead = currentWordsRead
    
    // 计算阅读速度（词/分钟）
    if (this.metrics.totalReadingTime > 0) {
      this.metrics.readingSpeed = Math.round((this.metrics.wordsRead / this.metrics.totalReadingTime) * 60)
    }
    
    console.log('📊 阅读速度:', this.metrics.readingSpeed, '词/分钟')
  }

  /**
   * 记录段落点击
   */
  recordHighlightClick() {
    this.metrics.highlightClicks++
    console.log('🎯 段落定位点击:', this.metrics.highlightClicks)
  }

  /**
   * 检查触发条件
   */
  checkTriggers() {
    const hints = []
    
    // 触发条件1：超过60秒，滚动深度<50%（未通读全文）
    if (!this.triggeredHints.has('noScrolling') && 
        this.metrics.totalReadingTime > 60 && 
        this.metrics.scrollDepth < 50) {
      
      this.triggers.noScrolling = true
      this.triggeredHints.add('noScrolling')
      hints.push(this.getHint('noScrolling'))
      
      console.log('🔔 触发提示: 未通读全文')
    }
    
    // 触发条件2：阅读速度过慢（<150词/分钟）且时间>2分钟
    if (!this.triggeredHints.has('slowReading') && 
        this.metrics.readingSpeed > 0 && 
        this.metrics.readingSpeed < 150 && 
        this.metrics.totalReadingTime > 120) {
      
      this.triggers.slowReading = true
      this.triggeredHints.add('slowReading')
      hints.push(this.getHint('slowReading'))
      
      console.log('🔔 触发提示: 阅读速度过慢')
    }
    
    // 触发条件3：回读超过5次
    if (!this.triggeredHints.has('frequentReturn') && 
        this.metrics.returnCount > 5) {
      
      this.triggers.frequentReturn = true
      this.triggeredHints.add('frequentReturn')
      hints.push(this.getHint('frequentReturn'))
      
      console.log('🔔 触发提示: 回读过多')
    }
    
    return hints.length > 0 ? hints[0] : null
  }

  /**
   * 获取提示内容
   */
  getHint(triggerType) {
    const hints = {
      noScrolling: {
        type: 'readingStrategy',
        title: '阅读策略提示',
        message: '别着急答题，先通读全文',
        details: [
          '快速浏览全文，把握文章结构',
          '注意首尾段的核心观点',
          '标记关键词和转折词'
        ],
        icon: '📖',
        position: 'top-right',
        color: '#4F7FE8'
      },
      slowReading: {
        type: 'speedUp',
        title: '阅读速度提示',
        message: '这段较难？试着先抓主题句',
        details: [
          '每段第一句通常是主题句',
          '不要逐字翻译，直接理解',
          '遇到生词先跳过，根据上下文推测'
        ],
        icon: '⚡',
        position: 'side',
        color: '#F59E0B'
      },
      frequentReturn: {
        type: 'structure',
        title: '结构分析提示',
        message: '回读过多？画出关键句',
        details: [
          '找出每段的核心句',
          '理清段落间的逻辑关系',
          '注意转折、因果、对比等信号词'
        ],
        icon: '🎯',
        position: 'side',
        color: '#10B981'
      },
      answerWithoutReading: {
        type: 'warning',
        title: '答题提醒',
        message: '建议先完整阅读文章',
        details: [
          '考研阅读强调理解而非技巧',
          '完整阅读有助于把握文章主旨',
          '避免断章取义导致错误'
        ],
        icon: '⚠️',
        position: 'top-right',
        color: '#EF4444'
      }
    }
    
    return hints[triggerType] || null
  }

  /**
   * 检查是否未读就答题
   */
  checkAnswerWithoutReading() {
    // 如果滚动深度<30%就开始答题
    if (!this.triggeredHints.has('answerWithoutReading') && 
        this.metrics.scrollDepth < 30) {
      
      this.triggers.answerWithoutReading = true
      this.triggeredHints.add('answerWithoutReading')
      return this.getHint('answerWithoutReading')
    }
    
    return null
  }

  /**
   * 获取当前统计数据
   */
  getStats() {
    return {
      scrollDepth: this.metrics.scrollDepth,
      readingSpeed: this.metrics.readingSpeed,
      returnCount: this.metrics.returnCount,
      totalTime: this.metrics.totalReadingTime,
      triggeredHints: Array.from(this.triggeredHints)
    }
  }

  /**
   * 重置监控
   */
  reset() {
    this.metrics = {
      scrollDepth: 0,
      readingSpeed: 0,
      returnCount: 0,
      highlightClicks: 0,
      timePerParagraph: [],
      totalReadingTime: 0,
      wordsRead: 0,
      lastScrollTop: 0,
      readingStartTime: 0
    }
    
    this.triggers = {
      slowReading: false,
      noScrolling: false,
      frequentReturn: false,
      answerWithoutReading: false
    }
    
    this.triggeredHints.clear()
    
    console.log('🔄 阅读监控已重置')
  }
}

module.exports = ReadingAITutor

