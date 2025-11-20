/**
 * User 实体 - 领域层
 * 
 * Phase 1: 本地用户，使用 email/password
 * 
 * 职责：
 * - 表示用户的核心数据
 * - 完全独立于框架（无 wx、无 cloud）
 * - 包含密码验证等业务规则
 */
class User {
  constructor(data = {}) {
    // 处理null或undefined参数
    data = data || {}

    this.id = data.id || this._generateId()
    this.email = data.email || ''
    this.passwordHash = data.passwordHash || '' // 存储哈希，不存储明文
    this.nickname = data.nickname || '新用户'
    this.avatar = data.avatar || ''
    this.createdAt = data.createdAt || new Date().toISOString()
    this.updatedAt = data.updatedAt || new Date().toISOString()
  }

  _generateId() {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substr(2, 9)
    return `user_${timestamp}_${random}`
  }

  /**
   * 验证密码（简单版本，Phase 1 用）
   * @param {string} password - 明文密码
   * @returns {boolean}
   */
  verifyPassword(password) {
    if (!password) return false

    // Phase 1: 简单哈希（实际项目应使用 bcrypt 等）
    const hash = this._simpleHash(password)
    return hash === this.passwordHash
  }

  /**
   * 设置密码
   * @param {string} password - 明文密码
   */
  setPassword(password) {
    if (!password || password.length < 6) {
      throw new Error('密码至少6个字符')
    }
    this.passwordHash = this._simpleHash(password)
    this.updatedAt = new Date().toISOString()
  }

  /**
   * 简单哈希函数（仅用于 Phase 1 演示）
   * @private
   */
  _simpleHash(str) {
    if (!str) return '0'

    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
    return hash.toString(36)
  }

  /**
   * 验证用户数据
   */
  validate() {
    const errors = []
    
    if (!this.email || !this.email.includes('@') || !this.email.includes('.') ||
        this.email.startsWith('@') || this.email.endsWith('@') ||
        this.email.startsWith('.') || this.email.endsWith('.')) {
      errors.push('Invalid email')
    }
    
    if (!this.passwordHash) {
      errors.push('Password is required')
    }
    
    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * 序列化（用于存储）
   */
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      passwordHash: this.passwordHash,
      nickname: this.nickname,
      avatar: this.avatar,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    }
  }

  /**
   * 反序列化
   */
  static fromJSON(data) {
    return new User(data)
  }
}

module.exports = User

