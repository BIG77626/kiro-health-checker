// translation-ai-coach.js
// 翻译练习专属AI教练 - 实时辅助，分段引导

class TranslationAICoach {
  constructor() {
    // 监控指标
    this.metrics = {
      sentenceStartTime: {},       // 每个句子的开始时间
      hesitationTime: {},          // 犹豫时间
      editCount: {},               // 编辑次数（修改输入）
      backspaceCount: {},          // 删除次数
      inputLength: {},             // 当前输入长度
      lastInputTime: {},           // 最后一次输入时间
      stuckCount: 0,               // 卡住次数（长时间无输入）
      viewedHintLevels: {}         // 已查看的提示级别
    }
    
    // 当前句子的提示级别
    this.currentHintLevel = {}
    
    // 触发标记
    this.triggeredSentences = new Set()
    
    // 句子分析缓存
    this.sentenceAnalysis = {}
  }

  /**
   * 开始监控某个句子
   */
  startMonitoring(sentenceId) {
    this.metrics.sentenceStartTime[sentenceId] = Date.now()
    this.metrics.lastInputTime[sentenceId] = Date.now()
    this.metrics.inputLength[sentenceId] = 0
    this.metrics.editCount[sentenceId] = 0
    this.metrics.backspaceCount[sentenceId] = 0
    
    if (!this.currentHintLevel[sentenceId]) {
      this.currentHintLevel[sentenceId] = 0
    }
    
    console.log('🎯 开始监控句子:', sentenceId)
  }

  /**
   * 记录用户输入
   */
  recordInput(sentenceId, newLength, _oldLength) {
    const now = Date.now()
    
    // 更新最后输入时间
    this.metrics.lastInputTime[sentenceId] = now
    
    // 记录输入长度变化
    const prevLength = this.metrics.inputLength[sentenceId] || 0
    this.metrics.inputLength[sentenceId] = newLength
    
    // 判断是编辑还是删除
    if (newLength < prevLength) {
      this.metrics.backspaceCount[sentenceId] = (this.metrics.backspaceCount[sentenceId] || 0) + 1
    } else if (Math.abs(newLength - prevLength) > 5) {
      // 大幅修改视为编辑
      this.metrics.editCount[sentenceId] = (this.metrics.editCount[sentenceId] || 0) + 1
    }
    
    console.log('📝 输入记录:', sentenceId, '长度:', newLength)
  }

  /**
   * 监控无输入状态（卡住）
   */
  monitorStuck(sentenceId) {
    if (!this.metrics.lastInputTime[sentenceId]) {
      return null
    }
    
    const timeSinceLastInput = Math.floor((Date.now() - this.metrics.lastInputTime[sentenceId]) / 1000)
    
    // 触发条件1：20秒无输入 → Level 1
    if (timeSinceLastInput > 20 && this.currentHintLevel[sentenceId] === 0) {
      console.log('⏰ 长时间无输入:', timeSinceLastInput, '秒')
      return { sentenceId, triggerReason: 'stuck' }
    }
    
    // 触发条件2：40秒无输入 → Level 2
    if (timeSinceLastInput > 40 && this.currentHintLevel[sentenceId] === 1) {
      console.log('⏰⏰ 非常长时间无输入:', timeSinceLastInput, '秒')
      return { sentenceId, triggerReason: 'veryStuck' }
    }
    
    return null
  }

  /**
   * 监控频繁编辑
   */
  monitorFrequentEdit(sentenceId) {
    const editCount = this.metrics.editCount[sentenceId] || 0
    const backspaceCount = this.metrics.backspaceCount[sentenceId] || 0
    
    // 触发条件3：编辑次数超过3次 → Level 2
    if (editCount >= 3 && this.currentHintLevel[sentenceId] < 2) {
      console.log('✏️ 频繁编辑:', editCount, '次')
      return { sentenceId, triggerReason: 'frequentEdit' }
    }
    
    // 触发条件4：删除次数超过5次 → Level 2
    if (backspaceCount >= 5 && this.currentHintLevel[sentenceId] < 2) {
      console.log('⌫ 频繁删除:', backspaceCount, '次')
      return { sentenceId, triggerReason: 'frequentBackspace' }
    }
    
    return null
  }

  /**
   * 监控输入质量（简单版本）
   */
  monitorInputQuality(sentenceId, userInput, sentence) {
    if (!userInput || userInput.length < 5) {
      return null
    }
    
    // 检查是否包含关键词
    const keywords = this.extractKeywords(sentence)
    const missingKeywords = keywords.filter(kw => !userInput.toLowerCase().includes(kw.toLowerCase()))
    
    // 触发条件5：输入长度超过原文50%但缺少关键词 → Level 3
    if (userInput.length > sentence.chinese.length * 0.5 && missingKeywords.length > keywords.length * 0.5) {
      console.log('⚠️ 输入质量问题，缺少关键词:', missingKeywords)
      return { sentenceId, triggerReason: 'missingKeywords', missingKeywords }
    }
    
    return null
  }

