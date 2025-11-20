/**
 * Weekly Feedback Aggregation Cloud Function
 * 
 * 功能: 每周聚合用户反馈，生成Prompt优化建议
 * 触发: 定时触发（每周日凌晨2点 - Cron: 0 2 * * 0）
 * 执行: P1-004 FeedbackAggregationService
 * 
 * === 开发前检查清单 ===
 * [x] cloud-function-development: 目录结构正确
 * [x] cloud-function-development: package.json配置完整
 * [x] cloud-function-development: config.json触发器正确
 * [x] cloud-function-development: Cron表达式已验证
 * [x] development-discipline: 失败场景已考虑
 * [x] development-discipline: 错误处理完整
 * [x] development-discipline: 日志输出完整
 * 
 * @see /.claude/skills/quick-refs/CLOUD-FUNCTION-DEVELOPMENT.md
 * @see /.claude/skills/quick-refs/development-discipline.md
 */

const cloud = require('wx-server-sdk');

// 初始化云开发环境
cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

/**
 * 云函数入口函数
 * 
 * @param {Object} event - 触发事件对象
 * @param {Object} context - 云函数上下文
 * @returns {Promise<Object>} 执行结果
 * 
 * 返回格式:
 * {
 *   success: boolean,
 *   duration: number,
 *   metadata: {
 *     rawCount: number,
 *     qualityCount: number,
 *     patternCount: number,
 *     suggestionCount: number
 *   },
 *   reason: string
 * }
 */
exports.main = async (event, context) => {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log('='.repeat(80));
  console.log('[CloudFunction] Weekly Feedback Aggregation Started');
  console.log('[CloudFunction] Timestamp:', timestamp);
  console.log('[CloudFunction] Event:', JSON.stringify(event || {}, null, 2));
  console.log('='.repeat(80));
  
  try {
    // ==================== Phase 1: 初始化ServiceContainer ====================
    
    console.log('[CloudFunction] Phase 1: Initializing ServiceContainer');
    
    // 动态require（云函数环境中）
    // 注意：云函数中需要将ll5.2目录也上传，或者使用云函数依赖
    const ServiceContainer = require('./core/application/services/ServiceContainer');
    
    // 初始化配置（云环境专用logger）
    const config = {
      logger: {
        log: (...args) => console.log('[ServiceContainer]', ...args),
        info: (...args) => console.log('[ServiceContainer]', ...args),
        warn: (...args) => console.warn('[ServiceContainer]', ...args),
        error: (...args) => console.error('[ServiceContainer]', ...args)
      },
      // 云函数特定配置
      aggregationTimeout: 15000,  // 15秒（云函数总共20秒）
      minFeedbackCount: 50
    };
    
    ServiceContainer.init(config);
    console.log('[CloudFunction] ServiceContainer initialized successfully');
    
    // ==================== Phase 2: 执行反馈聚合 ====================
    
    console.log('[CloudFunction] Phase 2: Starting feedback aggregation');
    
    const aggregationService = ServiceContainer.getFeedbackAggregationService();
    const result = await aggregationService.aggregateFeedback();
    
    console.log('[CloudFunction] Aggregation completed');
    console.log('[CloudFunction] Result metadata:', JSON.stringify(result.metadata, null, 2));
    
    // ==================== Phase 3: 记录结果并返回 ====================
    
    const duration = Date.now() - startTime;
    
    console.log('='.repeat(80));
    console.log('[CloudFunction] Execution Summary:');
    console.log('[CloudFunction]   Duration:', duration, 'ms');
    console.log('[CloudFunction]   Reason:', result.reason || 'success');
    console.log('[CloudFunction]   Raw Count:', result.metadata.rawCount || 0);
    console.log('[CloudFunction]   Quality Count:', result.metadata.qualityCount || 0);
    console.log('[CloudFunction]   Pattern Count:', result.metadata.patternCount || 0);
    console.log('[CloudFunction]   Suggestion Count:', result.metadata.suggestionCount || 0);
    console.log('='.repeat(80));
    
    // 构造返回结果
    const response = {
      success: true,
      duration,
      timestamp,
      metadata: result.metadata,
      reason: result.reason || 'success',
      suggestions: result.suggestions.map(s => ({
        title: s.title,
        priority: s.priority,
        source: s.source
      })) // 只返回摘要，不返回完整内容（节省流量）
    };
    
    console.log('[CloudFunction] Completed successfully');
    
    // Iron Law 5: 即使成功也要返回，避免云函数认为超时
    return response;
    
  } catch (error) {
    // ==================== 错误处理（Iron Law 5） ====================
    
    const duration = Date.now() - startTime;
    
    console.error('='.repeat(80));
    console.error('[CloudFunction] ERROR OCCURRED');
    console.error('[CloudFunction] Duration before error:', duration, 'ms');
    console.error('[CloudFunction] Error message:', error.message);
    console.error('[CloudFunction] Error stack:');
    console.error(error.stack);
    console.error('='.repeat(80));
    
    // 记录错误详情（用于调试）
    if (error.code) {
      console.error('[CloudFunction] Error code:', error.code);
    }
    if (error.cause) {
      console.error('[CloudFunction] Error cause:', error.cause);
    }
    
    // 返回错误结果但success=false，避免云函数重试
    // Iron Law: 不抛出异常，返回success: false
    const errorResponse = {
      success: false,
      duration,
      timestamp: new Date().toISOString(),
      error: {
        message: error.message,
        stack: error.stack,
        code: error.code || 'UNKNOWN_ERROR'
      },
      metadata: {
        rawCount: 0,
        qualityCount: 0,
        patternCount: 0,
        suggestionCount: 0
      }
    };
    
    console.error('[CloudFunction] Returning error response:', JSON.stringify(errorResponse, null, 2));
    
    return errorResponse;
  }
};

// ==================== 本地测试入口（Iron Law 4） ====================

if (require.main === module) {
  console.log('[LocalTest] Starting local mock test...');
  console.log('[LocalTest] This will test the cloud function logic locally');
  console.log('='.repeat(80));
  
  // Mock事件对象
  const mockEvent = {
    userInfo: {
      appId: 'local-test',
      openId: 'test-user'
    },
    trigger: 'manual',  // 手动触发（非定时器）
    timestamp: Date.now()
  };
  
  // Mock上下文对象
  const mockContext = {
    memory_limit_in_mb: 256,
    time_limit_in_ms: 20000,
    request_id: 'local-test-' + Date.now(),
    environ: 'local'
  };
  
  // 执行测试
  exports.main(mockEvent, mockContext)
    .then(result => {
      console.log('='.repeat(80));
      console.log('[LocalTest] Test completed successfully');
      console.log('[LocalTest] Result:', JSON.stringify(result, null, 2));
      console.log('='.repeat(80));
      process.exit(0);
    })
    .catch(error => {
      console.error('='.repeat(80));
      console.error('[LocalTest] Test failed with error:');
      console.error('[LocalTest] Message:', error.message);
      console.error('[LocalTest] Stack:', error.stack);
      console.error('='.repeat(80));
      process.exit(1);
    });
}
