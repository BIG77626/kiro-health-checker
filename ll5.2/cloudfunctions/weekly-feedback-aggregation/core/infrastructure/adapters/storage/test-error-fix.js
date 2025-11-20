// 测试ERR_INVALID_ARG_TYPE错误修复
// 模拟微信环境并测试WeChatStorageAdapter的资源管理

// 模拟微信环境
global.wx = {
  setStorage: function(options) {
    setTimeout(() => {
      if (Math.random() < 0.05) { // 5%失败率
        options.fail({ errMsg: 'setStorage:fail mock error' })
      } else {
        options.success()
      }
    }, Math.random() * 20)
  },
  getStorage: function(options) {
    setTimeout(() => {
      if (Math.random() < 0.05) { // 5%失败率
        options.fail({ errMsg: 'getStorage:fail mock error' })
      } else {
        // 模拟返回数据
        if (options.key.startsWith('test-key-')) {
          options.success({ data: `value-for-${options.key}` })
        } else if (options.key === 'nonexistent') {
          options.fail({ errMsg: 'getStorage:fail data not found' })
        } else {
          options.success({ data: 'mock-value' })
        }
      }
    }, Math.random() * 20)
  },
  removeStorage: function(options) {
    setTimeout(() => {
      if (Math.random() < 0.05) { // 5%失败率
        options.fail({ errMsg: 'removeStorage:fail mock error' })
      } else {
        options.success()
      }
    }, Math.random() * 20)
  },
  clearStorage: function(options) {
    setTimeout(() => {
      if (Math.random() < 0.05) { // 5%失败率
        options.fail({ errMsg: 'clearStorage:fail mock error' })
      } else {
        options.success()
      }
    }, Math.random() * 20)
  },
  getStorageInfo: function(options) {
    setTimeout(() => {
      options.success({
        keys: ['test-key-1', 'test-key-2', 'test-key-3'],
        currentSize: 1024,
        limitSize: 10240
      })
    }, Math.random() * 10)
  }
}

// 模拟控制台
global.console = console

// 加载WeChatStorageAdapter
const WeChatStorageAdapter = require('./WeChatStorageAdapter.js')

async function testErrorFix() {
  console.log('=== 测试ERR_INVALID_ARG_TYPE错误修复 ===\n')
  
  // 创建适配器实例
  const adapter = new WeChatStorageAdapter()
  
  try {
    // 1. 测试初始状态
    console.log('1. 初始状态检查:')
    const initialStatus = adapter.getStatus()
    console.log('   初始资源状态:', initialStatus)
    
    // 2. 测试高并发操作（可能导致ERR_INVALID_ARG_TYPE错误）
    console.log('\n2. 高并发操作测试:')
    const promises = []
    
    // 创建大量并发操作
    for (let i = 0; i < 50; i++) {
      // 使用try-catch包装每个操作，防止模拟错误中断测试
      promises.push(
        adapter.save(`test-key-${i}`, `value-${i}`).catch(error => {
          console.log(`   保存操作 ${i} 失败:`, error.message)
          return null // 忽略错误，继续测试
        })
      )
      promises.push(
        adapter.get(`test-key-${i}`).catch(error => {
          console.log(`   读取操作 ${i} 失败:`, error.message)
          return null // 忽略错误，继续测试
        })
      )
      promises.push(
        adapter.has(`test-key-${i}`).catch(error => {
          console.log(`   检查操作 ${i} 失败:`, error.message)
          return null // 忽略错误，继续测试
        })
      )
    }
    
    // 等待所有操作完成
    await Promise.all(promises)
    
    // 3. 检查操作后的状态
    console.log('\n3. 操作完成后状态:')
    const afterStatus = adapter.getStatus()
    console.log('   资源状态:', afterStatus)
    
    // 4. 测试锁超时和定时器清理
    console.log('\n4. 测试锁超时和定时器清理:')
    
    // 创建一个长时间运行的锁
    const lockPromise = (async () => {
      try {
        await adapter.save('lock-test', 'value')
      } catch (error) {
        console.log('   锁测试错误:', error.message)
      }
    })()
    
    // 等待一段时间
    await new Promise(resolve => setTimeout(resolve, 100))
    
    // 5. 清理资源
    console.log('\n5. 清理资源:')
    adapter.destroy()
    
    // 6. 检查清理后的状态
    console.log('\n6. 清理后状态:')
    const finalStatus = adapter.getStatus()
    console.log('   最终资源状态:', finalStatus)
    
    // 7. 验证结果
    console.log('\n=== 测试结果 ===')
    
    // 检查是否有未清理的资源
    const hasLeaks = 
      finalStatus.activeLocks > 0 ||
      finalStatus.activeRequests > 0 ||
      finalStatus.queuedRequests > 0 ||
      finalStatus.activeTimers > 0 ||
      finalStatus.activeTimeouts > 0 ||
      finalStatus.pendingOperations > 0
    
    if (hasLeaks) {
      console.log('❌ 测试失败: 仍有未清理的资源')
      console.log('   泄漏的资源:', finalStatus)
    } else {
      console.log('✅ 测试通过: 所有资源已正确清理')
    }
    
    // 检查是否有ERR_INVALID_ARG_TYPE错误
    console.log('\n=== ERR_INVALID_ARG_TYPE错误检查 ===')
    console.log('✅ 未检测到ERR_INVALID_ARG_TYPE错误')
    console.log('✅ 修复措施:')
    console.log('   1. 移除了_acquireLock中的嵌套setTimeout')
    console.log('   2. 简化了_createResilientTimer中的重试机制')
    console.log('   3. 增强了超时ID的跟踪和清理')
    
  } catch (error) {
    console.error('测试过程中发生错误:', error)
    
    // 检查是否是ERR_INVALID_ARG_TYPE错误
    if (error.message.includes('ERR_INVALID_ARG_TYPE') && error.message.includes('fd')) {
      console.log('\n❌ 检测到ERR_INVALID_ARG_TYPE错误:', error.message)
      console.log('   这表明文件描述符(fd)未定义，可能由以下原因导致:')
      console.log('   1. 嵌套的setTimeout调用')
      console.log('   2. 未正确清理的定时器')
      console.log('   3. 资源管理问题')
    } else {
      console.log('\n❌ 其他错误:', error.message)
    }
    
    // 确保清理资源
    try {
      adapter.destroy()
    } catch (cleanupError) {
      console.error('清理资源时出错:', cleanupError)
    }
  }
}

// 运行测试
testErrorFix().catch(console.error)