// components/learning-card/learning-card.js
Component({
  /**
   * 学习模块卡片组件
   * 用于学习页的5个核心模块展示
   */
  properties: {
    // 图标路径
    icon: {
      type: String,
      value: ''
    },

    // 标题
    title: {
      type: String,
      value: ''
    },

    // 副标题
    subtitle: {
      type: String,
      value: ''
    },

    // 计数文字
    count: {
      type: String,
      value: ''
    },

    // 徽章文字
    badge: {
      type: String,
      value: ''
    },

    // 徽章类型：new, warning, danger
    badgeType: {
      type: String,
      value: 'new'
    },

    // 背景颜色类名：blue, green, orange, red, purple
    bgColorClass: {
      type: String,
      value: 'blue'
    }
  },

  data: {

  },

  methods: {
    /**
     * 卡片点击事件
     */
    onCardTap() {
      this.triggerEvent('tap', {
        title: this.data.title
      })
    }
  }
})

