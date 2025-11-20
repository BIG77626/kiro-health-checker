// components/cloze-question/cloze-question.js

const { wrongQuestionCollector } = require('../../../../utils/wrong-questions.js')
const ClozeAITrainer = require('./cloze-ai-trainer.js')

Component({
  properties: {
    clozeData: {
      type: Object,
      value: {}
    }
  },

  data: {
    contentParts: [],
    currentBlankIndex: 0,
    currentBlank: null,
    currentBlankId: null,
    userAnswers: {},
    showAnswer: false,
    showContextHint: false,
    answeredCount: 0,
    totalBlanks: 0,

    // 完型填空AI训练师
    showClozeAIHint: false,
    clozeAIHintData: null,
    hesitationTimer: null
  },

  lifetimes: {
    attached() {
      // 初始化AI训练师
      this.aiTrainer = new ClozeAITrainer()
      console.log('🎯 完型填空组件加载完成, AI训练师已启动')
      
      this.parseContent()
    },

    detached() {
      // 清理定时器
      if (this.data.hesitationTimer) {
        clearInterval(this.data.hesitationTimer)
      }
      
      // 重置AI训练师
      if (this.aiTrainer) {
        this.aiTrainer.reset()
      }
    }
  },

  observers: {
    'clozeData': function(newData) {
      if (newData && newData.content) {
        this.parseContent()
      }
    }
  },

  methods: {
    /**
     * 解析完形填空文本
     */
    parseContent() {
      const { content, blanks } = this.data.clozeData
      if (!content || !blanks) {return}

      const parts = []
      let lastIndex = 0

      // 解析文本，将 ___1___ 替换为占位符
      const regex = /___(\d+)___/g
      let match

      while ((match = regex.exec(content)) !== null) {
        // 添加前面的文本
        if (match.index > lastIndex) {
          parts.push({
            type: 'text',
            content: content.substring(lastIndex, match.index)
          })
        }

        // 添加空格
        const blankId = parseInt(match[1])
        parts.push({
          type: 'blank',
          id: blankId
        })

        lastIndex = match.index + match[0].length
      }

      // 添加最后的文本
      if (lastIndex < content.length) {
        parts.push({
          type: 'text',
          content: content.substring(lastIndex)
        })
      }

      this.setData({
        contentParts: parts,
        totalBlanks: blanks.length,
        currentBlank: blanks[0],
        currentBlankId: blanks[0].id,
        currentBlankIndex: 0
      })
    },

    /**
     * 选择空格
     */
    selectBlank(e) {
      const { id } = e.currentTarget.dataset
      const { blanks } = this.data.clozeData

      const index = blanks.findIndex(b => b.id === id)
      if (index !== -1) {
        // 清除之前的犹豫定时器
        if (this.data.hesitationTimer) {
          clearInterval(this.data.hesitationTimer)
        }

        this.setData({
          currentBlankIndex: index,
          currentBlank: blanks[index],
          currentBlankId: id,
          showContextHint: false
        })

        // 开始监控这个空格
        if (this.aiTrainer) {
          this.aiTrainer.startMonitoring(id)
          
          // 启动犹豫监控定时器（每5秒检查一次）
          const timer = setInterval(() => {
            const result = this.aiTrainer.monitorHesitation(id)
            if (result) {
              this.showClozeAIHint(result)
            }
          }, 5000)
          
          this.setData({ hesitationTimer: timer })
        }
      }
    },

    /**
     * 选择选项
     */
    selectOption(e) {
      const { option } = e.currentTarget.dataset
      const { currentBlankId, currentBlank } = this.data

      // 清除犹豫定时器
      if (this.data.hesitationTimer) {
        clearInterval(this.data.hesitationTimer)
        this.setData({ hesitationTimer: null })
      }

      const newAnswers = { ...this.data.userAnswers }
      newAnswers[currentBlankId] = option

      const answeredCount = Object.keys(newAnswers).length
      const isCorrect = currentBlank && currentBlank.answer === option

      this.setData({
        userAnswers: newAnswers,
        answeredCount: answeredCount
      })

      // AI监控：判断对错并记录
      if (this.aiTrainer) {
        if (isCorrect) {
          this.aiTrainer.recordCorrect(currentBlankId)
        } else {
          // 错误监控
          const result = this.aiTrainer.monitorError(
            currentBlankId,
            option,
            currentBlank.answer,
            currentBlank
          )
          
          if (result && !this.data.showClozeAIHint) {
            this.showClozeAIHint(result)
          }
        }
      }

      // 检查答案是否正确，如果错误则收集到错题本
      if (!isCorrect) {
        // 构建错题数据
        const wrongQuestion = {
          id: `cloze-${this.data.clozeData.id}-blank-${currentBlankId}`,
          type: '完形填空',
          content: `第 ${currentBlankId} 空：${currentBlank.context || ''}`,
          explanation: currentBlank.analysis || '',
          keywords: []
        }

        // 收集错题
        wrongQuestionCollector.collect(wrongQuestion, option, currentBlank.answer)
      }

      // 触发父组件事件
      this.triggerEvent('answer', {
        blankId: currentBlankId,
        answer: option,
        isCorrect: isCorrect
      })

      wx.vibrateShort()

      // 自动跳到下一空
      setTimeout(() => {
        if (this.data.currentBlankIndex < this.data.totalBlanks - 1) {
          this.nextBlank()
        }
      }, 300)
    },

    /**
     * 上一空
     */
    prevBlank() {
      const newIndex = this.data.currentBlankIndex - 1
      if (newIndex >= 0) {
        const { blanks } = this.data.clozeData
        this.setData({
          currentBlankIndex: newIndex,
          currentBlank: blanks[newIndex],
          currentBlankId: blanks[newIndex].id,
          showContextHint: false
        })
      }
    },

    /**
     * 下一空
     */
    nextBlank() {
      const newIndex = this.data.currentBlankIndex + 1
      const { blanks } = this.data.clozeData

      if (newIndex < blanks.length) {
        this.setData({
          currentBlankIndex: newIndex,
          currentBlank: blanks[newIndex],
          currentBlankId: blanks[newIndex].id,
          showContextHint: false
        })
      }
    },

    /**
     * 显示上下文提示
     */
    showContext() {
      this.setData({
        showContextHint: !this.data.showContextHint
      })
    },

    /**
     * 切换答案显示
     */
    toggleAnswer() {
      this.setData({
        showAnswer: !this.data.showAnswer
      })
    },

    // ==================== 完型填空AI训练师相关方法 ====================

    /**
     * 显示完型填空AI提示
     */
    showClozeAIHint(result) {
      if (!this.aiTrainer || !result) return
      
      const { blankId } = result
      const blank = this.data.clozeData.blanks.find(b => b.id === blankId)
      
      if (!blank) return
      
      // 获取渐进式提示
      const hintData = this.aiTrainer.getProgressiveHint(blankId, blank, result.triggerReason)
      
      this.setData({
        showClozeAIHint: true,
        clozeAIHintData: hintData
      })
      
      // 震动反馈
      wx.vibrateShort()
      
      console.log('🤖 完型填空AI提示触发:', hintData.level, hintData.title)
    },

    /**
     * 关闭完型填空AI提示
     */
    closeClozeAIHint() {
      this.setData({
        showClozeAIHint: false
      })
      
      console.log('❌ 用户关闭完型填空AI提示')
    },

    /**
     * 请求下一级提示
     */
    requestNextHint() {
      if (!this.aiTrainer) return
      
      const { currentBlankId, currentBlank } = this.data
      
      if (!currentBlank) return
      
      // 获取下一级提示
      const hintData = this.aiTrainer.requestNextLevelHint(currentBlankId, currentBlank)
      
      this.setData({
        clozeAIHintData: hintData
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
