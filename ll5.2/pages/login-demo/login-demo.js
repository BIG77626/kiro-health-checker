// pages/login-demo/login-demo.js
// Phase 1 演示页面：本地用户登录

const { container } = require('../../core/infrastructure/di/container')

Page({
  data: {
    email: '',
    password: '',
    loading: false
  },

  // 邮箱输入
  onEmailInput(e) {
    this.setData({ email: e.detail.value })
  },

  // 密码输入
  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
  },

  // 登录按钮
  async onLogin() {
    const { email, password } = this.data

    if (!email || !password) {
      wx.showToast({ title: '请输入邮箱和密码', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      // ⭐ 调用 LoginUserUseCase
      const loginUserUseCase = container.resolve('loginUserUseCase')
      const result = await loginUserUseCase.execute({ email, password })

      if (result.success) {
        wx.showToast({ title: result.message, icon: 'success' })
        
        // 保存登录状态到全局
        const app = getApp()
        app.globalData.currentUser = result.user
        
        // 跳转到首页
        setTimeout(() => {
          wx.switchTab({ url: '/pages/home/home' })
        }, 1500)
      } else {
        wx.showToast({ title: result.error, icon: 'none' })
      }
    } catch (error) {
      console.error('[LoginPage] Error:', error)
      wx.showToast({ title: '登录失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  },

  // 注册按钮
  async onRegister() {
    const { email, password } = this.data

    if (!email || !password) {
      wx.showToast({ title: '请输入邮箱和密码', icon: 'none' })
      return
    }

    this.setData({ loading: true })

    try {
      // ⭐ 调用 RegisterUserUseCase
      const registerUserUseCase = container.resolve('registerUserUseCase')
      const result = await registerUserUseCase.execute({
        email,
        password,
        nickname: email.split('@')[0] // 使用邮箱前缀作为昵称
      })

      if (result.success) {
        wx.showToast({ title: result.message, icon: 'success' })
        
        // 注册成功后自动登录
        setTimeout(() => {
          this.onLogin()
        }, 1000)
      } else {
        wx.showToast({ title: result.error, icon: 'none' })
      }
    } catch (error) {
      console.error('[LoginPage] Register error:', error)
      wx.showToast({ title: '注册失败', icon: 'none' })
    } finally {
      this.setData({ loading: false })
    }
  }
})

