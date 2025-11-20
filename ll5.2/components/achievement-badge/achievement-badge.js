// components/achievement-badge/achievement-badge.js
Component({
  /**
   * 成就徽章组件
   * 用于个人中心的成就展示
   */
  properties: {
    // 图标
    icon: {
      type: String,
      value: ''
    },

    // 标题
    title: {
      type: String,
      value: ''
    },

    // 数值
    value: {
      type: String,
      value: ''
    },

    // 描述
    description: {
      type: String,
      value: ''
    },

    // 是否解锁
    unlocked: {
      type: Boolean,
      value: true
    },

    // 主题色：gold, fire, blue, green, purple, red
    theme: {
      type: String,
      value: 'blue'
    }
  },

  methods: {
    onTap() {
      if (this.data.unlocked) {
        this.triggerEvent('tap', {
          title: this.data.title
        })
      }
    }
  }
})

