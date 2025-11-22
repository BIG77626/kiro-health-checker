/**
 * Storage缓存适配器（封装wx.storage）
 * 
 * 应用Skills:
 * - AI-CACHE-OPTIMIZATION v1.0
 * - clean-architecture v4.0 (封装平台API)
 * - development-discipline v5.0 (Silent Fail)
 * 
 * 功能: L2持久化缓存，响应时间<50ms
 * 平台: 微信小程序 wx.storage / Node fs
 * 容量: 默认500条
 */

const Logger = require('../logging/Logger')

class CacheStorageAdapter {
  constructor({ storageImpl, keyPrefix = 'ai_cache_' }) {
    this.storage = storageImpl; // wx 或 Node fs wrapper
    this.keyPrefix = keyPrefix;
  }

  /**
   * 获取缓存
   * 
   * @param {string} key
   * @returns {Promise<any|null>}
   * 
   * 失败场景:
   * - 键不存在 → 返回null
   * - JSON解析失败 → 返回null并删除损坏数据
   * - Storage错误 → 抛异常（由上层Silent Fail处理）
   */
  async get(key) {
    try {
      const value = await this._getStorage(key);
      
      if (!value) {
        return null;
      }

      // 尝试解析JSON
      try {
        return typeof value === 'string' ? JSON.parse(value) : value;
      } catch (parseError) {
        // 数据损坏，删除并返回null
        console.warn(`[CacheStorageAdapter] Corrupted data for key: ${key}, removing...`);
        await this.remove(key);
        return null;
      }

    } catch (error) {
      // 抛给上层处理（Silent Fail）
      Logger.error('CacheStorageAdapter', 'StorageGetFailed', {
        key: key,
        errorType: error.name || 'StorageError',
        errorMsg: error.message || 'Storage get failed',
        errorCode: 'ERR_CACHE_STORAGE_GET',
        fallback: 'throw_error',
        impact: 'feature_degradation'
      })
      throw new Error(`Storage get failed: ${error.message}`);
    }
  }

