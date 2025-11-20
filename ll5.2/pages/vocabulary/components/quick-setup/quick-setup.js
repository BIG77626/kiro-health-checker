// pages/vocabulary/components/quick-setup/quick-setup.js
Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    }
  },

  data: {
    dailyGoal: 50,
    difficultyLevel: 'medium',
    estimatedTime: 25
  },

  methods: {
    /**
     * 选择每日目标
     */
    selectDailyGoal(e) {
      const value = parseInt(e.currentTarget.dataset.value)
      this.setData({
        dailyGoal: value,
        estimatedTime: this.calculateEstimatedTime(value)
      })
    },

    /**
     * 选择难度等级
     */
    selectDifficulty(e) {
      const value = e.currentTarget.dataset.value
      this.setData({
        difficultyLevel: value
      })
    },

    /**
     * 计算估算时间
     */
    calculateEstimatedTime(wordCount) {
      // 假设每个单词平均30秒
      return Math.ceil(wordCount * 0.5)
    },

    /**
     * 确认设置
     */
    onConfirm() {
      const { dailyGoal, difficultyLevel } = this.data
      
      this.triggerEvent('confirm', {
        dailyGoal,
        difficultyLevel
      })

      console.log('✅ [快速设置] 用户确认设置:', { dailyGoal, difficultyLevel })
    },

    /**
     * 跳过设置
     */
    onSkip() {
      // 使用默认设置
      this.triggerEvent('skip', {
        dailyGoal: 50,
        difficultyLevel: 'medium'
      })

      console.log('ℹ️ [快速设置] 用户跳过设置，使用默认值')
    },

    /**
     * 关闭弹窗
     */
    onClose() {
      this.triggerEvent('close')
    },

    /**
     * 阻止事件冒泡
     */
    stopPropagation() {
      // 阻止点击modal内部时关闭
    }
  }
})

