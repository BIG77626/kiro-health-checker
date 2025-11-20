/**
 * 生词本提示弹窗组件
 * 发现难词后自动提示用户加入生词本
 */

// 获取全局应用实例
const app = getApp()

Component({
  properties: {
    // 是否显示弹窗
    visible: {
      type: Boolean,
      value: false,
      observer: 'onVisibleChange'
    },

    // 单词数据
    wordData: {
      type: Object,
      value: null
    },

    // 遇到次数
    attempts: {
      type: Number,
      value: 0
    },

    // 困难次数
    hardCount: {
      type: Number,
      value: 0
    }
  },

  data: {
    // 弹窗状态
    showModal: false,
    animationData: {},

    // 单词信息
    word: '',
    phonetic: '',
    meaning: '',
    message: '',

    // 用户选项
    dontShowAgain: false
  },

  methods: {
    /**
     * 监听显示状态变化
     */
    onVisibleChange(newVal, oldVal) {
      if (newVal !== oldVal) {
        if (newVal) {
          this.showPrompt()
        } else {
          this.hidePrompt()
        }
      }
    },

    /**
     * 显示弹窗
     */
    showPrompt() {
      console.log('📖 [生词本弹窗] 显示弹窗')

      const { wordData, attempts, hardCount } = this.properties

      if (!wordData) {
        console.error('❌ [生词本弹窗] 缺少单词数据')
        return
      }

      // 设置单词信息
      this.setData({
        word: wordData.word || '',
        phonetic: wordData.phonetic || '',
        meaning: wordData.meaning || '',
        message: `"${wordData.word}" 已经遇到 ${attempts || 1} 次了`,
        showModal: true,
        dontShowAgain: false
      })

      // 显示动画
      this.showAnimation()
    },

    /**
     * 隐藏弹窗
     */
    hidePrompt() {
      console.log('📖 [生词本弹窗] 隐藏弹窗')

      // 隐藏动画
      this.hideAnimation()

      // 延迟设置显示状态
      setTimeout(() => {
        this.setData({
          showModal: false
        })
      }, 300)
    },

    /**
     * 显示动画
     */
    showAnimation() {
      const animation = wx.createAnimation({
        duration: 300,
        timingFunction: 'ease-out'
      })

      animation.scale(1).step()

      this.setData({
        animationData: animation.export()
      })
    },

    /**
     * 隐藏动画
     */
    hideAnimation() {
      const animation = wx.createAnimation({
        duration: 200,
        timingFunction: 'ease-in'
      })

      animation.scale(0.8).opacity(0).step()

      this.setData({
        animationData: animation.export()
      })
    },

    /**
     * 点击加入生词本
     */
    onAddToVocabBook() {
      console.log('📖 [生词本弹窗] 用户选择加入生词本')

      const { wordData } = this.properties

      // 调用父组件方法
      this.triggerEvent('addToVocabBook', {
        wordData,
        dontShowAgain: this.data.dontShowAgain
      })

      // 隐藏弹窗
      this.hidePrompt()

      // 显示成功提示
      wx.showToast({
        title: '已加入生词本',
        icon: 'success',
        duration: 1500
      })
    },

    /**
     * 点击暂不加入
     */
    onSkipVocabBook() {
      console.log('📖 [生词本弹窗] 用户选择暂不加入')

      const { wordData } = this.properties

      // 调用父组件方法
      this.triggerEvent('skipVocabBook', {
        wordData,
        dontShowAgain: this.data.dontShowAgain
      })

      // 隐藏弹窗
      this.hidePrompt()

      // 显示提示
      if (!this.data.dontShowAgain) {
        wx.showToast({
          title: '好的，下次再问',
          icon: 'none',
          duration: 1500
        })
      }
    },

    /**
     * 切换"不再提示"选项
     */
    onDontShowAgainChange(e) {
      const dontShowAgain = e.detail.value.length > 0
      this.setData({ dontShowAgain })

      console.log('📖 [生词本弹窗] 设置不再提示:', dontShowAgain)
    },

    /**
     * 点击遮罩层关闭
     */
    onModalClose() {
      // 不允许通过点击遮罩关闭，强制用户做出选择
      // 可以添加轻微的震动提示
      wx.vibrateShort && wx.vibrateShort({
        type: 'light'
      })
    },

    /**
     * 播放单词发音
     */
    onPlayPronunciation() {
      const { phonetic } = this.data

      if (phonetic && phonetic.trim()) {
        // 这里可以调用TTS服务
        console.log('🔊 [生词本弹窗] 播放发音:', phonetic)

        // 暂时使用系统提示音
        wx.showToast({
          title: phonetic,
          icon: 'none',
          duration: 1000
        })
      } else {
        wx.showToast({
          title: '暂无发音',
          icon: 'none'
        })
      }
    },

    /**
     * 获取单词难度描述
     */
    getDifficultyDescription() {
      const { attempts, hardCount } = this.properties

      if (hardCount >= 3) {
        return '非常困难'
      } else if (hardCount >= 2) {
        return '比较困难'
      } else if (attempts >= 3) {
        return '需要注意'
      } else {
        return '稍作复习'
      }
    }
  }
})