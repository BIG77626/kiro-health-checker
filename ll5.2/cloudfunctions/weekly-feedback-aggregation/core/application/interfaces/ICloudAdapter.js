/**
 * 云端适配器接口
 *
 * 定义云端服务的基本操作契约
 * 包括云函数调用、文件上传下载等功能
 */
class ICloudAdapter {
  /**
   * 调用云函数
   * @param {string} functionName - 云函数名称
   * @param {Object} data - 调用参数
   * @returns {Promise<Object>} 调用结果
   */
  async callFunction(functionName, data = {}) {
    throw new Error('Method callFunction() must be implemented')
  }

  /**
   * 上传文件
   * @param {Object} options - 上传选项
   * @returns {Promise<Object>} 上传结果
   */
  async uploadFile(options) {
    throw new Error('Method uploadFile() must be implemented')
  }

  /**
   * 下载文件
   * @param {Object} options - 下载选项
   * @returns {Promise<Object>} 下载结果
   */
  async downloadFile(options) {
    throw new Error('Method downloadFile() must be implemented')
  }

  /**
   * 删除文件
   * @param {string} fileID - 文件ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteFile(fileID) {
    throw new Error('Method deleteFile() must be implemented')
  }
}

module.exports = ICloudAdapter
