// pages/paperdetail/paperdetail.js
const { CloudDatabase } = require('../../utils/cloud.js')
const { showError, showLoading, hideLoading } = require('../../utils/util.js')
const themeUtils = require('../../utils/theme.js')
const { createThemeContainer } = require('../../core/infrastructure/di/themeContainer')

const paperDB = new CloudDatabase('papers')

// 🏛️ 架构铁律合规: 使用DI容器获取服务
const themeContainer = createThemeContainer('wechat')
const checkThemeSetupStatusUseCase = themeContainer.resolve('checkThemeSetupStatusUseCase')
const markThemeSetupShownUseCase = themeContainer.resolve('markThemeSetupShownUseCase')

Page({
  data: {
    paper: null,
    isLoading: true,
    loadError: false,
    showThemeSetup: false,
    systemTheme: 'light'
  },

  onLoad(options) {
    console.log('【页面参数】', options)        // ← 看实际传了什么
    const { id } = options
    console.log('【解构出的id】', id, '类型:', typeof id) // 🔍 调试：查看解构出的id值和类型

    if (!id) {
      console.warn('⚠️ paperId 为空，直接返回')
      showError('试卷ID参数缺失')
      setTimeout(() => {
        wx.navigateBack()
      }, 2000)
      return
    }

    console.log('✅ 开始加载试卷，ID:', id)
    this.setData({ paperId: id })
    this.loadPaper(id)
    this.checkThemeSetup()
  },

  async loadPaper(id) {
    this.setData({ isLoading: true, loadError: false })
    showLoading('加载试卷信息...')

    console.log('🔍 准备加载试卷，ID:', id) // 调试信息

    try {
      const paper = await paperDB.get(id)
      console.log('🔍 从云数据库获取的试卷数据:', paper) // 调试信息

      // 📌 验证数据完整性
      if (paper && this.validatePaperData(paper)) {
        // 确保返回的数据有 id 字段
        const processedPaper = {
          ...paper,
          id: paper._id || paper.id || id // 优先使用 _id，其次 id，最后使用传入的 id
        }
        console.log('🔍 处理后的试卷数据:', processedPaper) // 调试信息

        this.setData({
          paper: processedPaper,
          isLoading: false
        })
      } else {
        console.warn('⚠️ 云数据库数据不完整或未找到试卷，使用示例数据')
        console.log('🔍 数据验证失败的原因:', {
          paperExists: Boolean(paper),
          hasContent: Boolean(paper && paper.content),
          hasQuestions: Boolean(paper && paper.content && paper.content.questions),
          questionsLength: paper && paper.content && paper.content.questions ? paper.content.questions.length : 0
        })
        // 数据不完整或未找到，使用示例数据
        this.loadSamplePaper(id)
      }
    } catch (error) {
      console.error('❌ 加载试卷失败:', error)
      // 加载失败时使用示例数据
      this.loadSamplePaper(id)
    }

    hideLoading()
  },

  // 验证试卷数据完整性
  validatePaperData(paper) {
    console.log('🔍 开始验证试卷数据完整性...') // 调试信息

    // 检查基本字段
    if (!paper) {
      console.error('❌ 试卷数据为空')
      return false
    }

    // 检查 content 字段
    if (!paper.content) {
      console.error('❌ 试卷缺少 content 字段')
      return false
    }

    // 检查 questions 字段
    if (!paper.content.questions) {
      console.error('❌ 试卷 content 中缺少 questions 字段')
      return false
    }

    // 检查 questions 是否为数组
    if (!Array.isArray(paper.content.questions)) {
      console.error('❌ 试卷 questions 不是数组类型')
      return false
    }

    // 检查 questions 数组是否为空
    if (paper.content.questions.length === 0) {
      console.error('❌ 试卷 questions 数组为空')
      return false
    }

    console.log('✅ 试卷数据验证通过，题目数量:', paper.content.questions.length)
    return true
  },

  loadSamplePaper(id) {
    console.log('🔍 加载示例试卷数据，ID:', id) // 调试信息

    // 提供示例试卷数据，便于调试
    const samplePaper = {
      id: id,
      title: '2023年考研英语一真题',
      year: 2023,
      type: 'english1',
      sections: ['reading_a', 'reading_b', 'translation'],
      difficulty: 'medium',
      estimated_time: 180,
      content: {
        passages: [
          {
            id: 'passage_1',
            title: 'Technology and Modern Society',
            readTime: 6,
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
          },
          {
            id: 'passage_2',
            title: 'Education in the Digital Age',
            readTime: 5,
            paragraphs: [
              {
                number: 1,
                text: 'The integration of digital technologies in education has revolutionized traditional learning methods. Online platforms, interactive software, and multimedia resources have made education more accessible and engaging for students worldwide.',
                translation: '数字技术在教育中的整合已经彻底改变了传统的学习方法。在线平台、交互式软件和多媒体资源使全世界的学生更容易接受教育，更有参与感。'
              },
              {
                number: 2,
                text: 'Despite these advantages, the digital divide remains a significant challenge. Not all students have equal access to technology, creating disparities in educational opportunities and outcomes.',
                translation: '尽管有这些优势，数字鸿沟仍然是一个重大挑战。并非所有学生都能平等地接触技术，这在教育机会和结果方面造成了差异。'
              }
            ]
          }
        ],
        questions: [
          {
            id: 'q1',
            type: 'reading_a',
            passage_id: 'passage_1',
            question: 'According to the passage, what is the main impact of technology on modern life?',
            options: [
              'A. It has made life more complicated and stressful',
              'B. It has transformed how we interact with the world',
              'C. It has reduced our productivity significantly',
              'D. It has eliminated traditional communication methods'
            ],
            correct_answer: 'B',
            evidence_paragraphs: [1],
            evidence_sentences: ['The rapid advancement of technology has fundamentally transformed how we interact with the world around us'],
            explanation: '文章开头明确指出技术的快速发展从根本上改变了我们与周围世界的互动方式。',
            difficulty_tips: ['注意关键词"transformed"', '理解"interact"的含义']
          },
          {
            id: 'q2',
            type: 'reading_a',
            passage_id: 'passage_1',
            question: 'What does the author suggest about dealing with technology?',
            options: [
              'A. We should completely avoid using technology',
              'B. We should use technology without any restrictions',
              'C. We should maintain a balanced approach to technology',
              'D. We should rely entirely on artificial intelligence'
            ],
            correct_answer: 'C',
            evidence_paragraphs: [3],
            evidence_sentences: ['maintain a balanced approach to technology adoption'],
            explanation: '文章第三段提到需要保持技术采用的平衡方法。',
            difficulty_tips: ['关注"balanced approach"这个关键短语']
          },
          {
            id: 'q3',
            type: 'reading_a',
            passage_id: 'passage_2',
            question: 'What challenge does the digital divide present in education?',
            options: [
              'A. Teachers are not well-trained in technology',
              'B. Students have unequal access to technology',
              'C. Online platforms are too expensive',
              'D. Digital tools are not effective for learning'
            ],
            correct_answer: 'B',
            evidence_paragraphs: [2],
            evidence_sentences: ['Not all students have equal access to technology'],
            explanation: '文章明确提到不是所有学生都能平等地接触技术。',
            difficulty_tips: ['理解"digital divide"的含义', '注意"equal access"的表述']
          },
          {
            id: 'q4',
            type: 'reading_a',
            passage_id: 'passage_2',
            question: 'How has technology affected traditional education according to the passage?',
            options: [
              'A. It has completely replaced traditional methods',
              'B. It has revolutionized traditional learning methods',
              'C. It has made traditional education obsolete',
              'D. It has had no significant impact'
            ],
            correct_answer: 'B',
            evidence_paragraphs: [1],
            evidence_sentences: ['The integration of digital technologies in education has revolutionized traditional learning methods'],
            explanation: '文章第一句就说明数字技术的整合彻底改变了传统的学习方法。',
            difficulty_tips: ['理解"revolutionized"的含义', '区分"革命性改变"和"完全替代"']
          },
          {
            id: 'q5',
            type: 'reading_b',
            passage_id: 'passage_1',
            question: 'Which of the following best summarizes the author\'s attitude toward technology?',
            options: [
              'A. Completely optimistic',
              'B. Completely pessimistic',
              'C. Balanced and realistic',
              'D. Indifferent and neutral'
            ],
            correct_answer: 'C',
            evidence_paragraphs: [2, 3],
            evidence_sentences: ['brings both opportunities and challenges', 'maintain a balanced approach'],
            explanation: '作者既提到了技术带来的机遇，也提到了挑战，并建议采取平衡的方法。',
            difficulty_tips: ['综合分析作者的整体态度', '注意正反两方面的论述']
          }
        ]
      }
    }

    console.log('🔍 示例试卷数据创建完成:', samplePaper) // 调试信息
    console.log('🔍 示例试卷题目数量:', samplePaper.content.questions.length) // 调试题目数量

    this.setData({
      paper: samplePaper,
      isLoading: false,
      loadError: false
    })

    console.log('✅ 示例试卷数据已设置到页面') // 确认数据设置
  },

  startPractice() {
    console.log('🔍 开始练习 - 当前试卷数据:', this.data.paper) // 详细调试信息

    // 添加数据验证
    if (this.data.isLoading) {
      showError('试卷信息正在加载中，请稍候...')
      return
    }

    if (!this.data.paper) {
      console.error('❌ 试卷数据为空')
      showError('试卷信息加载失败，请重试')
      return
    }

    if (!this.data.paper.id) {
      console.error('❌ 试卷ID无效:', this.data.paper.id)
      showError('试卷ID无效')
      return
    }

    console.log('🔍 试卷内容结构:', this.data.paper.content) // 调试内容结构
    console.log('🔍 题目数据:', this.data.paper.content?.questions) // 调试题目数据

    // 检查试卷是否有题目
    if (!this.data.paper.content) {
      console.error('❌ 试卷没有content字段')
      showError('试卷数据结构异常，请联系管理员')
      return
    }

    if (!this.data.paper.content.questions) {
      console.error('❌ 试卷content中没有questions字段')
      showError('该试卷暂无题目，请选择其他试卷')
      return
    }

    if (this.data.paper.content.questions.length === 0) {
      console.error('❌ 试卷questions数组为空，长度:', this.data.paper.content.questions.length)
      showError('该试卷暂无题目，请选择其他试卷')
      return
    }

    console.log('✅ 试卷验证通过，题目数量:', this.data.paper.content.questions.length)

    wx.navigateTo({
      url: `/pages/practice/practice?paperId=${this.data.paper.id}`,
      success: () => {
        console.log('✅ 成功跳转到练习页面')
      },
      fail: (error) => {
        console.error('❌ 导航失败:', error)
        showError('跳转练习页面失败')
      }
    })
  },

  // 重新加载试卷
  reloadPaper() {
    if (this.data.paperId) {
      this.loadPaper(this.data.paperId)
    }
  },

  // 返回上一页
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

  // 主题设置相关方法
  async checkThemeSetup() {
    try {
      // 🏛️ 架构铁律合规: 通过Use Case检查主题设置状态 (A1超时保护)
      const result = await checkThemeSetupStatusUseCase.executeWithTimeout()
      const hasSetupTheme = result.data.hasShown
      
      if (!hasSetupTheme) {
        const systemInfo = wx.getSystemInfoSync()
        const systemTheme = systemInfo.theme || 'light'
        this.setData({
          showThemeSetup: true,
          systemTheme
        })
      }
    } catch (error) {
      console.error('[paperdetail] 检查主题设置状态失败:', error)
    }
  },

  onThemeSetupConfirm(e) {
    const { theme } = e.detail
    themeUtils.setUserTheme(theme)
    // 🏛️ 架构铁律合规: 通过Use Case标记主题设置状态 (A1超时保护)
    markThemeSetupShownUseCase.executeWithTimeout().catch(error => {
      console.error('[paperdetail] 标记主题设置失败:', error)
    })
    this.setData({ showThemeSetup: false })
  },

  onThemeSetupClose() {
    this.setData({ showThemeSetup: false })
  },

  // 跳转到阅读器页面
  goToReader(e) {
    const { passageId, passageIndex } = e.currentTarget.dataset
    const { paper } = this.data

    console.log('🔍 点击文章，准备跳转到阅读器:', { passageId, passageIndex }) // 调试信息

    if (!paper || !paper.content || !paper.content.passages) {
      console.error('❌ 试卷数据不完整，无法跳转到阅读器')
      showError('文章数据不完整')
      return
    }

    const passage = paper.content.passages[passageIndex]
    if (!passage) {
      console.error('❌ 未找到对应文章')
      showError('未找到对应文章')
      return
    }

    // 构建跳转参数
    const params = {
      paperId: paper.id,
      passageId: passageId,
      passageIndex: passageIndex,
      paperTitle: paper.title
    }

    const queryString = Object.keys(params)
      .map(key => `${key}=${encodeURIComponent(params[key])}`)
      .join('&')

    const url = `/pages/reader/reader?${queryString}`
    console.log('🔍 准备跳转到阅读器:', url) // 调试信息

    wx.navigateTo({
      url: url,
      success: () => {
        console.log('✅ 跳转到阅读器成功')
      },
      fail: (error) => {
        console.error('❌ 跳转到阅读器失败:', error)
        showError('跳转失败，请重试')
      }
    })
  }
})
