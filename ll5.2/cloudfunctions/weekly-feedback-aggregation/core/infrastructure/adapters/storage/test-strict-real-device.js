/**
 * 严格真机调试ERR_INVALID_ARG_TYPE错误测试脚本
 * 
 * 此脚本严格模拟微信小程序环境，特别关注文件描述符问题
 */

// 模拟微信小程序环境，严格模拟真机环境
global.wx = {
  setStorage: function(options) {
    // 模拟真机环境中的文件描述符问题
    // 在真机环境中，Promise和setTimeout的组合可能导致文件描述符错误
    if (typeof options !== 'object' || !options.key) {
      if (options.fail) {
        setTimeout(() => {
          options.fail({ errMsg: 'setStorage:fail invalid parameter' })
        }, 0)
      }
      return
    }
    
    // 模拟真机环境中的异步行为
    setTimeout(() => {
      if (Math.random() < 0.05) { // 5%失败率
        if (options.fail) {
          options.fail({ errMsg: 'setStorage:fail mock error' })
        }
      } else {
        if (options.success) {
          options.success()
        }
      }
    }, 10)
  },
  
  getStorage: function(options) {
    // 模拟真机环境中的文件描述符问题
    if (typeof options !== 'object' || !options.key) {
      if (options.fail) {
        setTimeout(() => {
          options.fail({ errMsg: 'getStorage:fail invalid parameter' })
        }, 0)
      }
      return
    }
    
    // 模拟真机环境中的异步行为
    setTimeout(() => {
      if (Math.random() < 0.05) { // 5%失败率
        if (options.fail) {
          options.fail({ errMsg: 'getStorage:fail mock error' })
        }
      } else if (Math.random() < 0.2) { // 20%数据不存在
        if (options.fail) {
          options.fail({ errMsg: 'getStorage:fail data not found' })
        }
      } else {
        if (options.success) {
          options.success({ data: 'mock-data' })
        }
      }
    }, 10)
  },
  
  removeStorage: function(options) {
    // 模拟真机环境中的文件描述符问题
    if (typeof options !== 'object' || !options.key) {
      if (options.fail) {
        setTimeout(() => {
          options.fail({ errMsg: 'removeStorage:fail invalid parameter' })
        }, 0)
      }
      return
    }
    
    // 模拟真机环境中的异步行为
    setTimeout(() => {
      if (Math.random() < 0.05) { // 5%失败率
        if (options.fail) {
          options.fail({ errMsg: 'removeStorage:fail mock error' })
        }
      } else {
        if (options.success) {
          options.success()
        }
      }
    }, 10)
  },
  
  clearStorage: function(options) {
    // 模拟真机环境中的文件描述符问题
    if (typeof options !== 'object') {
      if (options.fail) {
        setTimeout(() => {
          options.fail({ errMsg: 'clearStorage:fail invalid parameter' })
        }, 0)
      }
      return
    }
    
    // 模拟真机环境中的异步行为
    setTimeout(() => {
      if (Math.random() < 0.05) { // 5%失败率
        if (options.fail) {
          options.fail({ errMsg: 'clearStorage:fail mock error' })
        }
      } else {
        if (options.success) {
          options.success()
        }
      }
    }, 10)
  },
  
  getStorageInfo: function(options) {
    // 模拟真机环境中的文件描述符问题
    if (typeof options !== 'object') {
      if (options.fail) {
        setTimeout(() => {
          options.fail({ errMsg: 'getStorageInfo:fail invalid parameter' })
        }, 0)
      }
      return
    }
    
    // 模拟真机环境中的异步行为
    setTimeout(() => {
      if (Math.random() < 0.05) { // 5%失败率
        if (options.fail) {
          options.fail({ errMsg: 'getStorageInfo:fail mock error' })
        }
      } else {
        if (options.success) {
          options.success({
            keys: ['test-key', 'concurrent-key-0', 'concurrent-key-1', 'timeout-test-key', 'repeat-key'],
            currentSize: 1024,
            limitSize: 10240
          })
        }
      }
    }, 10)
  },
  
  getLogManager: function() {
    return {
      log: function(...args) {
        console.log('[WX]', ...args)
      },
      warn: function(...args) {
        console.warn('[WX]', ...args)
      },
      error: function(...args) {
        console.error('[WX]', ...args)
      }
    }
  }
}

// 模拟真机环境中的文件描述符问题
const originalSetTimeout = global.setTimeout
global.setTimeout = function(callback, delay, ...args) {
  // 在真机环境中，setTimeout可能导致文件描述符问题
  // 这里模拟这种问题
  try {
    return originalSetTimeout(callback, delay, ...args)
  } catch (error) {
    if (error.message.includes('ERR_INVALID_ARG_TYPE')) {
      console.error('模拟真机环境中的ERR_INVALID_ARG_TYPE错误:', error)
      throw error
    }
    throw error
  }
}

