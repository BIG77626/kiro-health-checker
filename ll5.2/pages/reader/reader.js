// pages/reader/reader.js
const { CloudDatabase } = require('../../utils/cloud.js')
const { showError, showLoading, hideLoading } = require('../../utils/util.js')
const themeUtils = require('../../utils/theme.js')
const { createThemeContainer } = require('../../core/infrastructure/di/themeContainer')
const learningDataManager = require('../../utils/learning-data-manager.js')

const paperDB = new CloudDatabase('papers')

// 🏛️ 架构铁律合规: 使用DI容器获取服务
const themeContainer = createThemeContainer('wechat')
const checkThemeSetupStatusUseCase = themeContainer.resolve('checkThemeSetupStatusUseCase')
const markThemeSetupShownUseCase = themeContainer.resolve('markThemeSetupShownUseCase')

Page({
  data: {
    paper: null,
    passage: null,
    currentPassageIndex: 0,
    isLoading: true,
    readingSettings: {
      fontSize: 'medium', // small, medium, large
      lineHeight: 'normal', // compact, normal, relaxed
      theme: 'light' // light, dark, sepia
    },
    showSettings: false,
    showTranslation: false,
    showThemeSetup: false,
    systemTheme: 'light'
  },

  onLoad(options) {
    console.log('【阅读器页面参数】', options) // 调试信息

    const { paperId, passageId, passageIndex, paperTitle } = options

    if (!paperId || passageIndex === undefined) {
      console.error('❌ 阅读器参数缺失:', { paperId, passageIndex })
      showError('参数缺失，无法加载文章')
      setTimeout(() => {
        wx.navigateBack()
      }, 2000)
      return
    }

    this.setData({
      paperId: paperId,
      passageId: passageId,
      currentPassageIndex: parseInt(passageIndex),
      paperTitle: decodeURIComponent(paperTitle || '考研英语文章')
    })

    this.loadArticle(paperId, parseInt(passageIndex))
    this.loadReadingSettings()

    // 检查主题设置
    this.checkThemeSetup()
  },

  async loadArticle(paperId, passageIndex) {
    this.setData({ isLoading: true })
    showLoading('加载文章内容...')

    try {
      // 加载试卷数据
      const paper = await paperDB.get(paperId)
      console.log('🔍 阅读器加载的试卷数据:', paper) // 调试信息

      if (!paper || !paper.content || !paper.content.passages) {
        console.warn('⚠️ 试卷数据不完整，使用示例文章')
        this.loadSampleArticle()
        return
      }

      const passage = paper.content.passages[passageIndex]
      if (!passage) {
        console.error('❌ 未找到指定文章')
        showError('文章不存在')
        setTimeout(() => {
          wx.navigateBack()
        }, 2000)
        return
      }

      console.log('🔍 加载的文章内容:', passage) // 调试信息

      this.setData({
        paper: paper,
        passage: passage,
        isLoading: false
      })

      // 设置页面标题
      wx.setNavigationBarTitle({
        title: passage.title || '考研英语阅读'
      })

    } catch (error) {
      console.error('❌ 加载文章失败:', error)
      this.loadSampleArticle()
    }

    hideLoading()
  },

  loadSampleArticle() {
    // 提供示例文章数据
    const samplePassage = {
      id: 'sample_passage',
      title: 'Technology and Modern Society',
      paragraphs: [
        {
          number: 1,
          text: 'The rapid advancement of technology has fundamentally transformed how we interact with the world around us. From smartphones that connect us globally to artificial intelligence that assists in decision-making, technology permeates every aspect of modern life.',
          translation: '技术的快速发展从根本上改变了我们与周围世界的互动方式。从连接全球的智能手机到协助决策的人工智能，技术渗透到现代生活的各个方面。'
        },
        {
          number: 2,
          text: 'However, this technological revolution brings both opportunities and challenges. While digital tools enhance productivity and create new possibilities for communication and learning, they also raise concerns about privacy, employment displacement, and social isolation.',
          translation: '然而，这场技术革命既带来了机遇也带来了挑战。虽然数字工具提高了生产力，为沟通和学习创造了新的可能性，但它们也引发了对隐私、就业替代和社会孤立的担忧。'
        },
        {
          number: 3,
          text: 'As we navigate this digital landscape, it becomes crucial to develop digital literacy and maintain a balanced approach to technology adoption. The key lies not in avoiding technology, but in understanding how to harness its benefits while mitigating its potential drawbacks.',
          translation: '当我们在这个数字化环境中穿行时，培养数字素养并保持技术采用的平衡方法变得至关重要。关键不在于避免技术，而在于了解如何利用其优势同时减轻其潜在缺点。'
        }
      ]
    }

    this.setData({
      passage: samplePassage,
      isLoading: false
    })

    wx.setNavigationBarTitle({
      title: samplePassage.title
    })
  },

  loadReadingSettings() {
    // 🏛️ 架构铁律合规: 使用数据管理器获取阅读设置
    try {
      const settings = learningDataManager.getReadingSettings()
      if (settings) {
        this.setData({ readingSettings: settings })
      }
    } catch (error) {
      console.error('加载阅读设置失败:', error)
    }
  },

  saveReadingSettings() {
    // 🏛️ 架构铁律合规: 使用数据管理器保存阅读设置
    try {
      learningDataManager.saveReadingSettings(this.data.readingSettings)
    } catch (error) {
      console.error('保存阅读设置失败:', error)
    }
  },

  // 切换设置面板
  toggleSettings() {
    this.setData({
      showSettings: !this.data.showSettings
    })
  },

  // 切换翻译显示
  toggleTranslation() {
    this.setData({
      showTranslation: !this.data.showTranslation
    })
  },

  // 设置字体大小
  setFontSize(e) {
    const fontSize = e.currentTarget.dataset.size
    this.setData({
      'readingSettings.fontSize': fontSize
    })
    this.saveReadingSettings()
  },

  // 设置行高
  setLineHeight(e) {
    const lineHeight = e.currentTarget.dataset.height
    this.setData({
      'readingSettings.lineHeight': lineHeight
    })
    this.saveReadingSettings()
  },

  // 设置主题
  setTheme(e) {
    const theme = e.currentTarget.dataset.theme
    this.setData({
      'readingSettings.theme': theme
    })
    this.saveReadingSettings()
  },

  // 返回试卷详情
  goBack() {
    wx.navigateBack({
      fail: () => {
        // 如果没有上一页，跳转到学习页面
        wx.switchTab({
          url: '/pages/study/study'
        })
      }
    })
  },

  // 检查主题设置
  async checkThemeSetup() {
    // 检查是否是首次使用
    // 🏛️ 架构铁律合规: 通过Use Case检查主题设置状态 (A1超时保护)
    const themeSetupResult = await checkThemeSetupStatusUseCase.executeWithTimeout()
    const hasSeenThemeSetup = themeSetupResult.data.hasShown

    if (!hasSeenThemeSetup) {
      // 获取系统主题
      const systemTheme = themeUtils.detectSystemDarkMode() ? 'dark' : 'light'

      this.setData({
        systemTheme: systemTheme
      })

      // 延迟显示主题设置弹窗
      setTimeout(() => {
        this.setData({
          showThemeSetup: true
        })
      }, 1000)
    }
  },

  // 主题设置确认
  onThemeSetupConfirm(e) {
    const { theme, followSystem } = e.detail

    // 应用主题
    if (followSystem) {
      themeUtils.setFollowSystem(true)
    } else {
      themeUtils.setUserTheme(theme)
    }

    // 更新阅读设置
    this.setData({
      'readingSettings.theme': theme,
      showThemeSetup: false
    })

    // 保存设置
    this.saveReadingSettings()

    // 标记已看过主题设置
    // 🏛️ 架构铁律合规: 通过Use Case标记主题设置状态 (A1超时保护)
    markThemeSetupShownUseCase.executeWithTimeout().catch(error => {
      console.error('[reader] 标记主题设置失败:', error)
    })
  },

  // 关闭主题设置
  onThemeSetupClose() {
    this.setData({
      showThemeSetup: false
    })

    // 标记已看过主题设置
    // 🏛️ 架构铁律合规: 通过Use Case标记主题设置状态 (A1超时保护)
    markThemeSetupShownUseCase.executeWithTimeout().catch(error => {
      console.error('[reader] 标记主题设置失败:', error)
    })
  }
})
