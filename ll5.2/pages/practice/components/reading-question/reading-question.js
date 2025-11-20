// components/reading-question/reading-question.js

const { wrongQuestionCollector } = require('../../../../utils/wrong-questions.js')
const ReadingAITutor = require('./reading-ai-tutor.js')

Component({
  properties: {
    passage: {
      type: Object,
      value: {}
    },
    questions: {
      type: Array,
      value: []
    },
    passageIndex: {
      type: Number,
      value: 0
    },
    totalPassages: {
      type: Number,
      value: 1
    }
  },

  data: {
    currentQuestionIndex: 0,
    userAnswers: {},
    showAnswer: false,
    highlightedPara: -1,
    scrollTarget: '',

    // 单词弹窗
    showWordPopup: false,
    selectedWord: '',
    selectedContext: '',

    // 句子卡片
    showSentenceCard: false,
    selectedSentence: '',

    // 阅读AI导师
    showReadingAIHint: false,
    readingAIHintData: null,
    readingStartTime: 0,
    lastScrollTop: 0
  },

  lifetimes: {
    attached() {
      // 初始化AI导师
      this.aiTutor = new ReadingAITutor()
      
      // 开始阅读监控
      const totalWords = this.countWords(this.data.passage.content || '')
      this.aiTutor.startReading(totalWords)
      
      this.setData({
        readingStartTime: Date.now()
      })
      
      console.log('📚 阅读理解组件加载完成, AI导师已启动')
    },

    detached() {
      // 组件销毁时重置AI导师
      if (this.aiTutor) {
        this.aiTutor.reset()
      }
    }
  },

  methods: {
    /**
     * 选择答案
     */
    selectAnswer(e) {
      const { questionId, option } = e.currentTarget.dataset

      // 检查是否未读就答题
      this.checkAnswerWithoutReading()

      this.setData({
        [`userAnswers.${questionId}`]: option
      })

      // 检查答案是否正确，如果错误则收集到错题本
      const question = this.data.questions.find(q => q.id === questionId)
      if (question && question.answer !== option) {
        // 收集错题
        wrongQuestionCollector.collect(question, option, question.answer)
      }

      // 触发父组件事件
      this.triggerEvent('answer', {
        questionId: questionId,
        answer: option,
        isCorrect: question && question.answer === option
      })

      wx.vibrateShort()
    },

    /**
     * 切换答案显示
     */
    toggleAnswer() {
      this.setData({
        showAnswer: !this.data.showAnswer
      })
    },

    /**
     * 高亮段落
     */
    highlightParagraph(e) {
      const { index } = e.currentTarget.dataset

      this.setData({
        highlightedPara: index,
        scrollTarget: `para-${index}`
      })
    },

    /**
     * 定位关键词
     */
    locateKeyword(e) {
      const { keyword } = e.currentTarget.dataset

      // 在段落中查找关键词并高亮
      const paragraphs = this.data.passage.paragraphs
      for (let i = 0; i < paragraphs.length; i++) {
        if (paragraphs[i].includes(keyword)) {
          this.setData({
            highlightedPara: i,
            scrollTarget: `para-${i}`
          })

          wx.showToast({
            title: `定位到第${i + 1}段`,
            icon: 'success',
            duration: 1500
          })
          break
        }
      }
    },

    /**
     * 下一篇文章
     */
    nextPassage() {
      this.triggerEvent('next')
    },

    /**
     * 长按文本（选择单词或句子）
     */
    onTextLongPress(e) {
      const text = e.currentTarget.dataset.text

      wx.showActionSheet({
        itemList: ['查看单词', '翻译句子', '分析句子结构'],
        success: (res) => {
          switch(res.tapIndex) {
          case 0:
            // 查看单词 - 弹出输入框让用户输入要查的词
            this.promptWordInput(text)
            break
          case 1:
            // 翻译句子
            this.showSentenceTranslation(text)
            break
          case 2:
            // 分析句子结构
            this.analyzeSentenceStructure(text)
            break
          }
        }
      })
    },

    /**
     * 提示输入单词
     */
    promptWordInput(context) {
      wx.showModal({
        title: '查看单词',
        content: '请在下方输入要查询的单词',
        editable: true,
        placeholderText: '输入单词...',
        success: (res) => {
          if (res.confirm && res.content) {
            const word = res.content.trim()
            if (word) {
              this.showWordPopup(word, context)
            }
          }
        }
      })
    },

    /**
     * 显示单词弹窗
     */
    showWordPopup(word, context) {
      this.setData({
        showWordPopup: true,
        selectedWord: word,
        selectedContext: context
      })
    },

    /**
     * 关闭单词弹窗
     */
    onCloseWordPopup() {
      this.setData({
        showWordPopup: false,
        selectedWord: '',
        selectedContext: ''
      })
    },

    /**
     * 单词加入生词本事件
     */
    onWordAddToVocab(e) {
      console.log('单词已加入生词本:', e.detail.word)
    },

    /**
     * 单词加入薄弱点库事件
     */
    onWordAddToWeakness(e) {
      console.log('单词已加入薄弱点练习库:', e.detail.word)
    },

    /**
     * 翻译句子
     */
    showSentenceTranslation(sentence) {
      this.setData({
        showSentenceCard: true,
        selectedSentence: sentence
      })
    },

    /**
     * 分析句子结构
     */
    analyzeSentenceStructure(sentence) {
      this.setData({
        showSentenceCard: true,
        selectedSentence: sentence
      })
    },

    /**
     * 关闭句子卡片
     */
    onCloseSentenceCard() {
      this.setData({
        showSentenceCard: false,
        selectedSentence: ''
      })
    },

    /**
     * 句子加入练习库事件
     */
    onSentenceAddToPractice(e) {
      console.log('句子已加入长难句库:', e.detail.sentence)
    },

    /**
     * 表达方式切换事件
     */
    onVariationChange(e) {
      console.log('切换到表达方式:', e.detail.variation.typeLabel)
    },

    // ==================== 阅读AI导师相关方法 ====================

    /**
     * 监听页面滚动（由父页面调用）
     */
    onPageScroll(e) {
      if (!this.aiTutor) return
      
      const { scrollTop, scrollHeight } = e
      const contentHeight = 600  // 可视区域高度（需要根据实际情况调整）
      
      // 更新阅读速度
      const totalWords = this.countWords(this.data.passage.content || '')
      const scrollRatio = Math.min(scrollTop / scrollHeight, 1)
      const currentWordsRead = Math.floor(totalWords * scrollRatio)
      this.aiTutor.monitorReadingSpeed(currentWordsRead)
      
      // 监控滚动并检查触发条件
      const hint = this.aiTutor.monitorScroll(scrollTop, scrollHeight, contentHeight)
      
      if (hint && !this.data.showReadingAIHint) {
        this.showReadingAIHint(hint)
      }
    },

    /**
     * 显示阅读AI提示
     */
    showReadingAIHint(hintData) {
      if (!hintData) return
      
      this.setData({
        showReadingAIHint: true,
        readingAIHintData: hintData
      })
      
      // 震动反馈
      wx.vibrateShort()
      
      console.log('🤖 阅读AI提示触发:', hintData.type, hintData.title)
    },

    /**
     * 关闭阅读AI提示
     */
    closeReadingAIHint() {
      this.setData({
        showReadingAIHint: false
      })
      
      console.log('❌ 用户关闭阅读AI提示')
    },

    /**
     * 阻止事件冒泡
     */
    stopPropagation() {
      // 阻止冒泡
    },

    /**
     * 计算文章字数
     */
    countWords(text) {
      if (!text) return 0
      
      // 英文按单词计数
      const words = text.trim().split(/\s+/)
      return words.filter(word => word.length > 0).length
    },

    /**
     * 选择答案时检查是否未读就答题
     */
    checkAnswerWithoutReading() {
      if (!this.aiTutor) return
      
      const hint = this.aiTutor.checkAnswerWithoutReading()
      if (hint && !this.data.showReadingAIHint) {
        this.showReadingAIHint(hint)
      }
    }
  }
})