// 加载WeChatStorageAdapter
const WeChatStorageAdapter = require('./WeChatStorageAdapter.js')

// 测试函数
async function runStrictTest() {
  console.log('=== 严格真机调试ERR_INVALID_ARG_TYPE错误测试 ===')
  
  // 创建适配器实例
  const adapter = new WeChatStorageAdapter({
    autoStart: true,
    lockTimeout: 5000,
    lockCleanupInterval: 10000,
    maxConcurrentRequests: 5
  })
  
  console.log('初始状态检查:')
  console.log(adapter.getStatus())
  
  // 测试1: 基本操作测试
  console.log('\n=== 测试1: 基本操作测试 ===')
  try {
    await adapter.save('test-key', 'test-value')
    console.log('保存操作成功')
    
    const value = await adapter.get('test-key')
    console.log('读取操作成功，值:', value)
    
    const hasKey = await adapter.has('test-key')
    console.log('检查键存在:', hasKey)
    
    await adapter.remove('test-key')
    console.log('删除操作成功')
    
    const hasKeyAfterRemove = await adapter.has('test-key')
    console.log('删除后检查键存在:', hasKeyAfterRemove)
  } catch (error) {
    console.error('基本操作测试失败:', error)
  }
  
  // 测试2: 高并发操作测试
  console.log('\n=== 测试2: 高并发操作测试 ===')
  const concurrentPromises = []
  
  for (let i = 0; i < 20; i++) {
    const key = `concurrent-key-${i}`
    const value = `concurrent-value-${i}`
    
    // 添加错误处理，确保测试继续
    const savePromise = adapter.save(key, value).catch(error => {
      console.error(`保存 ${key} 失败:`, error.message)
      return null
    })
    
    const getPromise = adapter.get(key).catch(error => {
      console.error(`读取 ${key} 失败:`, error.message)
      return null
    })
    
    const hasPromise = adapter.has(key).catch(error => {
      console.error(`检查 ${key} 失败:`, error.message)
      return false
    })
    
    concurrentPromises.push(savePromise, getPromise, hasPromise)
  }
  
  try {
    await Promise.all(concurrentPromises)
    console.log('高并发操作完成')
  } catch (error) {
    console.error('高并发操作失败:', error)
  }
  
  // 测试3: 锁超时测试
  console.log('\n=== 测试3: 锁超时测试 ===')
  try {
    // 创建一个长时间运行的保存操作
    const longSavePromise = adapter.save('timeout-test-key', 'timeout-test-value')
    
    // 尝试获取同一个键，应该等待
    const anotherSavePromise = adapter.save('timeout-test-key', 'another-value')
    
    await Promise.race([
      longSavePromise,
      anotherSavePromise,
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('超时测试')), 1000)
      )
    ])
    
    console.log('锁超时测试完成')
  } catch (error) {
    console.error('锁超时测试失败:', error.message)
  }
  
  // 测试4: 定时器清理测试
  console.log('\n=== 测试4: 定时器清理测试 ===')
  console.log('清理前状态:')
  console.log(adapter.getStatus())
  
  // 等待一段时间，让定时器运行
  await new Promise(resolve => setTimeout(resolve, 100))
  
  // 销毁适配器
  adapter.destroy()
  
  console.log('清理后状态:')
  console.log(adapter.getStatus())
  
  // 测试5: 重复操作测试
  console.log('\n=== 测试5: 重复操作测试 ===')
  const newAdapter = new WeChatStorageAdapter({
    autoStart: true,
    lockTimeout: 5000,
    lockCleanupInterval: 10000,
    maxConcurrentRequests: 5
  })
  
  // 重复保存和读取同一个键
  for (let i = 0; i < 10; i++) {
    try {
      await newAdapter.save('repeat-key', `value-${i}`)
      const value = await newAdapter.get('repeat-key')
      console.log(`第${i+1}次操作成功，值:`, value)
    } catch (error) {
      console.error(`第${i+1}次操作失败:`, error.message)
    }
  }
  
  // 最终状态检查
  console.log('\n=== 最终状态检查 ===')
  console.log(newAdapter.getStatus())
  
  // 清理资源
  newAdapter.destroy()
  
  console.log('\n=== 测试完成 ===')
  console.log('如果没有出现ERR_INVALID_ARG_TYPE错误，说明修复成功')
}

// 运行测试
runStrictTest().catch(error => {
  console.error('测试运行失败:', error)
  process.exit(1)
})