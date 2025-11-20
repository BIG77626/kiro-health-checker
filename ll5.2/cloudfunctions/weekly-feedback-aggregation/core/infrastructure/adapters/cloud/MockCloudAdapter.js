/**
 * Mock云端适配器
 *
 * 用于测试环境的云端功能模拟
 * 提供与WeChatCloudAdapter相同的接口
 */
const ICloudAdapter = require('../../../application/interfaces/ICloudAdapter')

class MockCloudAdapter extends ICloudAdapter {
  constructor() {
    super()
    this.mockData = {
      login: {
        success: true,
        data: {
          userInfo: {
            nickName: 'Mock User',
            avatarUrl: 'https://example.com/avatar.jpg',
            gender: 1,
            country: 'China',
            province: 'Guangdong',
            city: 'Shenzhen'
          },
          openid: 'mock_openid_12345',
          sessionKey: 'mock_session_key_abcdef'
        }
      }
    }
  }

  /**
   * 模拟调用云函数
   * @param {string} functionName - 云函数名称
   * @param {Object} data - 调用参数
   * @returns {Promise<Object>} 调用结果
   */
  async callFunction(functionName, data = {}) {
    console.log(`[MockCloudAdapter] 调用云函数: ${functionName}`, data)

    // 模拟网络延迟
    await new Promise(resolve => setTimeout(resolve, 100))

    switch (functionName) {
      case 'login':
        return {
          success: true,
          message: '登录成功',
          data: this.mockData.login.data
        }

      default:
        return {
          success: false,
          message: `未实现的云函数: ${functionName}`,
          error: { code: 'NOT_IMPLEMENTED' }
        }
    }
  }

  /**
   * 模拟上传文件
   * @param {Object} options - 上传选项
   * @returns {Promise<Object>} 上传结果
   */
  async uploadFile(options) {
    console.log('[MockCloudAdapter] 模拟文件上传:', options)

    await new Promise(resolve => setTimeout(resolve, 200))

    return {
      success: true,
      message: '文件上传成功',
      data: {
        fileID: `mock_file_${Date.now()}`,
        url: 'https://example.com/mock_file.jpg'
      }
    }
  }

  /**
   * 模拟下载文件
   * @param {Object} options - 下载选项
   * @returns {Promise<Object>} 下载结果
   */
  async downloadFile(options) {
    console.log('[MockCloudAdapter] 模拟文件下载:', options)

    await new Promise(resolve => setTimeout(resolve, 150))

    return {
      success: true,
      message: '文件下载成功',
      data: {
        tempFilePath: '/mock/temp/file.jpg'
      }
    }
  }

  /**
   * 模拟删除文件
   * @param {string} fileID - 文件ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteFile(fileID) {
    console.log('[MockCloudAdapter] 模拟删除文件:', fileID)

    await new Promise(resolve => setTimeout(resolve, 50))

    return {
      success: true,
      message: '文件删除成功'
    }
  }
}

module.exports = MockCloudAdapter
