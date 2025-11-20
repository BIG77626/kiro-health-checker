// pages/morpheme-learning/morpheme-learning.js
// 词根词素学习页面

Page({
  data: {
    // UI状态
    showProgressDetail: false,
    
    // 今日进度
    todayProgress: {
      target: 5,
      completed: 2
    },
    todayProgressPercent: 40,
    
    // 总体进度
    totalProgress: {
      total: 100,
      mastered: 45,
      words: 312,
      days: 23,
      avgPerDay: 2.0
    },
    totalProgressPercent: 45,
    
    // 今日任务列表
    todayTasks: [
      {
        id: 'struct',
        name: 'struct',
        meaning: '建造',
        wordCount: 7,
        completed: true
      },
      {
        id: 'port',
        name: 'port',
        meaning: '携带',
        wordCount: 5,
        completed: true
      },
      {
        id: 'ject',
        name: 'ject',
        meaning: '投掷',
        wordCount: 6,
        completed: false
      },
      {
        id: 'dict',
        name: 'dict',
        meaning: '说',
        wordCount: 4,
        completed: false
      },
      {
        id: 'scrib',
        name: 'scrib',
        meaning: '写',
        wordCount: 5,
        completed: false
      }
    ],
    
    // 今日学习词根
    todayMorphemes: [
      {
        id: 'struct',
        name: 'struct',
        meaning: '建造',
        derivedWordCount: 7,
        status: 'completed',
        statusIcon: '■',
        statusText: '已掌握'
      },
      {
        id: 'port',
        name: 'port',
        meaning: '携带',
        derivedWordCount: 5,
        status: 'learning',
        statusIcon: '▢',
        statusText: '学习中'
      },
      {
        id: 'ject',
        name: 'ject',
        meaning: '投掷',
        derivedWordCount: 6,
        status: 'new',
        statusIcon: '□',
        statusText: '未学习'
      },
      {
        id: 'dict',
        name: 'dict',
        meaning: '说',
        derivedWordCount: 4,
        status: 'new',
        statusIcon: '□',
        statusText: '未学习'
      },
      {
        id: 'scrib',
        name: 'scrib',
        meaning: '写',
        derivedWordCount: 5,
        status: 'new',
        statusIcon: '□',
        statusText: '未学习'
      }
    ]
  },

  onLoad(_options) {
    // 页面加载时初始化数据
    this.loadUserProgress()
  },

  /**
   * 加载用户学习进度
   */
  loadUserProgress() {
    // TODO: 从云数据库或本地存储加载真实数据
    // 目前使用模拟数据
    
    // 计算进度百分比
    const todayPercent = Math.round(
      (this.data.todayProgress.completed / this.data.todayProgress.target) * 100
    )
    const totalPercent = Math.round(
      (this.data.totalProgress.mastered / this.data.totalProgress.total) * 100
    )
    
    this.setData({
      todayProgressPercent: todayPercent,
      totalProgressPercent: totalPercent
    })
  },

  /**
   * 切换进度详情显示
   */
  toggleProgressDetail() {
    this.setData({
      showProgressDetail: !this.data.showProgressDetail
    })
  },

  /**
   * 点击词根卡片
   */
  onMorphemeClick(e) {
    const { id } = e.currentTarget.dataset
    console.log('点击词根:', id)
    
    // 可以跳转到词根详情页或直接开始学习
    // 这里暂时什么都不做，等待用户点击"开始学习"按钮
  },

  /**
   * 开始学习词根
   */
  onStartLearning(e) {
    const { id } = e.currentTarget.dataset
    console.log('开始学习词根:', id)
    
    // 跳转到学习页面，开始6阶段学习流程
    wx.navigateTo({
      url: `/pages/morpheme-study/morpheme-study?morphemeId=${id}`
    })
  },

  /**
   * 查看全部词根库
   */
  onViewAllMorphemes() {
    wx.navigateTo({
      url: '/pages/morpheme-library/morpheme-library'
    })
  },

  onShow() {
    // 页面显示时刷新进度
    this.loadUserProgress()
  }
})

