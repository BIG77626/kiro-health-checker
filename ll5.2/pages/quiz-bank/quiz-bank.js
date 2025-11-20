// pages/quiz-bank/quiz-bank.js
const { showLoading, hideLoading, showError } = require('../../utils/util.js')
const themeUtils = require('../../utils/theme.js')
const { practiceProgressManager } = require('../../utils/practice-progress.js')
const { friendlyErrorManager } = require('../../utils/friendly-error.js')
const { createThemeContainer } = require('../../core/infrastructure/di/themeContainer')

// 🏛️ 架构铁律合规: 使用DI容器获取服务
const themeContainer = createThemeContainer('wechat')
const checkThemeSetupStatusUseCase = themeContainer.resolve('checkThemeSetupStatusUseCase')
const markThemeSetupShownUseCase = themeContainer.resolve('markThemeSetupShownUseCase')

Page({
  data: {
    themeClass: '',  // 暗色模式类名

    // 每日学习进度数据
    todayStudyTime: 45,  // 今日学习时长（分钟）
    targetTime: 70,      // 目标时长（分钟）
    remainingTime: 25,   // 剩余时长（分钟）
    studyProgress: 65,   // 学习进度（百分比）

    quizCategories: [
      {
        id: 'reading_comprehension',
        title: '阅读理解',
        subtitle: '精准定位，攻克长难句',
        icon: '/images/reading.png',
        colorLight: '#FED7AA',
        colorDark: '#DC2626',
        topics: [
          { name: '科技发展', count: 45, difficulty: 'medium' },
          { name: '社会现象', count: 38, difficulty: 'hard' },
          { name: '教育文化', count: 32, difficulty: 'easy' },
          { name: '经济生活', count: 28, difficulty: 'medium' }
        ],
        totalQuestions: 143,
        completedQuestions: 67,
        accuracy: '78.5%',
        progressPercent: 46.9
      },
      {
        id: 'cloze_test',
        title: '完形填空',
        subtitle: '逻辑推理，上下文理解',
        icon: '/images/cloze.png',
        colorLight: '#C7D2FE',
        colorDark: '#6366F1',
        topics: [
          { name: '记叙文', count: 25, difficulty: 'easy' },
          { name: '说明文', count: 22, difficulty: 'medium' },
          { name: '议论文', count: 18, difficulty: 'hard' }
        ],
        totalQuestions: 65,
        completedQuestions: 23,
        accuracy: '65.2%',
        progressPercent: 35.4
      },
      {
        id: 'translation',
        title: '翻译',
        subtitle: '理解原文，准确表达',
        icon: '/images/translation.png',
        colorLight: '#A7F3D0',
        colorDark: '#065F46',
        topics: [
          { name: '英译汉', count: 35, difficulty: 'hard' },
          { name: '汉译英', count: 30, difficulty: 'hard' }
        ],
        totalQuestions: 65,
        completedQuestions: 12,
        accuracy: '58.3%',
        progressPercent: 18.5
      },
      {
        id: 'new_question_type',
        title: '新题型',
        subtitle: '七选五，排序，标题匹配',
        icon: '/images/cloze.png',
        colorLight: '#C7D2FE',
        colorDark: '#6366F1',
        topics: [
          { name: '七选五', count: 28, difficulty: 'medium' },
          { name: '排序题', count: 20, difficulty: 'hard' },
          { name: '标题匹配', count: 15, difficulty: 'medium' }
        ],
        totalQuestions: 63,
        completedQuestions: 31,
        accuracy: '72.1%',
        progressPercent: 49.2
      },
      {
        id: 'writing',
        title: '写作',
        subtitle: '小作文+大作文训练',
        icon: '/images/reading.png',
        colorLight: '#FED7AA',
        colorDark: '#DC2626',
        topics: [
          { name: '应用文写作', count: 20, difficulty: 'easy' },
          { name: '图表作文', count: 18, difficulty: 'medium' },
          { name: '图画作文', count: 15, difficulty: 'hard' }
        ],
        totalQuestions: 53,
        completedQuestions: 8,
        accuracy: '75.0%',
        progressPercent: 15.1
      },
      {
        id: 'vocabulary',
        title: '词汇语法',
        subtitle: '高频词汇，核心语法',
        icon: '/images/vocab.png',
        colorLight: '#FECACA',
        colorDark: '#DB2777',
        topics: [
          { name: '高频词汇', count: 500, difficulty: 'easy' },
          { name: '词汇辨析', count: 200, difficulty: 'medium' },
          { name: '语法填空', count: 150, difficulty: 'medium' }
        ],
        totalQuestions: 850,
        completedQuestions: 324,
        accuracy: '84.2%',
        progressPercent: 38.1
      }
    ],
    recentPractice: [
      {
        title: '2023年阅读理解Text 1',
        type: '阅读理解',
        score: 85,
        date: '今天',
        time: '15分钟'
      },
      {
        title: '完形填空专项训练',
        type: '完形填空',
        score: 70,
        date: '昨天',
        time: '20分钟'
      },
      {
        title: '翻译练习 - 科技类',
        type: '翻译',
        score: 68,
        date: '前天',
        time: '25分钟'
      }
    ],
    selectedCategory: null,
    showCategoryDetail: false,
    isLoading: false,
    showThemeSetup: false,
    systemTheme: 'light'
  },

  onLoad(_options) {
    this.setData({ isLoading: false })
    this.checkThemeSetup()
  },

  onShow() {
    // 页面显示时可以刷新数据
  },

  // 选择题型分类
  selectCategory(e) {
    const { categoryId } = e.currentTarget.dataset
    const category = this.data.quizCategories.find(cat => cat.id === categoryId)

    if (category) {
      this.setData({
        selectedCategory: category,
        showCategoryDetail: true
      })
    }
  },

  // 关闭分类详情
  closeCategoryDetail() {
    this.setData({
      showCategoryDetail: false,
      selectedCategory: null
    })
  },

  // 先阅读文章
  readArticleFirst(_e) {

    showLoading('加载文章中...')

    setTimeout(() => {
      hideLoading()
      this.closeCategoryDetail()

      wx.navigateTo({
        url: '/pages/reading-article/reading-article?paperId=sample_reading_comprehension&passageId=passage_1&title=阅读理解文章'
      })
    }, 800)
  },

  // 开始专项练习
  startCategoryPractice(e) {
    const { categoryId } = e.currentTarget.dataset

    showLoading('准备题目中...')

    // 模拟加载过程
    setTimeout(() => {
      hideLoading()

      // 根据不同题型跳转到对应的练习页面
      switch(categoryId) {
      case 'reading_comprehension':
        // 对于阅读理解，提供选择：先阅读文章或直接答题
        wx.showModal({
          title: '阅读理解练习',
          content: '您想要先阅读文章，还是直接开始答题？',
          cancelText: '先阅读文章',
          confirmText: '直接答题',
          success: (res) => {
            if (res.confirm) {
              // 直接答题
              wx.navigateTo({
                url: '/pages/practice/practice?paperId=sample_reading_comprehension&mode=practice&type=reading'
              })
            } else {
              // 先阅读文章
              wx.navigateTo({
                url: '/pages/reading-article/reading-article?paperId=sample_reading_comprehension&passageId=passage_1&title=阅读理解文章'
              })
            }
          }
        })
        return
      case 'cloze_test':
        wx.navigateTo({
          url: '/pages/practice/practice?paperId=sample_cloze&mode=practice&type=cloze'
        })
        break
      case 'translation':
        wx.navigateTo({
          url: '/pages/practice/practice?type=translation&typeName=翻译练习' // ⭐ 修复：使用统一练习页面
        })
        break
      case 'new_question_type':
        wx.navigateTo({
          url: '/pages/practice/practice?paperId=sample_new_type&mode=practice&type=new_type'
        })
        break
      case 'writing':
        wx.navigateTo({
          url: '/pages/practice/practice?type=writing&typeName=写作练习' // ⭐ 修复：使用统一练习页面
        })
        break
      case 'vocabulary':
        wx.navigateTo({
          url: '/pages/vocabulary/vocabulary' // ⭐ 修复：跳转到词汇学习页面
        })
        break
      default:
        showError('该题型暂未开放')
      }
    }, 1000)
  },

  // 开始话题练习
  startTopicPractice(e) {
    const { topic, categoryId } = e.currentTarget.dataset

    showLoading('加载题目中...')

    setTimeout(() => {
      hideLoading()
      wx.navigateTo({
        url: `/pages/practice/practice?paperId=sample_${categoryId}&topic=${topic}&mode=practice`
      })
    }, 800)
  },

  // 查看练习记录
  viewPracticeHistory() {
    // ⭐ 修复：跳转到训练&分析Tab
    wx.switchTab({
      url: '/pages/wrong-questions/wrong-questions'
    })
  },

  // 智能推荐练习
  smartRecommendation() {
    showLoading('分析中...')

    setTimeout(() => {
      hideLoading()
      wx.showModal({
        title: '智能推荐',
        content: '根据您的练习情况，建议重点练习：\n1. 阅读理解 - 科技发展类\n2. 完形填空 - 议论文\n3. 翻译 - 英译汉\n\n是否开始推荐练习？',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({
              url: '/pages/practice/practice?paperId=recommended&mode=practice'
            })
          }
        }
      })
    }, 1500)
  },

  // 模拟考试
  startMockExam() {
    wx.showModal({
      title: '模拟考试（开发中）',
      content: '该功能正在紧张开发中，即将上线！\n\n预计功能：\n• 完整考研英语题型\n• 180分钟限时答题\n• 真题实战模拟\n• 智能评分分析\n• 错题自动归类\n\n敬请期待 🎯',
      showCancel: false,
      confirmText: '期待上线'
    })
  },

  // 跳转到详细分析页面
  goToAnalysis() {
    wx.navigateTo({
      url: '/pages/report/report'
    })
  },

  // ==================== 题库卡片跳转方法 ====================

  // 跳转到阅读理解
  goToReading() {
    console.log('🔍 [导航] 点击了阅读理解卡片')
    wx.navigateTo({
      url: '/pages/practice/practice?type=reading&typeName=阅读理解',
      success: () => {
        console.log('✅ [导航] 阅读理解页面跳转成功')
      },
      fail: (err) => {
        console.error('❌ [导航] 阅读理解页面跳转失败:', err)
        friendlyErrorManager.show(err, {
          title: '跳转失败',
          message: '无法打开阅读理解练习页面'
        })
      }
    })
  },

  // 跳转到完形填空
  goToCloze() {
    console.log('🔍 [导航] 点击了完形填空卡片')
    wx.navigateTo({
      url: '/pages/practice/practice?type=cloze&typeName=完形填空',
      success: () => {
        console.log('✅ [导航] 完形填空页面跳转成功')
      },
      fail: (err) => {
        console.error('❌ [导航] 完形填空页面跳转失败:', err)
        friendlyErrorManager.show(err, {
          title: '跳转失败',
          message: '无法打开完形填空练习页面'
        })
      }
    })
  },

  // 跳转到翻译练习
  goToTranslation() {
    console.log('🔍 [导航] 点击了翻译练习卡片')
    wx.navigateTo({
      url: '/pages/practice/practice?type=translation&typeName=翻译练习',
      success: () => {
        console.log('✅ [导航] 翻译练习页面跳转成功')
      },
      fail: (err) => {
        console.error('❌ [导航] 翻译练习页面跳转失败:', err)
        friendlyErrorManager.show(err, {
          title: '跳转失败',
          message: '无法打开翻译练习页面'
        })
      }
    })
  },

  // 跳转到写作练习
  goToWriting() {
    console.log('🔍 [导航] 点击了写作练习卡片')
    wx.navigateTo({
      url: '/pages/practice/practice?type=writing&typeName=写作练习',
      success: () => {
        console.log('✅ [导航] 写作练习页面跳转成功')
      },
      fail: (err) => {
        console.error('❌ [导航] 写作练习页面跳转失败:', err)
        friendlyErrorManager.show(err, {
          title: '跳转失败',
          message: '无法打开写作练习页面'
        })
      }
    })
  },

  // 跳转到新题型
  goToNewType() {
    console.log('🔍 [导航] 点击了新题型卡片')
    wx.navigateTo({
      url: '/pages/practice/practice?type=newtype&typeName=新题型',
      success: () => {
        console.log('✅ [导航] 新题型页面跳转成功')
      },
      fail: (err) => {
        console.error('❌ [导航] 新题型页面跳转失败:', err)
        friendlyErrorManager.show(err, {
          title: '跳转失败',
          message: '无法打开新题型练习页面'
        })
      }
    })
  },

  // 跳转到词汇学习（直接跳转到普通词汇学习）
  goToVocabulary() {
    console.log('🔍 [导航] 点击了词汇学习卡片')
    wx.navigateTo({
      url: '/pages/vocabulary/vocabulary',
      success: () => {
        console.log('✅ [导航] 词汇学习页面跳转成功')
      },
      fail: (err) => {
        console.error('❌ [导航] 词汇学习页面跳转失败:', err)
        friendlyErrorManager.show(err, {
          title: '跳转失败',
          message: '无法打开词汇学习页面'
        })
      }
    })
  },

  // 跳转到词根词素学习（直接跳转）
  goToMorpheme() {
    console.log('🔍 [导航] 点击了词根词素卡片')
    wx.navigateTo({
      url: '/pages/morpheme-learning/morpheme-learning',
      success: () => {
        console.log('✅ [导航] 词根词素页面跳转成功')
      },
      fail: (err) => {
        console.error('❌ [导航] 词根词素页面跳转失败:', err)
        friendlyErrorManager.show(err, {
          title: '跳转失败',
          message: '无法打开词根词素学习页面'
        })
      }
    })
  },

  // 继续上次未完成的题目
  continueLastQuestion() {
    const lastProgress = practiceProgressManager.getLastProgress()
    
    if (!lastProgress) {
      wx.showToast({
        title: '没有未完成的题目',
        icon: 'none',
        duration: 2000
      })
      return
    }

    // 显示确认弹窗
    wx.showModal({
      title: '继续练习',
      content: `上次练习：${practiceProgressManager.getProgressDescription(lastProgress)}\n\n是否继续？`,
      confirmText: '继续',
      cancelText: '重新开始',
      success: (res) => {
        if (res.confirm) {
          // 继续上次进度
          wx.navigateTo({
            url: `/pages/practice/practice?paperId=${lastProgress.paperId}&type=${lastProgress.type}&typeName=${lastProgress.typeName}&continue=true&questionIndex=${lastProgress.questionIndex}`
          })
        } else {
          // 重新开始
          practiceProgressManager.clearProgress()
          wx.navigateTo({
            url: `/pages/practice/practice?paperId=${lastProgress.paperId}&type=${lastProgress.type}&typeName=${lastProgress.typeName}`
          })
        }
      }
    })
  },

  // 跳转到生词本页面
  goToVocabBook() {
    console.log('📖 [quiz-bank] 跳转到生词本')
    wx.navigateTo({
      url: '/pages/vocab-book/vocab-book'
    })
  },

  // 跳转到错题页面
  goToWrongQuestions() {
    // ⭐ 修复：wrong-questions在TabBar中，使用switchTab
    wx.switchTab({
      url: '/pages/wrong-questions/wrong-questions'
    })
  },


  /**
   * 检查是否需要显示主题设置弹窗
   * 使用 SmartModalManager 智能管理弹窗时机
   * 
   * 注意：这里不再展示主题设置弹窗，因为已经在首页展示过了
   * SmartModalManager 会自动管理每个弹窗的展示次数
   */
  async checkThemeSetup() {
    // 题库页面不再主动展示主题设置弹窗
    // 用户可以在个人中心手动设置主题
    console.log('📱 题库页面加载完成，主题设置已在首页完成')
  },

  /**
   * 主题设置确认
   */
  onThemeSetupConfirm(e) {
    const { theme, followSystem, selectedOption } = e.detail

    try {
      // 设置主题
      if (followSystem) {
        themeUtils.setFollowSystem(true)
      } else {
        themeUtils.setUserTheme(theme)
      }

      // 🏛️ 架构铁律合规: 通过Use Case标记主题设置状态 (A1超时保护)
      markThemeSetupShownUseCase.executeWithTimeout().catch(error => {
        console.error('[quiz-bank] 标记主题设置失败:', error)
      })

      // 关闭弹窗
      this.setData({
        showThemeSetup: false
      })

      console.log('主题设置完成:', { theme, followSystem, selectedOption })

    } catch (error) {
      console.error('主题设置失败:', error)
    }
  },

  /**
   * 主题设置弹窗关闭
   */
  onThemeSetupClose() {
    this.setData({
      showThemeSetup: false
    })
  }
})
