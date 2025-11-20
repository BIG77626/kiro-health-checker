const IUserRepository = require('../../application/interfaces/IUserRepository')
const User = require('../../domain/entities/User')

/**
 * 用户仓储实现 - 本地存储版本
 * 
 * Phase 1: 只使用本地存储（IStorageAdapter），不涉及云端
 */
class UserRepositoryImpl extends IUserRepository {
  constructor(storageAdapter) {
    super()
    this.storageAdapter = storageAdapter
    this.USER_KEY_PREFIX = 'user_'
    this.EMAIL_INDEX_KEY = 'user_email_index' // email -> userId 映射
  }

  /**
   * 通过 email 查找用户
   */
  async findByEmail(email) {
    try {
      // 1. 从索引中查找 userId
      const emailIndex = await this.storageAdapter.get(this.EMAIL_INDEX_KEY) || {}
      const userId = emailIndex[email]
      
      if (!userId) {
        return null
      }
      
      // 2. 通过 userId 查找用户
      return await this.findById(userId)
    } catch (error) {
      console.error('[UserRepositoryImpl] findByEmail error:', error)
      return null
    }
  }

  /**
   * 通过 ID 查找用户
   */
  async findById(userId) {
    try {
      const key = `${this.USER_KEY_PREFIX}${userId}`
      const data = await this.storageAdapter.get(key)
      
      if (!data) {
        return null
      }
      
      return User.fromJSON(data)
    } catch (error) {
      console.error('[UserRepositoryImpl] findById error:', error)
      return null
    }
  }

  /**
   * 保存用户
   */
  async save(user) {
    try {
      // 验证
      const validation = user.validate()
      if (!validation.valid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`)
      }
      
      // 保存用户数据
      const key = `${this.USER_KEY_PREFIX}${user.id}`
      await this.storageAdapter.save(key, user.toJSON())
      
      // 更新 email 索引
      if (user.email) {
        const emailIndex = await this.storageAdapter.get(this.EMAIL_INDEX_KEY) || {}
        emailIndex[user.email] = user.id
        await this.storageAdapter.save(this.EMAIL_INDEX_KEY, emailIndex)
      }
      
      console.log('[UserRepositoryImpl] User saved:', user.id)
    } catch (error) {
      console.error('[UserRepositoryImpl] save error:', error)
      throw error
    }
  }

  /**
   * 更新用户
   */
  async update(user) {
    user.updatedAt = new Date().toISOString()
    await this.save(user)
  }

  /**
   * 删除用户
   */
  async delete(userId) {
    try {
      // 1. 获取用户（为了清理 email 索引）
      const user = await this.findById(userId)
      
      // 2. 删除用户数据
      const key = `${this.USER_KEY_PREFIX}${userId}`
      await this.storageAdapter.remove(key)
      
      // 3. 清理 email 索引
      if (user && user.email) {
        const emailIndex = await this.storageAdapter.get(this.EMAIL_INDEX_KEY) || {}
        delete emailIndex[user.email]
        await this.storageAdapter.save(this.EMAIL_INDEX_KEY, emailIndex)
      }
      
      console.log('[UserRepositoryImpl] User deleted:', userId)
    } catch (error) {
      console.error('[UserRepositoryImpl] delete error:', error)
      throw error
    }
  }

  /**
   * 获取学习统计数据
   */
  async getStudyStatistics(userId) {
    try {
      // 从学习记录中计算统计数据
      const studyRecords = await this.getStudyRecordsFromCloud(userId)

      if (studyRecords.length === 0) {
        return {
          studyDays: 0,
          totalStudyTime: 0,
          totalQuestions: 0,
          bestAccuracy: 0,
          lastStudyDate: null,
          averageAccuracy: 0,
          studyStreak: 0,
          strongestSubject: null,
          weakestSubject: null
        }
      }

      // 计算学习天数
      const uniqueDates = [...new Set(studyRecords.map(r => r.created_date?.split('T')[0]).filter(Boolean))]
      const studyDays = uniqueDates.length

      // 计算总学习时间（假设每道题耗时60秒）
      const totalStudyTime = Math.round((studyRecords.length * 60) / 3600) // 转换为小时

      // 计算总题数
      const totalQuestions = studyRecords.length

      // 计算每日正确率
      const dailyStats = {}
      studyRecords.forEach(record => {
        const date = record.created_date?.split('T')[0]
        if (!date) return

        if (!dailyStats[date]) {
          dailyStats[date] = { total: 0, correct: 0 }
        }
        dailyStats[date].total++
        if (record.is_correct) {
          dailyStats[date].correct++
        }
      })

      const accuracies = Object.values(dailyStats).map(day =>
        day.total > 0 ? Math.round((day.correct / day.total) * 100) : 0
      )

      const bestAccuracy = Math.max(...accuracies, 0)
      const averageAccuracy = accuracies.length > 0
        ? Math.round(accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length)
        : 0

      // 获取最后学习日期
      const lastStudyDate = studyRecords.length > 0
        ? studyRecords[0].created_date
        : null

      return {
        studyDays,
        totalStudyTime,
        totalQuestions,
        bestAccuracy,
        lastStudyDate,
        averageAccuracy,
        studyStreak: studyDays, // 简化为学习天数
        strongestSubject: 'reading', // 默认值
        weakestSubject: 'translation' // 默认值
      }

    } catch (error) {
      console.error('[UserRepositoryImpl] getStudyStatistics error:', error)
      // 返回默认统计数据
      return {
        studyDays: 0,
        totalStudyTime: 0,
        totalQuestions: 0,
        bestAccuracy: 0,
        lastStudyDate: null,
        averageAccuracy: 0,
        studyStreak: 0,
        strongestSubject: null,
        weakestSubject: null
      }
    }
  }

  /**
   * 保存学习记录
   */
  async saveStudyRecord(userId, record) {
    try {
      // 这里应该保存到云端，暂时使用本地存储作为模拟
      const key = `study_record_${userId}_${Date.now()}`
      await this.storageAdapter.save(key, {
        ...record,
        userId,
        created_date: new Date().toISOString()
      })
      console.log('[UserRepositoryImpl] Study record saved:', key)
    } catch (error) {
      console.error('[UserRepositoryImpl] saveStudyRecord error:', error)
      throw error
    }
  }

  /**
   * 同步用户数据到云端
   */
  async syncToCloud(userId, localRecords) {
    try {
      // 这里应该调用云函数同步数据
      // 暂时返回成功作为模拟
      console.log('[UserRepositoryImpl] Sync to cloud:', userId, localRecords.length, 'records')
      return true
    } catch (error) {
      console.error('[UserRepositoryImpl] syncToCloud error:', error)
      return false
    }
  }

  /**
   * 从云端获取学习记录
   */
  async getStudyRecordsFromCloud(userId, limit = 1000) {
    try {
      // 这里应该从云数据库获取学习记录
      // 暂时从本地存储获取作为模拟
      const allKeys = await this.storageAdapter.getAllKeys()
      const studyRecordKeys = allKeys.filter(key => key.startsWith(`study_record_${userId}_`))

      const records = []
      for (const key of studyRecordKeys.slice(0, limit)) {
        const record = await this.storageAdapter.get(key)
        if (record) {
          records.push(record)
        }
      }

      // 按创建时间倒序排序
      records.sort((a, b) => new Date(b.created_date) - new Date(a.created_date))

      return records
    } catch (error) {
      console.error('[UserRepositoryImpl] getStudyRecordsFromCloud error:', error)
      return []
    }
  }
}

module.exports = UserRepositoryImpl

