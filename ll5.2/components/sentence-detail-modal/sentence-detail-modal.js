// components/sentence-detail-modal/sentence-detail-modal.js
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    sentence: {
      type: Object,
      value: {}
    },
    isFavorite: {
      type: Boolean,
      value: false
    }
  },

  methods: {
    /**
     * 关闭弹窗
     */
    onClose() {
      this.triggerEvent('close')
    },

    /**
     * 插入原句
     */
    onInsertOriginal() {
      this.triggerEvent('insert', {
        sentence: this.data.sentence
      })
      wx.showToast({
        title: '已插入原句',
        icon: 'success'
      })
    },

    /**
     * 插入变体
     */
    onInsertVariant(e) {
      const variant = e.currentTarget.dataset.variant
      const variantSentence = {
        ...this.data.sentence,
        english: variant.english,
        chinese: variant.chinese
      }

      this.triggerEvent('insert', {
        sentence: variantSentence
      })

      wx.showToast({
        title: '已插入变体',
        icon: 'success'
      })
    },

    /**
     * 收藏/取消收藏
     */
    onFavorite() {
      this.triggerEvent('favorite', {
        sentenceId: this.data.sentence.id,
        isFavorite: !this.data.isFavorite
      })
    }
  }
})


