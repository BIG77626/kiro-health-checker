// components/hint-drawer/hint-drawer.js

const { highlight, toRichTextNodes } = require('../../utils/highlight.js')

Component({
  properties: {
    // 抽屉显示状态
    visible: {
      type: Boolean,
      value: false
    },

    // 当前步骤（1/2/3）
    step: {
      type: Number,
      value: 1
    },

    // Step1文案
    step1Text: {
      type: String,
      value: '先定位题干关键词...'
    },

    // Step2支架步骤
    scaffoldSteps: {
      type: Array,
      value: []
    },

    // Step3自检清单
    checklistItems: {
      type: Array,
      value: []
    },

    // 原文材料
    materialText: {
      type: String,
      value: ''
    },

    // 高亮关键词
    keywords: {
      type: Array,
      value: []
    },

    // Gate门槛配置
    gateConfig: {
      type: Object,
      value: {}
    },

    // 当前用户行为数据
    userProgress: {
      type: Object,
      value: {
        idleSec: 0,
        attempts: 0,
        scrolls: 0,
        ackChecked: false
      }
    }
  },

  data: {
    state: 'open',
    drawerHeight: 1200, // 初始高度

    // Step解锁状态
    step2Unlocked: false,
    step3Unlocked: false,

    // Gate提示文案
    gateHintStep2: '正在加载...',
    gateHintStep3: '正在加载...',

    // Gate准备状态
    gateReadyStep2: false,
    gateReadyStep3: false,

    // 高亮后的材料
    highlightedText: ''
  },

  lifetimes: {
    attached() {
      console.log('📌 hint-drawer组件已加载')
    },

    ready() {
      // 首次加载时不自动更新，等待visible=true
      console.log('📌 hint-drawer组件ready')
    },

    detached() {
      console.log('🗑️ hint-drawer组件已卸载')
    }
  },

  observers: {
    // 监听visible变化
    'visible': function(newVisible) {
      if (newVisible) {
        console.log('📂 抽屉打开')
        // 延迟重置，避免与动画冲突
        setTimeout(() => {
          this.setData({
            state: 'open',
            step2Unlocked: false,
            step3Unlocked: false
          })
          this.updateGateStatus()
          this.updateHighlight()
        }, 50)
      } else {
        console.log('📁 抽屉关闭')
      }
    },

    // 监听用户进度变化
    'userProgress.idleSec': function(newVal) {
      if (this.properties.visible && newVal > 0) {
        this.updateGateStatus()
      }
    },

    'userProgress.attempts': function(newVal) {
      if (this.properties.visible && newVal > 0) {
        this.updateGateStatus()
      }
    }
  },

  methods: {
    /**
     * 更新Gate解锁状态
     */
    updateGateStatus() {
      const gate = this.data.gateConfig || {}
      const mode = gate.mode || 'step3'
      const conditions = gate.conditions || {}
      const progress = this.data.userProgress || {}

      // 检查条件
      const minIdleSec = conditions.minIdleSec || 30
      const minAttempts = conditions.minAttempts || 1
      const minScrolls = conditions.minScrolls || 0
      const manualAck = gate.manualAck || false

      const idleOk = progress.idleSec >= minIdleSec
      const attemptsOk = progress.attempts >= minAttempts
      const scrollsOk = progress.scrolls >= minScrolls
      const ackOk = manualAck ? progress.ackChecked : true

      // 计算剩余条件
      const leftConditions = []
      if (!idleOk) {leftConditions.push(`等待 ${minIdleSec - progress.idleSec} 秒`)}
      if (!attemptsOk) {leftConditions.push(`尝试作答 ${minAttempts - progress.attempts} 次`)}
      if (!scrollsOk) {leftConditions.push(`回看材料 ${minScrolls - progress.scrolls} 次`)}
      if (!ackOk) {leftConditions.push('勾选确认')}

      const allOk = idleOk && attemptsOk && scrollsOk && ackOk

      // Step2解锁判断
      const step2Ready = (mode === 'none' || mode === 'step3') ? true : allOk
      const step2Hint = step2Ready
        ? '✅ 已满足条件，可查看'
        : `还需：${leftConditions.join('、')}`

      // Step3解锁判断
      const step3Ready = allOk
      const step3Hint = step3Ready
        ? '✅ 已满足条件，可查看'
        : `还需：${leftConditions.join('、')}`

      // 只在状态变化时更新
      if (this.data.gateReadyStep2 !== step2Ready ||
          this.data.gateReadyStep3 !== step3Ready ||
          this.data.gateHintStep2 !== step2Hint ||
          this.data.gateHintStep3 !== step3Hint) {

        this.setData({
          gateReadyStep2: step2Ready,
          gateReadyStep3: step3Ready,
          gateHintStep2: step2Hint,
          gateHintStep3: step3Hint
        })

        console.log('🔓 Gate状态更新:', {
          step2Ready,
          step3Ready,
          leftConditions: leftConditions.length > 0 ? leftConditions : '已满足'
        })
      }
    },

    /**
     * 更新高亮材料
     */
    updateHighlight() {
      const text = this.data.materialText
      const keywords = this.data.keywords

      if (!text || !keywords || keywords.length === 0) {
        this.setData({ highlightedText: '' })
        return
      }

      const startTime = Date.now()
      const highlightedHtml = highlight(text, keywords)
      const nodes = toRichTextNodes(highlightedHtml)
      const elapsed = Date.now() - startTime

      console.log(`⚡ 高亮渲染耗时: ${elapsed}ms`)

      this.setData({
        highlightedText: nodes
      })
    },

    /**
     * 解锁Step2
     */
    onUnlockStep2() {
      if (!this.data.gateReadyStep2) {
        wx.showToast({
          title: '请先满足解锁条件',
          icon: 'none'
        })
        return
      }

      this.setData({ step2Unlocked: true })

      wx.vibrateShort()
      wx.showToast({
        title: '✅ Step2已解锁',
        icon: 'success'
      })

      this.triggerEvent('unlock', {
        step: 2,
        timestamp: Date.now()
      })

      console.log('🔓 Step2已解锁')
    },

    /**
     * 解锁Step3
     */
    onUnlockStep3() {
      if (!this.data.gateReadyStep3) {
        wx.showToast({
          title: '请先满足解锁条件',
          icon: 'none'
        })
        return
      }

      this.setData({ step3Unlocked: true })

      wx.vibrateShort()
      wx.showToast({
        title: '✅ Step3已解锁',
        icon: 'success'
      })

      this.triggerEvent('unlock', {
        step: 3,
        timestamp: Date.now()
      })

      console.log('🔓 Step3已解锁')
    },

    /**
     * 关闭抽屉
     */
    onClose() {
      console.log('🔽 请求关闭抽屉')

      // 直接触发关闭事件，让父组件控制visible
      this.triggerEvent('close', {})
    },

    /**
     * 点击遮罩关闭
     */
    onMaskTap() {
      console.log('🖱️ 点击遮罩关闭')
      this.triggerEvent('close', {})
    },

    /**
     * 阻止冒泡
     */
    stopPropagation() {
      // 阻止事件冒泡到遮罩层
    },

    /**
     * 阻止滚动穿透
     */
    preventMove() {
      return false
    },

    /**
     * 确认理解，关闭抽屉
     */
    onConfirm() {
      wx.vibrateShort()

      console.log('✅ 用户已确认理解')

      this.triggerEvent('confirm', {
        step2Unlocked: this.data.step2Unlocked,
        step3Unlocked: this.data.step3Unlocked,
        timestamp: Date.now()
      })

      // 直接触发关闭
      this.triggerEvent('close', {})
    }
  }
})

