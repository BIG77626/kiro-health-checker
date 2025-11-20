// components/hint-bar/hint-bar.js

const { nextState, HINT_STATES } = require('../../utils/state-machine.js')

Component({
  properties: {
    questionId: {
      type: String,
      value: ''
    },
    focus: {
      type: String,
      value: ''
    },
    canExpand: {
      type: Boolean,
      value: false
    },
    remainSteps: {
      type: Number,
      value: 0
    },
    hintState: {
      type: String,
      value: 'HIDDEN',
      observer: function(newVal) {
        // 外部状态同步到内部
        if (newVal) {
          this.setData({ hintState: newVal })
        }
      }
    }
  },

  data: {
    hintState: HINT_STATES.HIDDEN,
    expanded: false,
    hidden: false
  },

  lifetimes: {
    attached() {
      console.log('📌 hint-bar组件已加载')
    }
  },

  // 使用小程序原生observers（零依赖观察者）
  observers: {
    'focus': function(focus) {
      console.log('🔔 focus变化:', focus ? '已加载' : '空')

      if (focus && this.data.hintState === HINT_STATES.LOADING) {
        // focus加载完成，转换到STEP1
        console.log('📌 focus加载完成，准备显示聚焦条')
        this.transitionTo(HINT_STATES.STEP1)
      }
    }
  },

  methods: {
    /**
     * 状态转换
     */
    transitionTo(targetState) {
      const context = {
        hintLoaded: Boolean(this.data.focus),
        safeLevel: 'no-answer',
        loadError: false
      }

      const newState = nextState(this.data.hintState, {
        ...context,
        trigger: targetState
      })

      if (newState !== this.data.hintState) {
        this.setData({
          hintState: newState
        })

        console.log(`hint-bar状态: ${this.data.hintState} → ${newState}`)
      }
    },

    /**
     * 展开/收起
     */
    onExpand() {
      const newExpanded = !this.data.expanded

      this.setData({
        expanded: newExpanded
      })

      // 触发父组件事件
      this.triggerEvent('expand', {
        expanded: newExpanded,
        questionId: this.data.questionId
      })

      console.log('展开更多提示:', newExpanded)
    },

    /**
     * 重试
     */
    onRetry() {
      this.transitionTo(HINT_STATES.LOADING)

      this.triggerEvent('retry', {
        questionId: this.data.questionId
      })
    }
  }
})