  /**
   * 获取渐进式提示（3级 + 实时辅助）
   */
  getProgressiveHint(sentenceId, sentence, triggerReason, additionalData = {}) {
    // 分析句子（缓存）
    if (!this.sentenceAnalysis[sentenceId]) {
      this.sentenceAnalysis[sentenceId] = this.analyzeSentence(sentence)
    }
    
    const analysis = this.sentenceAnalysis[sentenceId]
    
    // 确定提示级别
    let targetLevel = this.currentHintLevel[sentenceId] || 0
    
    if (triggerReason === 'stuck') {
      targetLevel = Math.max(targetLevel, 1)
    } else if (triggerReason === 'veryStuck' || triggerReason === 'frequentEdit' || triggerReason === 'frequentBackspace') {
      targetLevel = Math.max(targetLevel, 2)
    } else if (triggerReason === 'missingKeywords') {
      targetLevel = Math.max(targetLevel, 3)
    }
    
    // 更新当前级别
    this.currentHintLevel[sentenceId] = targetLevel
    
    // 记录已查看的级别
    if (!this.metrics.viewedHintLevels[sentenceId]) {
      this.metrics.viewedHintLevels[sentenceId] = []
    }
    this.metrics.viewedHintLevels[sentenceId].push(targetLevel)
    
    console.log('💡 生成翻译提示, 句子:', sentenceId, '级别:', targetLevel)
    
    return this.generateHintByLevel(targetLevel, sentence, analysis, additionalData)
  }

  /**
   * 分析句子结构
   */
  analyzeSentence(sentence) {
    const chinese = sentence.chinese || ''
    const english = sentence.english || ''
    
    // 提取关键词
    const keywords = this.extractKeywords(sentence)
    
    // 识别句子结构
    const structure = this.identifySentenceStructure(chinese)
    
    // 识别时态
    const tense = this.identifyTense(chinese, english)
    
    // 识别难点
    const difficulties = this.identifyDifficulties(chinese, sentence)
    
    return {
      keywords,
      structure,
      tense,
      difficulties,
      segments: this.segmentSentence(chinese, keywords)
    }
  }

  /**
   * 提取关键词
   */
  extractKeywords(sentence) {
    // 优先使用sentence.keywords
    if (sentence.keywords && sentence.keywords.length > 0) {
      return sentence.keywords
    }
    
    // 简单规则提取（去除常见虚词）
    const stopWords = ['的', '了', '是', '在', '有', '和', '与', '或', '但', '而', '也', '都', '很', '最', '更', '为', '被', '把', '将', '给', '从', '向', '到', '于']
    const chinese = sentence.chinese || ''
    const words = chinese.split('').filter(w => !stopWords.includes(w) && w.trim())
    
    // 返回前5个关键字
    return words.slice(0, 5)
  }

  /**
   * 识别句子结构
   */
  identifySentenceStructure(chinese) {
    if (/[，、；]/.test(chinese)) {
      return '并列句'
    } else if (/虽然|尽管|即使/.test(chinese)) {
      return '让步状语从句'
    } else if (/因为|由于|所以/.test(chinese)) {
      return '因果句'
    } else if (/如果|假如|要是/.test(chinese)) {
      return '条件句'
    } else if (/被|把/.test(chinese)) {
      return '被动/把字句'
    } else {
      return '简单句'
    }
  }

  /**
   * 识别时态
   */
  identifyTense(chinese, english) {
    if (/了|过/.test(chinese) || /ed\b|has|have|had/.test(english)) {
      return '过去时'
    } else if (/将|会|要/.test(chinese) || /will|shall|going to/.test(english)) {
      return '将来时'
    } else if (/正在|在/.test(chinese) || /ing\b/.test(english)) {
      return '进行时'
    } else {
      return '一般现在时'
    }
  }

  /**
   * 识别难点
   */
  identifyDifficulties(chinese, sentence) {
    const difficulties = []
    
    if (/被|把/.test(chinese)) {
      difficulties.push('被动/把字句翻译')
    }
    
    if (/虽然|尽管|即使/.test(chinese)) {
      difficulties.push('让步状语从句')
    }
    
    if (/不仅.*而且|既.*又/.test(chinese)) {
      difficulties.push('并列结构')
    }
    
    if (chinese.length > 30) {
      difficulties.push('长句翻译')
    }
    
    if (sentence.difficulty === 'hard') {
      difficulties.push('高难度句型')
    }
    
    return difficulties
  }

  /**
   * 分段句子
   */
  segmentSentence(chinese, _keywords) {
    // 简单分段：按标点符号分割
    const segments = chinese.split(/[，、；]/).filter(s => s.trim())
    
    if (segments.length <= 1) {
      // 如果没有标点，按关键词分段
      return [chinese]
    }
    
    return segments
  }

