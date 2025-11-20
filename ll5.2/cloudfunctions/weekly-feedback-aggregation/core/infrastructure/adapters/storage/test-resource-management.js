// 测试脚本：验证WeChatStorageAdapter的资源管理
// 用于解决"EMFILE: too many open files"错误

const WeChatStorageAdapter = require('./WeChatStorageAdapter');

// 模拟微信环境
global.wx = {
  getStorage: (options) => {
    // 模拟成功情况
    if (options.key === 'test-key') {
      setTimeout(() => options.success({ data: 'test-value' }), 10);
    } else if (options.key.startsWith('test-key-')) {
      setTimeout(() => options.success({ data: `test-value-${options.key.split('-')[2]}` }), 10);
    } else {
      // 模拟失败情况
      setTimeout(() => options.fail({ errMsg: 'data not found' }), 10);
    }
  },
  setStorage: (options) => {
    setTimeout(() => options.success(), 10);
  },
  removeStorage: (options) => {
    setTimeout(() => options.success(), 10);
  },
  clearStorage: (options) => {
    setTimeout(() => options.success(), 10);
  },
  getStorageInfo: (options) => {
    setTimeout(() => options.success({ keys: [] }), 10);
  },
  getLogManager: () => ({
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info
  })
};

async function testResourceManagement() {
  console.log('开始测试资源管理...');
  
  // 创建适配器实例
  const adapter = new WeChatStorageAdapter();
  
  // 初始状态检查
  console.log('初始状态:', adapter.getStatus());
  
  try {
    // 执行多个操作
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(adapter.save(`test-key-${i}`, `test-value-${i}`));
      promises.push(adapter.get(`test-key-${i}`));
    }
    
    // 等待所有操作完成
    await Promise.all(promises);
    
    // 检查状态
    console.log('操作完成后状态:', adapter.getStatus());
    
    // 清理资源
    adapter.destroy();
    
    // 检查清理后状态
    console.log('清理后状态:', adapter.getStatus());
    
    console.log('资源管理测试完成！');
  } catch (error) {
    console.error('测试过程中发生错误:', error);
    adapter.destroy();
  }
}

// 运行测试
testResourceManagement().catch(console.error);