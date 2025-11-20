// pages/reading-article/reading-article.js
const { showLoading, hideLoading, showError } = require('../../utils/util.js')
const themeUtils = require('../../utils/theme.js')
const { CloudDatabase } = require('../../utils/cloud.js')
const { createThemeContainer } = require('../../core/infrastructure/di/themeContainer')
const learningDataManager = require('../../utils/learning-data-manager.js')

const paperDB = new CloudDatabase('papers')

// 🏛️ 架构铁律合规: 使用DI容器获取服务
const themeContainer = createThemeContainer('wechat')

Page({
  data: {
    article: null,
    paperId: '',
    passageId: '',
    isLoading: true,
    loadError: false,

    // 阅读设置
    readingSettings: {
      fontSize: 16, // 字体大小 14, 16, 18, 20
      lineHeight: 1.6, // 行间距 1.4, 1.6, 1.8, 2.0
      theme: 'light', // 主题 light, dark, sepia
      showTranslation: false // 是否显示翻译
    },

    /**
   * 初始化主题设置
   */
    initializeTheme() {
      try {
        const theme = themeUtils.getCurrentTheme()

        // 应用主题
        this.setData({
          theme: theme.theme,
          followSystem: theme.followSystem
        })

        // 监听系统主题变化
        if (theme.followSystem) {
          this.setupSystemThemeListener()
        }

        console.log('阅读页面主题初始化:', theme)
      } catch (error) {
        console.error('主题初始化失败:', error)
      }
    },

    /**
   * 设置系统主题监听器
   */
    setupSystemThemeListener() {
    // 监听系统主题变化（需要小程序基础库支持）
      if (wx.onThemeChange) {
        wx.onThemeChange((res) => {
          const systemTheme = res.theme === 'dark' ? 'dark' : 'light'
          this.setData({ theme: systemTheme })
          console.log('系统主题变化:', systemTheme)
        })
      }
    },

    showSettings: false,

    // 单词翻译功能
    showWordPopup: false,
    selectedWord: '',
    wordDefinition: '',
    wordPhonetic: '',
    wordExamples: [],

    // 句子翻译功能
    showSentenceTranslation: false,
    selectedSentence: '',
    sentenceTranslation: '',
    fontSizeOptions: [
      { value: 14, label: '小' },
      { value: 16, label: '标准' },
      { value: 18, label: '大' },
      { value: 20, label: '特大' }
    ],
    lineHeightOptions: [
      { value: 1.4, label: '紧密' },
      { value: 1.6, label: '标准' },
      { value: 1.8, label: '宽松' },
      { value: 2.0, label: '超宽' }
    ],
    themeOptions: [
      { value: 'light', label: '白天', bg: '#ffffff', color: '#1f2937' },
      { value: 'dark', label: '夜间', bg: '#1f2937', color: '#f9fafb' },
      { value: 'sepia', label: '护眼', bg: '#fef7e0', color: '#78350f' }
    ]
  },

  onLoad(options) {
    console.log('【阅读页面参数】', options)

    // 初始化主题
    this.initializeTheme()

    const { paperId, passageId, title } = options

    if (!paperId) {
      console.error('❌ 缺少必要参数: paperId')
      showError('参数错误')
      setTimeout(() => {
        wx.navigateBack()
      }, 2000)
      return
    }

    this.setData({
      paperId: paperId,
      passageId: passageId || 'passage_1'
    })

    // 设置页面标题
    if (title) {
      wx.setNavigationBarTitle({
        title: title
      })
    }

    // 加载阅读设置
    this.loadReadingSettings()

    // 加载文章内容
    this.loadArticle()
  },

  onShow() {
    // 隐藏导航栏（可选）
    // wx.hideNavigationBarLoading()
  },

  async loadArticle() {
    this.setData({ isLoading: true, loadError: false })
    showLoading('加载文章中...')

    try {
      // 先尝试从云数据库加载
      const paper = await paperDB.get(this.data.paperId)

      if (paper && paper.content && paper.content.passages) {
        const passage = paper.content.passages.find(p => p.id === this.data.passageId)

        if (passage) {
          this.setData({
            article: {
              ...passage,
              paperTitle: paper.title,
              year: paper.year,
              source: paper.source
            },
            isLoading: false
          })

          // 更新页面标题
          wx.setNavigationBarTitle({
            title: passage.title || '阅读理解'
          })
        } else {
          console.warn('⚠️ 指定文章未找到，使用示例文章')
          this.loadSampleArticle()
        }
      } else {
        console.warn('⚠️ 试卷数据不完整，使用示例文章')
        this.loadSampleArticle()
      }
    } catch (error) {
      console.error('❌ 加载文章失败:', error)
      this.loadSampleArticle()
    }

    hideLoading()
  },

  loadSampleArticle() {
    console.log('🔍 加载示例阅读理解文章')

    const sampleArticles = [
      {
        id: 'passage_1',
        title: 'The Digital Revolution in Education',
        paperTitle: '2024年考研英语一阅读理解',
        year: '2024',
        source: 'The Guardian',
        difficulty: 'medium',
        wordCount: 485,
        readingTime: '3-4分钟',
        topic: '教育科技',
        paragraphs: [
          {
            number: 1,
            text: 'The rapid advancement of technology has fundamentally transformed how we interact with the world around us.',
            translation: '技术的快速发展从根本上改变了我们与周围世界的互动方式。'
          },
          {
            number: 2,
            text: 'From smartphones that connect us globally to artificial intelligence that assists in decision-making, technology permeates every aspect of modern life.',
            translation: '从连接全球的智能手机到协助决策的人工智能，技术渗透到现代生活的各个方面。'
          },
          {
            number: 3,
            text: 'However, this technological revolution brings both opportunities and challenges.',
            translation: '然而，这场技术革命既带来了机遇也带来了挑战。'
          },
          {
            number: 4,
            text: 'While digital tools enhance productivity and create new possibilities for communication and learning, they also raise concerns about privacy, employment displacement, and social isolation.',
            translation: '虽然数字工具提高了生产力，为沟通和学习创造了新的可能性，但它们也引发了对隐私、就业替代和社会孤立的担忧。'
          },
          {
            number: 5,
            text: 'As we navigate this digital landscape, it becomes crucial to develop digital literacy and maintain a balanced approach to technology adoption.',
            translation: '当我们在这个数字化环境中穿行时，培养数字素养并保持技术采用的平衡方法变得至关重要。'
          },
          {
            number: 6,
            text: 'The key lies not in avoiding technology, but in understanding how to harness its benefits while mitigating its potential drawbacks.',
            translation: '关键不在于避免技术，而在于了解如何利用其优势同时减轻其潜在缺点。'
          },
          {
            number: 7,
            text: 'Furthermore, the digital divide remains a significant challenge in achieving equitable education.',
            translation: '此外，数字鸿沟仍然是实现公平教育的重大挑战。'
          },
          {
            number: 8,
            text: 'While affluent students have access to high-speed internet, modern devices, and tech support, their less privileged counterparts often struggle with outdated equipment and unreliable connections.',
            translation: '虽然富裕的学生可以使用高速互联网、现代设备和技术支持，但他们较为贫困的同龄人往往在过时的设备和不可靠的连接中苦苦挣扎。'
          },
          {
            number: 9,
            text: 'Looking ahead, the future of education will likely involve a hybrid approach that combines the best aspects of traditional and digital learning.',
            translation: '展望未来，教育的未来可能涉及一种混合方法，结合传统学习和数字学习的最佳方面。'
          },
          {
            number: 10,
            text: 'Educators must strike a balance between leveraging technology to enhance learning experiences and preserving the human elements that are crucial for intellectual and emotional development.',
            translation: '教育工作者必须在利用技术增强学习体验和保留对智力和情感发展至关重要的人文因素之间取得平衡。'
          }
        ]
      }
    ]

    this.setData({
      article: sampleArticles[0],
      isLoading: false,
      loadError: false
    })
  },

  // 加载阅读设置
  loadReadingSettings() {
    try {
      // 🏛️ 架构铁律合规: 使用数据管理器获取阅读设置
      const settings = learningDataManager.getReadingSettings()
      if (settings) {
        this.setData({
          readingSettings: { ...this.data.readingSettings, ...settings }
        })
      }
    } catch (error) {
      console.log('加载阅读设置失败:', error)
    }
  },

  // 保存阅读设置
  saveReadingSettings() {
    try {
      // 🏛️ 架构铁律合规: 使用数据管理器保存阅读设置
      learningDataManager.saveReadingSettings(this.data.readingSettings)
    } catch (error) {
      console.log('保存阅读设置失败:', error)
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
    const newSettings = {
      ...this.data.readingSettings,
      showTranslation: !this.data.readingSettings.showTranslation
    }

    this.setData({
      readingSettings: newSettings
    })

    this.saveReadingSettings()
  },

  // 设置字体大小
  setFontSize(e) {
    const { size } = e.currentTarget.dataset
    const newSettings = {
      ...this.data.readingSettings,
      fontSize: parseInt(size)
    }

    this.setData({
      readingSettings: newSettings
    })

    this.saveReadingSettings()
  },

  // 设置行间距
  setLineHeight(e) {
    const { height } = e.currentTarget.dataset
    const newSettings = {
      ...this.data.readingSettings,
      lineHeight: parseFloat(height)
    }

    this.setData({
      readingSettings: newSettings
    })

    this.saveReadingSettings()
  },

  // 设置主题
  setTheme(e) {
    const { theme } = e.currentTarget.dataset
    try {
      // 获取当前主题设置
      // 更新主题设置（不跟随系统）
      themeUtils.setUserTheme(theme)

      // 应用新主题
      const newSettings = {
        ...this.data.readingSettings,
        theme: theme
      }

      this.setData({
        readingSettings: newSettings,
        theme: theme,
        followSystem: false
      })

      this.saveReadingSettings()

      console.log('主题切换成功:', theme)
    } catch (error) {
      console.error('主题切换失败:', error)
    }
  },

  // 开始答题
  startQuestions() {
    const { paperId } = this.data

    showLoading('准备题目中...')

    setTimeout(() => {
      hideLoading()
      wx.navigateTo({
        url: `/pages/practice/practice?paperId=${paperId}&mode=practice&type=reading`
      })
    }, 800)
  },

  // 返回上一页
  goBack() {
    wx.navigateBack({
      fail: () => {
        wx.switchTab({
          url: '/pages/study/study'
        })
      }
    })
  },

  // 单词点击处理
  onWordTap(e) {
    const { word } = e.currentTarget.dataset
    if (!word) {return}

    console.log('🔍 点击单词:', word)

    // 清理单词（去除标点符号）
    const cleanWord = word.toLowerCase().replace(/[^a-zA-Z]/g, '')
    if (!cleanWord) {return}

    this.setData({
      selectedWord: cleanWord,
      showWordPopup: true
    })

    // 获取单词定义和发音
    this.getWordDefinition(cleanWord)

    // 朗读单词
    if (this.data.readingSettings.soundEnabled !== false) {
      this.speakWord(cleanWord)
    }
  },

  // 获取单词定义
  async getWordDefinition(word) {
    try {
      // 这里可以调用真实的词典API，目前使用模拟数据
      const definition = this.getMockWordDefinition(word)

      this.setData({
        wordDefinition: definition.definition,
        wordPhonetic: definition.phonetic,
        wordExamples: definition.examples
      })
    } catch (error) {
      console.error('获取单词定义失败:', error)
      this.setData({
        wordDefinition: '暂无释义',
        wordPhonetic: '',
        wordExamples: []
      })
    }
  },

  // 模拟词典数据
  getMockWordDefinition(word) {
    const mockDefinitions = {
      'technology': {
        phonetic: '/tɛkˈnɑlədʒi/',
        definition: 'n. 技术，科技；工艺，技艺',
        examples: [
          'Modern technology has changed our lives.',
          'He works in the technology industry.'
        ]
      },
      'digital': {
        phonetic: '/ˈdɪdʒɪtl/',
        definition: 'adj. 数字的，数码的；手指的',
        examples: [
          'We live in the digital age.',
          'Digital cameras are very popular.'
        ]
      },
      'education': {
        phonetic: '/ˌɛdʒuˈkeɪʃən/',
        definition: 'n. 教育，培养；教育学',
        examples: [
          'Education is very important.',
          'She has a good education background.'
        ]
      },
      'development': {
        phonetic: '/dɪˈvɛləpmənt/',
        definition: 'n. 发展，发育；开发，研制',
        examples: [
          'The development of science and technology.',
          'Child development is crucial.'
        ]
      }
    }

    return mockDefinitions[word] || {
      phonetic: `/${word}/`,
      definition: '词义查找中...',
      examples: ['例句加载中...']
    }
  },

  // 朗读单词
  speakWord(word) {
    try {
      // 使用微信内置的语音合成
      wx.createInnerAudioContext({
        success: (_audioContext) => {
          // 这里可以使用真实的TTS服务
          // 目前使用系统提示音作为占位
          console.log('🔊 朗读单词:', word)
        }
      })

      // 模拟朗读反馈
      wx.vibrateShort({
        type: 'light'
      })

    } catch (error) {
      console.error('朗读失败:', error)
    }
  },

  // 关闭单词弹窗
  closeWordPopup() {
    this.setData({
      showWordPopup: false,
      selectedWord: '',
      wordDefinition: '',
      wordPhonetic: '',
      wordExamples: []
    })
  },

  // 句子长按处理
  onSentenceLongPress(e) {
    const { sentence } = e.currentTarget.dataset
    if (!sentence) {return}

    console.log('📝 长按句子:', sentence)

    wx.showActionSheet({
      itemList: ['翻译句子', '朗读句子', '收藏句子'],
      success: (res) => {
        switch(res.tapIndex) {
        case 0:
          this.translateSentence(sentence)
          break
        case 1:
          this.speakSentence(sentence)
          break
        case 2:
          this.collectSentence(sentence)
          break
        }
      }
    })
  },

  // 翻译句子
  translateSentence(sentence) {
    // 这里可以调用真实的翻译API
    const translation = this.getMockTranslation(sentence)

    this.setData({
      selectedSentence: sentence,
      sentenceTranslation: translation,
      showSentenceTranslation: true
    })
  },

  // 模拟翻译
  getMockTranslation(sentence) {
    // 简化的翻译逻辑
    const translations = {
      'The rapid advancement of technology has fundamentally transformed how we interact with the world around us.':
        '技术的快速发展从根本上改变了我们与周围世界的互动方式。',
      'From smartphones that connect us globally to artificial intelligence that assists in decision-making, technology permeates every aspect of modern life.':
        '从连接全球的智能手机到协助决策的人工智能，技术渗透到现代生活的各个方面。'
    }

    return translations[sentence] || '翻译加载中...'
  },

  // 朗读句子
  speakSentence(sentence) {
    console.log('🔊 朗读句子:', sentence)

    wx.showToast({
      title: '正在朗读...',
      icon: 'none',
      duration: 2000
    })

    // 这里可以调用真实的TTS服务
  },

  // 收藏句子
  collectSentence(sentence) {
    try {
      // 🏛️ 架构铁律合规: 使用数据管理器获取收藏句子
      const collectedSentences = learningDataManager.getCollectedSentences()

      if (!collectedSentences.some(item => item.sentence === sentence)) {
        collectedSentences.push({
          sentence: sentence,
          source: this.data.article.title,
          date: new Date().toISOString()
        })

        // 🏛️ 架构铁律合规: 使用数据管理器保存收藏句子
        learningDataManager.saveCollectedSentences(collectedSentences)

        wx.showToast({
          title: '已收藏',
          icon: 'success',
          duration: 1500
        })
      } else {
        wx.showToast({
          title: '已经收藏过了',
          icon: 'none',
          duration: 1500
        })
      }
    } catch (error) {
      console.error('收藏句子失败:', error)
      wx.showToast({
        title: '收藏失败',
        icon: 'error',
        duration: 1500
      })
    }
  },

  // 关闭句子翻译
  closeSentenceTranslation() {
    this.setData({
      showSentenceTranslation: false,
      selectedSentence: '',
      sentenceTranslation: ''
    })
  },

  // 切换全文翻译
  toggleFullTranslation() {
    const newSettings = {
      ...this.data.readingSettings,
      showTranslation: !this.data.readingSettings.showTranslation
    }

    this.setData({
      readingSettings: newSettings
    })

    this.saveReadingSettings()

    const message = newSettings.showTranslation ? '已显示翻译' : '已隐藏翻译'
    wx.showToast({
      title: message,
      icon: 'none',
      duration: 1000
    })
  },

  // 预览错误处理
  onError() {
    this.setData({
      isLoading: false,
      loadError: true
    })
    hideLoading()
  },

  /**
   * 检查是否需要显示主题设置弹窗
   */
  async checkThemeSetup() {
    try {
      // 🏛️ 架构铁律合规: 使用ThemeService检查主题设置状态 (A1超时保护)
      const checkThemeStatusUseCase = themeContainer.getCheckThemeSetupStatusUseCase()
      const themeStatus = await checkThemeStatusUseCase.executeWithTimeout()

      if (themeStatus.hasShown) {
        return // 已经显示过主题设置弹窗
      }

      // 获取系统主题
      const systemTheme = themeUtils.detectSystemDarkMode() ? 'dark' : 'light'

      // 延迟显示弹窗，确保页面加载完成
      setTimeout(() => {
        this.setData({
          showThemeSetup: true,
          systemTheme
        })
      }, 1000)

    } catch (error) {
      console.error('检查主题设置失败:', error)
    }
  },

  /**
   * 主题设置确认
   */
  async onThemeSetupConfirm(e) {
    const { theme, followSystem, selectedOption } = e.detail

    try {
      // 设置主题
      if (followSystem) {
        themeUtils.setFollowSystem(true)
      } else {
        themeUtils.setUserTheme(theme)
      }

      // 🏛️ 架构铁律合规: 使用ThemeService标记主题设置已显示 (A1超时保护)
      const markThemeShownUseCase = themeContainer.getMarkThemeSetupShownUseCase()
      await markThemeShownUseCase.executeWithTimeout()

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
