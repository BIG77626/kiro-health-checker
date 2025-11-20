// utils/wrong-questions.js
// 错题收集和管理工具类（本地存储版本）

const STORAGE_KEY = 'wrong_questions_local'

/**
 * 错题收集器（使用本地存储�? */
class WrongQuestionCollector {
  /**
   * 获取本地存储的所有错�?   */
  _getLocalWrongQuestions() {
    try {
      const data = wx.getStorageSync(STORAGE_KEY)
      return data || []
    } catch (error) {
      console.error('💾 读取本地错题失败:', error)
      return []
    }
  }

  /**
   * 保存错题到本地存�?   */
  _saveLocalWrongQuestions(questions) {
    try {
      wx.setStorageSync(STORAGE_KEY, questions)
      return true
    } catch (error) {
      console.error('💾 保存本地错题失败:', error)
      return false
    }
  }

  /**
   * 收集错题
   * @param {Object} questionData - 题目数据
   * @param {String} userAnswer - 用户答案
   * @param {String} correctAnswer - 正确答案
   */
  collect(questionData, userAnswer, correctAnswer) {
    try {
      const questions = this._getLocalWrongQuestions()

      // 检查是否已存在
      const existingIndex = questions.findIndex(q => q.questionId === questionData.id)

      if (existingIndex >= 0) {
        // 更新错题记录
        questions[existingIndex] = {
          ...questions[existingIndex],
          userAnswer: userAnswer,
          correctAnswer: correctAnswer,
          wrongCount: (questions[existingIndex].wrongCount || 0) + 1,
          lastWrongTime: new Date().toISOString(),
          isMastered: false
        }
      } else {
        // 新增错题记录
        questions.push({
          questionId: questionData.id,
          questionType: questionData.type,
          questionContent: questionData.content,
          userAnswer: userAnswer,
          correctAnswer: correctAnswer,
          explanation: questionData.explanation,
          sourcePaperId: questionData.sourcePaperId,
          keywords: questionData.keywords || [],
          wrongCount: 1,
          firstWrongTime: new Date().toISOString(),
          lastWrongTime: new Date().toISOString(),
          isMastered: false
        })
      }

      this._saveLocalWrongQuestions(questions)
      console.log('✅ 错题已收集:', questionData.id)
    } catch (error) {
      console.error('❌ 错题收集失败:', error)
    }
  }

  /**
   * 获取错题列表
   * @param {Object} filters - 过滤条件
   */
  getWrongQuestions(filters = {}) {
    try {
      let questions = this._getLocalWrongQuestions()

      // 应用过滤器
      if (filters.questionType) {
        questions = questions.filter(q => q.questionType === filters.questionType)
      }

      // 按最后错误时间倒序排序
      questions.sort((a, b) =>
        new Date(b.lastWrongTime) - new Date(a.lastWrongTime)
      )

      return questions
    } catch (error) {
      console.error('❌ 获取错题列表失败:', error)
      return []
    }
  }

  /**
   * 标记错题为已复习（Issue #6: 调用API标记为已复习）
   * 
   * 失败场景（5个）:
   * 1. storage不可用 → Silent fail，返回false
   * 2. questionId不存在 → Silent fail，返回false
   * 3. 数据格式错误 → 数据验证+Silent fail
   * 4. 重复标记 → 直接返回true
   * 5. 快速操作 → 状态检查
   * 
   * Skills: development-discipline v5.2 (Iron Law 5: 失败场景优先)
   * 
   * @param {String} questionId - 题目 ID
   * @returns {Boolean} 是否标记成功
   */
  markAsReviewed(questionId) {
    try {
      // 场景2: 防御性检查 - questionId必须存在
      if (!questionId) {
        console.warn('❌ questionId不能为空')
        return false
      }

      console.log('[WrongQuestions] 标记错题为已复习:', questionId)

      // 场景1 & 3: 获取错题列表（Silent fail）
      const questions = this._getLocalWrongQuestions()
      if (!Array.isArray(questions)) {
        console.error('❌ 错题数据格式错误')
        return false
      }

      const index = questions.findIndex(q => q.questionId === questionId)

      if (index < 0) {
        // 场景2: 错题不存在
        console.warn('❌ 错题不存在:', questionId)
        return false
      }

      // 场景4: 检查是否已经标记
      if (questions[index].reviewed) {
        console.log('✅ 错题已经标记为已复习')
        return true
      }

      // 标记为已复习
      questions[index].reviewed = true
      questions[index].reviewedTime = new Date().toISOString()
      questions[index].reviewCount = (questions[index].reviewCount || 0) + 1

      // 保存到storage
      const saved = this._saveLocalWrongQuestions(questions)
      if (saved) {
        console.log('✅ 错题已标记为已复习:', questionId)
        return true
      } else {
        // 场景1: storage保存失败
        console.error('❌ 保存失败')
        return false
      }

    } catch (error) {
      // Silent fail: 不阻塞UI
      console.error('❌ 标记已复习失败（Silent Fail）:', error)
      return false
    }
  }

  /**
   * 标记错题为已掌握
   * @param {String} questionId - 题目 ID
   */
  markAsMastered(questionId) {
    try {
      const questions = this._getLocalWrongQuestions()
      const index = questions.findIndex(q => q.questionId === questionId)

      if (index >= 0) {
        questions[index].isMastered = true
        questions[index].masteredTime = new Date().toISOString()
        this._saveLocalWrongQuestions(questions)
        console.log('✅ 错题已标记为掌握:', questionId)
      }
    } catch (error) {
      console.error('❌ 标记掌握失败:', error)
    }
  }

  /**
   * 删除错题
   * @param {String} questionId - 题目 ID
   */
  deleteWrongQuestion(questionId) {
    try {
      let questions = this._getLocalWrongQuestions()
      questions = questions.filter(q => q.questionId !== questionId)
      this._saveLocalWrongQuestions(questions)
      console.log('✅ 错题已删除:', questionId)
    } catch (error) {
      console.error('❌ 删除错题失败:', error)
    }
  }

  /**
   * 获取错题统计
   */
  async getStatistics() {
    try {
      const allWrong = await this.getWrongQuestions()
      const mastered = allWrong.filter(q => q.isMastered)
      const unmastered = allWrong.filter(q => !q.isMastered)

      // 按题型分类
      const byType = {}
      allWrong.forEach(q => {
        const type = q.questionType || '未分类'
        byType[type] = (byType[type] || 0) + 1
      })

      return {
        total: allWrong.length,
        mastered: mastered.length,
        unmastered: unmastered.length,
        byType: byType
      }
    } catch (error) {
      console.error('❌ 获取错题统计失败:', error)
      return {
        total: 0,
        mastered: 0,
        unmastered: 0,
        byType: {}
      }
    }
  }

  /**
   * 清空所有已掌握的错�?   */
  clearMastered() {
    try {
      let questions = this._getLocalWrongQuestions()
      questions = questions.filter(q => !q.isMastered)
      this._saveLocalWrongQuestions(questions)
      console.log('🧹 已清空已掌握的错题')
      return true
    } catch (error) {
      console.error('❌ 清空已掌握错题失败:', error)
      return false
    }
  }
}

// 导出单例
const wrongQuestionCollector = new WrongQuestionCollector()

module.exports = {
  wrongQuestionCollector
}