  /**
   * 根据级别生成提示
   */
  generateHintByLevel(level, sentence, analysis, additionalData) {
    const hints = {
      1: {
        level: 1,
        title: '结构提示',
        message: '先理清句子结构',
        detail: this.getStructureHint(analysis),
        icon: '🏗️',
        color: '#4F7FE8'
      },
      2: {
        level: 2,
        title: '分段引导',
        message: '我们一起来分段翻译',
        detail: this.getSegmentHint(analysis),
        icon: '📝',
        color: '#F59E0B'
      },
      3: {
        level: 3,
        title: '关键词提示',
        message: '看看这些关键词怎么翻译',
        detail: this.getKeywordHint(analysis, additionalData.missingKeywords),
        icon: '🔑',
        color: '#10B981'
      }
    }
    
    return hints[level] || hints[1]
  }

  /**
   * Level 1: 结构提示
   */
  getStructureHint(analysis) {
    const { structure, tense, difficulties } = analysis
    
    let hint = `句子类型：${structure}\n时态：${tense}`
    
    if (difficulties.length > 0) {
      hint += `\n注意：${difficulties[0]}`
    }
    
    return hint
  }

  /**
   * Level 2: 分段提示
   */
  getSegmentHint(analysis) {
    const { segments } = analysis
    
    if (segments.length <= 1) {
      return '这是一个简单句，可以直接翻译'
    }
    
    let hint = '建议分段翻译：\n'
    segments.forEach((seg, idx) => {
      hint += `${idx + 1}. ${seg}\n`
    })
    
    return hint.trim()
  }

  /**
   * Level 3: 关键词提示
   */
  getKeywordHint(analysis, missingKeywords) {
    const { keywords } = analysis
    
    if (missingKeywords && missingKeywords.length > 0) {
      return `你可能遗漏了这些关键词：\n${missingKeywords.join('、')}`
    }
    
    return `关键词：${keywords.join('、')}`
  }

  /**
   * 请求下一级提示
   */
  requestNextLevelHint(sentenceId, sentence) {
    const currentLevel = this.currentHintLevel[sentenceId] || 0
    const nextLevel = Math.min(currentLevel + 1, 3)
    
    this.currentHintLevel[sentenceId] = nextLevel
    
    console.log('👆 用户请求下一级提示, 当前级别:', nextLevel)
    
    // 分析句子
    if (!this.sentenceAnalysis[sentenceId]) {
      this.sentenceAnalysis[sentenceId] = this.analyzeSentence(sentence)
    }
    
    const analysis = this.sentenceAnalysis[sentenceId]
    
    return this.generateHintByLevel(nextLevel, sentence, analysis)
  }

  /**
   * 实时反馈（用户每次输入后调用）
   */
  getRealTimeFeedback(sentenceId, userInput, sentence) {
    if (!userInput || userInput.length < 3) {
      return null
    }
    
    const analysis = this.sentenceAnalysis[sentenceId] || this.analyzeSentence(sentence)
    const { keywords } = analysis
    
    // 计算进度
    const progress = Math.min(Math.floor((userInput.length / sentence.chinese.length) * 100), 100)
    
    // 检查关键词覆盖
    const coveredKeywords = keywords.filter(kw => 
      userInput.toLowerCase().includes(kw.toLowerCase()) || 
      this.checkKeywordTranslation(kw, userInput)
    )
    
    const keywordProgress = keywords.length > 0 
      ? Math.floor((coveredKeywords.length / keywords.length) * 100)
      : 100
    
    return {
      progress,
      keywordProgress,
      coveredKeywords,
      missingKeywords: keywords.filter(kw => !coveredKeywords.includes(kw))
    }
  }

  /**
   * 检查关键词是否已翻译（简单版本）
   */
  checkKeywordTranslation(_keyword, _userInput) {
    // 这里应该使用词典或AI判断，暂时返回false
    return false
  }

  /**
   * 获取统计数据
   */
  getStats() {
    return {
      hesitationTime: this.metrics.hesitationTime,
      editCount: this.metrics.editCount,
      backspaceCount: this.metrics.backspaceCount,
      viewedHintLevels: this.metrics.viewedHintLevels,
      stuckCount: this.metrics.stuckCount
    }
  }

  /**
   * 重置监控
   */
  reset() {
    this.metrics = {
      sentenceStartTime: {},
      hesitationTime: {},
      editCount: {},
      backspaceCount: {},
      inputLength: {},
      lastInputTime: {},
      stuckCount: 0,
      viewedHintLevels: {}
    }
    
    this.currentHintLevel = {}
    this.triggeredSentences.clear()
    this.sentenceAnalysis = {}
    
    console.log('🔄 翻译练习AI监控已重置')
  }
}

module.exports = TranslationAICoach

