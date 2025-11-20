/**
 * 骨架屏组件
 * 
 * 应用Skills:
 * - development-discipline v5.0 (Silent Fail)
 * - clean-architecture v4.0 (可复用组件)
 * 
 * 功能: 加载占位UI，提升用户体验
 * 性能: 立即渲染 <50ms
 */

Component({
  /**
   * 组件属性
   */
  properties: {
    // 是否显示骨架屏
    show: {
      type: Boolean,
      value: true
    },
    
    // 页面类型: 'practice' | 'vocabulary' | 'profile'
    type: {
      type: String,
      value: 'practice'
    },
    
    // 最小显示时间（ms）- 避免闪烁
    minDisplayTime: {
      type: Number,
      value: 300
    }
  },

  /**
   * 组件数据
   */
  data: {
    startTime: 0
  },

  /**
   * 组件生命周期
   */
  lifetimes: {
    attached() {
      // 记录开始时间（用于最小显示时间控制）
      this.setData({
        startTime: Date.now()
      })
    }
  },

  /**
   * 组件方法
   */
  methods: {
    /**
     * 隐藏骨架屏（带最小显示时间控制）
     * 
     * 失败场景: 
     * - 数据加载太快导致闪烁
     * 
     * 解决: 保证最小显示时间
     */
    hide() {
      const elapsed = Date.now() - this.data.startTime
      const delay = Math.max(0, this.properties.minDisplayTime - elapsed)

      setTimeout(() => {
        this.triggerEvent('hidden')
      }, delay)
    },

    /**
     * 显示骨架屏
     */
    show() {
      this.setData({
        startTime: Date.now()
      })
      this.triggerEvent('shown')
    }
  }
})
