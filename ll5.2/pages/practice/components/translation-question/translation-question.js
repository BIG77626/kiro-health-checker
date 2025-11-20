// components/translation-question/translation-question.js

// 引入 diff-match-patch
const DiffMatchPatch = require('diff-match-patch')
const TranslationAICoach = require('./translation-ai-coach.js')

Component({
  properties: {
    translationData: {
      type: Object,
      value: {}
    },
    userAnswer: {
      type: String,
      value: ''
    },
    showAnswer: {
      type: Boolean,
      value: false
    }
  },

  data: {
    currentAnswer: '',
    wordCount: 0,
    showReference: false,
    differences: [],
    similarity: 0,
    isEvaluating: false,
    aiEvaluation: null,

    // 翻译AI教练
    showTranslationAIHint: false,
    translationAIHintData: null,
    stuckCheckTimer: null,
    lastInputLength: 0
  },

  lifetimes: {
    attached() {
      // 初始化AI教练
      this.aiCoach = new TranslationAICoach()
      console.log('🎯 翻译练习组件加载完成, AI教练已启动')
      
      if (this.data.userAnswer) {
        this.setData({
          currentAnswer: this.data.userAnswer,
          wordCount: this.countWords(this.data.userAnswer)
        })
      }

      // 开始监控当前句子
      if (this.data.translationData && this.data.translationData.id) {
        this.aiCoach.startMonitoring(this.data.translationData.id)
        this.startStuckMonitoring()
      }
    },

    detached() {
      // 清理定时器
      if (this.data.stuckCheckTimer) {
        clearInterval(this.data.stuckCheckTimer)
      }
      
      // 重置AI教练
      if (this.aiCoach) {
        this.aiCoach.reset()
      }
    }
  },

  methods: {
    /**
     * 处理输入
     */
    onInput(e) {
      const value = e.detail.value
      const wordCount = this.countWords(value)

      this.setData({
        currentAnswer: value,
        wordCount: wordCount
      })

      // AI监控：记录输入
      if (this.aiCoach && this.data.translationData) {
        const sentenceId = this.data.translationData.id
        const oldLength = this.data.lastInputLength
        const newLength = value.length
        
        this.aiCoach.recordInput(sentenceId, newLength, oldLength)
        
        // 检查频繁编辑
        const editResult = this.aiCoach.monitorFrequentEdit(sentenceId)
        if (editResult && !this.data.showTranslationAIHint) {
          this.showTranslationAIHint(editResult)
        }
        
        // 检查输入质量
        if (value.length > 10) {
          const qualityResult = this.aiCoach.monitorInputQuality(sentenceId, value, this.data.translationData)
          if (qualityResult && !this.data.showTranslationAIHint) {
            this.showTranslationAIHint(qualityResult)
          }
        }
        
        this.setData({ lastInputLength: newLength })
      }
    },

    /**
     * 计算字数
     */
    countWords(text) {
      if (!text) {return 0}

      // 英文按单词计数，中文按字符计数
      const chineseChars = text.match(/[\u4e00-\u9fa5]/g) || []
      const englishWords = text.match(/[a-zA-Z]+/g) || []

      return chineseChars.length + englishWords.length
    },

    /**
     * 提交答案（升级版 - 使用diff-match-patch + AI评分）
     */
    async submitAnswer() {
      const { currentAnswer } = this.data
      const { translationData } = this.data

      if (!currentAnswer.trim()) {
        wx.showToast({
          title: '请输入翻译',
          icon: 'none'
        })
        return
      }

      // 1. 使用diff-match-patch计算精确差异
      const dmp = new DiffMatchPatch()
      const diffs = dmp.diff_main(currentAnswer, translationData.referenceAnswer)
      dmp.diff_cleanupSemantic(diffs) // 语义清理，提高准确性

      // 2. 计算相似度
      const similarity = this.calculateSimilarity(dmp, diffs, currentAnswer, translationData.referenceAnswer)

      // 3. 格式化差异用于展示
      const formattedDiffs = this.formatDifferences(diffs)

      this.setData({
        showReference: true,
        differences: formattedDiffs,
        similarity: similarity,
        isEvaluating: true
      })

      // 4. 异步调用AI评分（可选）
      this.callAIEvaluation(currentAnswer, translationData)

      // 触发提交事件
      this.triggerEvent('submit', {
        answer: currentAnswer,
        wordCount: this.data.wordCount,
        questionId: translationData.id,
        similarity: similarity
      })

      wx.vibrateShort()
    },

    /**
     * 计算相似度（使用Levenshtein距离）
     */
    calculateSimilarity(dmp, diffs, userAnswer, referenceAnswer) {
      const levenshtein = dmp.diff_levenshtein(diffs)
      const maxLength = Math.max(userAnswer.length, referenceAnswer.length)

      if (maxLength === 0) {return 100}

      const similarity = ((1 - levenshtein / maxLength) * 100).toFixed(1)
      return parseFloat(similarity)
    },

    /**
     * 格式化差异（用于展示）
     */
    formatDifferences(diffs) {
      const formatted = []

      diffs.forEach((diff, index) => {
        const [operation, text] = diff

        if (operation === 0) {
          // 相同部分
          formatted.push({
            type: 'equal',
            text: text,
            index: index
          })
        } else if (operation === -1) {
          // 删除（用户缺少）
          formatted.push({
            type: 'removed',
            text: text,
            index: index,
            message: '缺少此部分'
          })
        } else if (operation === 1) {
          // 添加（用户多余或错误）
          formatted.push({
            type: 'added',
            text: text,
            index: index,
            message: '此部分多余或错误'
          })
        }
      })

      return formatted
    },

    /**
     * 调用AI评分（使用Qwen3-14B微调模型）
     */
    async callAIEvaluation(userAnswer, translationData) {
      try {
        wx.showLoading({
          title: 'AI评分中...',
          mask: true
        })

        const result = await wx.cloud.callFunction({
          name: 'translation-grading',
          data: {
            userTranslation: userAnswer,
            referenceTranslation: translationData.referenceAnswer,
            sourceText: translationData.sourceText
          }
        })

        wx.hideLoading()

        if (result.result.success) {
          this.setData({
            aiEvaluation: result.result.data,
            isEvaluating: false
          })

          wx.showToast({
            title: `AI评分：${result.result.data.score}分`,
            icon: 'success',
            duration: 2000
          })
        } else {
          throw new Error(result.result.error || 'AI评分失败')
        }
      } catch (error) {
        console.warn('[TranslationQuestion] AI评分失败，已降级:', error.errMsg || error.message)
        wx.hideLoading()
        this.setData({ isEvaluating: false })

        // Silent Fail: AI失败不影响基础功能
        wx.showToast({
          title: 'AI评分暂不可用',
          icon: 'none',
          duration: 1500
        })
        console.log('[TranslationQuestion] 已降级为基础对比模式')
      }
    },

    /**
     * 切换参考答案显示
     */
    toggleReference() {
      this.setData({
        showReference: !this.data.showReference
      })
    },

    /**
     * 重新翻译
     */
    retranslate() {
      this.setData({
        currentAnswer: '',
        wordCount: 0,
        showReference: false,
        differences: []
      })
    },

    /**
     * 查看解析
     */
    viewExplanation() {
      this.triggerEvent('viewExplanation', {
        questionId: this.data.translationData.id
      })
    },

    // ==================== 翻译AI教练相关方法 ====================

    /**
     * 开始卡住监控
     */
    startStuckMonitoring() {
      // 每10秒检查一次是否卡住
      const timer = setInterval(() => {
        if (!this.aiCoach || !this.data.translationData) {
          clearInterval(timer)
          return
        }
        
        const result = this.aiCoach.monitorStuck(this.data.translationData.id)
        if (result && !this.data.showTranslationAIHint) {
          this.showTranslationAIHint(result)
        }
      }, 10000)
      
      this.setData({ stuckCheckTimer: timer })
    },

    /**
     * 显示翻译AI提示
     */
    showTranslationAIHint(result) {
      if (!this.aiCoach || !result) return
      
      const { sentenceId } = result
      const sentence = this.data.translationData
      
      if (!sentence) return
      
      // 获取渐进式提示
      const hintData = this.aiCoach.getProgressiveHint(sentenceId, sentence, result.triggerReason, result)
      
      this.setData({
        showTranslationAIHint: true,
        translationAIHintData: hintData
      })
      
      // 震动反馈
      wx.vibrateShort()
      
      console.log('🤖 翻译AI提示触发:', hintData.level, hintData.title)
    },

    /**
     * 关闭翻译AI提示
     */
    closeTranslationAIHint() {
      this.setData({
        showTranslationAIHint: false
      })
      
      console.log('❌ 用户关闭翻译AI提示')
    },

    /**
     * 请求下一级提示
     */
    requestNextTranslationHint() {
      if (!this.aiCoach) return
      
      const sentence = this.data.translationData
      
      if (!sentence) return
      
      // 获取下一级提示
      const hintData = this.aiCoach.requestNextLevelHint(sentence.id, sentence)
      
      this.setData({
        translationAIHintData: hintData
      })
      
      // 震动反馈
      wx.vibrateShort()
      
      console.log('👆 用户请求下一级提示, 当前级别:', hintData.level)
    },

    /**
     * 阻止事件冒泡
     */
    stopPropagation() {
      // 阻止冒泡
    }
  }
})

