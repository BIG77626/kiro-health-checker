// components/recommendation-card/recommendation-card.js
Component({
  /**
   * 推荐卡片组件
   * 用于智能推荐区域
   */
  properties: {
    // 标题
    title: {
      type: String,
      value: ''
    },

    // 描述
    description: {
      type: String,
      value: ''
    },

    // 题目数量
    count: {
      type: Number,
      value: 0
    },

    // 预计时长（分钟）
    estimatedTime: {
      type: Number,
      value: 0
    },

    // 优先级：high, medium, low
    priority: {
      type: String,
      value: 'medium'
    }
  },

  data: {
    priorityText: {
      'high': '高优先级',
      'medium': '中优先级',
      'low': '低优先级'
    }
  },

  methods: {
    onCardTap() {
      this.triggerEvent('tap', {
        title: this.data.title,
        priority: this.data.priority
      })
    }
  }
})

