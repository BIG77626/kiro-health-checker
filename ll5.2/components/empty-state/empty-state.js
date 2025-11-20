// components/empty-state/empty-state.js
const themeUtils = require('../../utils/theme.js')

Component({
  properties: {
    // 图标（emoji）
    icon: {
      type: String,
      value: '📭'
    },
    // 标题
    title: {
      type: String,
      value: '暂无内容'
    },
    // 描述
    description: {
      type: String,
      value: ''
    },
    // 按钮文本
    buttonText: {
      type: String,
      value: ''
    },
    // 副按钮文本
    secondaryButtonText: {
      type: String,
      value: ''
    }
  },

  data: {
    themeClass: ''
  },

  lifetimes: {
    attached() {
      // 初始化主题
      const themeClass = themeUtils.getThemeClass()
      this.setData({ themeClass })

      // 监听主题变化
      this.themeListener = (e) => {
        this.setData({ themeClass: e.detail.themeClass })
      }
      themeUtils.addThemeListener(this.themeListener)
    },

    detached() {
      // 移除主题监听
      if (this.themeListener) {
        themeUtils.removeThemeListener(this.themeListener)
      }
    }
  },

  methods: {
    // 主按钮点击
    onButtonTap() {
      this.triggerEvent('buttontap')
    },

    // 副按钮点击
    onSecondaryButtonTap() {
      this.triggerEvent('secondarybuttontap')
    }
  }
})

