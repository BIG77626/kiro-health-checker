// components/hint-float-card/hint-float-card.js

const { highlight, toRichTextNodes } = require('../../utils/highlight.js')

Component({
  properties: {
    // 是否显示组件
    visible: {
      type: Boolean,
      value: false
    },

    // 主要提示文案
    message: {
      type: String,
      value: '先定位题干关键词，找同义改写线索'
    },

    // 关键提示点（数组）
    points: {
      type: Array,
      value: []
    },

    // 关键词（用于高亮）
    keywords: {
      type: Array,
      value: []
    },

    // 是否自动展开
    autoExpand: {
      type: Boolean,
      value: true
    },

    // 是否显示徽章
    showBadge: {
      type: Boolean,
      value: false
    }
  },

  data: {
    expanded: false,        // 是否展开
    currentStep: 1,         // 当前显示步骤（1/2/3）
    highlightedMessage: ''  // 高亮后的消息
  },

  lifetimes: {
    attached() {
      console.log('💡 hint-float-card组件已加载')
    },

    ready() {
      this.updateHighlight()
    }
  },

  observers: {
    // 监听visible变化
    'visible': function(newVisible) {
      if (newVisible) {
        console.log('🔔 提示触发显示')

        // 重置为Step1
        this.setData({ currentStep: 1 })

        if (this.properties.autoExpand) {
          // 自动展开
          this.autoExpandCard()
        } else {
          // 仅显示图标（带脉冲动画）
          this.setData({
            expanded: false
          })
        }
      } else {
        // 隐藏（收起为图标）
        this.setData({
          expanded: false,
          currentStep: 1
        })
        console.log('🔕 提示已隐藏')
      }
    },

    // 监听message或keywords变化
    'message, keywords': function() {
      this.updateHighlight()
    }
  },

  methods: {
    /**
     * 更新高亮文本
     */
    updateHighlight() {
      const message = this.properties.message
      const keywords = this.properties.keywords

      if (!message) {
        this.setData({ highlightedMessage: '' })
        return
      }

      if (!keywords || keywords.length === 0) {
        // 无关键词，直接显示
        this.setData({ highlightedMessage: message })
        return
      }

      // 高亮关键词
      const highlightedHtml = highlight(message, keywords)
      const nodes = toRichTextNodes(highlightedHtml)

      this.setData({
        highlightedMessage: nodes
      })
    },

    /**
     * 自动展开卡片
     */
    autoExpandCard() {
      // 延迟100ms，等待组件渲染完成
      setTimeout(() => {
        this.setData({
          expanded: true,
          currentStep: 1  // 确保从Step1开始
        })

        // 震动反馈
        wx.vibrateShort()

        // 触发展开事件
        this.triggerEvent('expand', {
          timestamp: Date.now()
        })

        console.log('📤 卡片自动展开')
      }, 100)
    },

    /**
     * 切换展开/收起
     */
    onToggle() {
      const willExpand = !this.data.expanded

      console.log('👆 用户点击切换:', willExpand ? '展开' : '收起')

      this.setData({
        expanded: willExpand,
        currentStep: willExpand ? 1 : this.data.currentStep  // 展开时重置为Step1
      })

      wx.vibrateShort()

      // 触发对应事件
      if (willExpand) {
        this.triggerEvent('expand', {
          manual: true,
          timestamp: Date.now()
        })
      } else {
        this.triggerEvent('collapse', {
          timestamp: Date.now()
        })
      }
    },

    /**
     * 用户点击收起（头部按钮）
     */
    onCollapse() {
      console.log('👆 用户点击收起按钮')

      this.setData({
        expanded: false,
        currentStep: 1
      })

      wx.vibrateShort()

      // 触发收起事件
      this.triggerEvent('collapse', {
        timestamp: Date.now()
      })
    },

    /**
     * 展开更多内容
     */
    onExpandMore() {
      const currentStep = this.data.currentStep
      const nextStep = currentStep + 1

      if (nextStep > 3) {
        console.log('⚠️ 已是最后一步')
        return
      }

      console.log(`📤 展开Step${nextStep}`)

      this.setData({
        currentStep: nextStep
      })

      wx.vibrateShort()

      // 触发展开事件
      this.triggerEvent('expandMore', {
        step: nextStep,
        timestamp: Date.now()
      })
    },

    /**
     * 阻止冒泡
     */
    stopPropagation() {
      // 阻止事件冒泡
    },

    /**
     * 阻止滚动穿透
     */
    preventMove() {
      return false
    }
  }
})

