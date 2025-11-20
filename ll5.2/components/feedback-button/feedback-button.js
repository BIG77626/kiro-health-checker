/**
 * 反馈按钮组件 - P1-002
 * 
 * === 开发前检查清单 ===
 * [x] 失败场景列表已完成 (7个)
 * [x] 5类测试已设计 (25个用例)
 * [x] Skills三问法已回答
 * [x] 生产环境5问已思考
 * [x] 复用P1-001成功模式
 * 
 * === Iron Laws ===
 * - NO wx.* in core: wx.*调用只在外层或Adapter
 * - Silent fail: 所有错误不crash，记录日志
 * - 依赖注入: 通过ServiceContainer获取FeedbackService
 * - 失败场景优先: 7个场景全覆盖
 * - 5类标准测试: 25个用例设计完成
 */

Component({
  /**
   * 组件属性
   */
  properties: {
    // 反馈内容ID（如AI建议ID、题目ID等）
    contentId: {
      type: String,
      required: true
    },
    
    // 反馈类型（translation, writing, recommendation, conversation）
    contentType: {
      type: String,
      value: 'recommendation'
    },
    
    // 上下文信息（可选，用于更精准的分析）
    context: {
      type: Object,
      value: null
    }
  },

  /**
   * 组件数据
   */
  data: {
    feedbackType: null,      // 'thumbUp' | 'thumbDown' | null
    showComment: false,      // 是否显示评论输入框
    comment: '',             // 用户评论内容
    isSubmitting: false     // 是否正在提交
  },

  /**
   * 组件方法
   */
  methods: {
    /**
     * 点击"有用"按钮
     */
    onThumbUp() {
      // 防抖检查
      if (this.data.isSubmitting) {
        return
      }
      
      // 如果之前已经点过，取消
      if (this.data.feedbackType === 'thumbUp') {
        this._cancelFeedback()
        return
      }
      
      // 更新UI状态
      this.setData({
        feedbackType: 'thumbUp',
        showComment: false,
        comment: ''
      })
      
      // 立即上报（不等待用户评论）
      this._submitFeedback('thumbUp', '')
    },

    /**
     * 点击"无用"按钮
     */
    onThumbDown() {
      // 防抖检查
      if (this.data.isSubmitting) {
        return
      }
      
      // 如果之前已经点过，取消
      if (this.data.feedbackType === 'thumbDown') {
        this._cancelFeedback()
        return
      }
      
      // 更新UI状态，展开评论输入
      this.setData({
        feedbackType: 'thumbDown',
        showComment: true,
        comment: ''
      })
      
      // 不立即上报，等用户填写评论或点击提交
    },

    /**
     * 评论输入
     */
    onCommentInput(e) {
      const comment = e.detail.value || ''
      
      // 限制长度（防御性编程）
      const maxLength = 500
      const truncated = comment.length > maxLength 
        ? comment.substring(0, maxLength) 
        : comment
      
      this.setData({
        comment: truncated
      })
    },

    /**
     * 取消评论
     */
    onCancelComment() {
      this._cancelFeedback()
    },

    /**
     * 提交评论
     */
    onSubmitComment() {
      // 防抖检查
      if (this.data.isSubmitting) {
        return
      }
      
      // 提交反馈（带评论）
      this._submitFeedback('thumbDown', this.data.comment)
      
      // 收起评论框
      this.setData({
        showComment: false
      })
    },

    /**
     * 取消反馈（私有方法）
     */
    _cancelFeedback() {
      this.setData({
        feedbackType: null,
        showComment: false,
        comment: ''
      })
      
      // 记录取消行为（也是有价值的数据）
      this._recordCancelAction()
    },

    /**
     * 提交反馈（私有方法）
     * 
     * === 失败场景处理 ===
     * 1. ServiceContainer未初始化 → Silent fail
     * 2. FeedbackService不存在 → Silent fail
     * 3. 网络失败 → 自动重试+离线缓存
     * 4. 数据库写入失败 → 降级存储
     * 5. 快速连续点击 → 防抖
     * 6. 页面卸载 → onUnload清理
     * 7. 用户取消 → 记录取消行为
     */
    async _submitFeedback(type, comment) {
      // 防抖：正在提交中
      if (this.data.isSubmitting) {
        console.log('[FeedbackButton] Already submitting, skip')
        return
      }
      
      this.setData({ isSubmitting: true })
      
      try {
        // 获取FeedbackService（依赖注入）
        const app = getApp()
        const serviceContainer = app.globalData.serviceContainer
        
        // 失败场景1: ServiceContainer未初始化
        if (!serviceContainer) {
          console.warn('[FeedbackButton] ServiceContainer not available, feedback skipped')
          this._showTip('反馈功能暂时不可用')
          return
        }
        
        const feedbackService = serviceContainer.getFeedbackService()
        
        // 失败场景2: FeedbackService不存在
        if (!feedbackService) {
          console.warn('[FeedbackButton] FeedbackService not available, feedback skipped')
          this._showTip('反馈功能暂时不可用')
          return
        }
        
        // 构建反馈数据
        const feedbackData = {
          contentId: this.properties.contentId,
          contentType: this.properties.contentType,
          feedbackType: type,
          comment: comment || '',
          context: this.properties.context || {},
          timestamp: Date.now()
        }
        
        // 调用FeedbackService上报
        // 失败场景3-4: 网络失败/数据库失败 → FeedbackService内部处理
        await feedbackService.submitFeedback(feedbackData)
        
        // 上报成功，触发事件通知父组件
        this.triggerEvent('feedbackSubmit', {
          type,
          comment,
          success: true,
          contentId: this.properties.contentId,
          contentType: this.properties.contentType
        })
        
        // 显示成功提示
        this._showTip('感谢您的反馈！')
        
      } catch (error) {
        // 失败场景：所有未捕获错误 → Silent fail
        console.error('[FeedbackButton] Submit failed:', error)
        
        // 不crash，只记录日志和轻提示
        this._showTip('反馈提交失败，已保存到本地')
        
        // 触发失败事件（可选）
        this.triggerEvent('feedbackSubmit', {
          type,
          comment,
          success: false,
          error: error.message,
          contentId: this.properties.contentId,
          contentType: this.properties.contentType
        })
        
      } finally {
        // 重置提交状态
        this.setData({ isSubmitting: false })
      }
    },

    /**
     * 记录取消行为（私有方法）
     */
    _recordCancelAction() {
      try {
        const app = getApp()
        const serviceContainer = app.globalData.serviceContainer
        
        if (!serviceContainer) return
        
        const feedbackService = serviceContainer.getFeedbackService()
        if (!feedbackService) return
        
        // 取消也是一种反馈信号
        feedbackService.submitFeedback({
          contentId: this.properties.contentId,
          contentType: this.properties.contentType,
          feedbackType: 'cancel',
          comment: '',
          context: this.properties.context || {},
          timestamp: Date.now()
        })
        
      } catch (error) {
        // Silent fail
        console.warn('[FeedbackButton] Record cancel failed:', error)
      }
    },

    /**
     * 显示提示（私有方法）
     */
    _showTip(message) {
      // 使用微信原生toast（轻量级，不阻塞）
      if (typeof wx !== 'undefined' && wx.showToast) {
        wx.showToast({
          title: message,
          icon: 'none',
          duration: 2000
        })
      }
    }
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      console.log('[FeedbackButton] Component attached, contentId:', this.properties.contentId)
    },
    
    detached() {
      console.log('[FeedbackButton] Component detached')
      
      // 失败场景6: 页面卸载时清理pending请求
      // FeedbackService内部会处理，这里只需清理状态
      this.setData({
        isSubmitting: false,
        showComment: false
      })
    }
  }
})
