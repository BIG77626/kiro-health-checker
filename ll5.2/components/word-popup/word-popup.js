// components/word-popup/word-popup.js

const synonymGenerator = require('../../utils/vocabulary/synonym-generator.js')
const vocabularyCollector = require('../../utils/weakness/vocabulary-collector.js')
const morphemeParser = require('../../utils/learning/morpheme-parser.js')

Component({
  properties: {
    show: {
      type: Boolean,
      value: false
    },
    word: {
      type: String,
      value: ''
    },
    context: {
      type: String,
      value: ''
    }
  },

  data: {
    wordData: {},
    synonymGroups: [],
    synonymGroupIndex: 0,
    currentSynonyms: [],
    isWeakWord: false,
    viewCount: 0
  },

  observers: {
    'show, word': function(show, word) {
      if (show && word) {
        this.loadWordData(word)
      }
    }
  },

  methods: {
    /**
     * 加载单词数据
     */
    async loadWordData(word) {
      const cleanWord = word.toLowerCase().trim()

      try {
        // 1. 获取基础释义（模拟词典查询，实际应该调用词典API或本地词库）
        const wordInfo = await this._getWordInfo(cleanWord)

        // 2. 获取词素拆解
        const morphemes = morphemeParser.parseMorpheme(cleanWord)
        if (morphemes && morphemes.parts && morphemes.parts.length > 0) {
          wordInfo.morphemes = morphemes.parts.map(p => `${p.text}(${p.meaning})`).join(' + ')
        }

        // 3. 获取同义词分组
        const groups = synonymGenerator.getSynonymGroups(cleanWord)

        // 4. 检查是否为薄弱词
        const weakCheck = await vocabularyCollector.checkIfWeak(cleanWord)

        this.setData({
          wordData: wordInfo,
          synonymGroups: groups,
          synonymGroupIndex: 0,
          currentSynonyms: groups[0] || [],
          isWeakWord: weakCheck ? weakCheck.isWeak : false,
          viewCount: weakCheck ? weakCheck.frequency : 0
        })

        // 5. 收集到薄弱词汇库
        await vocabularyCollector.collectWeakVocabulary(
          wordInfo,
          this.data.context,
          'clicked'
        )

      } catch (error) {
        console.error('❌ 加载单词数据失败:', error)

        // 降级处理
        this.setData({
          wordData: {
            word: cleanWord,
            phonetic: '/',
            definition: '词义加载中...',
            examples: []
          }
        })
      }
    },

    /**
     * 获取单词信息（Issue #4: 调用词典API或查询本地数据库）
     * 
     * 失败场景（5个）:
     * 1. storage不可用 → Silent fail，使用mock数据
     * 2. 单词不存在 → 返回默认结构
     * 3. 数据格式错误 → 数据验证+降级
     * 4. 网络API失败 → 降级到storage/mock（预留）
     * 5. 重复查询 → 直接返回缓存
     * 
     * 数据来源优先级：
     * 1. storage缓存
     * 2. mock词典（并缓存）
     * 3. 将来扩展：真实API（ECDICT/有道/金山等）
     * 
     * Skills: development-discipline v5.2 (Iron Law 5: 失败场景优先)
     */
    async _getWordInfo(word) {
      try {
        // 场景2: 防御性检查 - word必须存在
        if (!word || typeof word !== 'string') {
          console.warn('[WordPopup] 单词无效')
          return this._getDefaultWordInfo(word || '')
        }

        const normalizedWord = word.toLowerCase().trim()
        console.log('[WordPopup] 查询单词:', normalizedWord)

        // 场景5: 先从storage缓存读取（Silent fail）
        const storageKey = `word_dict_${normalizedWord}`
        let wordInfo = null

        try {
          const cachedData = wx.getStorageSync(storageKey)
          if (cachedData && typeof cachedData === 'object') {
            // 场景3: 数据验证
            if (this._validateWordData(cachedData)) {
              console.log('[WordPopup] 从缓存加载单词')
              return cachedData
            } else {
              console.warn('[WordPopup] 缓存数据格式错误')
            }
          }
        } catch (error) {
          // 场景1: Silent fail - storage读取失败
          console.warn('[WordPopup] storage读取失败', error)
        }

        // 场景4（预留）: 将来可在此处调用真实API
        // try {
        //   wordInfo = await this._fetchFromAPI(normalizedWord)
        //   if (wordInfo) {
        //     this._cacheWordData(storageKey, wordInfo)
        //     return wordInfo
        //   }
        // } catch (error) {
        //   console.warn('[WordPopup] API查询失败，降级到mock', error)
        // }

        // 从mock词典获取
        wordInfo = this._getMockWordData(normalizedWord)
        
        // 缓存mock数据以便下次使用
        if (wordInfo && wordInfo.definition !== '释义查询中...') {
          this._cacheWordData(storageKey, wordInfo)
        }

        return wordInfo

      } catch (error) {
        // Silent fail: 不阻塞组件显示
        console.error('[WordPopup] 获取单词信息异常（Silent Fail）', error)
        return this._getDefaultWordInfo(word)
      }
    },

    /**
     * 获取mock词典数据（私有方法）
     * @private
     */
    _getMockWordData(word) {
      const mockDictionary = {
        'however': {
          word: 'however',
          phonetic: '/haʊˈevə(r)/',
          definition: 'adv. 然而，可是；无论如何 conj. 无论以何种方式',
          examples: [
            'However, this solution is not perfect.',
            'We must finish the work, however difficult it may be.'
          ]
        },
        'therefore': {
          word: 'therefore',
          phonetic: '/ˈðeəfɔː(r)/',
          definition: 'adv. 因此，所以',
          examples: [
            'He was ill, and therefore could not come.',
            'I think, therefore I am.'
          ]
        },
        'important': {
          word: 'important',
          phonetic: '/ɪmˈpɔːtnt/',
          definition: 'adj. 重要的；有地位的；有权力的',
          examples: [
            'This is an important decision.',
            'Health is more important than wealth.'
          ]
        },
        'develop': {
          word: 'develop',
          phonetic: '/dɪˈveləp/',
          definition: 'v. 发展；开发；研制；逐渐形成',
          examples: [
            'China is developing rapidly.',
            'Scientists are developing new vaccines.'
          ]
        }
      }

      return mockDictionary[word] || this._getDefaultWordInfo(word)
    },

    /**
     * 获取默认单词信息（私有方法）
     * @private
     */
    _getDefaultWordInfo(word) {
      return {
        word: word,
        phonetic: `/${word}/`,
        definition: '释义查询中...',
        examples: []
      }
    },

    /**
     * 验证单词数据格式（私有方法）
     * @private
     */
    _validateWordData(data) {
      return data &&
             typeof data.word === 'string' &&
             typeof data.phonetic === 'string' &&
             typeof data.definition === 'string' &&
             Array.isArray(data.examples)
    },

    /**
     * 缓存单词数据到storage（私有方法）
     * @private
     */
    _cacheWordData(key, data) {
      try {
        wx.setStorageSync(key, data)
        console.log('[WordPopup] 单词数据已缓存:', data.word)
      } catch (error) {
        // Silent fail: 缓存失败不影响使用
        console.warn('[WordPopup] 缓存数据失败', error)
      }
    },

    /**
     * 刷新同义词
     */
    onRefreshSynonyms() {
      const currentIndex = this.data.synonymGroupIndex
      const totalGroups = this.data.synonymGroups.length

      if (totalGroups === 0) {return}

      // 循环到下一组
      const nextIndex = (currentIndex + 1) % totalGroups

      this.setData({
        synonymGroupIndex: nextIndex,
        currentSynonyms: this.data.synonymGroups[nextIndex]
      })

      wx.showToast({
        title: '已切换',
        icon: 'none',
        duration: 500
      })

      // 触发事件
      this.triggerEvent('synonymrefresh', {
        groupIndex: nextIndex
      })
    },

    /**
     * 发音
     */
    onSpeak() {
      const { word } = this.data.wordData

      wx.showToast({
        title: `朗读: ${word}`,
        icon: 'none',
        duration: 1000
      })

      // TODO: 集成真实的TTS服务
      wx.vibrateShort()
    },

    /**
     * 加入生词本
     */
    onAddToVocab() {
      const { wordData } = this.data

      try {
        // 保存到生词本
        const vocabulary = wx.getStorageSync('user_vocabulary') || []

        if (!vocabulary.some(v => v.word === wordData.word)) {
          vocabulary.push({
            word: wordData.word,
            meaning: wordData.definition,
            phonetic: wordData.phonetic,
            addedTime: new Date().toISOString()
          })

          wx.setStorageSync('user_vocabulary', vocabulary)

          wx.showToast({
            title: '已加入生词本',
            icon: 'success'
          })
        } else {
          wx.showToast({
            title: '已在生词本中',
            icon: 'none'
          })
        }
      } catch (error) {
        console.error('❌ 加入生词本失败:', error)
        wx.showToast({
          title: '操作失败',
          icon: 'error'
        })
      }

      this.triggerEvent('addtovocab', {
        word: wordData
      })
    },

    /**
     * 加入薄弱点练习库
     */
    async onAddToWeakness() {
      const { wordData, context } = this.data

      await vocabularyCollector.collectWeakVocabulary(
        wordData,
        context,
        'manual_add'
      )

      wx.showToast({
        title: '已加入练习库',
        icon: 'success'
      })

      // 关闭弹窗
      setTimeout(() => {
        this.onClose()
      }, 1000)

      this.triggerEvent('addtoweakness', {
        word: wordData
      })
    },

    /**
     * 关闭弹窗
     */
    onClose() {
      this.setData({
        show: false
      })

      this.triggerEvent('close')
    }
  }
})

