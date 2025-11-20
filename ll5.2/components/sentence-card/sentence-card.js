// components/sentence-card/sentence-card.js
const { categories } = require('../../data/golden-sentences/mock-data.js')

Component({
  properties: {
    sentence: {
      type: Object,
      value: {}
    },
    isFavorite: {
      type: Boolean,
      value: false
    }
  },

  data: {
    tierName: '',
    categoryName: '',
    categoryIcon: '',
    difficultyStars: '',
    displayTags: [],
    usageCountText: '',
    successRateText: ''
  },

  observers: {
    'sentence': function(sentence) {
      if (sentence && sentence.tier) {
        this.updateDisplayInfo(sentence)
      }
    }
  },

  methods: {
    /**
     * 更新显示信息
     */
    updateDisplayInfo(sentence) {
      // 层级名称
      const tierMap = {
        'basic': '基础',
        'advanced': '进阶',
        'extended': '拓展'
      }

      // 分类信息
      const position = categories.positions.find(p => p.id === sentence.category.position)

      // 生成难度星星
      const stars = '★'.repeat(sentence.meta.difficulty || 0)

      // 获取前2个标签
      const displayTags = sentence.tags ? sentence.tags.slice(0, 2) : []

      // 格式化使用次数
      const usageCountText = this.formatNumber(sentence.meta.usageCount)

      // 格式化成功率
      const successRate = Math.round((sentence.meta.successRate || 0) * 100)
      const successRateText = successRate.toString()

      this.setData({
        tierName: tierMap[sentence.tier] || '未知',
        categoryName: position ? position.name : '未分类',
        categoryIcon: position ? position.icon : '📝',
        difficultyStars: stars,
        displayTags: displayTags,
        usageCountText: usageCountText,
        successRateText: successRateText
      })
    },

    /**
     * 格式化数字
     */
    formatNumber(num) {
      if (!num) {return '0'}
      if (num >= 10000) {
        return `${(num / 10000).toFixed(1)}w`
      }
      if (num >= 1000) {
        return `${(num / 1000).toFixed(1)}k`
      }
      return num.toString()
    },

    /**
     * 收藏
     */
    onFavorite() {
      // 防御性检查：sentence可能为null
      if (!this.data.sentence || !this.data.sentence.id) {
        console.warn('[SentenceCard] 收藏失败：句子数据不存在')
        wx.showToast({
          title: '数据加载中，请稍后',
          icon: 'none'
        })
        return
      }

      this.triggerEvent('favorite', {
        sentenceId: this.data.sentence.id,
        isFavorite: !this.data.isFavorite
      })
    },

    /**
     * 查看详情
     */
    onDetail() {
      // 防御性检查：sentence可能为null
      if (!this.data.sentence) {
        console.warn('[SentenceCard] 查看详情失败：句子数据不存在')
        wx.showToast({
          title: '数据加载中，请稍后',
          icon: 'none'
        })
        return
      }

      this.triggerEvent('detail', {
        sentence: this.data.sentence
      })
    },

    /**
     * 插入句子
     */
    onInsert() {
      // 防御性检查：sentence可能为null
      if (!this.data.sentence) {
        console.warn('[SentenceCard] 插入失败：句子数据不存在')
        wx.showToast({
          title: '数据加载中，请稍后',
          icon: 'none'
        })
        return
      }

      this.triggerEvent('insert', {
        sentence: this.data.sentence
      })

      wx.showToast({
        title: '已插入',
        icon: 'success',
        duration: 1500
      })
    }
  }
})
