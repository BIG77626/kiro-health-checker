// components/stat-card/stat-card.js
Component({
  /**
   * 统计卡片组件
   * 用于报告页和首页的数据展示
   */
  properties: {
    // 图标
    icon: {
      type: String,
      value: ''
    },

    // 数值
    value: {
      type: String,
      value: '0'
    },

    // 标签
    label: {
      type: String,
      value: ''
    },

    // 变化值
    change: {
      type: String,
      value: ''
    },

    // 变化类型：positive, negative
    changeType: {
      type: String,
      value: 'positive'
    },

    // 主题色：blue, green, purple, orange
    theme: {
      type: String,
      value: 'blue'
    }
  },

  methods: {
    onTap() {
      this.triggerEvent('tap', {
        label: this.data.label,
        value: this.data.value
      })
    }
  }
})

