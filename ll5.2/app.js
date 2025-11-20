// app.js
const themeUtils = require('./utils/theme.js')
const ProjectPerformanceTest = require('./tools/project-performance-test')

// ✅ BehaviorTracker 相关导入（遵循 P1-001 Skill + ServiceContainer模式）
// Day3: 使用ServiceContainer统一管理服务
const ServiceContainer = require('./core/application/services/ServiceContainer')
const { BEHAVIOR_CONFIG } = require('./behavior-config')

App({
  onLaunch(options) {
    console.log('App Launch', options)
    
    // ==================== ServiceContainer 初始化（P1-001 Day 3 完整版）====================
    // ✅ GOOD: 使用ServiceContainer统一管理所有服务
    // ✅ GOOD: 符合clean-architecture的依赖注入模式
    // ✅ GOOD: Pages通过getApp().globalData.serviceContainer获取服务
    if (BEHAVIOR_CONFIG.enableSwitch) {
      try {
        console.log('[App] Initializing ServiceContainer...')
        
        // 初始化ServiceContainer（包含所有Adapters和Services）
        ServiceContainer.init({
          // API配置
          apiBaseUrl: 'https://api.example.com',  // TODO: 替换为实际生产API
          uploadTimeout: 30000,
          maxRetries: 3,
          retryDelay: 2000,
          
          // BehaviorTracker配置
          maxBufferSize: BEHAVIOR_CONFIG.maxBufferSize || 10,
          flushInterval: BEHAVIOR_CONFIG.flushInterval || 30000,
          
          // Logger配置（可选）
          logger: null  // TODO: 接入实际logger（如云监控）
        })
        
        // 保存到globalData供Pages使用
        this.globalData.serviceContainer = ServiceContainer
        
        // 获取BehaviorTracker实例
        const tracker = ServiceContainer.getBehaviorTracker()
        this.globalData.tracker = tracker
        
        console.log('[App] ServiceContainer initialized successfully')
      } catch (error) {
        console.error('[App] Failed to initialize ServiceContainer:', error)
        this.globalData.serviceContainer = null
        this.globalData.tracker = null
      }
    } else {
      console.log('[App] BehaviorTracker disabled by config')
      this.globalData.serviceContainer = null
      this.globalData.tracker = null
    }
    // ==============================================================================
    
    // ==================== 性能测试（临时，测试完可删除）====================
    const ENABLE_PERFORMANCE_TEST = true // ⭐ 测试时设为 true，完成后设为 false
    
    if (ENABLE_PERFORMANCE_TEST) {
      try {
        console.log('🚀 启动性能测试...')
        const perfTest = ProjectPerformanceTest.getInstance()
        perfTest.start()
        
        // 延迟1秒后测试存储性能（避免阻塞启动）
        setTimeout(() => {
          perfTest.testStorage()
        }, 1000)
        
        // 保存到 globalData，方便在页面和控制台中使用
        this.globalData.perfTest = perfTest
      } catch (error) {
        console.error('性能测试初始化失败:', error)
      }
    }
    // ===================================================================
    
    // 初始化主题设置
    this.initializeTheme()
    
    // ==================== Tokens v0.2: 自动跟随系统暗色 ====================
    const applyTheme = (theme) => {
      const cls = theme === 'dark' ? 'theme-dark' : '';
      const pages = getCurrentPages();
      pages.forEach(page => {
        if (page.setData) {
          page.setData({ themeClass: cls });
        }
      });
    };
    
    try {
      const sys = wx.getSystemInfoSync();
      if (sys.theme) {
        applyTheme(sys.theme);
      }
    } catch(e) {
      console.warn('Failed to get system theme:', e);
    }
    
    wx.onThemeChange(({ theme }) => {
      console.log('System theme changed to:', theme);
      applyTheme(theme);
    });
    // ====================================================================
    
    // 云开发环境配置 - 动态环境切换
    const ENV_CONFIG = {
      develop: process.env.DEV_ENV_ID || 'cloud1-dev-xxx',
      trial: process.env.TRIAL_ENV_ID || 'cloud1-trial-xxx',
      release: process.env.RELEASE_ENV_ID || 'cloud1-8gjntqqo65c84728'  // 使用环境变量，保留默认值
    }
    const currentEnv = __wxConfig.envVersion || 'develop'
    const ENV_ID = ENV_CONFIG[currentEnv]
    
    // 初始化云开发环境
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: ENV_ID, // 动态环境ID，根据当前环境自动切换
        traceUser: true,
      })
      console.log(`云开发环境初始化成功 [${currentEnv}]:`, ENV_ID)
    }
  },
  
  onShow(options) {
    console.log('App Show', options)
    
    // ==================== 网络恢复时自动重传（P1-001 Skill）====================
    // ✅ GOOD: 监听网络状态变化，自动触发离线重传
    if (this.globalData.tracker) {
      wx.onNetworkStatusChange((res) => {
        console.log('[App] Network status changed:', res.networkType)
        
        if (res.isConnected) {
          this.globalData.tracker.retryOffline().catch(e => {
            console.warn('[App] Network recovery retry failed:', e)
          })
        }
      })
    }
    // ===========================================================================
  },
  
  onHide() {
    console.log('App Hide')
  },
  
  onError(msg) {
    console.log('App Error', msg)
  },
  
  globalData: {
    userInfo: null,
    hasLogin: false,
    serviceContainer: null,  // ✅ ServiceContainer 全局单例（Day3新增）
    tracker: null  // ✅ BehaviorTracker 全局单例（在 onLaunch 中初始化）
  },
  
  /**
   * 初始化主题设置
   */
  async initializeTheme() {
    try {
      // 获取系统主题
      const systemTheme = themeUtils.detectSystemDarkMode() ? 'dark' : 'light'
      
      // 获取用户主题设置
      const userTheme = themeUtils.getCurrentTheme()
      
      // 如果用户没有设置主题，则使用系统主题
      if (!userTheme.theme) {
        themeUtils.setFollowSystem(true) // 跟随系统
      }
      
      console.log('主题初始化完成:', userTheme)
    } catch (error) {
      console.error('主题初始化失败:', error)
    }
  },
  
  // 🔧 调试功能 - 登录测试
  async testSimpleLogin() {
    try {
      console.log('=== 开始测试登录云函数 ===')
      
      // 模拟用户数据
      const testUserInfo = {
        nickName: '测试用户',
        avatarUrl: 'https://example.com/avatar.jpg',
        gender: 1,
        language: 'zh_CN',
        city: '北京',
        province: '北京',
        country: '中国'
      }
      
      console.log('【测试数据】', testUserInfo)
      
      // 调用云函数（不传入code，测试基本逻辑）
      const result = await wx.cloud.callFunction({
        name: 'login',
        data: {
          userInfo: testUserInfo
          // 不传入code，测试云函数是否能处理
        }
      })
      
      console.log('【云函数返回】', result)
      console.log('【result.result】', result.result)
      
      if (result.result.success) {
        console.log('✅ 登录成功！')
        console.log('用户信息:', result.result.data.userInfo)
        console.log('openid:', result.result.data.openid)
      } else {
        console.error('❌ 登录失败')
        console.error('错误信息:', result.result.message)
        console.error('错误详情:', result.result.error)
      }
      
    } catch (error) {
      console.error('【调用云函数出错】', error)
      console.error('错误对象:', error)
      console.error('错误码:', error.code)
      console.error('错误信息:', error.message)
    }
  },
  
  // 🔧 调试功能 - 快速测试云函数
  async quickTestCloudFunction() {
    try {
      console.log('=== 快速测试云函数 ===')
      
      const result = await wx.cloud.callFunction({
        name: 'login',
        data: {
          userInfo: {
            nickName: '快速测试',
            avatarUrl: 'https://example.com/test.jpg'
          }
        }
      })
      
      console.log('【云函数调用成功】', result)
      
      if (result.result.success) {
        console.log('✅ 云函数正常工作')
        console.log('返回数据:', result.result.data)
      } else {
        console.error('❌ 云函数返回错误:', result.result)
      }
      
    } catch (error) {
      console.error('【云函数调用失败】', error)
    }
  }
})
