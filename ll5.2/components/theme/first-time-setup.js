/** 首次主题设置弹窗组件
 * 用于新用户首次登录时选择主题偏好
 */

const themeIcons = require('../../utils/theme-icons.js')

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    systemTheme: {
      type: String,
      value: 'light' // 'light' | 'dark'
    }
  },

  data: {
    selectedOption: 'system', // 'system' | 'light' | 'dark'
    brightnessIcon: themeIcons.brightnessIcon,
    sunIcon: themeIcons.sunIcon,
    moonIcon: themeIcons.moonIcon
  },

  lifetimes: {
    attached() {
      // 组件创建时初始化
    }
  },

  observers: {
    'selectedOption': function() {
      // 选择变更时的处理
    },
    'systemTheme': function() {
      // 系统主题变更时的处理
    }
  },

  methods: {

    /**
     * 选择选项
     */
    selectOption(e) {
      const { option } = e.currentTarget.dataset
      this.setData({
        selectedOption: option
      })
    },

    /**
     * 确认选择
     */
    confirmSelection() {
      const { selectedOption } = this.data

      // 根据选择设置主题
      let theme = 'light'
      let followSystem = false

      if (selectedOption === 'system') {
        followSystem = true
        theme = this.data.systemTheme
      } else if (selectedOption === 'dark') {
        theme = 'dark'
      }

      // 触发确认事件
      this.triggerEvent('confirm', {
        theme,
        followSystem,
        selectedOption
      })

      // 关闭弹窗
      this.closeModal()
    },

    /**
     * 跳过设置
     */
    skipSetup() {
      // 使用默认设置（亮色主题，不跟随系统）
      this.triggerEvent('confirm', {
        theme: 'light',
        followSystem: false,
        selectedOption: 'skip'
      })

      this.closeModal()
    },

    /**
     * 关闭弹窗
     */
    closeModal() {
      this.setData({ visible: false })
      this.triggerEvent('close')
    },

    /**
     * 点击遮罩层关闭
     */
    onMaskTap() {
      // 允许通过点击遮罩关闭
      this.skipSetup()
    }
  }
})
