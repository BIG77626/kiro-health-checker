/**
 * 存储适配器接口
 * 定义所有存储操作的抽象接口，由 Infrastructure 层实现
 * 
 * @interface IStorageAdapter
 */
class IStorageAdapter {
  /**
   * 保存数据
   * @param {string} _key - 存储键
   * @param {any} _value - 要存储的值
   * @returns {Promise<void>}
   */
  async save(_key, _value) {
    throw new Error('IStorageAdapter.save() must be implemented')
  }

  /**
   * 读取数据
   * @param {string} _key - 存储键
   * @returns {Promise<any>} 存储的值，如果不存在返回 null
   */
  async get(_key) {
    throw new Error('IStorageAdapter.get() must be implemented')
  }

  /**
   * 删除数据
   * @param {string} _key - 存储键
   * @returns {Promise<void>}
   */
  async remove(_key) {
    throw new Error('IStorageAdapter.remove() must be implemented')
  }

  /**
   * 清空所有数据
   * @returns {Promise<void>}
   */
  async clear() {
    throw new Error('IStorageAdapter.clear() must be implemented')
  }

  /**
   * 检查键是否存在
   * @param {string} _key - 存储键
   * @returns {Promise<boolean>}
   */
  async has(_key) {
    throw new Error('IStorageAdapter.has() must be implemented')
  }
}

module.exports = IStorageAdapter