  /**
   * 设置缓存
   * 
   * @param {string} key
   * @param {any} value
   * @returns {Promise<void>}
   * 
   * 失败场景:
   * - Storage满 → 抛异常
   * - JSON序列化失败 → 抛异常
   */
  async set(key, value) {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await this._setStorage(key, serialized);
    } catch (error) {
      Logger.error('CacheStorageAdapter', 'StorageSetFailed', {
        key: key,
        errorType: error.name || 'StorageError',
        errorMsg: error.message || 'Storage set failed',
        errorCode: 'ERR_CACHE_STORAGE_SET',
        fallback: 'throw_error',
        impact: 'data_loss'
      })
      throw new Error(`Storage set failed: ${error.message}`);
    }
  }

  /**
   * 删除缓存
   * 
   * @param {string} key
   * @returns {Promise<void>}
   */
  async remove(key) {
    try {
      await this._removeStorage(key);
    } catch (error) {
      Logger.error('CacheStorageAdapter', 'StorageRemoveFailed', {
        key: key,
        errorType: error.name || 'StorageError',
        errorMsg: error.message || 'Storage remove failed',
        errorCode: 'ERR_CACHE_STORAGE_REMOVE',
        fallback: 'throw_error',
        impact: 'no_impact'
      })
      throw new Error(`Storage remove failed: ${error.message}`);
    }
  }

  /**
   * 获取所有匹配前缀的键
   * 
   * @param {string} prefix
   * @returns {Promise<string[]>}
   */
  async keys(prefix = this.keyPrefix) {
    try {
      // 微信小程序: wx.getStorageInfo().keys
      // Node: fs.readdirSync
      return await this._getStorageKeys(prefix);
    } catch (error) {
      Logger.error('CacheStorageAdapter', 'StorageKeysFailed', {
        prefix: prefix,
        errorType: error.name || 'StorageError',
        errorMsg: error.message || 'Storage keys failed',
        errorCode: 'ERR_CACHE_STORAGE_KEYS',
        fallback: 'throw_error',
        impact: 'feature_degradation'
      })
      throw new Error(`Storage keys failed: ${error.message}`);
    }
  }

  /**
   * 获取Storage信息
   * 
   * @returns {Promise<{currentSize: number, limitSize: number}>}
   */
  async getInfo() {
    try {
      return await this._getStorageInfo();
    } catch (error) {
      console.warn('[CacheStorageAdapter] getInfo failed:', error);
      Logger.warn('CacheStorageAdapter', 'GetInfoFailed', {
        errorType: error.name || 'StorageError',
        errorMsg: error.message || 'Get storage info failed',
        errorCode: 'ERR_CACHE_STORAGE_INFO',
        fallback: 'return_default_value',
        impact: 'no_impact'
      })
      return { currentSize: 0, limitSize: 10 * 1024 * 1024 }; // 默认10MB
    }
  }

  // ===== Private Methods: 平台抽象 =====

  /**
   * 平台无关的Storage读取
   */
  async _getStorage(key) {
    if (typeof wx !== 'undefined' && wx.getStorageSync) {
      // 微信小程序同步API
      try {
        return wx.getStorageSync(key);
      } catch (error) {
        Logger.error('CacheStorageAdapter', 'WxGetStorageSyncFailed', {
          key: key,
          errorType: error.name || 'WxError',
          errorMsg: error.message || 'wx.getStorageSync failed',
          errorCode: 'ERR_CACHE_STORAGE_WX_GET',
          fallback: 'throw_error',
          impact: 'feature_degradation'
        })
        throw error;
      }
    } else if (this.storage && this.storage.get) {
      // 自定义Storage实现
      return await this.storage.get(key);
    } else {
      // Node环境或测试环境
      throw new Error('No storage implementation available');
    }
  }

  /**
   * 平台无关的Storage写入
   */
  async _setStorage(key, value) {
    if (typeof wx !== 'undefined' && wx.setStorageSync) {
      // 微信小程序同步API
      try {
        wx.setStorageSync(key, value);
      } catch (error) {
        Logger.error('CacheStorageAdapter', 'WxSetStorageSyncFailed', {
          key: key,
          errorType: error.name || 'WxError',
          errorMsg: error.message || 'wx.setStorageSync failed',
          errorCode: 'ERR_CACHE_STORAGE_WX_SET',
          fallback: 'throw_error',
          impact: 'data_loss'
        })
        throw error;
      }
    } else if (this.storage && this.storage.set) {
      // 自定义Storage实现
      await this.storage.set(key, value);
    } else {
      throw new Error('No storage implementation available');
    }
  }

  /**
   * 平台无关的Storage删除
   */
  async _removeStorage(key) {
    if (typeof wx !== 'undefined' && wx.removeStorageSync) {
      try {
        wx.removeStorageSync(key);
      } catch (error) {
        Logger.error('CacheStorageAdapter', 'WxRemoveStorageSyncFailed', {
          key: key,
          errorType: error.name || 'WxError',
          errorMsg: error.message || 'wx.removeStorageSync failed',
          errorCode: 'ERR_CACHE_STORAGE_WX_REMOVE',
          fallback: 'throw_error',
          impact: 'no_impact'
        })
        throw error;
      }
    } else if (this.storage && this.storage.remove) {
      await this.storage.remove(key);
    } else {
      throw new Error('No storage implementation available');
    }
  }

  /**
   * 平台无关的获取所有键
   */
  async _getStorageKeys(prefix) {
    if (typeof wx !== 'undefined' && wx.getStorageInfoSync) {
      try {
        const info = wx.getStorageInfoSync();
        return info.keys.filter(key => key.startsWith(prefix));
      } catch (error) {
        Logger.error('CacheStorageAdapter', 'WxGetStorageInfoSyncFailed', {
          prefix: prefix,
          errorType: error.name || 'WxError',
          errorMsg: error.message || 'wx.getStorageInfoSync failed',
          errorCode: 'ERR_CACHE_STORAGE_WX_KEYS',
          fallback: 'throw_error',
          impact: 'feature_degradation'
        })
        throw error;
      }
    } else if (this.storage && this.storage.keys) {
      return await this.storage.keys(prefix);
    } else {
      return [];
    }
  }

  /**
   * 平台无关的获取Storage信息
   */
  async _getStorageInfo() {
    if (typeof wx !== 'undefined' && wx.getStorageInfoSync) {
      try {
        const info = wx.getStorageInfoSync();
        return {
          currentSize: info.currentSize * 1024, // KB → Bytes
          limitSize: info.limitSize * 1024
        };
      } catch (error) {
        Logger.error('CacheStorageAdapter', 'WxGetStorageInfoSyncFailed2', {
          errorType: error.name || 'WxError',
          errorMsg: error.message || 'wx.getStorageInfoSync failed in getInfo',
          errorCode: 'ERR_CACHE_STORAGE_WX_INFO',
          fallback: 'throw_error',
          impact: 'feature_degradation'
        })
        throw error;
      }
    } else if (this.storage && this.storage.getInfo) {
      return await this.storage.getInfo();
    } else {
      return { currentSize: 0, limitSize: 10 * 1024 * 1024 };
    }
  }
}

module.exports = CacheStorageAdapter;
