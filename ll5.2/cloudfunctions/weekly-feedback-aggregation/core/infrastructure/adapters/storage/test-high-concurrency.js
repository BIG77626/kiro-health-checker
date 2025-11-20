// 高并发测试脚本：验证WeChatStorageAdapter在高负载下的资源管理
// 用于解决"EMFILE: too many open files"错误

const WeChatStorageAdapter = require('./WeChatStorageAdapter');

// 模拟微信环境
global.wx = {
  getStorage: (options) => {
    // 模拟随机延迟，模拟真实环境
    const delay = Math.random() * 50 + 10; // 10-60ms随机延迟
    setTimeout(() => {
      if (options.key.startsWith('test-key-')) {
        options.success({ data: `test-value-${options.key.split('-')[2]}` });
      } else {
        // 模拟失败情况
        options.fail({ errMsg: 'data not found' });
      }
    }, delay);
  },
  setStorage: (options) => {
    const delay = Math.random() * 50 + 10; // 10-60ms随机延迟
    setTimeout(() => options.success(), delay);
  },
  removeStorage: (options) => {
    const delay = Math.random() * 50 + 10; // 10-60ms随机延迟
    setTimeout(() => options.success(), delay);
  },
  clearStorage: (options) => {
    const delay = Math.random() * 50 + 10; // 10-60ms随机延迟
    setTimeout(() => options.success(), delay);
  },
  getStorageInfo: (options) => {
    const delay = Math.random() * 30 + 5; // 5-35ms随机延迟
    setTimeout(() => options.success({ keys: [] }), delay);
  },
  getLogManager: () => ({
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  })
};

async function testHighConcurrency() {
  console.log('开始高并发测试...');
  
  // 创建适配器实例
  const adapter = new WeChatStorageAdapter();
  
  // 初始状态检查
  console.log('初始状态:', adapter.getStatus());
  
  try {
    // 执行大量并发操作
    const promises = [];
    const operationCount = 100; // 100个并发操作
    
    for (let i = 0; i < operationCount; i++) {
      // 混合不同类型的操作
      if (i % 4 === 0) {
        promises.push(adapter.save(`test-key-${i}`, `test-value-${i}`));
      } else if (i % 4 === 1) {
        promises.push(adapter.get(`test-key-${i-1}`));
      } else if (i % 4 === 2) {
        promises.push(adapter.has(`test-key-${i-2}`));
      } else {
        promises.push(adapter.remove(`test-key-${i-3}`));
      }
    }
    
    // 等待所有操作完成
    await Promise.all(promises);
    
    // 检查状态
    console.log('操作完成后状态:', adapter.getStatus());
    
    // 清理资源
    adapter.destroy();
    
    // 检查清理后状态
    console.log('清理后状态:', adapter.getStatus());
    
    console.log('高并发测试完成！');
  } catch (error) {
    console.error('测试过程中发生错误:', error);
    adapter.destroy();
  }
}

async function testMemoryLeak() {
  console.log('\n开始内存泄漏测试...');
  
  // 创建适配器实例
  const adapter = new WeChatStorageAdapter();
  
  try {
    // 重复创建和销毁操作，测试是否有内存泄漏
    for (let round = 0; round < 5; round++) {
      console.log(`\n第 ${round + 1} 轮测试:`);
      
      // 执行操作
      const promises = [];
      for (let i = 0; i < 20; i++) {
        promises.push(adapter.save(`round-${round}-key-${i}`, `round-${round}-value-${i}`));
        promises.push(adapter.get(`round-${round}-key-${i}`));
      }
      
      await Promise.all(promises);
      
      // 检查状态
      const status = adapter.getStatus();
      console.log(`状态: ${JSON.stringify(status)}`);
      
      // 验证资源是否正确释放
      if (status.activeLocks > 0 || status.activeRequests > 0 || status.pendingOperations > 0) {
        console.warn('警告：检测到未释放的资源!');
      }
      
      // 短暂延迟
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // 清理资源
    adapter.destroy();
    
    console.log('\n内存泄漏测试完成！');
  } catch (error) {
    console.error('测试过程中发生错误:', error);
    adapter.destroy();
  }
}

// 运行测试
async function runTests() {
  await testHighConcurrency();
  await testMemoryLeak();
}

runTests().catch(console.error);